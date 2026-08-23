import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DISTANCE_OPTIONS,
  OTHER_OPTION,
  TERM_OPTIONS,
  fuelPriceOptions,
  termLabel,
} from '../lib/input-choices'
import { CITIES_BY_PROVINCE, PROVINCES, citiesFor, OTHER_CITY } from '../lib/data'
import { DEFAULT_FUEL_PRICE_ZAR_PER_L, DEFAULT_MONTHLY_KM } from '../lib/running-cost'
import { SOURCED_FUEL_PRICE } from '../lib/new-cars-source'

/**
 * These lists exist so a user picks instead of typing. The assertions guard the
 * two ways that quietly breaks: an app default that is not in its own list, so
 * the control opens on a blank; and a province with no cities behind it, so
 * choosing it leads to an empty second dropdown.
 */

describe('province and city', () => {
  it('offers cities for every province the app lists', () => {
    for (const province of PROVINCES) {
      const cities = citiesFor(province)
      assert.ok(cities.length > 1, `${province} has no cities`)
      assert.equal(cities[cities.length - 1], OTHER_CITY, `${province} has no escape hatch`)
    }
  })

  it('keeps the two lists in step, so no province is unreachable', () => {
    assert.deepEqual([...PROVINCES].sort(), Object.keys(CITIES_BY_PROVINCE).sort())
  })

  it('returns nothing before a province is chosen', () => {
    assert.deepEqual(citiesFor(''), [])
    assert.deepEqual(citiesFor('Atlantis'), [])
  })

  it('never repeats a city inside one province', () => {
    for (const [province, cities] of Object.entries(CITIES_BY_PROVINCE)) {
      assert.equal(new Set(cities).size, cities.length, `${province} repeats a city`)
    }
  })
})

describe('finance term', () => {
  it('covers the standard South African terms in order', () => {
    assert.ok(TERM_OPTIONS.includes(72))
    assert.deepEqual([...TERM_OPTIONS], [...TERM_OPTIONS].sort((a, b) => a - b))
    assert.ok(TERM_OPTIONS.every((m) => m >= 12 && m <= 96))
  })

  it('describes a term in years as well as months', () => {
    assert.equal(termLabel(12), '12 months (1 year)')
    assert.equal(termLabel(72), '72 months (6 years)')
    // 54 months is 4.5 years and must not render as "4.5 years" with a stray
    // plural bug or as an integer.
    assert.equal(termLabel(54), '54 months (4.5 years)')
  })
})

describe('distance', () => {
  it('includes the running-cost default, so the control never opens blank', () => {
    assert.ok(
      DISTANCE_OPTIONS.some((o) => o.value === DEFAULT_MONTHLY_KM),
      `no option matches DEFAULT_MONTHLY_KM (${DEFAULT_MONTHLY_KM})`,
    )
  })

  it('runs low to high and describes each band in plain words', () => {
    const values = DISTANCE_OPTIONS.map((o) => o.value)
    assert.deepEqual(values, [...values].sort((a, b) => a - b))
    for (const option of DISTANCE_OPTIONS) {
      assert.match(option.label, /km/)
      assert.ok(option.label.length > 6, 'a bare number is not a description')
    }
  })
})

describe('fuel price', () => {
  it('always contains the app default it is offered next to', () => {
    // Both screens seed their control from a different constant, and both have
    // to appear in their own list or the select renders empty.
    assert.ok(fuelPriceOptions(DEFAULT_FUEL_PRICE_ZAR_PER_L).includes(DEFAULT_FUEL_PRICE_ZAR_PER_L))
    assert.ok(
      fuelPriceOptions(SOURCED_FUEL_PRICE.pricePerLitre).includes(SOURCED_FUEL_PRICE.pricePerLitre),
    )
  })

  it('is sorted, positive and free of duplicates', () => {
    const options = fuelPriceOptions(26)
    assert.deepEqual(options, [...options].sort((a, b) => a - b))
    assert.equal(new Set(options).size, options.length)
    assert.ok(options.every((p) => p >= 1))
  })

  it('never offers a negative price for a very low anchor', () => {
    assert.ok(fuelPriceOptions(2).every((p) => p >= 1))
  })
})

describe('escape hatches', () => {
  it('uses a sentinel that cannot collide with a real value', () => {
    // A car named "Other" would otherwise be indistinguishable from the
    // "let me type it" option.
    assert.match(OTHER_OPTION, /^__/)
    assert.notEqual(OTHER_OPTION, OTHER_CITY)
  })
})
