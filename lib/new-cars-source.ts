// Brand-new car catalogue: researched, sourced, dated.
//
// HOW THIS DIFFERS FROM lib/specs.ts
//
// lib/specs.ts is empty because no specification for the used listings had a
// citable source. These rows do: every one was read off a published article,
// and every row carries the publisher, the URL and the date it was published.
// Nothing here is remembered, inferred or filled in to look complete. Where a
// source did not state a figure, the field is null and the interface says
// "Not listed".
//
// TWO THINGS A READER MUST UNDERSTAND
//
// 1. Prices are LIST prices as published on the stated date. South African car
//    prices move several times a year. The date travels with the number
//    everywhere it is displayed, and a price older than 90 days is flagged.
// 2. The same nameplate appears more than once at different prices because
//    those are different derivatives captured on different dates. They are not
//    contradictions and they are not silently reconciled: each row shows its
//    own derivative, price and source.

export type NewCarSource = {
  id: string
  publisher: string
  title: string
  url: string
  /** Publication date as stated on the article. */
  publishedAt: string
}

export const NEW_CAR_SOURCES: Record<string, NewCarSource> = {
  'at-cheapest-2026': {
    id: 'at-cheapest-2026',
    publisher: 'AutoTrader South Africa',
    title: 'Top 10 cheapest new cars on sale in South Africa right now',
    url: 'https://www.autotrader.co.za/cars/news-and-advice/buying-a-car/top-10-cheapest-new-cars-on-sale-in-south-africa-right-now/16771',
    publishedAt: '2026-03-03',
  },
  'at-under-300k': {
    id: 'at-under-300k',
    publisher: 'AutoTrader South Africa',
    title: 'Best new entry-level cars under R300k (for first-time buyers)',
    url: 'https://www.autotrader.co.za/cars/news-and-advice/buying-a-car/best-new-entry-level-cars-under-r300k-(for-first-time-buyers)/16669',
    publishedAt: '2026-02-13',
  },
  'at-tco-2026': {
    id: 'at-tco-2026',
    publisher: 'AutoTrader South Africa',
    title: 'Polo Vivo vs Starlet vs Swift: the 2026 total cost of ownership',
    url: 'https://www.autotrader.co.za/cars/news-and-advice/automotive-news/polo-vivo-vs-starlet-vs-swift-the-2026-total-cost-of-ownership/17320',
    publishedAt: '2026-07-17',
  },
  'at-cheapest-to-run': {
    id: 'at-cheapest-to-run',
    publisher: 'AutoTrader South Africa',
    title: 'Cheapest cars to run in South Africa in 2026 with fuel prices at R26/L',
    url: 'https://www.autotrader.co.za/cars/news-and-advice/buying-a-car/cheapest-cars-to-run-in-south-africa-in-2026-with-fuel-prices-at-r26-l/17070',
    publishedAt: '2026-05-13',
  },
}

export type BodyType = 'Hatchback' | 'Sedan' | 'Crossover' | 'MPV'

export type NewCar = {
  id: string
  make: string
  model: string
  /** The derivative exactly as the source names it. */
  variant: string
  bodyType: BodyType
  listPrice: number
  fuel: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric'
  transmission: 'Manual' | 'Automatic' | null
  engineCc: number | null
  cylinders: number | null
  powerKw: number | null
  torqueNm: number | null
  /** Manufacturer claimed combined cycle, as published by the source. */
  consumptionL100km: number | null
  tankLitres: number | null
  seats: number | null
  bootLitres: number | null
  ncapStars: number | null
  ncapProgramme: string | null
  /** Only set where this repository actually holds a photograph. */
  imageUrl: string | null
  sourceId: keyof typeof NEW_CAR_SOURCES
}

/**
 * Images: only three of these models have a photograph in public/cars. The rest
 * are null and render an honest placeholder. A stand-in photo of a different
 * model would misrepresent the car being priced, which is worse than no photo.
 */
export const NEW_CARS: NewCar[] = [
  {
    id: 'nc-kwid-evolution',
    make: 'Renault', model: 'Kwid', variant: '1.0 Evolution', bodyType: 'Hatchback',
    listPrice: 178799, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1000, cylinders: 3, powerKw: 50, torqueNm: 91,
    consumptionL100km: 4.7, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-vitz-10',
    make: 'Toyota', model: 'Vitz', variant: '1.0', bodyType: 'Hatchback',
    listPrice: 178800, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1000, cylinders: 3, powerKw: 49, torqueNm: 89,
    consumptionL100km: 4.4, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-spresso-gl',
    make: 'Suzuki', model: 'S-Presso', variant: '1.0 GL', bodyType: 'Hatchback',
    listPrice: 178900, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1000, cylinders: 3, powerKw: 49, torqueNm: 89,
    consumptionL100km: 4.6, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-celerio-ga',
    make: 'Suzuki', model: 'Celerio', variant: '1.0 GA', bodyType: 'Hatchback',
    listPrice: 188900, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1000, cylinders: 3, powerKw: 49, torqueNm: 89,
    consumptionL100km: 4.2, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-tiago-12',
    make: 'Tata', model: 'Tiago', variant: '1.2', bodyType: 'Hatchback',
    listPrice: 189900, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1200, cylinders: 3, powerKw: 63, torqueNm: 113,
    consumptionL100km: 5.0, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-saga-13',
    make: 'Proton', model: 'Saga', variant: '1.3', bodyType: 'Sedan',
    listPrice: 209900, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1300, cylinders: 4, powerKw: 70, torqueNm: 120,
    consumptionL100km: 6.3, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-triber-evolution',
    make: 'Renault', model: 'Triber', variant: '1.0 Evolution', bodyType: 'MPV',
    listPrice: 218999, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1000, cylinders: 3, powerKw: 53, torqueNm: 96,
    consumptionL100km: 5.5, tankLitres: null, seats: 7, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-kiger-evolution',
    make: 'Renault', model: 'Kiger', variant: '1.0 Evolution', bodyType: 'Crossover',
    listPrice: 219999, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1000, cylinders: 3, powerKw: 52, torqueNm: 96,
    consumptionL100km: 5.4, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-grand-i10',
    make: 'Hyundai', model: 'Grand i10', variant: '1.0', bodyType: 'Hatchback',
    listPrice: 224900, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1000, cylinders: 3, powerKw: 49, torqueNm: 94,
    consumptionL100km: 5.5, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-swift-12',
    make: 'Suzuki', model: 'Swift', variant: '1.2', bodyType: 'Hatchback',
    listPrice: 227900, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1200, cylinders: 4, powerKw: 61, torqueNm: 113,
    consumptionL100km: 4.9, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null,
    imageUrl: '/cars/suzuki-swift.png', sourceId: 'at-cheapest-2026',
  },
  {
    id: 'nc-swift-gl-plus',
    make: 'Suzuki', model: 'Swift', variant: '1.2 GL+ manual', bodyType: 'Hatchback',
    listPrice: 250900, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1200, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: 4.4, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null,
    imageUrl: '/cars/suzuki-swift.png', sourceId: 'at-tco-2026',
  },
  {
    id: 'nc-baleno',
    make: 'Suzuki', model: 'Baleno', variant: 'from', bodyType: 'Hatchback',
    listPrice: 247900, fuel: 'Petrol', transmission: null,
    engineCc: null, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: 4.4, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
  {
    id: 'nc-dzire',
    make: 'Suzuki', model: 'Dzire', variant: '1.2', bodyType: 'Sedan',
    listPrice: 252900, fuel: 'Petrol', transmission: null,
    engineCc: 1200, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: 4.5, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
  {
    id: 'nc-amaze',
    make: 'Honda', model: 'Amaze', variant: 'from', bodyType: 'Sedan',
    listPrice: 254900, fuel: 'Petrol', transmission: null,
    engineCc: null, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: null, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
  {
    id: 'nc-xuv-3xo',
    make: 'Mahindra', model: 'XUV 3XO', variant: '1.2 turbo', bodyType: 'Crossover',
    listPrice: 259999, fuel: 'Petrol', transmission: null,
    engineCc: 1200, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: 5.6, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
  {
    id: 'nc-starlet-xi',
    make: 'Toyota', model: 'Starlet', variant: '1.5 Xi', bodyType: 'Hatchback',
    listPrice: 273700, fuel: 'Petrol', transmission: null,
    engineCc: 1500, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: 5.4, tankLitres: 36, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null,
    imageUrl: '/cars/toyota-starlet.png', sourceId: 'at-tco-2026',
  },
  {
    id: 'nc-polo-vivo-14',
    make: 'Volkswagen', model: 'Polo Vivo', variant: 'Hatch 1.4', bodyType: 'Hatchback',
    listPrice: 271900, fuel: 'Petrol', transmission: 'Manual',
    engineCc: 1400, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: 5.9, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: 4, ncapProgramme: 'Global NCAP (adult occupant)',
    imageUrl: null, sourceId: 'at-tco-2026',
  },
  {
    id: 'nc-magnite',
    make: 'Nissan', model: 'Magnite', variant: 'from', bodyType: 'Crossover',
    listPrice: 277300, fuel: 'Petrol', transmission: null,
    engineCc: null, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: null, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
  {
    id: 'nc-tiggo-4-pro',
    make: 'Chery', model: 'Tiggo 4 Pro', variant: 'from', bodyType: 'Crossover',
    listPrice: 279900, fuel: 'Petrol', transmission: null,
    engineCc: null, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: null, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
  {
    id: 'nc-mg-zs',
    make: 'MG', model: 'ZS', variant: 'from', bodyType: 'Crossover',
    listPrice: 289900, fuel: 'Petrol', transmission: null,
    engineCc: null, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: null, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
  {
    id: 'nc-exter',
    make: 'Hyundai', model: 'Exter', variant: 'from', bodyType: 'Crossover',
    listPrice: 289900, fuel: 'Petrol', transmission: null,
    engineCc: null, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: null, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
  {
    id: 'nc-fronx',
    make: 'Suzuki', model: 'Fronx', variant: 'from', bodyType: 'Crossover',
    listPrice: 299900, fuel: 'Petrol', transmission: null,
    engineCc: null, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: 4.8, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
  {
    id: 'nc-sonet-ls',
    make: 'Kia', model: 'Sonet', variant: 'LS manual', bodyType: 'Crossover',
    listPrice: 299995, fuel: 'Petrol', transmission: 'Manual',
    engineCc: null, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: 6.6, tankLitres: null, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null,
    imageUrl: '/cars/kia-sonet.png', sourceId: 'at-under-300k',
  },
  {
    id: 'nc-mg3',
    make: 'MG', model: 'MG3', variant: '1.5 (non-hybrid)', bodyType: 'Hatchback',
    listPrice: 299000, fuel: 'Petrol', transmission: null,
    engineCc: 1500, cylinders: null, powerKw: null, torqueNm: null,
    consumptionL100km: 6.0, tankLitres: 45, seats: null, bootLitres: null,
    ncapStars: null, ncapProgramme: null, imageUrl: null, sourceId: 'at-under-300k',
  },
]

/**
 * Pump price used by the running-cost estimate. Sourced rather than assumed:
 * AutoTrader's May 2026 running-cost analysis is built on R26/litre.
 */
export const SOURCED_FUEL_PRICE = {
  pricePerLitre: 26,
  sourceId: 'at-cheapest-to-run' as const,
}

export function sourceFor(car: NewCar): NewCarSource {
  return NEW_CAR_SOURCES[car.sourceId]
}

/** A published price ages. Past this many days the interface says so. */
export const PRICE_STALE_AFTER_DAYS = 90

export function priceAgeDays(car: NewCar, now: Date = new Date()): number {
  const published = new Date(sourceFor(car).publishedAt).getTime()
  if (!Number.isFinite(published)) return Number.POSITIVE_INFINITY
  return Math.floor((now.getTime() - published) / 86_400_000)
}

export function priceIsStale(car: NewCar, now: Date = new Date()): boolean {
  return priceAgeDays(car, now) > PRICE_STALE_AFTER_DAYS
}

export const NEW_CAR_PROVENANCE_NOTE =
  'Every price and specification here was read off a published article, and each card names the publisher and the date. Prices are list prices on that date and change through the year, so treat an older figure as a starting point and confirm with the dealer. Where a source did not state a figure we leave it blank rather than filling it in.'
