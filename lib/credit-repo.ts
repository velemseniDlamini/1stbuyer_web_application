// Credit history reads and writes against public.credit_history.
//
// Every query runs as the signed-in user, so row level security is what scopes
// it. There is no profile_id filter on the read to forget.
//
// The bureau is mirrored onto profiles.credit_bureau because that is the column
// support staff are allowed to see. The score itself never leaves this table.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreditEntry } from './store'

export type CreditRow = {
  id: string
  score: number
  bureau: string
  recorded_at: string
}

export function rowToCredit(row: CreditRow): CreditEntry {
  return { score: row.score, bureau: row.bureau, date: row.recorded_at }
}

export type CreditFetch =
  | { ok: true; entries: CreditEntry[] }
  | { ok: false; error: string }

export async function fetchCredit(client: SupabaseClient): Promise<CreditFetch> {
  const { data, error } = await client
    .from('credit_history')
    .select('id, score, bureau, recorded_at')
    // Oldest first: the app treats the last entry as current and draws the
    // trend in this order.
    .order('recorded_at', { ascending: true })

  if (error) return { ok: false, error: 'We could not load your credit history.' }
  return { ok: true, entries: (data as CreditRow[]).map(rowToCredit) }
}

export type WriteResult = { ok: true } | { ok: false; error: string }

export async function insertCredit(
  client: SupabaseClient,
  userId: string,
  entry: CreditEntry,
): Promise<WriteResult> {
  const { error } = await client.from('credit_history').insert({
    profile_id: userId,
    score: entry.score,
    bureau: entry.bureau,
    recorded_at: entry.date,
  })

  if (error) {
    return { ok: false, error: 'We could not save that score. Check your connection and try again.' }
  }

  // Best effort: the bureau on the profile is what support can see. A failure
  // here does not lose the score, so it does not fail the write.
  await client.from('profiles').update({ credit_bureau: entry.bureau }).eq('id', userId)
  return { ok: true }
}
