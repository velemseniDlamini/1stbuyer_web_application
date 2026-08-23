import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { VEHICLES } from '../lib/data'
import {
  COMPARE_ATTRIBUTES,
  MAX_COMPARE,
  NOT_LISTED,
  buildCarComparison,
  buildComparison,
  buildComparisonEvent,
  buildComparisonSummary,
  canPersonalise,
  compareHref,
  instalmentAtRate,
  lowestInstalmentId,
  parseCompareIds,
  satisfiesKnowTheMarket,
  specCell,
  toggleCompareId,
  type CompareContext,
} from '../lib/compare'
import { EMPTY_SPEC, type CarSpec } from '../lib/specs'
import { estimateInstalment, isUsableScore, targetRateForScore } from '../lib/finance'

const CAR = VEHICLES[0]
const OTHER = VEHICLES[1]

function ctx(overrides: Partial<CompareContext> = {}): CompareContext {
  return {
    score: 712,
    monthlyIncome: 32000,
    driverAge: 29,
    licenceYears: 7,
    fuelPricePerL: 22.5,
    monthlyKm: 1200,
    ...overrides,
  }
}

/* --------------------------------------------------- the credit-score gate -- */

describe('credit gate', () => {
  it('never produces an instalment number without a recorded score', () => {
    const c = buildCarComparison(CAR, ctx({ score: null }))
    assert.equal(c.instalment, null)
    assert.equal(c.affordability, null)
    assert.equal(c.cells.instalment.kind, 'locked')
    assert.equal(c.cells.affordability.kind, 'locked')
  })

  it('treats a score of exactly 0 as no score at all', () => {
    assert.equal(isUsableScore(0), false)
    assert.equal(canPersonalise({ score: 0 }), false)
    const c = buildCarComparison(CAR, ctx({ score: 0 }))
    assert.equal(c.instalment, null)
    assert.equal(c.cells.instalment.kind, 'locked')
  })

  it('treats implausible and non-finite scores as no score', () => {
    for (const bad of [-50, 1200, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(isUsableScore(bad), false, `${bad} should not be usable`)
      assert.equal(buildCarComparison(CAR, ctx({ score: bad })).instalment, null)
    }
  })

  it('no locked cell ever renders a digit', () => {
    const c = buildCarComparison(CAR, ctx({ score: null }))
    for (const attr of COMPARE_ATTRIBUTES) {
      const cell = c.cells[attr.id]
      if (cell.kind !== 'locked') continue
      assert.ok(!/\d/.test(cell.display), `${attr.id} leaked a number: ${cell.display}`)
    }
  })

  it('unlocks the numbers once a real score exists', () => {
    const c = buildCarComparison(CAR, ctx({ score: 712 }))
    assert.equal(typeof c.instalment, 'number')
    assert.equal(c.cells.instalment.kind, 'value')
    assert.ok((c.instalment as number) > 0)
  })
})

/* ------------------------------------------------- per-user rate fairness -- */

describe('instalments are personal', () => {
  it('two users with different credit bands see different instalments for the same car', () => {
    const excellent = buildCarComparison(CAR, ctx({ score: 800 })).instalment as number
    const needsWork = buildCarComparison(CAR, ctx({ score: 500 })).instalment as number

    assert.ok(excellent > 0 && needsWork > 0)
    assert.notEqual(excellent, needsWork)
    // The stronger score must be the cheaper one, not merely different.
    assert.ok(
      excellent < needsWork,
      `expected the excellent band to be cheaper (${excellent} vs ${needsWork})`,
    )
    assert.ok(targetRateForScore(800) < targetRateForScore(500))
  })

  it('agrees exactly with the instalment shown on the vehicle card in Explore', () => {
    for (const score of [null, 620, 712, 800]) {
      const fromCompare = buildCarComparison(CAR, ctx({ score }))
      if (score === null) {
        assert.equal(fromCompare.instalment, null)
        continue
      }
      assert.equal(fromCompare.instalment, estimateInstalment(CAR.price, score))
    }
  })

  it('prices a cheaper car lower at an identical rate', () => {
    const cheap = instalmentAtRate(200000, 13.25)
    const dear = instalmentAtRate(400000, 13.25)
    assert.ok(cheap < dear)
  })
})

/* ------------------------------------------------------ spec parity rules -- */

describe('spec parity and missing data', () => {
  it('renders an absent spec as "Not listed", never a zero', () => {
    const cell = specCell(EMPTY_SPEC, 'powerKw', (kw) => `${kw} kW`)
    assert.equal(cell.kind, 'missing')
    assert.equal(cell.display, NOT_LISTED)
    assert.ok(!/\b0\b/.test(cell.display))
  })

  it('never calls the formatter for a null value', () => {
    let called = false
    specCell(EMPTY_SPEC, 'engineCc', () => {
      called = true
      return 'should not happen'
    })
    assert.equal(called, false)
  })

  it('formats a sourced spec value when one exists', () => {
    const spec: CarSpec = {
      ...EMPTY_SPEC,
      powerKw: 81,
      source: 'Manufacturer spec sheet',
      sourceUrl: 'https://example.invalid/spec',
      capturedAt: '2026-08-01',
    }
    const cell = specCell(spec, 'powerKw', (kw) => `${kw} kW`)
    assert.equal(cell.kind, 'value')
    assert.equal(cell.display, '81 kW')
  })

  it('asks every car exactly the same questions, in the same order', () => {
    const comparisons = buildComparison([CAR, OTHER, VEHICLES[2]], ctx())
    const expected = COMPARE_ATTRIBUTES.map((a) => a.id)
    for (const c of comparisons) {
      assert.deepEqual(Object.keys(c.cells).sort(), [...expected].sort())
      for (const id of expected) {
        assert.ok(c.cells[id], `${c.vehicle.id} is missing the ${id} row`)
      }
    }
  })

  it('has no duplicate attribute ids or labels', () => {
    const ids = COMPARE_ATTRIBUTES.map((a) => a.id)
    const labels = COMPARE_ATTRIBUTES.map((a) => a.label)
    assert.equal(new Set(ids).size, ids.length)
    assert.equal(new Set(labels).size, labels.length)
  })

  it('reports reliability as unavailable rather than inventing a rating', () => {
    const c = buildCarComparison(CAR, ctx())
    assert.equal(c.cells.reliability.kind, 'missing')
    assert.match(String(c.cells.reliability.note), /not yet available/i)
  })
})

/* -------------------------------------------------------------- selection -- */

describe('selection model', () => {
  it('refuses a fourth car instead of silently dropping it', () => {
    const three = ['v1', 'v2', 'v3']
    const result = toggleCompareId(three, 'v4')
    assert.equal(result.rejected, true)
    assert.deepEqual(result.ids, three)
    assert.equal(result.ids.length, MAX_COMPARE)
  })

  it('removes an already-selected car without rejecting', () => {
    const result = toggleCompareId(['v1', 'v2'], 'v1')
    assert.equal(result.rejected, false)
    assert.deepEqual(result.ids, ['v2'])
  })

  it('parses a shared URL, dropping unknown and duplicate ids', () => {
    const ids = parseCompareIds(`${CAR.id},${CAR.id},not-a-car,${OTHER.id}`, VEHICLES)
    assert.deepEqual(ids, [CAR.id, OTHER.id])
  })

  it('caps a hand-edited URL at the maximum', () => {
    const many = VEHICLES.map((v) => v.id).join(',')
    assert.equal(parseCompareIds(many, VEHICLES).length, MAX_COMPARE)
  })

  it('round-trips ids through the compare href', () => {
    assert.equal(compareHref([CAR.id, OTHER.id]), `/compare?cars=${CAR.id},${OTHER.id}`)
    assert.equal(compareHref([]), '/compare')
  })

  it('ranks the cheapest instalment only when the numbers exist', () => {
    const priced = buildComparison([CAR, OTHER], ctx({ score: 712 }))
    assert.ok(lowestInstalmentId(priced))
    const locked = buildComparison([CAR, OTHER], ctx({ score: null }))
    assert.equal(lowestInstalmentId(locked), null)
  })
})

/* ------------------------------------------------------- journey plumbing -- */

describe('journey event', () => {
  it('counts only a real, personalised comparison of two or more cars', () => {
    const twoWithScore = buildComparisonEvent([CAR.id, OTHER.id], { score: 712 })
    const twoWithout = buildComparisonEvent([CAR.id, OTHER.id], { score: null })
    const oneWithScore = buildComparisonEvent([CAR.id], { score: 712 })

    assert.equal(satisfiesKnowTheMarket([twoWithScore]), true)
    assert.equal(satisfiesKnowTheMarket([twoWithout]), false)
    assert.equal(satisfiesKnowTheMarket([oneWithScore]), false)
    assert.equal(satisfiesKnowTheMarket([]), false)
  })

  it('records what was compared and when', () => {
    const at = new Date('2026-08-20T10:00:00.000Z')
    const event = buildComparisonEvent([CAR.id, OTHER.id], { score: 712 }, at)
    assert.equal(event.type, 'cars_compared')
    assert.deepEqual(event.carIds, [CAR.id, OTHER.id])
    assert.equal(event.personalised, true)
    assert.equal(event.at, at.toISOString())
  })
})

/* ----------------------------------------------------------- text export -- */

describe('exported summary', () => {
  it('is never more confident than the screen', () => {
    const c = ctx({ score: null })
    const text = buildComparisonSummary(buildComparison([CAR, OTHER], c), c)
    assert.match(text, /No credit score recorded/)
    assert.match(text, /Locked, no credit score recorded/)
  })

  it('states the basis of the instalment when one is shown', () => {
    const c = ctx({ score: 712 })
    const text = buildComparisonSummary(buildComparison([CAR, OTHER], c), c)
    assert.match(text, /Good credit band/)
    assert.match(text, /72 months/)
    assert.match(text, /Not listed" means we do not hold that value/)
  })

  it('lists every attribute for every car', () => {
    const c = ctx()
    const text = buildComparisonSummary(buildComparison([CAR, OTHER], c), c)
    for (const attr of COMPARE_ATTRIBUTES) {
      const occurrences = text.split(attr.label).length - 1
      assert.ok(occurrences >= 2, `${attr.label} appears ${occurrences} times, expected 2`)
    }
  })
})
