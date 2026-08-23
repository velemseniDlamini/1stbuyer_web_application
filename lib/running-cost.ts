// F-15 Car Compare, indicative monthly running cost.
//
// Three components, each of which must be honest about what it is:
//
//   Fuel:      an ASSUMPTION the user controls. We do not hold manufacturer
//                consumption figures for this catalogue (see lib/specs.ts), so
//                the litres/100km comes from an editable per-fuel-type default
//                that is labelled as an assumption, not as a spec sheet figure.
//                If a sourced combined-cycle figure exists for the car, it is
//                used instead and the interface says which was used.
//   Insurance: the cheapest indicative premium from the existing insurance
//                comparison logic in lib/insurance.ts. Not a new invented number,
//                and carries that module's "indicative, not a quote" framing.
//   Servicing: deliberately absent. There is no sourced South African
//                service-plan pricing in this build, so it is reported as
//                excluded rather than estimated. An invented service figure
//                would move the total by hundreds of rands a month.
//
// Nothing here is a quote. Every consumer of this module must render the
// "Indicative, not a quote" label alongside the figure (FR-096 pattern).

import { INSURERS, type Vehicle } from './data'
import { quoteFor } from './insurance'
import type { CarSpec } from './specs'

/**
 * Pump price used as the DEFAULT of an editable field. It is an assumption with
 * a date, not a live feed, the interface labels it that way and lets the user
 * replace it with what they actually pay.
 */
export const DEFAULT_FUEL_PRICE_ZAR_PER_L = 22.5
export const FUEL_PRICE_ASSUMED_AT = '2026-08-01'
export const DEFAULT_MONTHLY_KM = 1200

/**
 * Editable consumption assumptions by fuel type. These are coarse, openly
 * labelled planning assumptions, NOT model-specific figures, and never
 * presented as such.
 */
export const ASSUMED_L_PER_100KM: Record<Vehicle['fuel'], number> = {
  Petrol: 7.5,
  Diesel: 6.5,
  Hybrid: 4.8,
}

export type RunningCostInput = {
  vehicle: Vehicle
  spec?: CarSpec | null
  fuelPricePerL: number
  monthlyKm: number
  /** Driver context for the insurance component; null when unknown. */
  driverAge: number | null
  licenceYears: number | null
}

export type RunningCostBreakdown = {
  fuel: number
  insurance: number
  /** Always null in v1: no sourced service-plan pricing exists. */
  servicing: null
  total: number
  /** Where the consumption figure came from, so the UI can say so. */
  consumptionBasis: 'manufacturer' | 'assumption'
  litresPer100km: number
  excluded: string[]
}

export function litresPer100kmFor(vehicle: Vehicle, spec?: CarSpec | null): {
  value: number
  basis: 'manufacturer' | 'assumption'
} {
  const sourced = spec?.combinedLper100km
  if (typeof sourced === 'number' && sourced > 0) {
    return { value: sourced, basis: 'manufacturer' }
  }
  return { value: ASSUMED_L_PER_100KM[vehicle.fuel], basis: 'assumption' }
}

export function monthlyFuelCost(params: {
  litresPer100km: number
  fuelPricePerL: number
  monthlyKm: number
}): number {
  const { litresPer100km, fuelPricePerL, monthlyKm } = params
  if (!(litresPer100km > 0) || !(fuelPricePerL > 0) || !(monthlyKm > 0)) return 0
  return (litresPer100km / 100) * monthlyKm * fuelPricePerL
}

/**
 * Cheapest indicative comprehensive premium across the insurers already modelled
 * in lib/insurance.ts. Comprehensive is the correct cover to price here because
 * it is compulsory on a financed vehicle.
 */
export function indicativeInsuranceMonthly(input: {
  vehiclePrice: number
  driverAge: number | null
  licenceYears: number | null
}): number {
  const quotes = INSURERS.map((insurer) =>
    quoteFor(insurer, {
      cover: 'comprehensive',
      tracker: true,
      garaged: true,
      vehiclePrice: input.vehiclePrice,
      driverAge: input.driverAge,
      licenceYears: input.licenceYears,
    }),
  )
  return quotes.reduce((min, q) => Math.min(min, q.monthly), Infinity)
}

export function calculateRunningCost(input: RunningCostInput): RunningCostBreakdown {
  const consumption = litresPer100kmFor(input.vehicle, input.spec)
  const fuel = monthlyFuelCost({
    litresPer100km: consumption.value,
    fuelPricePerL: input.fuelPricePerL,
    monthlyKm: input.monthlyKm,
  })
  const insurance = indicativeInsuranceMonthly({
    vehiclePrice: input.vehicle.price,
    driverAge: input.driverAge,
    licenceYears: input.licenceYears,
  })

  return {
    fuel: Math.round(fuel),
    insurance: Math.round(insurance),
    servicing: null,
    total: Math.round(fuel) + Math.round(insurance),
    consumptionBasis: consumption.basis,
    litresPer100km: consumption.value,
    excluded: [
      'Servicing and maintenance, no sourced South African service-plan pricing yet',
      'Tyres, licensing and e-tolls',
      'Depreciation, deferred, see the note on total cost of ownership',
    ],
  }
}

export const RUNNING_COST_LABEL = 'Indicative, not a quote'

export const TCO_DEFERRED_NOTE =
  'Total cost of ownership and resale/depreciation are not shown. Estimating what this car is worth in three years needs a real South African residual-value dataset, and we would rather show nothing than a number we made up.'
