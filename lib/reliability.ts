// F-15 Car Compare, ownership / reliability data.
//
// The rule this module exists to enforce: a reliability figure appears only when
// it comes from a named, real, citable South African source. There is no star
// rating in this file, because inventing one for a real manufacturer would be
// fabricating about a real business, the failure mode the whole product is
// built to avoid.
//
// The registry below is empty. Every model therefore renders the honest-absence
// message, alongside a note naming the sources this app will draw on when the
// data is licensed and ingested. That is the same pattern already used correctly
// for market value, where asking price is shown rather than an invented discount.

export type ReliabilitySourceId = 'cars-co-za-oss' | 'aa-kinsey' | 'aa-autofacts'

export type ReliabilitySource = {
  id: ReliabilitySourceId
  name: string
  publisher: string
  url: string
  measures: string
}

/**
 * Real South African sources for ownership, running-cost and history data.
 * Listed so the interface can tell the user exactly where a figure would come
 * from, and, right now, that none has been ingested.
 */
export const RELIABILITY_SOURCES: ReliabilitySource[] = [
  {
    id: 'cars-co-za-oss',
    name: 'Ownership Satisfaction Survey',
    publisher: 'Cars.co.za, in partnership with Lightstone',
    url: 'https://www.cars.co.za/',
    measures: 'Owner-reported satisfaction and dealer service experience by brand and model.',
  },
  {
    id: 'aa-kinsey',
    name: 'Kinsey Report',
    publisher: 'Automobile Association of South Africa',
    url: 'https://aa.co.za/',
    measures: 'Comparative cost of genuine replacement parts, basket by basket, model by model.',
  },
  {
    id: 'aa-autofacts',
    name: 'AA AutoFacts',
    publisher: 'Automobile Association of South Africa',
    url: 'https://aa.co.za/',
    measures: 'VIN-level vehicle history: accident, theft and finance-settlement records.',
  },
]

export type ReliabilityRecord = {
  /** The figure exactly as the source publishes it, never rescaled or rounded into stars. */
  figure: string
  /** What the figure measures, in the source's own terms. */
  measure: string
  sourceId: ReliabilitySourceId
  /** Survey/report year, so a stale figure is visibly stale. */
  year: number
  url: string
}

/**
 * Keyed by `make model` lowercased. Empty until a licensed dataset is ingested.
 * Adding an entry without `sourceId`, `year` and `url` is a type error.
 */
export const RELIABILITY_BY_MODEL: Record<string, ReliabilityRecord> = {}

export function reliabilityKey(make: string, model: string): string {
  return `${make} ${model}`.trim().toLowerCase()
}

export function reliabilityFor(make: string, model: string): ReliabilityRecord | null {
  return RELIABILITY_BY_MODEL[reliabilityKey(make, model)] ?? null
}

export const RELIABILITY_ABSENT_MESSAGE = 'Reliability data not yet available for this model'

export const RELIABILITY_PROVENANCE_NOTE =
  'We do not publish a reliability score we cannot source. When this is available it will come from the Cars.co.za Ownership Satisfaction Survey (with Lightstone), the AA-Kinsey Report for parts pricing, and AA AutoFacts for vehicle history, each shown with its publisher and year. Until then this row stays empty rather than showing a rating we invented.'

/** Resolve a source record for display next to a figure. */
export function sourceFor(id: ReliabilitySourceId): ReliabilitySource | null {
  return RELIABILITY_SOURCES.find((s) => s.id === id) ?? null
}
