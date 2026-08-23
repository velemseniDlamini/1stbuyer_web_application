// F-15, smart comparison suggestions.
//
// Three strategies, in priority order, each producing a suggestion that carries
// its own reason in plain language. There is no "Recommended for you": if we
// cannot say why, we do not suggest.
//
// Strategy (c) reads an anonymised, count-only aggregate of saved comparisons.
// It never reads whose comparison it was, the aggregate carries pair counts
// and nothing else, which is the same privacy rule the analytics module applies.

import type { Vehicle } from './data'


export type SuggestionStrategy = 'same-brand-price' | 'similar-lower-mileage' | 'often-compared'

export type Suggestion = {
  vehicle: Vehicle
  strategy: SuggestionStrategy
  /** The "why am I seeing this?" line. Always concrete, never "recommended". */
  reason: string
}

/** Adjacent price band: within ±20% of the anchor's asking price. */
export const PRICE_BAND = 0.2

/**
 * A suggestion is a hint worth a tap, not a claim that a car is better, so the
 * bar here is deliberately lower than the diff-materiality threshold used to
 * tint the comparison table. 5 000 km is about three months of average South
 * African driving: enough to be worth surfacing, and the chip states the exact
 * figure so the user judges for themselves.
 */
export const MIN_MILEAGE_ADVANTAGE_KM = 5000

export type PairCounts = Record<string, number>

/** Stable key for an unordered pair, so A|B and B|A aggregate together. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

/**
 * Count-only aggregate over saved comparisons. Takes just the car-id arrays,
 * no user ids, no timestamps, nothing that could identify who compared what.
 */
export function buildPairCounts(comparisons: readonly { carIds: string[] }[]): PairCounts {
  const counts: PairCounts = {}
  for (const c of comparisons) {
    const ids = Array.from(new Set(c.carIds))
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j])
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
  }
  return counts
}

function zar(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value)
}

function km(value: number): string {
  return `${new Intl.NumberFormat('en-ZA').format(value)} km`
}

export type SuggestionInput = {
  anchor: Vehicle
  catalogue: readonly Vehicle[]
  /** Already in the compare set, never suggest what is on screen. */
  excludeIds: readonly string[]
  /** Suggestion ids the user dismissed permanently. */
  dismissedIds: readonly string[]
  pairCounts?: PairCounts
  limit?: number
}

/**
 * Up to `limit` (default 2) alternatives. Each strategy contributes at most one
 * candidate, so the user gets variety rather than three flavours of the same idea.
 */
export function suggestAlternatives(input: SuggestionInput): Suggestion[] {
  const { anchor, catalogue, excludeIds, dismissedIds, pairCounts = {}, limit = 2 } = input

  const available = catalogue.filter(
    (v) => v.id !== anchor.id && !excludeIds.includes(v.id) && !dismissedIds.includes(v.id),
  )

  const out: Suggestion[] = []
  const taken = new Set<string>()

  // (c) first: what other buyers actually compared this with is stronger
  // evidence than any rule we invent, but only when the aggregate is real.
  const mostCompared = available
    .map((v) => ({ v, count: pairCounts[pairKey(anchor.id, v.id)] ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)[0]

  if (mostCompared) {
    out.push({
      vehicle: mostCompared.v,
      strategy: 'often-compared',
      reason: `Compared with the ${anchor.model} ${mostCompared.count} time${mostCompared.count === 1 ? '' : 's'} in saved comparisons`,
    })
    taken.add(mostCompared.v.id)
  }

  // (a) same brand, adjacent price band.
  const sameBrand = available
    .filter(
      (v) =>
        !taken.has(v.id) &&
        v.make === anchor.make &&
        Math.abs(v.price - anchor.price) / anchor.price <= PRICE_BAND,
    )
    .sort((a, b) => Math.abs(a.price - anchor.price) - Math.abs(b.price - anchor.price))[0]

  if (sameBrand && out.length < limit) {
    const diff = sameBrand.price - anchor.price
    out.push({
      vehicle: sameBrand,
      strategy: 'same-brand-price',
      reason:
        diff === 0
          ? `Same brand, same price as the ${anchor.model}`
          : `Same brand, ${zar(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'}`,
    })
    taken.add(sameBrand.id)
  }

  // (b) similar class (same fuel + transmission), newer or lower mileage.
  const similarLowerKm = available
    .filter(
      (v) =>
        !taken.has(v.id) &&
        v.fuel === anchor.fuel &&
        v.transmission === anchor.transmission &&
        Math.abs(v.price - anchor.price) / anchor.price <= PRICE_BAND &&
        (anchor.mileage - v.mileage >= MIN_MILEAGE_ADVANTAGE_KM || v.year > anchor.year),
    )
    .sort((a, b) => a.mileage - b.mileage)[0]

  if (similarLowerKm && out.length < limit) {
    const parts: string[] = ['Similar price']
    if (similarLowerKm.year > anchor.year) parts.push('newer')
    const kmSaved = anchor.mileage - similarLowerKm.mileage
    if (kmSaved >= MIN_MILEAGE_ADVANTAGE_KM) parts.push(`${km(kmSaved)} less`)
    out.push({
      vehicle: similarLowerKm,
      strategy: 'similar-lower-mileage',
      reason: parts.join(', '),
    })
    taken.add(similarLowerKm.id)
  }

  return out.slice(0, limit)
}

export const SUGGESTION_TRANSPARENCY_NOTE =
  'Suggestions come from three rules only: the same brand in a nearby price band, a similar car with lower mileage, and what other people saved alongside this one (a count, with no personal data attached). Each chip says which rule produced it.'
