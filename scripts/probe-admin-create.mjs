import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = `probe.${Date.now()}@1stbuyer.co.za`
const password = 'ProbePassword!2026'

console.log('1. admin.createUser with email_confirm (sends no email)...')
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
})
console.log('   ', createErr ? `ERROR: ${createErr.message}` : `created, confirmed_at=${created.user?.confirmed_at ? 'set' : 'null'}`)

if (created?.user) {
  const { data: prof } = await admin.from('profiles').select('id,email,location').eq('id', created.user.id).maybeSingle()
  console.log('2. handle_new_user profile row:', prof ? `yes (${prof.email})` : 'NO')

  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password })
  console.log('3. client sign-in:', signIn?.session ? 'session returned' : `failed: ${signInErr?.message}`)

  if (signIn?.session) {
    const scoped = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    })
    const { data: mine } = await scoped.from('profiles').select('id,email')
    console.log('4. profiles visible to this user:', mine?.length ?? 0)

    const { error: updErr } = await scoped.from('profiles')
      .update({ full_name: 'Probe User', city: 'Durban', province: 'KwaZulu-Natal', monthly_income: 21000 })
      .eq('id', signIn.session.user.id)
    console.log('5. update own profile:', updErr ? `refused: ${updErr.message}` : 'allowed')

    const { data: after } = await scoped.from('profiles').select('full_name,location,monthly_income').maybeSingle()
    console.log('6. read back:', JSON.stringify(after))

    // Can this user reach anyone else's row, or a staff-only table?
    const { data: others } = await scoped.from('profiles').select('id').neq('id', signIn.session.user.id)
    console.log('7. other users visible:', others?.length ?? 0)
    const { data: audit, error: auditErr } = await scoped.from('staff_audit_logs').select('id')
    console.log('8. staff_audit_logs:', auditErr ? `refused (${auditErr.code})` : `${audit?.length ?? 0} rows`)
    const { data: newCars } = await scoped.from('new_cars').select('id').limit(3)
    console.log('9. new_cars readable:', newCars?.length ?? 0, 'rows')
  }

  await admin.auth.admin.deleteUser(created.user.id)
  console.log('10. probe user deleted')
}
