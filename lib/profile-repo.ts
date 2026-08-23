// Profile reads and writes against public.profiles.
//
// Every query here runs as the signed-in user, so row level security is what
// scopes it: there is no user id filter to forget. The mapping between the
// database row and the app's Profile type lives here and nowhere else.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Preferences, Profile } from './store'
import { DEFAULT_PREFERENCES } from './store'

export type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  city: string | null
  province: string | null
  location: string | null
  employment: string | null
  buying_goal: string | null
  date_of_birth: string | null
  licence_issued: string | null
  monthly_income: string | number | null
  credit_bureau: string | null
  preferences: Preferences | null
  created_at: string
  updated_at: string
}

/** A profile is only "set up" once onboarding has supplied the essentials. */
export function isProfileComplete(row: Pick<ProfileRow, 'full_name' | 'city' | 'monthly_income'>): boolean {
  return Boolean(row.full_name && row.city && row.monthly_income !== null)
}

function splitName(fullName: string | null): { firstName: string; lastName: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export function rowToProfile(row: ProfileRow): Profile {
  const { firstName, lastName } = splitName(row.full_name)
  const income = row.monthly_income === null ? 0 : Number(row.monthly_income)
  return {
    firstName,
    lastName,
    city: row.city ?? '',
    province: row.province ?? '',
    employment: row.employment ?? '',
    monthlyIncome: Number.isFinite(income) ? income : 0,
    dob: row.date_of_birth ?? '',
    licenceDate: row.licence_issued ?? '',
    goal: row.buying_goal ?? '',
    preferences: { ...DEFAULT_PREFERENCES, ...(row.preferences ?? {}) },
  }
}

export function profileToRow(profile: Profile): Record<string, unknown> {
  return {
    full_name: `${profile.firstName} ${profile.lastName}`.trim(),
    city: profile.city || null,
    province: profile.province || null,
    employment: profile.employment || null,
    buying_goal: profile.goal || null,
    // Empty date strings are null, never the epoch.
    date_of_birth: profile.dob || null,
    licence_issued: profile.licenceDate || null,
    monthly_income: profile.monthlyIncome > 0 ? profile.monthlyIncome : null,
    preferences: profile.preferences ?? DEFAULT_PREFERENCES,
  }
}

export type ProfileFetch =
  | { status: 'ok'; profile: Profile; row: ProfileRow }
  | { status: 'incomplete'; row: ProfileRow }
  | { status: 'missing' }
  | { status: 'error'; message: string }

export async function fetchProfile(client: SupabaseClient): Promise<ProfileFetch> {
  const { data, error } = await client
    .from('profiles')
    .select(
      'id, email, full_name, city, province, location, employment, buying_goal, date_of_birth, licence_issued, monthly_income, credit_bureau, preferences, created_at, updated_at',
    )
    .maybeSingle()

  if (error) return { status: 'error', message: error.message }
  if (!data) return { status: 'missing' }

  const row = data as ProfileRow
  // A row exists from the sign-up trigger before onboarding runs. That is not
  // the same as having a profile, and the gate must tell them apart.
  if (!isProfileComplete(row)) return { status: 'incomplete', row }
  return { status: 'ok', profile: rowToProfile(row), row }
}

export type SaveResult = { ok: true } | { ok: false; error: string }

export async function saveProfileRow(
  client: SupabaseClient,
  userId: string,
  profile: Profile,
): Promise<SaveResult> {
  const { error } = await client
    .from('profiles')
    .update(profileToRow(profile))
    .eq('id', userId)

  if (error) {
    return {
      ok: false,
      // Never surface the provider's wording.
      error: 'We could not save your profile. Check your connection and try again.',
    }
  }
  return { ok: true }
}

/** Credit bureau lives on the profile row and is what staff may see. */
export async function saveCreditBureau(
  client: SupabaseClient,
  userId: string,
  bureau: string,
): Promise<SaveResult> {
  const { error } = await client.from('profiles').update({ credit_bureau: bureau }).eq('id', userId)
  return error
    ? { ok: false, error: 'We could not record the bureau you used.' }
    : { ok: true }
}
