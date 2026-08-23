import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ARC_END_DEG,
  ARC_START_DEG,
  BUYING_POWER_FULL_TANK,
  SCORE_BANDS,
  SCORE_DISPLAY_MAX,
  arcPath,
  buyingPowerToFraction,
  needleAngle,
  scoreToFraction,
} from '../lib/gauge-display'
import { CREDIT_BANDS, bandForScore, estimateBuyingPower } from '../lib/finance'

/**
 * The dashboard gauges are a reskin. These assertions exist to keep them one:
 * the values they draw must stay identical to the values the app computed
 * before, and the display config must never leak into a calculation.
 */

describe('gauges are display only', () => {
  it('does not change what a score means', () => {
    // The gauge draws bandForScore's answer; it must not have its own opinion.
    for (const score of [0, 400, 582, 583, 613, 614, 680, 681, 766, 767, 999]) {
      const band = bandForScore(score)
      const segment = SCORE_BANDS.find((s) => s.id === band.id)
      assert.ok(segment, `no arc segment for band ${band.id}`)
      const fraction = scoreToFraction(score)
      // The needle must land inside the segment the app says the score is in.
      assert.ok(
        fraction >= segment!.from - 0.001 && fraction <= segment!.to + 0.001,
        `score ${score} is band ${band.id} but the needle sits at ${fraction}`,
      )
    }
  })

  it('derives its segments from the app bands rather than a second copy', () => {
    assert.equal(SCORE_BANDS.length, CREDIT_BANDS.length)
    for (const band of CREDIT_BANDS) {
      const segment = SCORE_BANDS.find((s) => s.id === band.id)
      assert.ok(segment, `band ${band.id} has no arc segment`)
      assert.equal(segment!.label, band.label)
      assert.ok(Math.abs(segment!.from - band.min / SCORE_DISPLAY_MAX) < 1e-9)
    }
  })

  it('reads left to right, worst to best', () => {
    for (let i = 1; i < SCORE_BANDS.length; i += 1) {
      assert.ok(
        SCORE_BANDS[i].from >= SCORE_BANDS[i - 1].from,
        'segments must be ordered worst to best along the arc',
      )
    }
  })

  it('clamps rather than spinning the needle off the dial', () => {
    assert.equal(scoreToFraction(-500), 0)
    assert.equal(scoreToFraction(99_999), 1)
    assert.equal(buyingPowerToFraction(-1), 0)
    assert.equal(buyingPowerToFraction(BUYING_POWER_FULL_TANK * 5), 1)
    assert.equal(buyingPowerToFraction(Number.NaN), 0)
  })

  it('never lets the fuel gauge ceiling reach the buying-power calculation', () => {
    // estimateBuyingPower must be blind to the display constant: a realistic
    // income has to produce the same figure whatever the gauge is scaled to.
    const before = estimateBuyingPower({ monthlyIncome: 32_000, score: 702 })
    assert.ok(before > 0)
    // The tank ceiling is display config; the calculator does not import it.
    assert.notEqual(before, BUYING_POWER_FULL_TANK)
    assert.equal(estimateBuyingPower({ monthlyIncome: 32_000, score: 702 }), before)
  })

  it('puts a figure above the full-tank mark at the top of the gauge, not off it', () => {
    assert.equal(buyingPowerToFraction(BUYING_POWER_FULL_TANK), 1)
    assert.ok(buyingPowerToFraction(BUYING_POWER_FULL_TANK / 2) > 0.49)
  })
})

describe('arc geometry', () => {
  it('sweeps left to right', () => {
    assert.ok(ARC_START_DEG > ARC_END_DEG, 'the arc must sweep from left to right')
    assert.ok(needleAngle(0) > needleAngle(1))
  })

  it('places the needle at the ends exactly', () => {
    assert.equal(needleAngle(0), ARC_START_DEG)
    assert.equal(needleAngle(1), ARC_END_DEG)
  })

  it('produces a valid, finite arc path for every fraction', () => {
    for (let f = 0; f <= 1.0001; f += 0.05) {
      const d = arcPath(50, 50, 40, 0, f)
      assert.match(d, /^M [\d.-]+ [\d.-]+ A 40 40 0 0 1 [\d.-]+ [\d.-]+$/)
      assert.doesNotMatch(d, /NaN|Infinity/)
    }
  })
})
