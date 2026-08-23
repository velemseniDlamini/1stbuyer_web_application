// F-15, deal quality against an honest market range.
//
// The product's existing position is that market value is set equal to the
// asking price rather than invented, because no valuation feed is licensed.
// That is still true, so this module does NOT invent one either. What it can do
// honestly is compare a listing against ITS OWN PEERS in the catalogue we hold:
// same make, model and a close year. That is real, checkable data.
//
// With a small catalogue most cars have no peers, and the answer is then
// "Market context not yet available", never a neutral-looking badge that reads
// as "fair price" to a hopeful buyer.

import type { Vehicle } from './data'

/** A range is only published when enough comparable listings support it. */
export const MIN_PEERS_FOR_RANGE = 3
export const PEER_YEAR_WINDOW = 1

export type MarketRange = {
  low: number
  median: number
  high: number
  peerCount: number
  basis: string
}

export type DealQuality = {
  id: 'below' | 'at' | 'above' | 'unknown'
  label: string
  detail: string
  range: MarketRange | null
  /** Percentage above/below the median, when a range exists. */
  deltaPct: number | null
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function peersFor(vehicle: Vehicle, catalogue: readonly Vehicle[]): Vehicle[] {
  return catalogue.filter(
    (v) =>
      v.id !== vehicle.id &&
      v.make === vehicle.make &&
      v.model === vehicle.model &&
      Math.abs(v.year - vehicle.year) <= PEER_YEAR_WINDOW,
  )
}

export function marketRangeFor(
  vehicle: Vehicle,
  catalogue: readonly Vehicle[],
): MarketRange | null {
  const peers = peersFor(vehicle, catalogue)
  if (peers.length < MIN_PEERS_FOR_RANGE) return null

  const prices = peers.map((p) => p.price)
  return {
    low: Math.min(...prices),
    median: median(prices),
    high: Math.max(...prices),
    peerCount: peers.length,
    basis: `${peers.length} comparable ${vehicle.make} ${vehicle.model} listings (${vehicle.year - PEER_YEAR_WINDOW}-${vehicle.year + PEER_YEAR_WINDOW}) in this catalogue`,
  }
}

/** Below/at/above is judged against the peer median with a 5% dead band. */
export const DEAL_DEAD_BAND = 0.05

export function dealQuality(vehicle: Vehicle, catalogue: readonly Vehicle[]): DealQuality {
  const range = marketRangeFor(vehicle, catalogue)

  if (!range) {
    return {
      id: 'unknown',
      label: 'Market context not yet available',
      detail:
        'We do not hold enough comparable listings to say whether this price is high or low, and we will not guess. Ask the dealer what similar cars are selling for, and check a valuation guide.',
      range: null,
      deltaPct: null,
    }
  }

  const deltaPct = (vehicle.price - range.median) / range.median

  if (deltaPct < -DEAL_DEAD_BAND) {
    return {
      id: 'below',
      label: 'Priced below market estimate',
      detail: `About ${Math.abs(Math.round(deltaPct * 100))}% under the median of ${range.basis}. Check why: mileage, condition or history may explain it.`,
      range,
      deltaPct,
    }
  }
  if (deltaPct > DEAL_DEAD_BAND) {
    return {
      id: 'above',
      label: 'Above market estimate, negotiate room exists',
      detail: `About ${Math.round(deltaPct * 100)}% over the median of ${range.basis}.`,
      range,
      deltaPct,
    }
  }
  return {
    id: 'at',
    label: 'At market estimate',
    detail: `Within ${Math.round(DEAL_DEAD_BAND * 100)}% of the median of ${range.basis}.`,
    range,
    deltaPct,
  }
}

export const MARKET_METHODOLOGY = {
  href: '/compare#methodology',
  summary:
    'We do not license a valuation feed, so we never publish an independent "market value". Where our own catalogue holds at least three comparable listings of the same make, model and year (±1), we compare the asking price to the median of those listings and say so. Where it does not, we say the context is unavailable rather than implying the price is fair.',
}
