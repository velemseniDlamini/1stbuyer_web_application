import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { normalisePath, type DeviceClass } from '@/lib/analytics-visits'
import { callerKey, checkRateLimit } from '@/lib/guardian/rate-limit'

/**
 * Records one page view.
 *
 * Runs with the service role because `app_visits` has row level security with
 * no policies: no browser can write to it directly, which is what stops anyone
 * from forging visits by hand against the anon key.
 *
 * The client token is hashed here and the raw value is discarded. The server
 * therefore never stores something that could be replayed into a browser to
 * impersonate a visitor, and the hash is useless after the token rotates.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEVICES: DeviceClass[] = ['phone', 'tablet', 'desktop']

/**
 * A per-process salt, so the stored hash cannot be reversed by hashing every
 * plausible token. It is regenerated on restart, which is fine: the token it
 * protects only lives 24 hours anyway.
 */
const SALT = process.env.VISIT_HASH_SALT ?? createHash('sha256')
  .update(String(process.pid) + String(Date.now()))
  .digest('hex')

export async function POST(request: Request) {
  // A tighter limit than Guardian's: a page view is cheap, but a loop that
  // fires one per render would otherwise inflate every number on the dashboard.
  const limit = checkRateLimit(`visit:${callerKey(request)}`, {
    limit: 40,
    windowMs: 60_000,
    globalLimit: 600,
  })
  if (!limit.allowed) {
    // Answered 204 rather than 429 on purpose. This endpoint is fire-and-forget
    // from the browser; a rejected beacon must not turn into a console error on
    // a user's screen for something that is purely our own bookkeeping.
    return new NextResponse(null, { status: 204 })
  }

  const admin = getAdminClient()
  if (!admin) return new NextResponse(null, { status: 204 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  const token = typeof body.token === 'string' ? body.token : ''
  const path = typeof body.path === 'string' ? normalisePath(body.path) : ''
  const device = DEVICES.includes(body.device as DeviceClass)
    ? (body.device as DeviceClass)
    : null
  // Token length is checked rather than trusted: the column requires a 64-char
  // hash, and a junk token would otherwise fail at the database with a 500.
  if (!token || token.length < 16 || token.length > 200 || !path || !device) {
    return new NextResponse(null, { status: 204 })
  }

  const sessionHash = createHash('sha256').update(SALT).update(token).digest('hex')

  // Failures are swallowed. Analytics must never be the reason a page appears
  // broken, and there is nothing the visitor could do about it anyway.
  const { error } = await admin.from('app_visits').insert({
    path,
    device,
    signed_in: body.signedIn === true,
    session_hash: sessionHash,
  })
  if (error) console.error(`[visit] insert failed: ${error.message}`)

  return new NextResponse(null, { status: 204 })
}
