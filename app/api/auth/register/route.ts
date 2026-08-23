import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

/**
 * Sign-up.
 *
 * WHY THIS ROUTE EXISTS, STATED PLAINLY
 *
 * This project has email confirmation switched on and no custom SMTP, so
 * Supabase tries to send a confirmation mail on every sign-up and its built-in
 * mailer allows only a couple per hour. Straight client-side signUp() therefore
 * fails with "email rate limit exceeded" for the third person who tries it.
 *
 * So sign-up runs here instead: the service role creates the user already
 * confirmed, no mail is sent, and the browser then signs in normally with the
 * password. The service key never leaves the server.
 *
 * THE TRADE-OFF, ALSO STATED PLAINLY
 *
 * This bypasses email verification. Anyone can register an address they do not
 * own. For a prototype whose email is only an identifier that is a reasonable
 * trade; before real money or real personal data flows through this, either
 * turn on a custom SMTP provider and use the normal confirmation flow, or add
 * a verification step here. This is recorded in supabase/README.md rather than
 * left for someone to discover.
 */

const MIN_PASSWORD = 8

export async function POST(request: Request) {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'Accounts are not available right now.' },
      { status: 503 },
    )
  }

  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  // Validate here too: a client-side check is a convenience, not a control.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD} characters.` },
      { status: 400 },
    )
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    const text = error.message.toLowerCase()
    const alreadyExists =
      text.includes('already') || text.includes('registered') || text.includes('exists')

    // An existing account is reported as such, because the user needs to know
    // to sign in instead. Everything else stays generic.
    return NextResponse.json(
      {
        error: alreadyExists
          ? 'There is already an account with that email address. Try signing in instead.'
          : 'We could not create the account. Try again in a moment.',
      },
      { status: alreadyExists ? 409 : 400 },
    )
  }

  // The handle_new_user trigger has already created the profiles row. Nothing
  // else is written here: the browser signs in and fills in its own profile
  // under its own row level security.
  return NextResponse.json({ ok: true, userId: data.user?.id ?? null })
}
