// Visit tracking: the rotating anonymous token, and the shapes the dashboard
// reads. No server-only imports here, so both sides can use it.
//
// THE PRIVACY POSITION, STATED ONCE
//
// This app tells first-time buyers that a dealership already knows more about
// them than they know about the dealership. It would be hypocritical to build
// a surveillance layer into the answer. So the only thing that identifies a
// visitor is a random token generated in their own browser that rotates every
// 24 hours and is stored hashed. No IP, no user agent, no user id, no referrer.
//
// The cost of that choice is stated on the dashboard rather than hidden: a
// visitor counted on Monday and again on Tuesday counts as two. There is no
// way to know otherwise without tracking people across days, which is exactly
// what this app refuses to do.

export const VISIT_TOKEN_KEY = '1stbuyer.visit'
export const VISIT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export type DeviceClass = 'phone' | 'tablet' | 'desktop'

/** Same breakpoints the layout uses, so the numbers describe the real layout. */
export function deviceClassFor(width: number): DeviceClass {
  if (width < 768) return 'phone'
  if (width < 1280) return 'tablet'
  return 'desktop'
}

export type VisitPayload = {
  path: string
  device: DeviceClass
  signedIn: boolean
  /** The raw rotating token. Hashed server side before it is stored. */
  token: string
}

/* ------------------------------------------------------- dashboard data -- */

export type VisitSummary = {
  totalVisits: number
  totalVisitors: number
  visitsToday: number
  visitorsToday: number
  visits7d: number
  visitors7d: number
  /** Null when there is nothing to divide, never a misleading zero. */
  signedInShare: number | null
}

export type VisitDay = { day: string; visits: number; visitors: number }
export type VisitPath = { path: string; visits: number; visitors: number }
export type VisitDevice = { device: DeviceClass; visits: number }

export type AnalyticsPayload = {
  summary: VisitSummary
  daily: VisitDay[]
  topPaths: VisitPath[]
  devices: VisitDevice[]
  /** When the read happened, so a stale panel is obvious. */
  generatedAt: string
}

/* ------------------------------------------------------------- helpers --- */

/**
 * Strip a path down to something safe and countable.
 *
 * Query strings and ids are dropped: `/compare?cars=v1,v2` is interesting as
 * "someone used Compare", and the specific cars are that person's business.
 * A share token in a URL is the clearest example of why this matters.
 */
export function normalisePath(rawPath: string): string {
  const path = rawPath.split('?')[0].split('#')[0]
  if (!path.startsWith('/')) return '/'
  // /share/<token> would otherwise write a live secret into the analytics table.
  if (path.startsWith('/share/')) return '/share/[token]'
  return path.replace(/\/+$/, '').slice(0, 120) || '/'
}

/** The percentage change between two periods, or null when there is no base. */
export function trendPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
