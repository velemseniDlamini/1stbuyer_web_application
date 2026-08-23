import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { VEHICLES } from '../lib/data'
import { EMPTY_SPEC, type CarSpec } from '../lib/specs'
import {
  ASSUMED_L_PER_100KM,
  calculateRunningCost,
  indicativeInsuranceMonthly,
  litresPer100kmFor,
  monthlyFuelCost,
} from '../lib/running-cost'
import { assessAffordability } from '../lib/finance'

const CAR = VEHICLES[0]

describe('fuel cost', () => {
  it('computes litres × distance × price', () => {
    // 8 ℓ/100km over 1000 km at R20/ℓ = 80 ℓ = R1600
    const cost = monthlyFuelCost({ litresPer100km: 8, fuelPricePerL: 20, monthlyKm: 1000 })
    assert.equal(cost, 1600)
  })

  it('scales linearly with distance and with price', () => {
    const base = monthlyFuelCost({ litresPer100km: 7, fuelPricePerL: 22, monthlyKm: 1000 })
    const twiceFar = monthlyFuelCost({ litresPer100km: 7, fuelPricePerL: 22, monthlyKm: 2000 })
    const twiceDear = monthlyFuelCost({ litresPer100km: 7, fuelPricePerL: 44, monthlyKm: 1000 })
    assert.equal(twiceFar, base * 2)
    assert.equal(twiceDear, base * 2)
  })

  it('returns zero rather than NaN or Infinity for nonsense inputs', () => {
    for (const input of [
      { litresPer100km: 0, fuelPricePerL: 22, monthlyKm: 1000 },
      { litresPer100km: 7, fuelPricePerL: 0, monthlyKm: 1000 },
      { litresPer100km: 7, fuelPricePerL: 22, monthlyKm: 0 },
      { litresPer100km: -7, fuelPricePerL: 22, monthlyKm: 1000 },
    ]) {
      const cost = monthlyFuelCost(input)
      assert.equal(cost, 0)
      assert.ok(Number.isFinite(cost))
    }
  })
})

describe('consumption basis', () => {
  it('falls back to the labelled per-fuel assumption when no spec exists', () => {
    const result = litresPer100kmFor(CAR, EMPTY_SPEC)
    assert.equal(result.basis, 'assumption')
    assert.equal(result.value, ASSUMED_L_PER_100KM[CAR.fuel])
  })

  it('prefers a manufacturer figure when one has been sourced', () => {
    const spec: CarSpec = {
      ...EMPTY_SPEC,
      combinedLper100km: 5.2,
      source: 'Manufacturer spec sheet',
      sourceUrl: 'https://example.invalid/spec',
      capturedAt: '2026-08-01',
    }
    const result = litresPer100kmFor(CAR, spec)
    assert.equal(result.basis, 'manufacturer')
    assert.equal(result.value, 5.2)
  })

  it('reports which basis it used so the screen can say so', () => {
    const breakdown = calculateRunningCost({
      vehicle: CAR,
      spec: EMPTY_SPEC,
      fuelPricePerL: 22.5,
      monthlyKm: 1200,
      driverAge: 29,
      licenceYears: 7,
    })
    assert.equal(breakdown.consumptionBasis, 'assumption')
  })
})

describe('running-cost total', () => {
  const breakdown = calculateRunningCost({
    vehicle: CAR,
    spec: EMPTY_SPEC,
    fuelPricePerL: 22.5,
    monthlyKm: 1200,
    driverAge: 29,
    licenceYears: 7,
  })

  it('is fuel plus insurance and nothing invented', () => {
    assert.equal(breakdown.total, breakdown.fuel + breakdown.insurance)
    assert.ok(breakdown.fuel > 0)
    assert.ok(breakdown.insurance > 0)
  })

  it('reports servicing as absent rather than estimating it', () => {
    assert.equal(breakdown.servicing, null)
    assert.ok(breakdown.excluded.some((e) => /servicing/i.test(e)))
    assert.ok(breakdown.excluded.some((e) => /depreciation/i.test(e)))
  })

  it('reuses the insurance module rather than inventing a premium', () => {
    const direct = indicativeInsuranceMonthly({
      vehiclePrice: CAR.price,
      driverAge: 29,
      licenceYears: 7,
    })
    assert.equal(breakdown.insurance, Math.round(direct))
  })

  it('prices a young, newly-licensed driver higher', () => {
    const young = indicativeInsuranceMonthly({ vehiclePrice: CAR.price, driverAge: 20, licenceYears: 0 })
    const settled = indicativeInsuranceMonthly({ vehiclePrice: CAR.price, driverAge: 40, licenceYears: 15 })
    assert.ok(young > settled)
  })
})

describe('affordability thresholds match /finance exactly', () => {
  const income = 30000

  it('calls 20% of income comfortable', () => {
    const verdict = assessAffordability(income * 0.2, income)
    assert.equal(verdict.id, 'comfortable')
    assert.equal(verdict.tone, 'success')
  })

  it('calls just over 20% a stretch', () => {
    const verdict = assessAffordability(income * 0.2 + 1, income)
    assert.equal(verdict.id, 'stretch')
    assert.equal(verdict.tone, 'warning')
  })

  it('calls exactly 30% a stretch and just over 30% risky', () => {
    assert.equal(assessAffordability(income * 0.3, income).id, 'stretch')
    assert.equal(assessAffordability(income * 0.3 + 1, income).id, 'risky')
  })

  it('never reports comfortable when income is unknown', () => {
    const verdict = assessAffordability(5000, 0)
    assert.equal(verdict.id, 'risky')
    assert.equal(verdict.ratio, 1)
  })

  it('carries its meaning in the label, not only the colour', () => {
    for (const [instalment, label] of [
      [income * 0.1, 'Comfortable'],
      [income * 0.25, 'A stretch'],
      [income * 0.5, 'Risky'],
    ] as const) {
      assert.equal(assessAffordability(instalment, income).label, label)
    }
  })
})
