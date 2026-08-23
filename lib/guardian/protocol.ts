// The contract between the Guardian panel and the Guardian API route.
//
// This module is imported by BOTH sides, so it must stay free of anything
// server-only (no SDK, no API key, no node built-ins).
//
// THE RULE THAT SHAPES THIS FILE
//
// Everything crossing the wire is untrusted, including the "context" the panel
// sends about the page the user is on. A browser can post whatever it likes to
// this endpoint. So every field is parsed, clamped and re-derived server side,
// and nothing the client sends is ever treated as an instruction: it lands in
// the model prompt as JSON data, never as a system message.
//
// The one thing the client is trusted for is describing the user's OWN state
// back to them. That is not a privilege escalation: a user lying to Guardian
// about their own credit score only misleads themselves, and no server-side
// record is written from any of it.

/** Roles the wire format allows. A client-supplied "system" role is rejected. */
export type WireRole = 'user' | 'guardian'

export type WireMessage = {
  role: WireRole
  text: string
}

/** Where the user is. Drives the suggestions and the model's live context. */
export type PageId =
  | 'dashboard'
  | 'journey'
  | 'explore'
  | 'new-cars'
  | 'rivals'
  | 'compare'
  | 'credit'
  | 'finance'
  | 'documents'
  | 'quotation'
  | 'insurance'
  | 'profile'
  | 'support'
  | 'other'

export const PAGE_IDS: readonly PageId[] = [
  'dashboard', 'journey', 'explore', 'new-cars', 'rivals', 'compare', 'credit',
  'finance', 'documents', 'quotation', 'insurance', 'profile',
  'support', 'other',
]

/**
 * What the panel tells the server about the user's situation.
 *
 * Split deliberately into two halves:
 *
 *   `page` and the id lists are NON-SENSITIVE. They go into the prompt on
 *   every request, because they are what makes Guardian feel like part of the
 *   app rather than a chatbot, and they reveal nothing but navigation.
 *
 *   `private` is SENSITIVE: credit score, income, quotation figures. It is NOT
 *   put in the prompt. It sits on the server for the life of one request and is
 *   only ever revealed to the model through a tool call, so a question about
 *   tyre sizes never ships the user's salary to Google.
 */
export type GuardianContext = {
  page: PageId
  /** Catalogue id of the vehicle the current screen is about, if any. */
  vehicleId?: string | null
  /** Catalogue ids currently in Car Compare. */
  compareIds?: string[]
  /** New-car catalogue id the Rivals screen is centred on. */
  newCarId?: string | null
}

/** The sensitive half. Never logged, never persisted, never in the base prompt. */
export type GuardianPrivateContext = {
  /** The user's recorded score, exactly as the app holds it. Never invented. */
  creditScore?: number | null
  monthlyIncome?: number | null
  firstName?: string | null
  /** Journey stage ids the user has completed. */
  completedStages?: string[]
  /** The most recent quotation analysis, if the user has run one. */
  quotation?: {
    vehicle: string
    score: number
    findings: { label: string; value: string; status: string; note: string }[]
  } | null
}

export type GuardianRequest = {
  messages: WireMessage[]
  context: GuardianContext
  private?: GuardianPrivateContext
}

/** A citation Guardian is allowed to show. Resolved server side from real ids. */
export type GuardianCitation = {
  id: string
  label: string
  /** Where to read more inside the app, when the source is app content. */
  href?: string
  /** External authority, when the source is published elsewhere. */
  url?: string
}

export type GuardianResponse = {
  reply: string
  citations: GuardianCitation[]
  /** Somewhere in the app to act on the answer. */
  link?: { label: string; href: string } | null
}

export type GuardianErrorCode =
  | 'disabled'
  | 'rate_limited'
  | 'bad_request'
  | 'upstream'
  | 'timeout'

export type GuardianError = { error: string; code: GuardianErrorCode; retryAfter?: number }

/* ------------------------------------------------------------- limits ---- */

export const LIMITS = {
  /** Characters in one question. Long enough to paste a quotation line-up. */
  maxMessageChars: 1500,
  /** Turns kept for context. Older turns are dropped, not summarised. */
  maxMessages: 20,
  maxCompareIds: 3,
  /** Guards against a client posting a novel as an "id". */
  maxIdChars: 64,
} as const

/* --------------------------------------------------------- validation ---- */

function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

function idList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const id = str(item, LIMITS.maxIdChars)
    if (id && !out.includes(id)) out.push(id)
    if (out.length === max) break
  }
  return out
}

/** A finite number inside a stated range, or null. Never NaN, never Infinity. */
function num(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < min || value > max) return null
  return value
}

export type ParseResult =
  | { ok: true; request: GuardianRequest }
  | { ok: false; error: string }

/**
 * Parse an untrusted request body into the shape the route will actually use.
 *
 * Rejects rather than coerces where the difference matters (an empty question,
 * a "system" role), and silently drops what is merely junk (an unknown page,
 * a fourth compare id), because a client sending noise should not be able to
 * make the endpoint fail loudly enough to be useful as an oracle.
 */
export function parseGuardianRequest(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Malformed request.' }
  const raw = body as Record<string, unknown>

  if (!Array.isArray(raw.messages) || raw.messages.length === 0) {
    return { ok: false, error: 'No question was sent.' }
  }

  const messages: WireMessage[] = []
  // Only the most recent turns travel: cost control and a hard bound on how
  // much a client can push into one prompt.
  for (const item of raw.messages.slice(-LIMITS.maxMessages)) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    // Anything that is not exactly "user" becomes "guardian". A client cannot
    // smuggle in a "system" turn to rewrite Guardian's instructions.
    const role: WireRole = entry.role === 'user' ? 'user' : 'guardian'
    const text = str(entry.text, LIMITS.maxMessageChars)
    if (!text) continue
    messages.push({ role, text })
  }

  if (messages.length === 0) return { ok: false, error: 'No question was sent.' }
  if (messages[messages.length - 1].role !== 'user') {
    return { ok: false, error: 'The last message must be a question.' }
  }

  const rawContext = (raw.context ?? {}) as Record<string, unknown>
  const page = PAGE_IDS.includes(rawContext.page as PageId)
    ? (rawContext.page as PageId)
    : 'other'

  const context: GuardianContext = {
    page,
    vehicleId: str(rawContext.vehicleId, LIMITS.maxIdChars),
    newCarId: str(rawContext.newCarId, LIMITS.maxIdChars),
    compareIds: idList(rawContext.compareIds, LIMITS.maxCompareIds),
  }

  const rawPrivate = (raw.private ?? {}) as Record<string, unknown>
  const priv: GuardianPrivateContext = {
    // Ranges match the app's own: lib/finance treats 0 and out-of-range as
    // unusable, and a "score" of 5000 is a client bug or an attack, not data.
    creditScore: num(rawPrivate.creditScore, 1, 999),
    monthlyIncome: num(rawPrivate.monthlyIncome, 1, 10_000_000),
    firstName: str(rawPrivate.firstName, 60),
    completedStages: idList(rawPrivate.completedStages, 12),
    quotation: parseQuotation(rawPrivate.quotation),
  }

  return { ok: true, request: { messages, context, private: priv } }
}

function parseQuotation(value: unknown): GuardianPrivateContext['quotation'] {
  if (!value || typeof value !== 'object') return null
  const q = value as Record<string, unknown>
  const vehicle = str(q.vehicle, 120)
  const score = num(q.score, 0, 100)
  if (!vehicle || score === null) return null

  const findings: NonNullable<GuardianPrivateContext['quotation']>['findings'] = []
  if (Array.isArray(q.findings)) {
    for (const item of q.findings.slice(0, 12)) {
      if (!item || typeof item !== 'object') continue
      const f = item as Record<string, unknown>
      const label = str(f.label, 80)
      const note = str(f.note, 400)
      if (!label || !note) continue
      findings.push({
        label,
        value: str(f.value, 80) ?? '',
        status: str(f.status, 20) ?? 'ok',
        note,
      })
    }
  }
  return { vehicle, score, findings }
}
