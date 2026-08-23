import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { askGuardian, matchVehiclesInQuestion } from '../lib/guardian'
import { VEHICLES } from '../lib/data'
import { MAX_COMPARE } from '../lib/compare'

describe('guardian comparison intent', () => {
  it('recognises two models named in one question', () => {
    const matches = matchVehiclesInQuestion('should I get the Polo or the Corolla Cross?')
    const models = matches.map((m) => m.model)
    assert.ok(models.includes('Polo'))
    assert.ok(models.includes('Corolla Cross'))
  })

  it('returns one listing per model, capped at the compare maximum', () => {
    const question = VEHICLES.map((v) => v.model).join(' vs ')
    const matches = matchVehiclesInQuestion(question)
    assert.ok(matches.length <= MAX_COMPARE)
    const models = matches.map((m) => m.model.toLowerCase())
    assert.equal(new Set(models).size, models.length)
  })

  it('deep-links into a pre-populated comparison', () => {
    const reply = askGuardian('compare the Polo and the Swift', { score: 712 })
    assert.equal(reply.matched, true)
    assert.ok(reply.link)
    assert.match(reply.link!.href, /^\/compare\?cars=/)
    const ids = reply.link!.href.split('=')[1].split(',')
    assert.equal(ids.length, 2)
    for (const id of ids) {
      assert.ok(VEHICLES.some((v) => v.id === id), `${id} is not a catalogue id`)
    }
  })

  it('asks for a second car when only one is named', () => {
    const reply = askGuardian('which one is better, the Polo?', { score: 712 })
    assert.equal(reply.matched, true)
    assert.match(reply.body, /second car/i)
  })

  it('sends a bare comparison question to Explore rather than a broken link', () => {
    const reply = askGuardian('which car should I buy', { score: null })
    assert.equal(reply.matched, true)
    assert.equal(reply.link?.href, '/explore')
  })

  it('does not hijack an insurance question that happens to say "compare"', () => {
    const reply = askGuardian('can I compare insurance premiums?', { score: 712 })
    assert.match(reply.title, /insurance/i)
    assert.equal(reply.link?.href, '/insurance')
  })

  it('tells the user the numbers stay locked without a score', () => {
    const reply = askGuardian('compare the Polo and the Swift', { score: null })
    assert.ok(reply.steps.some((s) => /credit score/i.test(s)))
  })

  it('refuses to rank on reliability it cannot source', () => {
    const reply = askGuardian('compare the Polo and the Swift', { score: 712 })
    assert.match(reply.body, /no sourced South African reliability data/i)
  })

  it('stays deterministic: the same question yields the same answer', () => {
    const a = askGuardian('compare the Polo and the Swift', { score: 712 })
    const b = askGuardian('compare the Polo and the Swift', { score: 712 })
    assert.deepEqual(a, b)
  })
})
