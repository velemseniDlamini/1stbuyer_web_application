import { INSURERS, type Insurer } from './data'

// Indicative modelling only. These are NOT quotes: no insurer has priced this
// risk. The base premiums in lib/data.ts are placeholders benchmarked against a
// ~R350,000 vehicle, and everything below is an openly-stated adjustment.
export const REFERENCE_VEHICLE_PRICE = 350000
export const PREMIUMS_REVIEWED = '2026-07-01'

export type CoverTypeId = 'comprehensive' | 'tpft' | 'third-party'

export type CoverType = {
  id: CoverTypeId
  label: string
  multiplier: number
  blurb: string
}

export const COVER_TYPES: CoverType[] = [
  {
    id: 'comprehensive',
    label: 'Comprehensive',
    multiplier: 1,
    blurb: 'Accident, theft, hijacking, fire and third-party damage. Required on a financed car.',
  },
  {
    id: 'tpft',
    label: 'Third party, fire & theft',
    multiplier: 0.62,
    blurb: 'Theft, fire and damage you cause to others. Your own accident damage is not covered.',
  },
  {
    id: 'third-party',
    label: 'Third party only',
    multiplier: 0.4,
    blurb: 'Only damage you cause to someone else. Cheapest, and rarely accepted by a lender.',
  },
]

export const TRACKER_DISCOUNT = 0.12
export const GARAGED_DISCOUNT = 0.08

export type InsuranceInput = {
  cover: CoverTypeId
  tracker: boolean
  garaged: boolean
  vehiclePrice: number
  driverAge: number | null
  licenceYears: number | null
}

export type InsuranceQuote = {
  insurer: Insurer
  monthly: number
  annual: number
}

/** Young or newly-licensed drivers are loaded by every South African insurer.
 *  We state the loading rather than hiding it inside the premium. */
export function driverLoading(age: number | null, licenceYears: number | null): number {
  let loading = 0
  if (age !== null && age > 0) {
    if (age < 21) loading += 0.35
    else if (age < 25) loading += 0.2
    else if (age < 30) loading += 0.08
  }
  if (licenceYears !== null) {
    if (licenceYears < 1) loading += 0.15
    else if (licenceYears < 2) loading += 0.07
  }
  return loading
}

export function valueFactor(vehiclePrice: number): number {
  if (!vehiclePrice || vehiclePrice <= 0) return 1
  const raw = vehiclePrice / REFERENCE_VEHICLE_PRICE
  // Premiums do not scale linearly with value, and we clamp so an unusual
  // price cannot produce an absurd figure.
  return Math.min(2.2, Math.max(0.6, 0.45 + 0.55 * raw))
}

export function quoteFor(insurer: Insurer, input: InsuranceInput): InsuranceQuote {
  const cover = COVER_TYPES.find((c) => c.id === input.cover) ?? COVER_TYPES[0]
  const discount = (input.tracker ? TRACKER_DISCOUNT : 0) + (input.garaged ? GARAGED_DISCOUNT : 0)
  const loading = driverLoading(input.driverAge, input.licenceYears)

  const monthly =
    insurer.baseMonthly *
    cover.multiplier *
    valueFactor(input.vehiclePrice) *
    (1 + loading) *
    (1 - discount)

  const rounded = Math.round(monthly)
  return { insurer, monthly: rounded, annual: rounded * 12 }
}

export function quoteAll(input: InsuranceInput): InsuranceQuote[] {
  return INSURERS.map((i) => quoteFor(i, input)).sort((a, b) => a.monthly - b.monthly)
}

export function annualSpread(quotes: InsuranceQuote[]): number {
  if (quotes.length < 2) return 0
  return quotes[quotes.length - 1].annual - quotes[0].annual
}
