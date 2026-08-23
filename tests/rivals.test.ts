import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CLOSENESS_PCT,
  OPPOSITE_MIN_DISTANCE,
  compareAxes,
  explainMatch,
  findRivals,
  isSameNameplate,
  searchNewCars,
} from '../lib/rivals'
import { NEW_CARS, type NewCar } from '../lib/new-cars-source'

/**
 * The point of these assertions is the honesty rule, not the ranking. A rival
 * must never be produced from a figure that does not exist, and an axis that
 * one row leaves null must be reported as dropped rather than treated as zero.
 */

function car(over: Partial<NewCar> & { id: string }): NewCar {
  return {
    make: 'Test',
    model: 'Model',
    variant: '1.0',
    bodyType: 'Hatchback',
    listPrice: 200000,
    fuel: 'Petrol',
    transmission: 'Manual',
    engineCc: 1000,
    cylinders: 3,
    powerKw: 50,
    torqueNm: 90,
    consumptionL100km: 5,
    tankLitres: null,
    seats: null,
    bootLitres: null,
    ncapStars: null,
    ncapProgramme: null,
    imageUrl: null,
    sourceId: 'at-cheapest-2026',
    ...over,
  }
}

describe('axis comparison', () => {
  it('drops an axis when either row published nothing, rather than scoring it', () => {
    const chosen = car({ id: 'a', powerKw: null })
    const other = car({ id: 'b', powerKw: 60 })
    const { axes, missing } = compareAxes(chosen, other)
    assert.ok(missing.includes('power'), 'power should be dropped')
    assert.equal(axes.find((a) => a.axis === 'power'), undefined)
  })

  it('never treats a null figure as a zero difference', () => {
    const chosen = car({ id: 'a', consumptionL100km: null })
    const other = car({ id: 'b', consumptionL100km: null })
    const { axes } = compareAxes(chosen, other)
    assert.equal(axes.some((a) => a.axis === 'consumption'), false)
  })

  it('calls a price inside the threshold close and one outside it far', () => {
    const chosen = car({ id: 'a', listPrice: 200000 })
    const inside = compareAxes(chosen, car({ id: 'b', listPrice: 220000 })) // +10%
    const outside = compareAxes(chosen, car({ id: 'c', listPrice: 260000 })) // +30%
    assert.equal(inside.axes.find((a) => a.axis === 'price')!.close, true)
    assert.equal(outside.axes.find((a) => a.axis === 'price')!.close, false)
    assert.ok(CLOSENESS_PCT.price > 10 && CLOSENESS_PCT.price < 30)
  })

  it('states the two actual figures in the note', () => {
    const note = compareAxes(car({ id: 'a', powerKw: 50 }), car({ id: 'b', powerKw: 75 }))
      .axes.find((a) => a.axis === 'power')!.note
    assert.match(note, /75 kW/)
    assert.match(note, /50 kW/)
    assert.match(note, /50% more/)
  })

  it('compares body and fuel type on every pair, because every row carries them', () => {
    const { axes } = compareAxes(
      car({ id: 'a', bodyType: 'Hatchback', fuel: 'Petrol' }),
      car({ id: 'b', bodyType: 'Crossover', fuel: 'Diesel' }),
    )
    assert.equal(axes.find((a) => a.axis === 'body')!.close, false)
    assert.equal(axes.find((a) => a.axis === 'fuel')!.close, false)
  })
})

describe('nameplates', () => {
  it('treats another trim of the same model as a derivative, not a rival', () => {
    const chosen = car({ id: 'a', make: 'Suzuki', model: 'Swift', variant: 'GA' })
    const trim = car({ id: 'b', make: 'Suzuki', model: 'Swift', variant: 'GL', listPrice: 230000 })
    const other = car({ id: 'c', make: 'Toyota', model: 'Starlet' })
    assert.equal(isSameNameplate(chosen, trim), true)
    assert.equal(isSameNameplate(chosen, other), false)

    const report = findRivals(chosen, [chosen, trim, other])
    assert.deepEqual(report.derivatives.map((d) => d.car.id), ['b'])
    assert.deepEqual(report.rivals.map((r) => r.car.id), ['c'])
  })

  it('never returns the chosen car as its own rival', () => {
    const chosen = car({ id: 'a' })
    const report = findRivals(chosen, [chosen, car({ id: 'b' })])
    assert.equal(report.rivals.some((r) => r.car.id === 'a'), false)
    assert.equal(report.opposites.some((r) => r.car.id === 'a'), false)
  })
})

describe('rivals and opposites', () => {
  const chosen = car({ id: 'chosen', listPrice: 200000, engineCc: 1000, powerKw: 50, consumptionL100km: 5 })
  const twin = car({ id: 'twin', make: 'Other', listPrice: 205000, engineCc: 1000, powerKw: 52, consumptionL100km: 5.1 })
  const far = car({
    id: 'far',
    make: 'Other',
    model: 'Big',
    bodyType: 'Crossover',
    fuel: 'Diesel',
    listPrice: 420000,
    engineCc: 2000,
    powerKw: 120,
    consumptionL100km: 8,
  })

  const report = findRivals(chosen, [chosen, twin, far])

  it('ranks the near-identical car first', () => {
    assert.equal(report.rivals[0].car.id, 'twin')
    assert.equal(report.rivals[0].closeness, 1)
  })

  it('puts the distant car in opposites and not at the top of rivals', () => {
    assert.equal(report.opposites[0].car.id, 'far')
    assert.equal(report.rivals[0].car.id, 'twin')
    assert.ok(report.opposites[0].distance >= OPPOSITE_MIN_DISTANCE)
  })

  it('refuses to call a merely different car an opposite', () => {
    // Same body, same fuel, same engine, 10% more money: different, not opposite.
    const mild = car({ id: 'mild', make: 'Other', model: 'Mild', listPrice: 220000 })
    const only = findRivals(chosen, [chosen, mild])
    assert.equal(only.rivals.length, 1)
    assert.equal(only.opposites.length, 0)
  })

  it('explains a match only from axes it actually measured', () => {
    const sparse = car({ id: 'sparse', make: 'Other', model: 'Sparse', powerKw: null, engineCc: null, consumptionL100km: null })
    const m = findRivals(chosen, [chosen, sparse]).rivals[0]
    const line = explainMatch(m, 'rival')
    assert.doesNotMatch(line, /power/)
    assert.doesNotMatch(line, /engine size/)
    assert.deepEqual(m.missingAxes.sort(), ['consumption', 'engine', 'power'])
  })

  it('honours the limit', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      car({ id: `m${i}`, make: 'Other', model: `M${i}`, listPrice: 200000 + i * 1000 }),
    )
    assert.equal(findRivals(chosen, [chosen, ...many], 3).rivals.length, 3)
  })
})

describe('against the real catalogue', () => {
  const vivo = NEW_CARS.find((c) => c.model.toLowerCase().includes('polo vivo')) ?? NEW_CARS[0]

  it('produces rivals for a real row without inventing any figure', () => {
    const report = findRivals(vivo, NEW_CARS)
    assert.ok(report.rivals.length > 0)
    for (const rival of report.rivals) {
      for (const axis of rival.axes) {
        if (axis.axis === 'power') {
          assert.notEqual(rival.car.powerKw, null)
          assert.notEqual(vivo.powerKw, null)
        }
        if (axis.axis === 'consumption') {
          assert.notEqual(rival.car.consumptionL100km, null)
        }
      }
    }
  })

  it('never lists the same car as both a rival and a derivative', () => {
    const report = findRivals(vivo, NEW_CARS)
    const rivalIds = new Set(report.rivals.map((r) => r.car.id))
    for (const d of report.derivatives) assert.equal(rivalIds.has(d.car.id), false)
  })
})

describe('catalogue search', () => {
  it('finds a car by model name and by make plus model', () => {
    assert.ok(searchNewCars('vivo', NEW_CARS).length > 0)
    assert.ok(searchNewCars('suzuki swift', NEW_CARS).length > 0)
  })

  it('returns nothing for an empty or unmatched term rather than a default car', () => {
    assert.deepEqual(searchNewCars('', NEW_CARS), [])
    assert.deepEqual(searchNewCars('lamborghini', NEW_CARS), [])
  })

  it('is deterministic', () => {
    const a = searchNewCars('swift', NEW_CARS).map((c) => c.id)
    const b = searchNewCars('swift', NEW_CARS).map((c) => c.id)
    assert.deepEqual(a, b)
  })
})
