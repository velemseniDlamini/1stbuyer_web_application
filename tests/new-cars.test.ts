import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  NEW_CARS,
  NEW_CAR_SOURCES,
  PRICE_STALE_AFTER_DAYS,
  SOURCED_FUEL_PRICE,
  priceAgeDays,
  priceIsStale,
  sourceFor,
} from '../lib/new-cars-source'
import {
  estimateNewCarCosts,
  fuelCostPer100km,
  newCarMakes,
  rowToNewCar,
  sortNewCars,
} from '../lib/new-cars'
import { estimateInstalment } from '../lib/finance'

const NOW = new Date('2026-08-21T09:00:00.000Z')

describe('new-car provenance', () => {
  it('gives every car a source that exists', () => {
    assert.ok(NEW_CARS.length >= 20)
    for (const car of NEW_CARS) {
      const source = sourceFor(car)
      assert.ok(source, `${car.id} cites a source that is not defined`)
      assert.ok(source.publisher && source.title)
      assert.match(source.url, /^https:\/\//)
      assert.match(source.publishedAt, /^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('gives every car a real price and a body type', () => {
    for (const car of NEW_CARS) {
      assert.ok(car.listPrice > 0, `${car.id} has no price`)
      assert.ok(['Hatchback', 'Sedan', 'Crossover', 'MPV'].includes(car.bodyType))
    }
  })

  it('uses null for anything the source did not publish, never zero', () => {
    for (const car of NEW_CARS) {
      for (const field of ['powerKw', 'torqueNm', 'engineCc', 'consumptionL100km', 'bootLitres'] as const) {
        const value = car[field]
        assert.ok(value === null || (typeof value === 'number' && value > 0),
          `${car.id}.${field} is ${value}: absent data must be null, not zero`)
      }
    }
  })

  it('only claims a photograph for models this repo actually holds', () => {
    const withImages = NEW_CARS.filter((c) => c.imageUrl !== null)
    for (const car of withImages) {
      assert.match(car.imageUrl!, /^\/cars\/[a-z0-9-]+\.png$/)
      // The file name must relate to the model, so a Swift never shows a Polo.
      const slug = car.model.toLowerCase().replace(/[^a-z0-9]/g, '-')
      assert.ok(
        car.imageUrl!.includes(slug),
        `${car.id} points at ${car.imageUrl}, which is not a photo of a ${car.model}`,
      )
    }
    // Most rows genuinely have no photo, and that is expected.
    assert.ok(NEW_CARS.filter((c) => c.imageUrl === null).length > withImages.length)
  })

  it('flags a price older than the staleness window', () => {
    const march = NEW_CARS.find((c) => c.sourceId === 'at-cheapest-2026')!
    assert.ok(priceAgeDays(march, NOW) > PRICE_STALE_AFTER_DAYS)
    assert.equal(priceIsStale(march, NOW), true)

    const fresh = new Date('2026-03-10T00:00:00.000Z')
    assert.equal(priceIsStale(march, fresh), false)
  })

  it('sources the default fuel price rather than assuming it', () => {
    assert.equal(SOURCED_FUEL_PRICE.pricePerLitre, 26)
    const source = NEW_CAR_SOURCES[SOURCED_FUEL_PRICE.sourceId]
    assert.ok(source)
    assert.match(source.title, /R26/)
  })
})

describe('new-car cost estimates', () => {
  const car = { listPrice: 200000, consumptionL100km: 5 }

  it('locks the instalment without a usable credit score', () => {
    const costs = estimateNewCarCosts({
      car, score: null, monthlyKm: 1000, driverAge: 30, licenceYears: 5,
    })
    assert.equal(costs.instalment, null)
    assert.equal(costs.totalMonthly, null, 'a total must not be shown when a component is locked')
    // Fuel and insurance do not depend on credit, so they still compute.
    assert.ok(costs.fuel !== null && costs.fuel > 0)
    assert.ok(costs.insurance > 0)
  })

  it('treats a zero score as no score', () => {
    const costs = estimateNewCarCosts({
      car, score: 0, monthlyKm: 1000, driverAge: 30, licenceYears: 5,
    })
    assert.equal(costs.instalment, null)
  })

  it('agrees with the instalment used everywhere else', () => {
    const costs = estimateNewCarCosts({
      car, score: 712, monthlyKm: 1000, driverAge: 30, licenceYears: 5,
    })
    assert.equal(costs.instalment, Math.round(estimateInstalment(car.listPrice, 712)))
  })

  it('computes fuel from the published figure only', () => {
    const costs = estimateNewCarCosts({
      car, score: 712, monthlyKm: 1000, fuelPricePerLitre: 26, driverAge: 30, licenceYears: 5,
    })
    // 5 l/100km over 1000 km at R26 = 50 litres = R1300
    assert.equal(costs.fuel, 1300)
  })

  it('refuses to invent fuel cost when no consumption was published', () => {
    const costs = estimateNewCarCosts({
      car: { listPrice: 200000, consumptionL100km: null },
      score: 712, monthlyKm: 1000, driverAge: 30, licenceYears: 5,
    })
    assert.equal(costs.fuel, null)
    assert.equal(costs.totalMonthly, null)
  })

  it('sums a total only when every component is real', () => {
    const costs = estimateNewCarCosts({
      car, score: 712, monthlyKm: 1000, fuelPricePerLitre: 26, driverAge: 30, licenceYears: 5,
    })
    assert.equal(costs.totalMonthly, costs.instalment! + costs.fuel! + costs.insurance)
  })

  it('prices fuel per 100km, or nothing at all', () => {
    assert.equal(fuelCostPer100km({ consumptionL100km: 5 }, 26), 130)
    assert.equal(fuelCostPer100km({ consumptionL100km: null }, 26), null)
  })
})

describe('new-car sorting', () => {
  it('sorts cheapest first by list price', () => {
    const sorted = sortNewCars(NEW_CARS, 'price', 26)
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i].listPrice >= sorted[i - 1].listPrice)
    }
  })

  it('sinks cars with no published power to the bottom instead of scoring them zero', () => {
    const sorted = sortNewCars(NEW_CARS, 'power', 26)
    const firstNull = sorted.findIndex((c) => c.powerKw === null)
    assert.ok(firstNull > 0, 'expected at least one car with a power figure first')
    // Everything after the first null must also be null.
    for (let i = firstNull; i < sorted.length; i++) {
      assert.equal(sorted[i].powerKw, null)
    }
  })

  it('sinks cars with no consumption to the bottom of the running-cost sort', () => {
    const sorted = sortNewCars(NEW_CARS, 'running', 26)
    const firstNull = sorted.findIndex((c) => c.consumptionL100km === null)
    if (firstNull === -1) return
    for (let i = firstNull; i < sorted.length; i++) {
      assert.equal(sorted[i].consumptionL100km, null)
    }
  })

  it('lists every make once, sorted', () => {
    const makes = newCarMakes(NEW_CARS)
    assert.deepEqual(makes, [...makes].sort())
    assert.equal(new Set(makes).size, makes.length)
  })
})

describe('database row mapping', () => {
  it('converts numeric strings from postgres and keeps nulls null', () => {
    const car = rowToNewCar({
      id: 'nc-x', make: 'Suzuki', model: 'Swift', variant: '1.2', body_type: 'Hatchback',
      list_price: 227900, fuel: 'Petrol', transmission: 'Manual',
      engine_cc: 1200, cylinders: 4,
      // Postgres returns numeric columns as strings.
      power_kw: '61.0', torque_nm: '113.0', consumption_l100km: '4.9',
      tank_litres: null, seats: null, boot_litres: null,
      ncap_stars: null, ncap_programme: null, image_url: '/cars/suzuki-swift.png',
      source_name: 'AutoTrader South Africa', source_title: 'Top 10',
      source_url: 'https://example.com/x', source_published_at: '2026-03-03',
    })

    assert.equal(car.powerKw, 61)
    assert.equal(car.torqueNm, 113)
    assert.equal(car.consumptionL100km, 4.9)
    assert.equal(car.bootLitres, null)
    assert.equal(car.seats, null)
    assert.equal(car.source.publisher, 'AutoTrader South Africa')
  })
})
