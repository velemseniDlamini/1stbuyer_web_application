// Display-only configuration for the dashboard gauges.
//
// NOTHING HERE PARTICIPATES IN A CALCULATION.
//
// The credit score, the buying-power figure and the journey percentage are all
// computed exactly where they were before, in lib/finance.ts and lib/store.tsx.
// This file only answers presentation questions: where does the needle sit on
// the arc, and which colour is that segment.
//
// The band boundaries are READ from CREDIT_BANDS rather than retyped, so the
// gauge and the Credit screen can never disagree about where "Good" starts.

import { CREDIT_BANDS } from './finance'

/* ------------------------------------------------------- credit gauge --- */

/** The bureau scale the app already uses. Display range for the arc only. */
export const SCORE_DISPLAY_MIN = 0
export const SCORE_DISPLAY_MAX = 999

export type GaugeBand = {
  id: string
  label: string
  /** Fraction of the arc where this band starts and ends, 0 to 1. */
  from: number
  to: number
  /** A CSS colour token. Warm and readable in both themes. */
  colour: string
}

/**
 * Tones per band, ordered worst to best so the arc reads left to right.
 *
 * Deliberately not the app's semantic destructive/success pair alone: a
 * five-segment arc needs five steps, and jumping straight from red to green
 * makes the middle bands look like errors rather than stages.
 */
const BAND_COLOURS: Record<string, string> = {
  below: 'var(--color-destructive)',
  average: 'var(--color-warning)',
  favourable: 'var(--color-warning)',
  good: 'var(--color-primary)',
  excellent: 'var(--color-success)',
}

/** The arc segments, derived from the app's own credit bands. */
export const SCORE_BANDS: GaugeBand[] = [...CREDIT_BANDS]
  // CREDIT_BANDS runs best-first for the rate table; an arc reads worst-first.
  .sort((a, b) => a.min - b.min)
  .map((band) => ({
    id: band.id,
    label: band.label,
    from: band.min / SCORE_DISPLAY_MAX,
    to: Math.min(band.max, SCORE_DISPLAY_MAX) / SCORE_DISPLAY_MAX,
    colour: BAND_COLOURS[band.id] ?? 'var(--color-muted-foreground)',
  }))

/** Where the needle sits, 0 to 1. Clamped so a stray value cannot spin it. */
export function scoreToFraction(score: number): number {
  const span = SCORE_DISPLAY_MAX - SCORE_DISPLAY_MIN
  return Math.min(1, Math.max(0, (score - SCORE_DISPLAY_MIN) / span))
}

/* --------------------------------------------------------- fuel gauge --- */

/**
 * The "full tank" mark on the buying-power gauge.
 *
 * A gauge needs a ceiling and the underlying figure has none, so this is a
 * display choice: R800 000 sits comfortably above the top of this app's
 * catalogue, which means a realistic first-time-buyer budget lands in the
 * readable middle of the arc rather than pinned at either end.
 *
 * The exact rand figure is ALWAYS rendered as text next to the gauge. The
 * needle is decoration; the number is the fact.
 */
export const BUYING_POWER_FULL_TANK = 800_000

export function buyingPowerToFraction(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.min(1, amount / BUYING_POWER_FULL_TANK)
}

/* ------------------------------------------------------ arc geometry ---- */

/** Degrees swept by both gauges. A wide sweep reads as a car instrument. */
export const ARC_START_DEG = 160
export const ARC_END_DEG = 20

export function polarPoint(cx: number, cy: number, r: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
}

/** An SVG arc path between two fractions of the sweep. */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  fromFraction: number,
  toFraction: number,
): string {
  const sweep = ARC_START_DEG - ARC_END_DEG
  const a1 = ARC_START_DEG - sweep * Math.min(Math.max(fromFraction, 0), 1)
  const a2 = ARC_START_DEG - sweep * Math.min(Math.max(toFraction, 0), 1)
  const p1 = polarPoint(cx, cy, r, a1)
  const p2 = polarPoint(cx, cy, r, a2)
  // Always the short way round: the sweep is under 180 degrees.
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
}

/** The needle angle for a fraction of the sweep. */
export function needleAngle(fraction: number): number {
  const sweep = ARC_START_DEG - ARC_END_DEG
  return ARC_START_DEG - sweep * Math.min(Math.max(fraction, 0), 1)
}
