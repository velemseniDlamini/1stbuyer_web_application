// F-15 Car Compare, pure comparison logic.
//
// Everything financial or factual about a comparison is decided here, with no
// React and no I/O, so it can be unit-tested directly (see tests/).
//
// Two rules run through the whole module:
//
//  1. PARITY. Every car answers the same question list, in the same order, with
//     the same labels. Misaligned rows are how comparison tools quietly mislead
//     people, a car that simply omits an unflattering row looks better than one
//     that reports it.
//  2. ABSENCE IS STATED. A value we do not hold renders as "Not listed" and is
//     marked `missing`. It is never zero, never blank, never a segment average.
//     A personalised number the user has not earned the right to (no credit
//     score) renders as `locked`, not as a guess.

import type { Vehicle } from './data'
import { DEALERS } from './data'
import {
  assessAffordability,
  bandForScore,
  calculateFinance,
  CARD_ESTIMATE,
  estimateInstalment,
  isUsableScore,
  rateForScore,
  type AffordabilityVerdict,
} from './finance'
import { reliabilityFor, sourceFor, RELIABILITY_ABSENT_MESSAGE } from './reliability'
import { calculateRunningCost, type RunningCostBreakdown } from './running-cost'
import { specFor, type CarSpec } from './specs'

export const MIN_COMPARE = 2
export const MAX_COMPARE = 3

export const NOT_LISTED = 'Not listed'

/* ------------------------------------------------------------ selection -- */

/** Add or remove an id, refusing a fourth rather than silently dropping it. */
export function toggleCompareId(
  ids: readonly string[],
  id: string,
): { ids: string[]; rejected: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), rejected: false }
  if (ids.length >= MAX_COMPARE) return { ids: [...ids], rejected: true }
  return { ids: [...ids, id], rejected: false }
}

/**
 * Parse `?cars=id1,id2,id3`. Unknown ids are dropped (a shared link may outlive
 * a listing), duplicates collapse, and the set is capped at MAX_COMPARE so a
 * hand-edited URL cannot produce a layout the screen cannot render.
 */
export function parseCompareIds(
  param: string | null | undefined,
  catalogue: readonly Vehicle[],
): string[] {
  if (!param) return []
  const known = new Set(catalogue.map((v) => v.id))
  const out: string[] = []
  for (const raw of param.split(',')) {
    const id = raw.trim()
    if (!id || !known.has(id) || out.includes(id)) continue
    out.push(id)
    if (out.length === MAX_COMPARE) break
  }
  return out
}

export function serialiseCompareIds(ids: readonly string[]): string {
  return ids.join(',')
}

/** The query key the compare set travels in. Named so readers cannot drift. */
export const COMPARE_PARAM = 'cars'

export function compareHref(ids: readonly string[]): string {
  return ids.length ? `/compare?${COMPARE_PARAM}=${serialiseCompareIds(ids)}` : '/compare'
}

export function vehiclesFor(ids: readonly string[], catalogue: readonly Vehicle[]): Vehicle[] {
  return ids
    .map((id) => catalogue.find((v) => v.id === id))
    .filter((v): v is Vehicle => Boolean(v))
}

/* -------------------------------------------------------------- context -- */

export type CompareContext = {
  /** Recorded bureau score, or null. A 0 or out-of-range value is not a score. */
  score: number | null
  monthlyIncome: number
  driverAge: number | null
  licenceYears: number | null
  fuelPricePerL: number
  monthlyKm: number
}

/**
 * The credit gate. Personalised money, instalment, affordability, is shown
 * only when the user has actually recorded a usable score. This is the whole
 * point of the feature's honesty story: without it we would be quoting a
 * stranger's credit profile back at them as if it were their own.
 */
export function canPersonalise(ctx: Pick<CompareContext, 'score'>): boolean {
  return isUsableScore(ctx.score)
}

/* ---------------------------------------------------------------- cells -- */

export type CellTone = 'default' | 'success' | 'warning' | 'destructive' | 'muted'

export type CompareCell =
  | { kind: 'value'; display: string; tone?: CellTone; note?: string }
  | { kind: 'badge'; display: string; tone: CellTone; note?: string }
  | { kind: 'link'; display: string; href: string; note?: string }
  | { kind: 'missing'; display: string; note?: string }
  | { kind: 'locked'; display: string; note: string }

export type CompareAttributeId =
  | 'price'
  | 'year'
  | 'mileage'
  | 'fuel'
  | 'transmission'
  | 'engine'
  | 'power'
  | 'torque'
  | 'drivetrain'
  | 'seats'
  | 'boot'
  | 'safety'
  | 'instalment'
  | 'affordability'
  | 'runningCost'
  | 'reliability'
  | 'dealer'
  | 'listing'

export type CompareSection = 'Price & condition' | 'Specification' | 'Your numbers' | 'Ownership' | 'Where to buy'

export type CompareAttribute = {
  id: CompareAttributeId
  label: string
  section: CompareSection
  /** Shown under the label to explain a derived or assumed figure. */
  hint?: string
}

/**
 * ONE label set, ONE fixed order, applied to every car. Adding a row here adds
 * it for all cars simultaneously, a car cannot opt out of a row it looks bad on.
 */
export const COMPARE_ATTRIBUTES: CompareAttribute[] = [
  { id: 'price', label: 'Asking price', section: 'Price & condition' },
  { id: 'year', label: 'Model year', section: 'Price & condition' },
  { id: 'mileage', label: 'Mileage', section: 'Price & condition' },
  { id: 'fuel', label: 'Fuel', section: 'Price & condition' },
  { id: 'transmission', label: 'Transmission', section: 'Price & condition' },

  { id: 'engine', label: 'Engine', section: 'Specification' },
  { id: 'power', label: 'Power', section: 'Specification' },
  { id: 'torque', label: 'Torque', section: 'Specification' },
  { id: 'drivetrain', label: 'Drivetrain', section: 'Specification' },
  { id: 'seats', label: 'Seats', section: 'Specification' },
  { id: 'boot', label: 'Boot space', section: 'Specification' },
  { id: 'safety', label: 'Safety rating', section: 'Specification' },

  {
    id: 'instalment',
    label: 'Estimated instalment',
    section: 'Your numbers',
    hint: `${CARD_ESTIMATE.termMonths} months · ${CARD_ESTIMATE.depositPct}% deposit · your credit band`,
  },
  {
    id: 'affordability',
    label: 'Affordability',
    section: 'Your numbers',
    hint: 'Instalment against your net monthly income',
  },
  {
    id: 'runningCost',
    label: 'Running cost / month',
    section: 'Your numbers',
    hint: 'Fuel + indicative insurance. Excludes servicing.',
  },

  { id: 'reliability', label: 'Ownership & reliability', section: 'Ownership' },

  { id: 'dealer', label: 'Branch', section: 'Where to buy' },
  { id: 'listing', label: 'Research this model', section: 'Where to buy' },
]

/* ----------------------------------------------------------- formatting -- */

function zar(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value)
}

function num(value: number): string {
  return new Intl.NumberFormat('en-ZA').format(value)
}

/** Every "we don't hold this" answer goes through here, so they are identical. */
export function missingCell(note?: string): CompareCell {
  return { kind: 'missing', display: NOT_LISTED, note }
}

const GATE_NOTE = 'Record your credit score to unlock this'

function lockedCell(): CompareCell {
  return { kind: 'locked', display: 'Locked', note: GATE_NOTE }
}

/**
 * Spec parity: a spec value becomes a cell, or an identical "Not listed" cell.
 * `format` is only ever called with a non-null value, so a formatter can never
 * accidentally render `0` for absent data.
 */
export function specCell<K extends keyof CarSpec>(
  spec: CarSpec,
  key: K,
  format: (value: NonNullable<CarSpec[K]>) => string,
): CompareCell {
  const value = spec[key]
  if (value === null || value === undefined || value === '') return missingCell()
  return { kind: 'value', display: format(value as NonNullable<CarSpec[K]>) }
}

/* ------------------------------------------------------------- building -- */

export type CarComparison = {
  vehicle: Vehicle
  spec: CarSpec
  /** Null when the credit gate is closed, never a fallback number. */
  instalment: number | null
  affordability: AffordabilityVerdict | null
  runningCost: RunningCostBreakdown
  cells: Record<CompareAttributeId, CompareCell>
}

/** Outbound research link: a real search on a real site, not scraped content. */
export function researchUrl(vehicle: Vehicle): string {
  const q = encodeURIComponent(`${vehicle.make} ${vehicle.model}`)
  return `https://www.cars.co.za/search?q=${q}`
}

export function buildCarComparison(vehicle: Vehicle, ctx: CompareContext): CarComparison {
  const spec = specFor(vehicle.id)
  const personalise = canPersonalise(ctx)

  const instalment = personalise ? estimateInstalment(vehicle.price, ctx.score) : null
  const affordability =
    personalise && ctx.monthlyIncome > 0 ? assessAffordability(instalment as number, ctx.monthlyIncome) : null

  const runningCost = calculateRunningCost({
    vehicle,
    spec,
    fuelPricePerL: ctx.fuelPricePerL,
    monthlyKm: ctx.monthlyKm,
    driverAge: ctx.driverAge,
    licenceYears: ctx.licenceYears,
  })

  const reliability = reliabilityFor(vehicle.make, vehicle.model)
  const dealer = DEALERS.find((d) => d.name === vehicle.dealer)

  const cells: Record<CompareAttributeId, CompareCell> = {
    price: { kind: 'value', display: zar(vehicle.price) },
    year: { kind: 'value', display: String(vehicle.year) },
    mileage: { kind: 'value', display: `${num(vehicle.mileage)} km` },
    fuel: { kind: 'value', display: vehicle.fuel },
    transmission: { kind: 'value', display: vehicle.transmission },

    engine: specCell(spec, 'engineCc', (cc) => `${num(cc)} cc`),
    power: specCell(spec, 'powerKw', (kw) => `${kw} kW`),
    torque: specCell(spec, 'torqueNm', (nm) => `${nm} Nm`),
    drivetrain: specCell(spec, 'drivetrain', (d) => d),
    seats: specCell(spec, 'seats', (s) => String(s)),
    boot: specCell(spec, 'bootLitres', (l) => `${num(l)} ℓ`),
    safety: spec.ncapStars === null
      ? missingCell()
      : {
          kind: 'value',
          display: `${spec.ncapStars}/5`,
          note: [spec.ncapProgramme, spec.ncapYear].filter(Boolean).join(' '),
        },

    instalment: personalise
      ? {
          kind: 'value',
          display: `${zar(instalment as number)}/mo`,
          note: `at ${rateForScore(ctx.score).toFixed(2)}% · ${bandForScore(ctx.score as number).label} band`,
        }
      : lockedCell(),

    affordability: !personalise
      ? lockedCell()
      : affordability
        ? {
            kind: 'badge',
            display: affordability.label,
            tone: affordability.tone,
            note: `${Math.round(affordability.ratio * 100)}% of your take-home pay`,
          }
        : missingCell('Add your monthly income in Profile'),

    runningCost: {
      kind: 'value',
      display: `${zar(runningCost.total)}/mo`,
      note:
        runningCost.consumptionBasis === 'assumption'
          ? 'Fuel from your editable assumption, not a spec sheet'
          : 'Fuel from the manufacturer combined figure',
    },

    reliability: reliability
      ? {
          kind: 'value',
          display: reliability.figure,
          note: `${reliability.measure}, ${sourceFor(reliability.sourceId)?.publisher ?? 'source'} ${reliability.year}`,
        }
      : missingCell(RELIABILITY_ABSENT_MESSAGE),

    dealer: dealer
      ? { kind: 'link', display: dealer.name, href: dealer.website, note: `${dealer.city}, ${dealer.province}` }
      : vehicle.dealer
        ? { kind: 'value', display: vehicle.dealer }
        : missingCell(),

    listing: { kind: 'link', display: 'Look up on Cars.co.za', href: researchUrl(vehicle) },
  }

  return { vehicle, spec, instalment, affordability, runningCost, cells }
}

export function buildComparison(
  vehicles: readonly Vehicle[],
  ctx: CompareContext,
): CarComparison[] {
  return vehicles.map((v) => buildCarComparison(v, ctx))
}

/**
 * Cheapest instalment across the set, used to highlight a row. Returns null when
 * the gate is closed, we do not rank cars by a number we refused to compute.
 */
export function lowestInstalmentId(comparisons: readonly CarComparison[]): string | null {
  const priced = comparisons.filter((c) => typeof c.instalment === 'number')
  if (priced.length < 2) return null
  return priced.reduce((best, c) =>
    (c.instalment as number) < (best.instalment as number) ? c : best,
  ).vehicle.id
}

/* --------------------------------------------------------------- export -- */

/**
 * Client-side text export, in the same shape as the quotation analyser's
 * negotiation-points.txt. Locked and missing values are exported as such, the
 * file must not be more confident than the screen.
 */
export function buildComparisonSummary(
  comparisons: readonly CarComparison[],
  ctx: CompareContext,
  generatedAt: Date = new Date(),
): string {
  const lines: string[] = []
  lines.push('1ST BUYER, CAR COMPARISON')
  lines.push('==========================')
  lines.push(`Generated: ${generatedAt.toLocaleString('en-ZA')}`)
  lines.push(
    canPersonalise(ctx)
      ? `Personalised for your ${bandForScore(ctx.score as number).label} credit band at ${rateForScore(ctx.score).toFixed(2)}%.`
      : 'No credit score recorded, instalment and affordability are not included.',
  )
  lines.push('')

  comparisons.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.vehicle.year} ${c.vehicle.make} ${c.vehicle.model} ${c.vehicle.variant}`)
    for (const attr of COMPARE_ATTRIBUTES) {
      const cell = c.cells[attr.id]
      const value =
        cell.kind === 'locked'
          ? 'Locked, no credit score recorded'
          : cell.kind === 'link'
            ? `${cell.display} (${cell.href})`
            : cell.display
      lines.push(`   ${attr.label.padEnd(24, '.')} ${value}`)
    }
    lines.push('')
  })

  lines.push('WHAT THESE NUMBERS ARE')
  lines.push(
    `  Instalment: ${CARD_ESTIMATE.termMonths} months, ${CARD_ESTIMATE.depositPct}% deposit, no balloon, the same basis as every vehicle card in the app.`,
  )
  lines.push('  Running cost: fuel from your own assumptions plus an indicative insurance premium. Not a quote.')
  lines.push('  Servicing, tyres, licensing and depreciation are excluded.')
  lines.push(`  "${NOT_LISTED}" means we do not hold that value, it is not a zero.`)
  lines.push('')
  lines.push('1st Buyer is independent, takes no commission, and does not rank dealers.')
  return lines.join('\n')
}

/* -------------------------------------------------------- journey event -- */

export type ComparisonEvent = {
  type: 'cars_compared'
  carIds: string[]
  /** Whether the user had a usable credit score at the time. */
  personalised: boolean
  at: string
}

/** Built here (pure) so the journey service consumes a real event, not a flag. */
export function buildComparisonEvent(
  ids: readonly string[],
  ctx: Pick<CompareContext, 'score'>,
  at: Date = new Date(),
): ComparisonEvent {
  return {
    type: 'cars_compared',
    carIds: [...ids],
    personalised: canPersonalise(ctx),
    at: at.toISOString(),
  }
}

/**
 * Stage 3 "Know The Market" credit: a comparison counts only when it was a real
 * comparison (2+ cars) run by a user the system could actually advise.
 */
export function satisfiesKnowTheMarket(events: readonly ComparisonEvent[]): boolean {
  return events.some((e) => e.type === 'cars_compared' && e.carIds.length >= MIN_COMPARE && e.personalised)
}

/* ------------------------------------------------------------ what-ifs --- */

/** Used by tests and by the screen's rate footnote. */
export function instalmentAtRate(price: number, annualRatePct: number): number {
  return calculateFinance({
    price,
    depositPct: CARD_ESTIMATE.depositPct,
    annualRatePct,
    termMonths: CARD_ESTIMATE.termMonths,
    balloonPct: CARD_ESTIMATE.balloonPct,
  }).monthly
}
