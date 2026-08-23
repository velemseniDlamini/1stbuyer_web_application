// Proves isolation between two real signed-in users, against the live project.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const failures = []
const stamp = Date.now()
const users = []

async function makeUser(label) {
  const email = `rls.${label}.${stamp}@1stbuyer.co.za`
  const password = 'RlsProbe!2026'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`${label}: ${error.message}`)
  const client = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error(`${label} sign-in: ${signInErr.message}`)
  await client.from('profiles').update({ full_name: `${label} person`, city: label }).eq('id', data.user.id)
  users.push({ label, id: data.user.id, email, client })
  return users[users.length - 1]
}

const alice = await makeUser('alice')
const bob = await makeUser('bob')
console.log(`two real users created\n`)

// 1. Each sees exactly one profile: their own.
for (const u of users) {
  const { data } = await u.client.from('profiles').select('id, full_name, city')
  const ids = (data ?? []).map((r) => r.id)
  console.log(`${u.label}: sees ${ids.length} profile(s) ${ids[0] === u.id ? '(their own)' : '(WRONG ROW)'}`)
  if (ids.length !== 1 || ids[0] !== u.id) failures.push(`${u.label} saw ${ids.length} rows`)
}

// 2. Targeting the other user's id by hand returns nothing.
const { data: peek } = await alice.client.from('profiles').select('id, full_name').eq('id', bob.id)
console.log(`alice querying bob's id directly: ${peek?.length ?? 0} row(s)`)
if ((peek?.length ?? 0) !== 0) failures.push('alice could read bob by id')

// 3. Writing to the other user's row changes nothing.
const { error: writeErr } = await alice.client
  .from('profiles').update({ full_name: 'HACKED', monthly_income: 999999 }).eq('id', bob.id)
const { data: bobAfter } = await admin.from('profiles').select('full_name, monthly_income').eq('id', bob.id).single()
console.log(`alice writing to bob's row: ${writeErr ? `refused (${writeErr.code})` : 'no error returned'}; bob.full_name is still "${bobAfter.full_name}"`)
if (bobAfter.full_name === 'HACKED') failures.push('alice overwrote bob')

// 4. Sensitive columns are unreachable through the support view.
const { data: dir, error: dirErr } = await alice.client.from('buyer_directory').select('*')
console.log(`alice reading buyer_directory: ${dirErr ? `refused (${dirErr.code})` : `${dir?.length ?? 0} row(s)`}`)
if ((dir?.length ?? 0) > 1) failures.push('buyer_directory leaked other buyers to a plain user')

// 5. Staff tables stay closed to a buyer.
for (const table of ['staff_audit_logs', 'system_settings', 'tickets']) {
  const { data, error } = await alice.client.from(table).select('*').limit(5)
  console.log(`alice reading ${table}: ${error ? `refused (${error.code})` : `${data?.length ?? 0} row(s)`}`)
  if ((data?.length ?? 0) > 0) failures.push(`alice read ${data.length} rows from ${table}`)
}

// 6. Role escalation attempt.
const { error: roleErr } = await alice.client.from('profiles').update({ role: 'super_admin' }).eq('id', alice.id)
const { data: aliceRole } = await admin.from('profiles').select('role').eq('id', alice.id).single()
console.log(`alice self-promoting to super_admin: ${roleErr ? `refused (${roleErr.code})` : 'no error'}; role is "${aliceRole.role}"`)
if (aliceRole.role !== 'buyer') failures.push('a buyer escalated their own role')

for (const u of users) await admin.auth.admin.deleteUser(u.id)
console.log('\nprobe users deleted')

if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`)
  failures.forEach((f) => console.log(`  - ${f}`))
  process.exit(1)
}
console.log('\nIsolation holds: each user reads and writes only their own row.')
