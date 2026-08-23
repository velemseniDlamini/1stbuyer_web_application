// Supabase browser client.
//
// Returns null when the environment variables are absent, which is the
// graceful-degradation pattern the product already uses: the app falls back to
// local persistence and says so, rather than the screen breaking.
//
// Only the anon key is ever referenced here. The service role key bypasses row
// level security entirely and must never appear in a module that can reach the
// browser; it lives in SUPABASE_SERVICE_ROLE_KEY and is read only by
// lib/supabase-admin.ts, which is server-only.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        // The session is the app's source of truth for who is signed in, so it
        // must survive a refresh and refresh itself before expiry.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: '1stbuyer.auth',
      },
    })
  }
  return client
}

export const supabaseConfigured = Boolean(url && anonKey)
