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

for (const domain of ['example.com', 'demo.1stbuyer.co.za', 'mailinator.com', 'gmail.com']) {
  const email = `probe.${Date.now()}@${domain}`
  const { data, error } = await anon.auth.signUp({ email, password: 'ProbePassword!2026' })
  if (error) {
    console.log(`${domain.padEnd(22)} rejected: ${error.message}`)
  } else {
    console.log(`${domain.padEnd(22)} accepted | session: ${Boolean(data.session)} | confirmed_at: ${data.user?.confirmed_at ?? 'null'}`)
    if (data.user) await admin.auth.admin.deleteUser(data.user.id)
  }
}
