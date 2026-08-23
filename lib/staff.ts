// Staff layer: the hidden entry point, the local session model, audit logging
// and the settings/content that the admin portal edits.
//
// READ THIS BEFORE TRUSTING ANYTHING HERE AS SECURITY.
//
// This build has no server, no Supabase, no session cookies and no TOTP
// provider. Every check in this file runs in the browser against localStorage,
// which the person sitting at the browser controls. It is therefore:
//
//   a working model of the roles, screens, audit trail and workflows, and
//   NOT an access-control boundary.
//
// The migrations shipped alongside it define the real boundary (RLS scoped
// through auth.uid()), and the staff sign-in screen says plainly that this
// build authenticates locally. Pretending otherwise would be security theatre,
// which is worse than no security because it stops people asking for the real
// thing.

import type { StaffRole } from './support'

/* --------------------------------------------------------- hidden gate --- */

/** Default trigger copy. Editable from the admin content panel. */
export const DEFAULT_TRIGGER_TEXT = 'find your car'

/** Three clicks on the same element inside this window opens the staff sheet. */
export const TRIGGER_CLICK_COUNT = 3
export const TRIGGER_WINDOW_MS = 600

export type ClickTracker = { count: number; firstAt: number }

/** Pure click-sequence reducer, so the trigger is unit-testable. */
export function registerTriggerClick(
  tracker: ClickTracker | null,
  now: number,
  windowMs = TRIGGER_WINDOW_MS,
  target = TRIGGER_CLICK_COUNT,
): { tracker: ClickTracker; opened: boolean } {
  if (!tracker || now - tracker.firstAt > windowMs) {
    return { tracker: { count: 1, firstAt: now }, opened: target === 1 }
  }
  const count = tracker.count + 1
  return { tracker: { count, firstAt: tracker.firstAt }, opened: count >= target }
}

/* ------------------------------------------------------------- accounts -- */

export type StaffAccount = {
  id: string
  email: string
  name: string
  role: Exclude<StaffRole, 'buyer'>
  /** Local-only credential for this prototype. See the warning at the top. */
  passcode: string
  active: boolean
  createdAt: string
  lastSignInAt?: string
  /** Real deployments require TOTP; this build records the intent only. */
  totpEnrolled: boolean
}

/**
 * Seed staff for the prototype. Real deployments provision staff through the
 * invite flow in the migration notes; there is deliberately no sign-up UI.
 */
export const SEED_STAFF: StaffAccount[] = [
  {
    id: 'staff-admin',
    email: 'admin@1stbuyer.test',
    name: 'Velemseni Dlamini',
    role: 'super_admin',
    passcode: 'admin1st',
    active: true,
    createdAt: '2026-01-05T08:00:00.000Z',
    totpEnrolled: false,
  },
  {
    id: 'staff-support',
    email: 'support@1stbuyer.test',
    name: 'Naledi Khumalo',
    role: 'support',
    passcode: 'support1st',
    active: true,
    createdAt: '2026-02-11T08:00:00.000Z',
    totpEnrolled: false,
  },
]

/* -------------------------------------------------------- authentication -- */

export type StaffSession = {
  staffId: string
  role: Exclude<StaffRole, 'buyer'>
  name: string
  email: string
  startedAt: string
  lastActiveAt: string
}

/** Inactivity timeout. Configurable from the admin settings panel. */
export const DEFAULT_SESSION_HOURS = 4

export type SignInAttempt = {
  email: string
  passcode: string
}

export type SignInOutcome =
  | { ok: true; session: StaffSession }
  | { ok: false; reason: 'invalid' | 'locked' }

/**
 * One generic failure for every cause: unknown email, wrong passcode and
 * disabled account are indistinguishable to the caller, so the gate cannot be
 * used to enumerate staff addresses.
 */
export function authenticateStaff(
  attempt: SignInAttempt,
  accounts: readonly StaffAccount[],
  now: Date = new Date(),
): SignInOutcome {
  const email = attempt.email.trim().toLowerCase()
  const account = accounts.find((a) => a.email.toLowerCase() === email)

  if (!account || !account.active || account.passcode !== attempt.passcode) {
    return { ok: false, reason: 'invalid' }
  }

  return {
    ok: true,
    session: {
      staffId: account.id,
      role: account.role,
      name: account.name,
      email: account.email,
      startedAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
    },
  }
}

export const GENERIC_SIGN_IN_ERROR = 'Credentials not recognised.'

export function sessionExpired(
  session: StaffSession | null,
  now: Date = new Date(),
  hours = DEFAULT_SESSION_HOURS,
): boolean {
  if (!session) return true
  const last = new Date(session.lastActiveAt).getTime()
  if (!Number.isFinite(last)) return true
  return now.getTime() - last > hours * 3600 * 1000
}

/* ------------------------------------------------------- rate limiting --- */

export const MAX_ATTEMPTS = 5
export const ATTEMPT_WINDOW_MINUTES = 15
export const LOCKOUT_MINUTES = 30

export type AttemptLog = { at: string; ok: boolean }

/**
 * Client-side throttle. It slows a human at this keyboard; it does not stop a
 * scripted attacker, who would simply clear storage. The real control is
 * server-side and is called out in the migration notes.
 */
export function lockoutState(
  attempts: readonly AttemptLog[],
  now: Date = new Date(),
): { locked: boolean; remainingMinutes: number; failuresInWindow: number } {
  const windowStart = now.getTime() - ATTEMPT_WINDOW_MINUTES * 60000
  const failures = attempts.filter((a) => !a.ok && new Date(a.at).getTime() >= windowStart)

  if (failures.length < MAX_ATTEMPTS) {
    return { locked: false, remainingMinutes: 0, failuresInWindow: failures.length }
  }

  const last = failures[failures.length - 1]
  const until = new Date(last.at).getTime() + LOCKOUT_MINUTES * 60000
  const remaining = Math.ceil((until - now.getTime()) / 60000)
  return {
    locked: remaining > 0,
    remainingMinutes: Math.max(0, remaining),
    failuresInWindow: failures.length,
  }
}

/* ----------------------------------------------------------- audit log --- */

export type AuditAction =
  | 'staff.sign_in'
  | 'staff.sign_out'
  | 'ticket.view'
  | 'ticket.reply'
  | 'ticket.note'
  | 'ticket.status_change'
  | 'ticket.assign'
  | 'ticket.delete'
  | 'user.lookup'
  | 'user.sensitive_reveal'
  | 'user.suspend'
  | 'impersonation.start'
  | 'impersonation.end'
  | 'staff.invite'
  | 'staff.revoke'
  | 'system_setting_changed'
  | 'content_changed'
  | 'guardian_rule_changed'
  | 'analytics.export'
  | 'maintenance_mode'
  | 'sessions.revoked'

export type AuditEntry = {
  id: string
  staffId: string
  staffName: string
  action: AuditAction
  targetUserId?: string
  metadata?: Record<string, string | number | boolean>
  createdAt: string
  /** Recorded honestly: a browser cannot see its own public IP. */
  ipAddress: string
  userAgent: string
}

export const IP_UNAVAILABLE = 'not captured (client-side build)'

export function buildAuditEntry(params: {
  session: StaffSession
  action: AuditAction
  targetUserId?: string
  metadata?: Record<string, string | number | boolean>
  now?: Date
  id?: string
  userAgent?: string
}): AuditEntry {
  const now = params.now ?? new Date()
  return {
    id: params.id ?? crypto.randomUUID(),
    staffId: params.session.staffId,
    staffName: params.session.name,
    action: params.action,
    targetUserId: params.targetUserId,
    metadata: params.metadata,
    createdAt: now.toISOString(),
    ipAddress: IP_UNAVAILABLE,
    userAgent:
      params.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
  }
}

/** Support reads only its own trail; super admin reads everything. */
export function visibleAudit(
  entries: readonly AuditEntry[],
  role: Exclude<StaffRole, 'buyer'>,
  staffId: string,
): AuditEntry[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return role === 'super_admin' ? sorted : sorted.filter((e) => e.staffId === staffId)
}

/* ------------------------------------------------------------ settings --- */

export type SystemSettings = {
  maintenanceMode: boolean
  maintenanceMessage: string
  staffSessionHours: number
  triggerText: string
  fuelPriceDefault: number
  slaHours: { P0: number; P1: number; P2: number; P3: number }
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  maintenanceMode: false,
  maintenanceMessage:
    'We are making a change and have paused the app for a moment. Nothing you have recorded is lost. Please try again shortly.',
  staffSessionHours: DEFAULT_SESSION_HOURS,
  triggerText: DEFAULT_TRIGGER_TEXT,
  fuelPriceDefault: 22.5,
  slaHours: { P0: 4, P1: 24, P2: 72, P3: 168 },
}

/** Honest-absence copy, editable without a deployment. */
export type ContentSnippets = {
  reliabilityAbsent: string
  marketContextAbsent: string
  serviceNetworkAbsent: string
}

export const DEFAULT_CONTENT: ContentSnippets = {
  reliabilityAbsent: 'Reliability data not yet available for this model',
  marketContextAbsent: 'Market context not yet available',
  serviceNetworkAbsent: 'Service network data not yet available',
}

export type SupportSnippet = {
  id: string
  title: string
  body: string
}

export const DEFAULT_SNIPPETS: SupportSnippet[] = [
  {
    id: 'snippet-credit',
    title: 'Credit not connected',
    body: 'Thanks for reaching out. To help with your instalment question, could you confirm your credit score is recorded? You can do that in Profile, then Credit. Once it is there, the instalment and affordability figures unlock across the app.',
  },
  {
    id: 'snippet-estimate',
    title: 'Why figures are estimates',
    body: 'The instalment we show is an estimate built from prime plus your credit band, over 72 months with a 10% deposit. It is not a quote from a lender, and a dealer may offer you a different rate. We show the assumptions on the screen so you can check them.',
  },
  {
    id: 'snippet-documents',
    title: 'Documents are not uploaded',
    body: 'To be clear about what the app does: your finance pack records file names and dates on your device only. We do not upload, read or verify the documents themselves. Please take the originals with you to the dealership.',
  },
]

/* ------------------------------------------------------- guardian rules -- */

export type GuardianRuleConfig = {
  id: string
  label: string
  enabled: boolean
  /** Extra keywords added by an admin, on top of the compiled rule. */
  extraKeywords: string[]
}

export const GUARDIAN_RULE_IDS = [
  'interest-rate',
  'balloon',
  'warranty',
  'credit-check',
  'affordability',
  'tradein',
  'insurance',
  'roadworthy',
  'compare',
  'documents',
] as const

export function defaultGuardianRules(): GuardianRuleConfig[] {
  return GUARDIAN_RULE_IDS.map((id) => ({
    id,
    label: id.replace(/-/g, ' '),
    enabled: true,
    extraKeywords: [],
  }))
}

export const CONFIRMATION_PHRASE = 'I understand the impact'
