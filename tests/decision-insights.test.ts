import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { VEHICLES, type Vehicle } from '../lib/data'
import {
  CRITERIA,
  DEFAULT_WEIGHTS,
  scoreVehicles,
  type ScoreInputs,
} from '../lib/decision-score'
import {
  AVERAGE_KM_PER_YEAR,
  buildInsights,
  chargingNote,
  dealerContext,
  negotiationLeverage,
  serviceNetworkNote,
} from '../lib/insights'
import { dealQuality, marketRangeFor, MIN_PEERS_FOR_RANGE } from '../lib/market-value'
import { buildPairCounts, pairKey, suggestAlternatives } from '../lib/suggestions'
import {
  createShareToken,
  findValidShare,
  isExpired,
  REDACTED_FIELDS,
  SHARE_TTL_HOURS,
  toPublicRows,
} from '../lib/share-token'
import { parseComparisonPhrase, topMatches } from '../lib/fuzzy'
import { hasRenderableHistory, priceHistoryFor, sparklinePoints } from '../lib/price-history'

const car = (over: Partial<Vehicle> = {}): Vehicle => ({ ...VEHICLES[0], ...over })

const inputs = (over: Partial<ScoreInputs> = {}): ScoreInputs => ({
  affordability: 5000,
  runningCost: 2500,
  reliability: null,
  dealerDistance: null,
  specPreference: null,
  ...over,
})

/* ------------------------------------------------------ decision helper -- */

describe('weighted decision helper', () => {
  it('excludes a criterion with no data instead of scoring it zero', () => {
    const [a, b] = scoreVehicles([
      { vehicleId: 'a', inputs: inputs({ affordability: 4000 }) },
      { vehicleId: 'b', inputs: inputs({ affordability: 8000 }) },
    ])

    const reliabilityA = a.criteria.find((c) => c.id === 'reliability')!
    assert.equal(reliabilityA.points, null)
    assert.equal(reliabilityA.included, false)

    // The cheaper car wins on the criteria that did apply.
    assert.ok((a.total as number) > (b.total as number))
    assert.ok(a.total !== null && a.total <= 100)
  })

  it('states the exclusion in the exact required wording', () => {
    const [score] = scoreVehicles([
      { vehicleId: 'a', inputs: inputs() },
      { vehicleId: 'b', inputs: inputs({ affordability: 9000 }) },
    ])
    assert.match(score.disclosure, /^Score excludes /)
    assert.match(score.disclosure, /data not yet available\.$/)
    assert.match(score.disclosure, /reliability/)
  })

  it('does not disclose a criterion the user weighted to zero', () => {
    const weights = { ...DEFAULT_WEIGHTS, reliability: 0, dealerDistance: 0, specPreference: 0 }
    const [score] = scoreVehicles(
      [
        { vehicleId: 'a', inputs: inputs() },
        { vehicleId: 'b', inputs: inputs({ affordability: 9000 }) },
      ],
      weights,
    )
    assert.equal(score.disclosure, '')
  })

  it('returns null rather than a fake score when nothing applies', () => {
    const [score] = scoreVehicles([
      {
        vehicleId: 'a',
        inputs: {
          affordability: null,
          runningCost: null,
          reliability: null,
          dealerDistance: null,
          specPreference: null,
        },
      },
    ])
    assert.equal(score.total, null)
  })

  it('ties every car at 50 when a criterion has no spread', () => {
    const scores = scoreVehicles([
      { vehicleId: 'a', inputs: inputs({ runningCost: 2500 }) },
      { vehicleId: 'b', inputs: inputs({ runningCost: 2500 }) },
    ])
    for (const s of scores) {
      assert.equal(s.criteria.find((c) => c.id === 'runningCost')!.points, 50)
    }
  })

  it('offers exactly the five documented criteria', () => {
    assert.deepEqual(
      CRITERIA.map((c) => c.id).sort(),
      ['affordability', 'dealerDistance', 'reliability', 'runningCost', 'specPreference'],
    )
  })
})

/* ---------------------------------------------------------- deal quality -- */

describe('market value and deal quality', () => {
  it('publishes no range without enough comparable listings', () => {
    assert.equal(marketRangeFor(VEHICLES[0], VEHICLES), null)
    const quality = dealQuality(VEHICLES[0], VEHICLES)
    assert.equal(quality.id, 'unknown')
    assert.equal(quality.label, 'Market context not yet available')
    assert.equal(quality.range, null)
  })

  it('never implies fairness when the context is missing', () => {
    const quality = dealQuality(VEHICLES[0], VEHICLES)
    assert.doesNotMatch(quality.label, /fair|good|market price/i)
  })

  it('calls a listing above market only against real peers', () => {
    const peers: Vehicle[] = [
      car({ id: 'p1', price: 200000 }),
      car({ id: 'p2', price: 205000 }),
      car({ id: 'p3', price: 195000 }),
    ]
    const subject = car({ id: 'subject', price: 260000 })
    const catalogue = [subject, ...peers]

    const range = marketRangeFor(subject, catalogue)
    assert.ok(range)
    assert.equal(range!.peerCount, MIN_PEERS_FOR_RANGE)

    const quality = dealQuality(subject, catalogue)
    assert.equal(quality.id, 'above')
    assert.match(quality.label, /negotiate room exists/)
  })

  it('calls a cheap listing below market and a close one at market', () => {
    const peers = [car({ id: 'p1', price: 300000 }), car({ id: 'p2', price: 300000 }), car({ id: 'p3', price: 300000 })]
    assert.equal(dealQuality(car({ id: 's', price: 240000 }), [car({ id: 's', price: 240000 }), ...peers]).id, 'below')
    assert.equal(dealQuality(car({ id: 's', price: 302000 }), [car({ id: 's', price: 302000 }), ...peers]).id, 'at')
  })
})

/* -------------------------------------------------------------- insights -- */

describe('pros and cons', () => {
  it('ties every line to a data point', () => {
    const insights = buildInsights({
      vehicle: VEHICLES[0],
      catalogue: VEHICLES,
      instalment: 5000,
      monthlyIncome: 30000,
      runningCostMonthly: 2500,
    })
    assert.ok(insights.length > 0)
    for (const insight of insights) {
      assert.ok(insight.basis.length > 0, `"${insight.text}" has no basis`)
    }
  })

  it('states the instalment share of income in the required shape', () => {
    const insights = buildInsights({
      vehicle: VEHICLES[0],
      catalogue: VEHICLES,
      instalment: 5400,
      monthlyIncome: 30000,
      runningCostMonthly: 2000,
    })
    const line = insights.find((i) => /% of your income/.test(i.text))
    assert.ok(line)
    assert.match(line!.text, /Instalment is 18% of your income, comfortable/)
  })

  it('says nothing about affordability without an instalment or an income', () => {
    const noScore = buildInsights({
      vehicle: VEHICLES[0],
      catalogue: VEHICLES,
      instalment: null,
      monthlyIncome: 30000,
      runningCostMonthly: 2500,
    })
    assert.equal(noScore.some((i) => /% of your income/.test(i.text)), false)

    const noIncome = buildInsights({
      vehicle: VEHICLES[0],
      catalogue: VEHICLES,
      instalment: 5000,
      monthlyIncome: 0,
      runningCostMonthly: 2500,
    })
    assert.equal(noIncome.some((i) => /% of your income/.test(i.text)), false)
  })

  it('flags mileage well above the annual average', () => {
    const old = car({ id: 'x', year: 2023, mileage: 2 * AVERAGE_KM_PER_YEAR + 60000 })
    const insights = buildInsights({
      vehicle: old,
      catalogue: VEHICLES,
      instalment: null,
      monthlyIncome: 0,
      runningCostMonthly: 0,
      currentYear: 2025,
    })
    assert.ok(insights.some((i) => /above average for a 2023 model/.test(i.text)))
  })
})

describe('negotiation leverage', () => {
  it('always returns an honest point, never invented leverage', () => {
    const leverage = negotiationLeverage(VEHICLES[0], VEHICLES, 2026)
    assert.ok(leverage)
    assert.ok(leverage!.basis.length > 0)
  })

  it('leads with an above-market price when peers support it', () => {
    const peers = [car({ id: 'p1', price: 200000 }), car({ id: 'p2', price: 200000 }), car({ id: 'p3', price: 200000 })]
    const subject = car({ id: 's', price: 260000 })
    const leverage = negotiationLeverage(subject, [subject, ...peers], 2026)
    assert.match(leverage!.point, /above the market estimate/)
  })
})

describe('South African context', () => {
  it('asks for a city rather than inventing a distance', () => {
    const ctx = dealerContext(VEHICLES[0], null)
    assert.match(ctx.label, /Add your city/)
    assert.doesNotMatch(ctx.detail, /\d+(\.\d+)?\s*km away/)
    assert.equal(ctx.rating, null)
  })

  it('reports same-city and cross-province honestly', () => {
    const vehicle = VEHICLES[0] // Super Group Constantia Kloof, Roodepoort, Gauteng
    assert.equal(dealerContext(vehicle, { city: 'Roodepoort', province: 'Gauteng' }).proximity, 'same-city')
    assert.equal(dealerContext(vehicle, { city: 'Pretoria', province: 'Gauteng' }).proximity, 'same-province')
    assert.equal(
      dealerContext(vehicle, { city: 'Cape Town', province: 'Western Cape' }).proximity,
      'other-province',
    )
  })

  it('states that service-network data is absent', () => {
    assert.match(serviceNetworkNote(VEHICLES[0], 'Gauteng'), /not yet available/i)
  })

  it('only raises charging for cars that might plug in', () => {
    assert.equal(chargingNote(car({ fuel: 'Petrol' })).applicable, false)
    assert.equal(chargingNote(car({ fuel: 'Diesel' })).applicable, false)

    const hybrid = chargingNote(car({ fuel: 'Hybrid' }))
    assert.equal(hybrid.applicable, true)
    // Must not assert plug-in status we cannot know.
    assert.match(hybrid.text, /does not say whether this model plugs in/)
  })
})

/* ----------------------------------------------------------- suggestions -- */

describe('smart suggestions', () => {
  it('offers at most two, never the anchor, never a car already compared', () => {
    const suggestions = suggestAlternatives({
      anchor: VEHICLES[0],
      catalogue: VEHICLES,
      excludeIds: [VEHICLES[0].id, VEHICLES[4].id],
      dismissedIds: [],
    })
    assert.ok(suggestions.length <= 2)
    for (const s of suggestions) {
      assert.notEqual(s.vehicle.id, VEHICLES[0].id)
      assert.notEqual(s.vehicle.id, VEHICLES[4].id)
    }
  })

  it('gives every suggestion a concrete reason, never "recommended for you"', () => {
    const suggestions = suggestAlternatives({
      anchor: VEHICLES[0],
      catalogue: VEHICLES,
      excludeIds: [],
      dismissedIds: [],
    })
    for (const s of suggestions) {
      assert.ok(s.reason.length > 0)
      assert.doesNotMatch(s.reason, /recommended|for you|you might like/i)
    }
  })

  it('honours a permanent dismissal', () => {
    const first = suggestAlternatives({
      anchor: VEHICLES[0],
      catalogue: VEHICLES,
      excludeIds: [],
      dismissedIds: [],
    })
    assert.ok(first.length > 0)
    const dismissed = first[0].vehicle.id
    const after = suggestAlternatives({
      anchor: VEHICLES[0],
      catalogue: VEHICLES,
      excludeIds: [],
      dismissedIds: [dismissed],
    })
    assert.equal(after.some((s) => s.vehicle.id === dismissed), false)
  })

  it('aggregates saved comparisons by pair count only', () => {
    const counts = buildPairCounts([
      { carIds: ['v1', 'v2'] },
      { carIds: ['v2', 'v1'] },
      { carIds: ['v1', 'v3'] },
    ])
    assert.equal(counts[pairKey('v1', 'v2')], 2)
    assert.equal(counts[pairKey('v1', 'v3')], 1)
    // The aggregate is numbers keyed by car pairs, nothing else can be in it.
    for (const [key, value] of Object.entries(counts)) {
      assert.equal(typeof value, 'number')
      assert.match(key, /^[^|]+\|[^|]+$/)
    }
  })

  it('surfaces a frequently-compared pair with its count in the reason', () => {
    const counts = buildPairCounts([
      { carIds: [VEHICLES[0].id, VEHICLES[6].id] },
      { carIds: [VEHICLES[0].id, VEHICLES[6].id] },
    ])
    const suggestions = suggestAlternatives({
      anchor: VEHICLES[0],
      catalogue: VEHICLES,
      excludeIds: [],
      dismissedIds: [],
      pairCounts: counts,
    })
    const hit = suggestions.find((s) => s.vehicle.id === VEHICLES[6].id)
    assert.ok(hit)
    assert.equal(hit!.strategy, 'often-compared')
    assert.match(hit!.reason, /2 times/)
  })
})

/* --------------------------------------------------------- share tokens -- */

describe('share tokens', () => {
  it('expires after 24 hours', () => {
    const now = new Date('2026-08-20T10:00:00.000Z')
    const share = createShareToken(['v1', 'v2'], now)
    assert.equal(isExpired(share, new Date('2026-08-20T20:00:00.000Z')), false)
    assert.equal(
      isExpired(share, new Date(now.getTime() + SHARE_TTL_HOURS * 3600 * 1000 + 1000)),
      true,
    )
  })

  it('does not resolve an expired or unknown token', () => {
    const now = new Date('2026-08-20T10:00:00.000Z')
    const share = createShareToken(['v1', 'v2'], now)
    assert.equal(findValidShare([share], share.token, now)?.token, share.token)
    assert.equal(findValidShare([share], 'nope', now), null)
    assert.equal(findValidShare([share], share.token, new Date('2026-08-25T10:00:00.000Z')), null)
  })

  it('strips every personal field from the shared view', () => {
    const rows = toPublicRows(VEHICLES.slice(0, 2))
    for (const row of rows) {
      for (const forbidden of REDACTED_FIELDS) {
        assert.equal(forbidden in row, false, `${forbidden} leaked into the shared view`)
      }
    }
    assert.deepEqual(Object.keys(rows[0]).sort(), [
      'dealer',
      'fuel',
      'mileage',
      'price',
      'title',
      'transmission',
      'vehicleId',
      'year',
    ])
  })
})

/* ---------------------------------------------------- natural language --- */

describe('natural-language comparison input', () => {
  it('splits a "vs" phrase and matches each side', () => {
    const parsed = parseComparisonPhrase('Polo Vivo vs Corolla Cross', VEHICLES)
    assert.equal(parsed.length, 2)
    assert.match(parsed[0].matches[0].vehicle.model, /Polo/)
    assert.match(parsed[1].matches[0].vehicle.model, /Corolla Cross/)
  })

  it('understands "or" and "and" as comparison separators', () => {
    for (const phrase of ['Polo or Swift', 'Polo and Swift']) {
      const parsed = parseComparisonPhrase(phrase, VEHICLES)
      assert.equal(parsed.length, 2, `"${phrase}" did not split`)
    }
  })

  it('returns at most two distinct models per term', () => {
    const matches = topMatches('volkswagen', VEHICLES, 2)
    assert.ok(matches.length <= 2)
    const models = matches.map((m) => m.vehicle.model)
    assert.equal(new Set(models).size, models.length)
  })

  it('returns nothing for a car the catalogue does not hold', () => {
    assert.deepEqual(topMatches('ferrari 488', VEHICLES), [])
  })

  it('ranks an exact model name above a partial hit', () => {
    const exact = topMatches('polo', VEHICLES, 1)[0]
    assert.equal(exact.score, 1)
    const partial = topMatches('polo vivo', VEHICLES, 1)[0]
    assert.ok(partial.score < 1)
  })
})

/* --------------------------------------------------------- price history -- */

describe('price sparkline', () => {
  it('draws nothing without at least two observations', () => {
    assert.equal(hasRenderableHistory(VEHICLES[0].id), false)
    assert.deepEqual(priceHistoryFor(VEHICLES[0].id), [])
    assert.deepEqual(sparklinePoints([]), [])
    assert.deepEqual(sparklinePoints([{ at: '2026-08-01', price: 100 }]), [])
  })

  it('plots a flat history down the middle rather than at an edge', () => {
    const points = sparklinePoints([
      { at: '2026-08-01', price: 100 },
      { at: '2026-08-10', price: 100 },
    ])
    assert.equal(points.length, 2)
    for (const p of points) assert.equal(p.y, 0.5)
  })
})
