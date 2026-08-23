// Analytics, privacy-safe by construction.
//
// The product holds a person's credit score, their income and the rand value of
// deals they are considering. None of that may ever leave the device through an
// analytics event. Rather than relying on every call site to remember that, the
// sanitiser below strips anything that looks like money or credit data, and the
// unit tests assert it. A leak has to get past a deny-list and a test to happen.

export type AnalyticsEventName =
  | 'cars_compared'
  | 'comparison_saved'
  | 'comparison_shared'
  /** Which catalogue row a buyer asked for rivals on. A car id, nothing else. */
  | 'rivals_car_chosen'

export type AnalyticsPayload = Record<string, string | number | boolean | null>

/**
 * Tokens that must never be transmitted. Matched against the key's *tokens*,
 * not as raw substrings: a naive substring check drops "brands" because it
 * contains "rand", which would silently gut the one field the comparison event
 * is supposed to carry. Tokenising keeps the deny-list strict without it
 * misfiring on innocent keys.
 */
const FORBIDDEN_TOKENS = new Set([
  'score',
  'band',
  'bands',
  'credit',
  'income',
  'salary',
  'earnings',
  'price',
  'prices',
  'amount',
  'rand',
  'rands',
  'zar',
  'deposit',
  'balloon',
  'rate',
  'rates',
  'email',
  'name',
  'surname',
  'dob',
  'birthdate',
  'number',
  'msisdn',
  'phone',
])

/** Prefixes covering variant spellings (instalment/installment, affordability). */
const FORBIDDEN_PREFIXES = ['instal', 'affordab']

/** Split camelCase, snake_case and kebab-case into lowercase tokens. */
export function tokeniseKey(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())
}

export function isForbiddenKey(key: string): boolean {
  return tokeniseKey(key).some(
    (token) => FORBIDDEN_TOKENS.has(token) || FORBIDDEN_PREFIXES.some((p) => token.startsWith(p)),
  )
}

/**
 * Drops forbidden keys and any value that is not a primitive. Returns the safe
 * payload plus the dropped keys, so the tests can assert on what was removed.
 */
export function sanitiseEvent(payload: AnalyticsPayload): {
  safe: AnalyticsPayload
  dropped: string[]
} {
  const safe: AnalyticsPayload = {}
  const dropped: string[] = []
  for (const [key, value] of Object.entries(payload)) {
    if (isForbiddenKey(key)) {
      dropped.push(key)
      continue
    }
    if (value !== null && typeof value === 'object') {
      dropped.push(key)
      continue
    }
    safe[key] = value
  }
  return { safe, dropped }
}

type TrackFn = (name: string, payload?: AnalyticsPayload) => void

let sink: TrackFn | null = null

/** Vercel Analytics is loaded in production only; tests inject their own sink. */
export function setAnalyticsSink(fn: TrackFn | null) {
  sink = fn
}

/**
 * Vercel Analytics exposes window.va once its script has loaded (production
 * only). Reading it lazily keeps this module free of framework imports so the
 * sanitiser can be unit-tested in plain Node.
 */
function defaultSink(name: string, payload?: AnalyticsPayload) {
  if (typeof window === 'undefined') return
  const va = (window as unknown as { va?: (event: string, name: string, data?: unknown) => void }).va
  va?.('event', name, payload)
}

export function track(name: AnalyticsEventName, payload: AnalyticsPayload = {}): AnalyticsPayload {
  const { safe } = sanitiseEvent(payload)
  try {
    ;(sink ?? defaultSink)(name, safe)
  } catch {
    /* analytics must never break a screen */
  }
  return safe
}

/* --------------------------------------------------------- event shapes -- */

/** Car ids, brands and a count. No rand amounts, no score, no band. */
export function comparedEvent(vehicles: readonly { id: string; make: string }[]): AnalyticsPayload {
  return {
    car_ids: vehicles.map((v) => v.id).join(','),
    brands: Array.from(new Set(vehicles.map((v) => v.make))).sort().join(','),
    count: vehicles.length,
  }
}
