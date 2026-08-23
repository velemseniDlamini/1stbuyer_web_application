import 'server-only'

// Service-role client. SERVER ONLY.
//
// The `server-only` import above is the guard: if any client component ever
// imports this module, the build fails rather than shipping a key that bypasses
// row level security to every visitor's browser.
//
// The only thing this client is used for today is provisioning a confirmed user
// during sign-up. See app/api/auth/register/route.ts for why that route exists.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getAdminClient(): SupabaseClient | null {
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const adminConfigured = Boolean(url && serviceKey)
