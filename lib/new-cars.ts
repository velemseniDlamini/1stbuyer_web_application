// New-car reads and the estimates built on them.
//
// The catalogue comes from Supabase when it is reachable and from the bundled
// module when it is not. Which one was used travels with the data, so the
// screen can say "live" or "bundled copy" rather than quietly presenting stale
// rows as current.

import { getSupabase } from './supabase'
import {
  NEW_CARS,
  NEW_CAR_SOURCES,
  SOURCED_FUEL_PRICE,
  type NewCar,
} from './new-cars-source'
import { estimateInstalment, isUsableScore } from './finance'
import { indicativeInsuranceMonthly } from './running-cost'

export type CatalogueOrigin = 'live' | 'bundled'

export type NewCarResult = {
  cars: NewCar[]
  origin: CatalogueOrigin
  /** Present when the live read failed, so the screen can say why. */
  error: string | null
}

type Row = {
  id: string
  make: string
  model: string
  variant: string
  body_type: NewCar['bodyType']
  list_price: number
  fuel: NewCar['fuel']
  transmission: NewCar['transmission']
  engine_cc: number | null
  cylinders: number | null
  power_kw: string | number | null
  torque_nm: string | number | null
  consumption_l100km: string | number | null
  tank_litres: number | null
  seats: number | null
  boot_litres: number | null
  ncap_stars: number | null
  ncap_programme: string | null
  image_url: string | null
  source_name: string
  source_title: string
  source_url: string
  source_published_at: string
}

/** Postgres returns numeric as a string; keep the null, convert the rest. */
function num(value: string | number | null): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function rowToNewCar(row: Row): NewCar & { source: { publisher: string; title: string; url: string; publishedAt: string } } {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    variant: row.variant,
    bodyType: row.body_type,
    listPrice: row.list_price,
    fuel: row.fuel,
    transmission: row.transmission,
    engineCc: row.engine_cc,
    cylinders: row.cylinders,
    powerKw: num(row.power_kw),
    torqueNm: num(row.torque_nm),
    consumptionL100km: num(row.consumption_l100km),
    tankLitres: row.tank_litres,
    seats: row.seats,
    bootLitres: row.boot_litres,
    ncapStars: row.ncap_stars,
    ncapProgramme: row.ncap_programme,
    imageUrl: row.image_url,
    sourceId: 'at-cheapest-2026',
    source: {
      publisher: row.source_name,
      title: row.source_title,
      url: row.source_url,
      publishedAt: row.source_published_at,
    },
  }
}

export async function fetchNewCars(): Promise<NewCarResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return { cars: NEW_CARS, origin: 'bundled', error: null }
  }

  try {
    const { data, error } = await supabase
      .from('new_cars')
      .select('*')
      .order('list_price', { ascending: true })

    if (error) return { cars: NEW_CARS, origin: 'bundled', error: error.message }
    if (!data || data.length === 0) {
      return { cars: NEW_CARS, origin: 'bundled', error: 'The live catalogue returned no rows.' }
    }

    return { cars: (data as Row[]).map(rowToNewCar), origin: 'live', error: null }
  } catch (err) {
    return {
      cars: NEW_CARS,
      origin: 'bundled',
      error: err instanceof Error ? err.message : 'The live catalogue could not be reached.',
    }
  }
}

/* ------------------------------------------------------------ estimates -- */

export type NewCarCosts = {
  /** Null when the buyer has no usable credit score: the same gate as everywhere. */
  instalment: number | null
  /** Null when the source did not publish a consumption figure. */
  fuel: number | null
  insurance: number
  /** Null when any component is unknown, never a partial total presented as whole. */
  totalMonthly: number | null
  fuelPricePerLitre: number
  monthlyKm: number
}

export function estimateNewCarCosts(params: {
  car: Pick<NewCar, 'listPrice' | 'consumptionL100km'>
  score: number | null
  monthlyKm: number
  fuelPricePerLitre?: number
  driverAge: number | null
  licenceYears: number | null
}): NewCarCosts {
  const fuelPricePerLitre = params.fuelPricePerLitre ?? SOURCED_FUEL_PRICE.pricePerLitre

  const instalment = isUsableScore(params.score)
    ? estimateInstalment(params.car.listPrice, params.score)
    : null

  // Only computed from a published consumption figure. No class average is
  // substituted, because the whole point of this screen is that the number
  // came from somewhere.
  const fuel =
    params.car.consumptionL100km !== null
      ? Math.round((params.car.consumptionL100km / 100) * params.monthlyKm * fuelPricePerLitre)
      : null

  const insurance = Math.round(
    indicativeInsuranceMonthly({
      vehiclePrice: params.car.listPrice,
      driverAge: params.driverAge,
      licenceYears: params.licenceYears,
    }),
  )

  const totalMonthly =
    instalment !== null && fuel !== null ? Math.round(instalment) + fuel + insurance : null

  return {
    instalment: instalment === null ? null : Math.round(instalment),
    fuel,
    insurance,
    totalMonthly,
    fuelPricePerLitre,
    monthlyKm: params.monthlyKm,
  }
}

/** Cost per 100km of fuel alone, for the "cheapest to run" sort. */
export function fuelCostPer100km(car: Pick<NewCar, 'consumptionL100km'>, pricePerLitre: number): number | null {
  if (car.consumptionL100km === null) return null
  return Math.round(car.consumptionL100km * pricePerLitre)
}

export type NewCarSort = 'price' | 'running' | 'power'

export function sortNewCars(cars: readonly NewCar[], sort: NewCarSort, pricePerLitre: number): NewCar[] {
  const list = [...cars]
  if (sort === 'price') return list.sort((a, b) => a.listPrice - b.listPrice)
  if (sort === 'power') {
    // Cars with no published power figure sink to the bottom rather than
    // sorting as if they were zero.
    return list.sort((a, b) => (b.powerKw ?? -1) - (a.powerKw ?? -1))
  }
  return list.sort((a, b) => {
    const ca = fuelCostPer100km(a, pricePerLitre)
    const cb = fuelCostPer100km(b, pricePerLitre)
    if (ca === null && cb === null) return a.listPrice - b.listPrice
    if (ca === null) return 1
    if (cb === null) return -1
    return ca - cb
  })
}

export function newCarMakes(cars: readonly NewCar[]): string[] {
  return Array.from(new Set(cars.map((c) => c.make))).sort()
}

export function sourceOf(car: NewCar & { source?: { publisher: string; title: string; url: string; publishedAt: string } }) {
  return car.source ?? NEW_CAR_SOURCES[car.sourceId]
}
