// Display-only configuration and geometry for the dashboard instruments.
//
// NOTHING HERE PARTICIPATES IN A CALCULATION.
//
// The credit score, the buying-power figure and the journey percentage are all
// computed exactly where they were before, in lib/finance.ts and lib/store.tsx.
// This file only answers presentation questions: where does the needle sit on
// the arc, where do the ticks go, which colour is that segment.
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
  colour: string
}

/**
 * Five steps from poor to excellent.
 *
 * Not the semantic destructive/success pair alone: a five-segment arc needs
 * five steps, and jumping straight from red to green makes the middle bands
 * read as errors rather than as stages on the way up.
 */
const BAND_COLOURS: Record<string, string> = {
  below: 'var(--color-destructive)',
  average: 'var(--color-warning)',
  favourable: 'var(--color-warning)',
  good: 'var(--color-primary)',
  excellent: 'var(--color-success)',
}

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
 * The exact rand figure is ALWAYS rendered as text under the dial. The needle
 * is decoration; the number is the fact.
 */
export const BUYING_POWER_FULL_TANK = 800_000

export function buyingPowerToFraction(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.min(1, amount / BUYING_POWER_FULL_TANK)
}

/* ------------------------------------------------------ arc geometry ---- */

/**
 * The sweep, in standard maths degrees. 170 to 10 is a 160-degree arc: open
 * enough to read five bands, and it leaves the whole lower half of the dial
 * free so the readout can sit below the hub without the needle ever crossing
 * it. An earlier 140-degree version put the number under the hub and the
 * needle tail cut straight through the digits.
 */
export const ARC_START_DEG = 170
export const ARC_END_DEG = 10
export const ARC_SWEEP_DEG = ARC_START_DEG - ARC_END_DEG

/** Shared dial geometry, so the two instruments are the same instrument. */
export const DIAL = {
  cx: 70,
  cy: 68,
  /** Centre line of the coloured band ring. */
  radius: 52,
  bandWidth: 11,
  needleLength: 43,
  viewBox: '0 0 140 80',
} as const

export function polarPoint(cx: number, cy: number, r: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
}

/**
 * An SVG arc between two fractions of the sweep.
 *
 * `inset` trims a little off each end in degrees, which is what puts the small
 * gaps between the coloured bands. Butt-joined segments read as one continuous
 * ring cut into pieces; gapped, rounded segments read as designed.
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  fromFraction: number,
  toFraction: number,
  inset = 0,
): string {
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1)
  let a1 = ARC_START_DEG - ARC_SWEEP_DEG * clamp(fromFraction) - inset
  let a2 = ARC_START_DEG - ARC_SWEEP_DEG * clamp(toFraction) + inset
  // A segment shorter than the gap would invert; collapse it instead.
  if (a1 < a2) a1 = a2 = (a1 + a2) / 2
  const p1 = polarPoint(cx, cy, r, a1)
  const p2 = polarPoint(cx, cy, r, a2)
  const largeArc = a1 - a2 > 180 ? 1 : 0
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
}

/** The needle angle for a fraction of the sweep. */
export function needleAngle(fraction: number): number {
  return ARC_START_DEG - ARC_SWEEP_DEG * Math.min(Math.max(fraction, 0), 1)
}

/**
 * Tick positions along the sweep, as fractions.
 *
 * `major` every fifth tick, which lines up with the quarter marks on the fuel
 * gauge and gives the credit dial a readable scale rather than a bare ring.
 */
export function ticks(count = 21): { fraction: number; major: boolean }[] {
  return Array.from({ length: count }, (_, i) => ({
    fraction: i / (count - 1),
    major: i % 5 === 0,
  }))
}

/* ------------------------------------------------------- journey road --- */

/**
 * Where the checkpoints sit along the road, as a fraction of its width.
 *
 * Inset at both ends so the first and last markers are not clipped by the
 * rounded ends of the strip.
 */
export function checkpointX(index: number, total: number): number {
  if (total <= 1) return 50
  return 10 + (80 * index) / (total - 1)
}
