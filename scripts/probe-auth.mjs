import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = `probe.${Date.now()}@1stbuyer.test`
const password = 'ProbePassword!2026'

console.log('1. signUp as anon...')
const { data: signUp, error: signUpErr } = await anon.auth.signUp({ email, password })
if (signUpErr) {
  console.log('   ERROR:', signUpErr.message, `(status ${signUpErr.status})`)
} else {
  console.log('   user created:', Boolean(signUp.user))
  console.log('   SESSION RETURNED:', Boolean(signUp.session), signUp.session ? '=> email confirmation is OFF' : '=> email confirmation is ON')
  console.log('   confirmed_at:', signUp.user?.confirmed_at ?? 'null')
}

if (signUp?.user) {
  console.log('\n2. did handle_new_user create a profile row?')
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('id, email, created_at')
    .eq('id', signUp.user.id)
    .maybeSingle()
  console.log('   profile row:', prof ? `yes (${prof.email})` : `no ${profErr?.message ?? ''}`)

  console.log('\n3. signInWithPassword...')
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password })
  console.log('   session:', Boolean(signIn?.session), signInErr ? `error: ${signInErr.message}` : '')

  if (signIn?.session) {
    console.log('\n4. can the signed-in user read only their own profile?')
    const scoped = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    })
    const { data: mine } = await scoped.from('profiles').select('id,email')
    console.log('   rows visible:', mine?.length ?? 0)

    const { error: updErr } = await scoped
      .from('profiles')
      .update({ full_name: 'Probe User', city: 'Durban', province: 'KwaZulu-Natal' })
      .eq('id', signIn.session.user.id)
    console.log('   own update:', updErr ? `refused: ${updErr.message}` : 'allowed')

    const { data: after } = await scoped.from('profiles').select('full_name, location').maybeSingle()
    console.log('   generated location column:', JSON.stringify(after?.location))
  }

  console.log('\n5. cleaning up the probe user...')
  const { error: delErr } = await admin.auth.admin.deleteUser(signUp.user.id)
  console.log('   deleted:', delErr ? delErr.message : 'yes')
}
