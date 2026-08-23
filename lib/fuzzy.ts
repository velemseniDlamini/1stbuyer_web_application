// Deterministic catalogue matching, shared by Guardian and the Compare
// natural-language input. One matcher, two callers, a question and a search
// box must not disagree about which car "polo vivo" means.
//
// No LLM, no scoring library: normalised substring and token overlap only, so
// the behaviour is auditable and identical every time.

import type { Vehicle } from './data'

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split a phrase like "Polo Vivo vs Corolla Cross" into its terms. */
export function splitComparisonTerms(input: string): string[] {
  return normalise(input)
    .split(/\s+(?:vs|versus|or|and|against)\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

export type VehicleMatch = {
  vehicle: Vehicle
  /** 0-1. Exact make+model is 1; a model-only hit scores lower. */
  score: number
  matchedOn: string
}

/**
 * Rank catalogue vehicles against one search term. A term must hit the model
 * name (or the full make+model) to match at all, matching on make alone would
 * turn "Volkswagen" into a random VW, which is not what the user asked for.
 */
export function matchVehicles(term: string, catalogue: readonly Vehicle[]): VehicleMatch[] {
  const q = normalise(term)
  if (!q) return []
  const qTokens = q.split(' ')

  const matches: VehicleMatch[] = []
  for (const vehicle of catalogue) {
    const model = normalise(vehicle.model)
    const full = normalise(`${vehicle.make} ${vehicle.model}`)
    const withVariant = normalise(`${vehicle.make} ${vehicle.model} ${vehicle.variant}`)

    let score = 0
    let matchedOn = ''

    if (q === full || q === model) {
      score = 1
      matchedOn = full
    } else if (q.includes(full) || full.includes(q)) {
      score = 0.9
      matchedOn = full
    } else if (q.includes(model) || model.includes(q)) {
      // "polo vivo" contains "polo": a real user intent, but weaker than exact.
      score = 0.75
      matchedOn = model
    } else {
      // Token overlap against make+model+variant, e.g. "corolla hybrid".
      const vTokens = new Set(withVariant.split(' '))
      const hits = qTokens.filter((t) => t.length > 2 && vTokens.has(t))
      const modelTokens = new Set(model.split(' '))
      const hitsModel = hits.some((t) => modelTokens.has(t))
      if (hitsModel) {
        score = 0.5 + Math.min(0.2, hits.length * 0.05)
        matchedOn = model
      }
    }

    if (score > 0) matches.push({ vehicle, score, matchedOn })
  }

  return matches.sort((a, b) => b.score - a.score || a.vehicle.price - b.vehicle.price)
}

/** Top N distinct models for one term, never two listings of the same model. */
export function topMatches(
  term: string,
  catalogue: readonly Vehicle[],
  limit = 2,
): VehicleMatch[] {
  const seen = new Set<string>()
  const out: VehicleMatch[] = []
  for (const match of matchVehicles(term, catalogue)) {
    const key = normalise(match.vehicle.model)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(match)
    if (out.length === limit) break
  }
  return out
}

/**
 * Parse a whole "A vs B" phrase into per-term candidate lists, so the UI can
 * ask the user to pick when a term is ambiguous rather than guessing.
 */
export function parseComparisonPhrase(
  input: string,
  catalogue: readonly Vehicle[],
  perTerm = 2,
): { term: string; matches: VehicleMatch[] }[] {
  return splitComparisonTerms(input).map((term) => ({
    term,
    matches: topMatches(term, catalogue, perTerm),
  }))
}
