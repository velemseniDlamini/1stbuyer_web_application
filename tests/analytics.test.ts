import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { VEHICLES } from '../lib/data'
import {
  comparedEvent,
  isForbiddenKey,
  sanitiseEvent,
  setAnalyticsSink,
  track,
  type AnalyticsPayload,
} from '../lib/analytics'
import { specFor, hasAnySpecValue, isCitable, EMPTY_SPEC, type CarSpec } from '../lib/specs'
import { reliabilityFor, RELIABILITY_SOURCES, sourceFor } from '../lib/reliability'
import { preferredVehicle, resolveVehicleContext, withVehicleContext } from '../lib/vehicle-context'

afterEach(() => setAnalyticsSink(null))

describe('analytics privacy', () => {
  it('drops money, credit and identity keys', () => {
    const { safe, dropped } = sanitiseEvent({
      car_ids: 'v1,v2',
      count: 2,
      credit_score: 712,
      band: 'Good',
      monthly_income: 32000,
      instalment: 5183,
      price: 329900,
      email: 'someone@example.co.za',
    })

    assert.deepEqual(Object.keys(safe).sort(), ['car_ids', 'count'])
    for (const leaked of ['credit_score', 'band', 'monthly_income', 'instalment', 'price', 'email']) {
      assert.ok(dropped.includes(leaked), `${leaked} should have been dropped`)
    }
  })

  it('recognises forbidden keys regardless of casing or nesting in the name', () => {
    for (const key of ['creditScore', 'CREDIT_BAND', 'userIncome', 'totalRandAmount', 'depositPct']) {
      assert.equal(isForbiddenKey(key), true, `${key} should be forbidden`)
    }
    for (const key of ['car_ids', 'brands', 'count']) {
      assert.equal(isForbiddenKey(key), false, `${key} should be allowed`)
    }
  })

  it('drops non-primitive values that could smuggle a payload', () => {
    const { safe, dropped } = sanitiseEvent({
      count: 2,
      // deliberately smuggling an object through a permitted key name
      brands: { toString: () => 'x' } as unknown as string,
    })
    assert.deepEqual(Object.keys(safe), ['count'])
    assert.deepEqual(dropped, ['brands'])
  })

  it('emits only ids, brands and a count for a comparison', () => {
    const payload = comparedEvent(VEHICLES.slice(0, 2))
    assert.deepEqual(Object.keys(payload).sort(), ['brands', 'car_ids', 'count'])
    assert.equal(payload.count, 2)
    assert.equal(typeof payload.brands, 'string')
  })

  it('sanitises at the point of transmission, not only at the call site', () => {
    const seen: { name: string; payload?: AnalyticsPayload }[] = []
    setAnalyticsSink((name, payload) => seen.push({ name, payload }))

    track('cars_compared', { car_ids: 'v1,v2', count: 2, credit_score: 712 } as AnalyticsPayload)

    assert.equal(seen.length, 1)
    assert.equal(seen[0].name, 'cars_compared')
    assert.ok(!('credit_score' in (seen[0].payload ?? {})))
  })

  it('never lets an analytics failure break the caller', () => {
    setAnalyticsSink(() => {
      throw new Error('network down')
    })
    assert.doesNotThrow(() => track('comparison_saved', { count: 2 }))
  })
})

describe('spec provenance', () => {
  it('holds no specs until a sourced dataset is ingested', () => {
    for (const v of VEHICLES) {
      assert.equal(hasAnySpecValue(specFor(v.id)), false, `${v.id} has an unsourced spec`)
    }
  })

  it('rejects a spec value that arrives without provenance', () => {
    const unsourced: CarSpec = { ...EMPTY_SPEC, powerKw: 81 }
    assert.equal(isCitable(unsourced), false)

    const sourced: CarSpec = {
      ...unsourced,
      source: 'Manufacturer spec sheet',
      sourceUrl: 'https://example.invalid/spec',
      capturedAt: '2026-08-01',
    }
    assert.equal(isCitable(sourced), true)
  })

  it('an empty spec needs no source', () => {
    assert.equal(isCitable(EMPTY_SPEC), true)
  })
})

describe('reliability provenance', () => {
  it('returns nothing rather than a fabricated rating', () => {
    for (const v of VEHICLES) {
      assert.equal(reliabilityFor(v.make, v.model), null)
    }
  })

  it('names only real, resolvable South African sources', () => {
    assert.ok(RELIABILITY_SOURCES.length >= 3)
    for (const source of RELIABILITY_SOURCES) {
      assert.ok(source.name && source.publisher && source.measures)
      assert.match(source.url, /^https:\/\//)
      assert.equal(sourceFor(source.id)?.id, source.id)
    }
  })
})

describe('vehicle context plumbing', () => {
  it('appends the vehicle id with the right separator', () => {
    assert.equal(withVehicleContext('/insurance', 'v2'), '/insurance?vehicle=v2')
    assert.equal(withVehicleContext('/insurance?x=1', 'v2'), '/insurance?x=1&vehicle=v2')
  })

  it('resolves a known id and refuses an unknown one', () => {
    assert.equal(resolveVehicleContext(VEHICLES[1].id, VEHICLES)?.id, VEHICLES[1].id)
    assert.equal(resolveVehicleContext('nope', VEHICLES), null)
    assert.equal(resolveVehicleContext(null, VEHICLES), null)
  })

  it('prefers explicit context, then a saved car, then the catalogue', () => {
    const explicit = preferredVehicle({
      contextId: VEHICLES[3].id,
      savedIds: [VEHICLES[1].id],
      catalogue: VEHICLES,
    })
    assert.equal(explicit.basis, 'context')
    assert.equal(explicit.vehicle?.id, VEHICLES[3].id)

    const saved = preferredVehicle({ contextId: null, savedIds: [VEHICLES[1].id], catalogue: VEHICLES })
    assert.equal(saved.basis, 'saved')
    assert.equal(saved.vehicle?.id, VEHICLES[1].id)

    const fallback = preferredVehicle({ contextId: null, savedIds: [], catalogue: VEHICLES })
    assert.equal(fallback.basis, 'catalogue')

    const empty = preferredVehicle({ contextId: null, savedIds: [], catalogue: [] })
    assert.equal(empty.basis, 'none')
    assert.equal(empty.vehicle, null)
  })
})
