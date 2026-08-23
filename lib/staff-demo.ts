// Quick sign-in for the staff portal.
//
// WHY THIS IS GATED
//
// These entries print a working passcode on screen. That is fine for local
// work, where the seed accounts and their passcodes are already sitting in
// lib/staff.ts in plain sight and the portal states that it authenticates in
// the browser and is not an access boundary.
//
// It is NOT fine to ship a deployed build that lists staff credentials to
// anyone who finds the trigger. So this is on in development and off in a
// production build unless someone deliberately turns it on with
// NEXT_PUBLIC_STAFF_QUICK_SIGN_IN=true. The default is the safe one.
//
// The personas are derived from SEED_STAFF rather than retyped, so a changed
// passcode or a renamed account cannot leave a stale credential on a button.

import { SEED_STAFF, type StaffAccount } from './staff'
import type { StaffRole } from './support'

export type StaffPersona = {
  id: string
  name: string
  email: string
  passcode: string
  role: Exclude<StaffRole, 'buyer'>
  roleLabel: string
  initials: string
  /** What signing in as this person actually lets you see. */
  summary: string
}

const ROLE_LABEL: Record<Exclude<StaffRole, 'buyer'>, string> = {
  super_admin: 'Super admin',
  support: 'IT support',
}

const ROLE_SUMMARY: Record<Exclude<StaffRole, 'buyer'>, string> = {
  super_admin:
    'Everything: tickets, user lookup, audit log, staff accounts, system settings, content and Guardian rules.',
  support:
    'Ticket queue, masked user lookup and their own audit trail. No staff, settings or content screens.',
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function toPersona(account: StaffAccount): StaffPersona | null {
  // A disabled account must not get a one-tap button: the point of the active
  // flag is that signing in as that person fails, and a button that always
  // errors is worse than no button.
  if (!account.active) return null
  const role = account.role
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    passcode: account.passcode,
    role,
    roleLabel: ROLE_LABEL[role],
    initials: initialsOf(account.name),
    summary: ROLE_SUMMARY[role],
  }
}

/**
 * Build the persona list from the accounts currently in the store, falling
 * back to the seed set. Passing live accounts means a passcode changed from
 * the admin screen is reflected here instead of handing out a stale one.
 */
export function staffPersonas(accounts: readonly StaffAccount[] = SEED_STAFF): StaffPersona[] {
  const source = accounts.length > 0 ? accounts : SEED_STAFF
  return source
    .map(toPersona)
    .filter((persona): persona is StaffPersona => persona !== null)
    // Super admin first: it is the one that shows the whole portal.
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'super_admin' ? -1 : 1))
}

/**
 * Whether to offer one-tap staff sign-in at all.
 *
 * Reads a NEXT_PUBLIC_ variable on purpose: this is a UI affordance decision,
 * not a secret, and it has to be knowable in the browser. It grants nothing on
 * its own, the credentials it reveals are the seed ones already in the repo.
 */
export function staffQuickSignInEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_STAFF_QUICK_SIGN_IN
  if (flag === 'true') return true
  if (flag === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

export const STAFF_QUICK_SIGN_IN_NOTE =
  'Sample staff accounts for trying the portal. Their passcodes are shown because this build signs staff in inside the browser and is a workflow model, not an access boundary. These buttons are hidden in a production build.'
