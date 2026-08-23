import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { VEHICLES, type Vehicle } from '../lib/data'
import {
  DIFF_FIELDS,
  MEANINGFUL_MILEAGE_DELTA_KM,
  buildDiffMatrix,
  categoricalDelta,
  numericDelta,
  runningCostConflict,
  similarityGuard,
} from '../lib/compare-helpers'

const car = (over: Partial<Vehicle> = {}): Vehicle => ({
  ...VEHICLES[0],
  ...over,
})

describe('spec-diff materiality', () => {
  it('treats a 2 kW gap as noise and a 40 kW gap as material', () => {
    const noise = numericDelta({
      field: 'powerKw',
      value: 62,
      allValues: [60, 62],
      higherIsBetter: true,
      format: (v) => `${v} kW`,
    })
    assert.equal(noise.material, false)

    const real = numericDelta({
      field: 'powerKw',
      value: 100,
      allValues: [60, 100],
      higherIsBetter: true,
      format: (v) => `${v} kW`,
    })
    assert.equal(real.material, true)
    assert.equal(real.standing, 'best')
    assert.match(real.explanation, /40 kW/)
  })

  it('excludes cars with no value instead of scoring them zero', () => {
    const verdict = numericDelta({
      field: 'powerKw',
      value: null,
      allValues: [null, 81],
      higherIsBetter: true,
      format: (v) => `${v} kW`,
    })
    assert.equal(verdict.material, false)
    assert.equal(verdict.explanation, '')
  })

  it('needs two present values before any delta exists', () => {
    const verdict = numericDelta({
      field: 'powerKw',
      value: 81,
      allValues: [81, null],
      higherIsBetter: true,
      format: (v) => `${v} kW`,
    })
    assert.equal(verdict.material, false)
  })

  it('uses an absolute rule for mileage, not a ratio', () => {
    const small = numericDelta({
      field: 'mileage',
      value: 30000,
      allValues: [30000, 40000],
      higherIsBetter: false,
      format: (v) => `${v} km`,
    })
    assert.equal(small.material, false)

    const big = numericDelta({
      field: 'mileage',
      value: 20000,
      allValues: [20000, 20000 + MEANINGFUL_MILEAGE_DELTA_KM],
      higherIsBetter: false,
      format: (v) => `${v} km`,
    })
    assert.equal(big.material, true)
    assert.equal(big.standing, 'best')
  })

  it('flags any categorical difference and stays quiet when unanimous', () => {
    assert.equal(categoricalDelta('Manual', ['Manual', 'Automatic']).material, true)
    assert.equal(categoricalDelta('Manual', ['Manual', 'Manual']).material, false)
    assert.equal(categoricalDelta(null, ['Manual', 'Automatic']).material, false)
  })

  it('builds a verdict for every diffable attribute and every car', () => {
    const matrix = buildDiffMatrix([
      { id: 'a', values: { price: 200000, mileage: 20000, transmission: 'Manual' } },
      { id: 'b', values: { price: 400000, mileage: 90000, transmission: 'Automatic' } },
    ])
    for (const field of DIFF_FIELDS) {
      assert.ok(matrix[field.attrId], `${field.attrId} row missing`)
      assert.ok(matrix[field.attrId].a && matrix[field.attrId].b)
    }
    assert.equal(matrix.price.a.standing, 'best') // cheaper wins
    assert.equal(matrix.transmission.a.material, true)
  })

  it('never calls a neutral field a winner', () => {
    const matrix = buildDiffMatrix([
      { id: 'a', values: { seats: 5 } },
      { id: 'b', values: { seats: 7 } },
    ])
    assert.equal(matrix.seats.a.standing, 'equal')
    assert.equal(matrix.seats.b.standing, 'equal')
  })
})

describe('too-similar guard', () => {
  it('warns on the same model, year, price and mileage', () => {
    const result = similarityGuard([
      car({ id: 'a', price: 300000, mileage: 30000 }),
      car({ id: 'b', price: 305000, mileage: 30500 }),
    ])
    assert.equal(result.similar, true)
    assert.match(result.message, /very similar/i)
    assert.match(result.message, /dealer reputation, service history, and location/i)
  })

  it('stays quiet when the price gap is over 5%', () => {
    const result = similarityGuard([
      car({ id: 'a', price: 300000, mileage: 30000 }),
      car({ id: 'b', price: 340000, mileage: 30500 }),
    ])
    assert.equal(result.similar, false)
  })

  it('stays quiet for different models at the same price', () => {
    const result = similarityGuard([
      car({ id: 'a', model: 'Polo', price: 300000, mileage: 30000 }),
      car({ id: 'b', model: 'Swift', price: 300000, mileage: 30000 }),
    ])
    assert.equal(result.similar, false)
  })
})

describe('running-cost conflict', () => {
  it('flags a mixed basis and names both sides', () => {
    const conflict = runningCostConflict([
      { name: 'Polo', basis: 'manufacturer', monthly: 2000 },
      { name: 'Corolla', basis: 'assumption', monthly: 2500 },
    ])
    assert.equal(conflict.mixed, true)
    assert.deepEqual(conflict.sourcedNames, ['Polo'])
    assert.deepEqual(conflict.assumedNames, ['Corolla'])
    assert.match(conflict.message, /consumption not listed for Corolla/)
    assert.match(conflict.message, /clearly marked/)
  })

  it('stays quiet when every car uses the same basis', () => {
    assert.equal(
      runningCostConflict([
        { name: 'Polo', basis: 'assumption', monthly: 2000 },
        { name: 'Swift', basis: 'assumption', monthly: 1900 },
      ]).mixed,
      false,
    )
  })
})
