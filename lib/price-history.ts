// F-15, asking-price history.
//
// Mirrors the price_snapshots table. The registry is empty: this build has
// never observed a listing twice, so there is no history to draw. The rule that
// follows is absolute, NO SPARKLINE WITHOUT HISTORY. A flat placeholder line
// would read as "this price has been stable", which is a claim we cannot make.

export type PriceSnapshot = {
  /** ISO date of the observation. */
  at: string
  price: number
}

export const PRICE_HISTORY_WINDOW_DAYS = 30

/** Populated by an ingestion that records the asking price over time. */
export const PRICE_HISTORY_BY_VEHICLE_ID: Record<string, PriceSnapshot[]> = {}

/** At least two observations are needed before a line means anything. */
export const MIN_SNAPSHOTS_FOR_SPARKLINE = 2

export function priceHistoryFor(
  vehicleId: string,
  windowDays = PRICE_HISTORY_WINDOW_DAYS,
  now: Date = new Date(),
): PriceSnapshot[] {
  const all = PRICE_HISTORY_BY_VEHICLE_ID[vehicleId] ?? []
  const cutoff = now.getTime() - windowDays * 86_400_000
  return all
    .filter((s) => {
      const t = new Date(s.at).getTime()
      return Number.isFinite(t) && t >= cutoff
    })
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

export function hasRenderableHistory(vehicleId: string, now?: Date): boolean {
  return priceHistoryFor(vehicleId, PRICE_HISTORY_WINDOW_DAYS, now).length >= MIN_SNAPSHOTS_FOR_SPARKLINE
}

/** Points normalised into a 0-1 box for an inline SVG polyline. */
export function sparklinePoints(snapshots: readonly PriceSnapshot[]): { x: number; y: number }[] {
  if (snapshots.length < MIN_SNAPSHOTS_FOR_SPARKLINE) return []
  const prices = snapshots.map((s) => s.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min

  return snapshots.map((s, i) => ({
    x: snapshots.length === 1 ? 0 : i / (snapshots.length - 1),
    // Flat history draws down the middle rather than at an edge.
    y: span === 0 ? 0.5 : 1 - (s.price - min) / span,
  }))
}

export function priceChange(snapshots: readonly PriceSnapshot[]): {
  delta: number
  pct: number
} | null {
  if (snapshots.length < MIN_SNAPSHOTS_FOR_SPARKLINE) return null
  const first = snapshots[0].price
  const last = snapshots[snapshots.length - 1].price
  if (first === 0) return null
  return { delta: last - first, pct: (last - first) / first }
}
