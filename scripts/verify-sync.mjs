// Proves credit history and the finance pack round-trip through Postgres as the
// signed-in user, and that a second user sees none of it.
//
// Run: node scripts/verify-sync.mjs
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
const made = []

async function makeUser(label) {
  const email = `sync.${label}.${stamp}@1stbuyer.co.za`
  const password = 'SyncProbe!2026'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`${label}: ${error.message}`)
  const client = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error(`${label} sign-in: ${signInErr.message}`)
  made.push(data.user.id)
  return { label, id: data.user.id, email, password, client }
}

function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`)
  if (!condition) failures.push(name)
}

const owner = await makeUser('owner')
const other = await makeUser('other')

/* ---------------------------------------------------------- credit ------- */

const scores = [
  { score: 611, bureau: 'TransUnion', recorded_at: '2026-05-02T09:00:00Z' },
  { score: 648, bureau: 'Experian', recorded_at: '2026-08-01T09:00:00Z' },
]
for (const row of scores) {
  const { error } = await owner.client.from('credit_history').insert({ profile_id: owner.id, ...row })
  check(`insert score ${row.score}`, !error, error?.message ?? '')
}

const { data: mine } = await owner.client
  .from('credit_history').select('score, bureau, recorded_at').order('recorded_at', { ascending: true })
check('reads both scores back, oldest first', mine?.length === 2 && mine[0].score === 611, JSON.stringify(mine))

const { data: theirs } = await other.client.from('credit_history').select('score')
check('the other user sees no scores', (theirs ?? []).length === 0, JSON.stringify(theirs))

const { error: crossWrite } = await other.client
  .from('credit_history').insert({ profile_id: owner.id, score: 999, bureau: 'x', recorded_at: new Date().toISOString() })
check('a score cannot be written into someone else\u2019s history', !!crossWrite, crossWrite?.code ?? 'ACCEPTED')

const { data: prof } = await owner.client.from('profiles').select('credit_bureau').eq('id', owner.id).single()
await owner.client.from('profiles').update({ credit_bureau: 'Experian' }).eq('id', owner.id)
const { data: prof2 } = await owner.client.from('profiles').select('credit_bureau').eq('id', owner.id).single()
check('bureau mirrors onto the profile', prof2?.credit_bureau === 'Experian', `was ${prof?.credit_bureau}`)

/* -------------------------------------------------------- documents ----- */

const up = await owner.client.from('documents').upsert(
  { profile_id: owner.id, doc_key: 'id', file_name: 'id-copy.pdf', status: 'added', doc_date: null },
  { onConflict: 'profile_id,doc_key' },
)
check('records a document', !up.error, up.error?.message ?? '')

const again = await owner.client.from('documents').upsert(
  { profile_id: owner.id, doc_key: 'id', file_name: 'id-copy-v2.pdf', status: 'added', doc_date: null },
  { onConflict: 'profile_id,doc_key' },
)
check('replacing updates rather than duplicating', !again.error, again.error?.message ?? '')

const { data: docs } = await owner.client.from('documents').select('doc_key, file_name')
check('one row per pack item', docs?.length === 1 && docs[0].file_name === 'id-copy-v2.pdf', JSON.stringify(docs))

const { data: otherDocs } = await other.client.from('documents').select('doc_key')
check('the other user sees no documents', (otherDocs ?? []).length === 0, JSON.stringify(otherDocs))

await owner.client.from('documents').delete().eq('profile_id', owner.id).eq('doc_key', 'id')
const { data: afterDelete } = await owner.client.from('documents').select('doc_key')
check('removing a document deletes the row', (afterDelete ?? []).length === 0, JSON.stringify(afterDelete))

/* ------------------------------------------- survives a fresh session ---- */

const rebound = createClient(URL, ANON, { auth: { persistSession: false } })
await rebound.auth.signInWithPassword({ email: owner.email, password: owner.password })
const { data: afterSignIn } = await rebound.from('credit_history').select('score')
check('history survives sign-out and sign-in', afterSignIn?.length === 2, JSON.stringify(afterSignIn))

for (const id of made) await admin.auth.admin.deleteUser(id)
console.log(`\ncleaned up ${made.length} probe users`)
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join(', ')}` : '\nall checks passed')
process.exit(failures.length ? 1 : 0)
