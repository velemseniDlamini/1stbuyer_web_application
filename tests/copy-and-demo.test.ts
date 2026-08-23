import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { DEMO_PERSONAS, personaById, DEMO_DISCLOSURE } from '../lib/demo-accounts'
import { DEFAULT_DOCS } from '../lib/documents'
import { savedComparisonSchema } from '../lib/validations'
import { estimateInstalment, isUsableScore } from '../lib/finance'
import { canPersonalise } from '../lib/compare'
import { assessCurrency } from '../lib/documents'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components', 'lib', 'supabase', 'docs', 'tests']
const SCAN_EXT = /\.(tsx?|css|sql|md)$/

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const rel = join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(rel, out)
    else if (SCAN_EXT.test(entry.name)) out.push(rel)
  }
  return out
}

/**
 * Typography guard. Em dashes and en dashes were removed from the product on
 * request; this test is what stops them reappearing in a later change. It scans
 * every source file, not just the ones that had them.
 *
 * The characters are built from their code points rather than typed literally,
 * so this file does not fail its own check.
 */
const EM_DASH = String.fromCharCode(0x2014)
const EN_DASH = String.fromCharCode(0x2013)

describe('typography: no em or en dashes anywhere', () => {
  const files = SCAN_DIRS.flatMap((dir) => sourceFiles(dir))

  it('scans a meaningful number of files', () => {
    assert.ok(files.length > 40, `only scanned ${files.length} files`)
  })

  it('contains no em dash (U+2014)', () => {
    const offenders = files.filter((f) => readFileSync(join(ROOT, f), 'utf8').includes(EM_DASH))
    assert.deepEqual(offenders, [], `em dash found in:\n${offenders.join('\n')}`)
  })

  it('contains no en dash (U+2013)', () => {
    const offenders = files.filter((f) => readFileSync(join(ROOT, f), 'utf8').includes(EN_DASH))
    assert.deepEqual(offenders, [], `en dash found in:\n${offenders.join('\n')}`)
  })

  it('left no double spaces or stray comma runs from the sweep', () => {
    const bad: string[] = []
    for (const file of files) {
      if (file.endsWith('.md')) continue
      let text = readFileSync(join(ROOT, file), 'utf8')
      // SQL string literals legitimately contain punctuation sets, such as the
      // character list handed to btrim(). Strip literals before applying what
      // is only a prose heuristic.
      if (file.endsWith('.sql')) text = text.replace(/'[^'\n]*'/g, "''")
      if (/,\s*,/.test(text)) bad.push(`${file}: double comma`)
      if (/\s,/.test(text.replace(/^\s*\*.*$/gm, ''))) bad.push(`${file}: space before comma`)
    }
    assert.deepEqual(bad, [], bad.join('\n'))
  })
})

/* ------------------------------------------------------- quick sign-in --- */

describe('quick sign-in personas', () => {
  const now = new Date('2026-08-21T09:00:00.000Z')

  it('offers three distinct personas with distinct emails', () => {
    assert.equal(DEMO_PERSONAS.length, 3)
    const ids = DEMO_PERSONAS.map((p) => p.id)
    const emails = DEMO_PERSONAS.map((p) => p.build(now).email)
    assert.equal(new Set(ids).size, 3)
    assert.equal(new Set(emails).size, 3)
  })

  it('labels every persona as sample data and warns that it is shared', () => {
    assert.match(DEMO_DISCLOSURE, /sample/i)
    // These are real accounts now, so the warning that matters is that anyone
    // can sign into them, not where the data is stored.
    assert.match(DEMO_DISCLOSURE, /anyone/i)
    assert.match(DEMO_DISCLOSURE, /do not put anything private/i)
    // Supabase rejects .test addresses as invalid, so the samples sit on a
    // subdomain of the product's own domain rather than a real mailbox.
    for (const persona of DEMO_PERSONAS) {
      assert.match(persona.build(now).email, /@demo\.1stbuyer\.co\.za$/)
    }
  })

  it('resolves personas by id and refuses unknown ids', () => {
    assert.equal(personaById('ready')?.id, 'ready')
    assert.equal(personaById('nope'), null)
  })

  it('the ready persona unlocks personalised numbers', () => {
    const seed = personaById('ready')!.build(now)
    assert.ok(seed.profile)
    const latest = seed.credit[seed.credit.length - 1]
    assert.equal(isUsableScore(latest.score), true)
    assert.equal(canPersonalise({ score: latest.score }), true)
    assert.ok(estimateInstalment(329900, latest.score) > 0)
  })

  it('the unscored persona keeps the credit gate closed', () => {
    const seed = personaById('unscored')!.build(now)
    assert.ok(seed.profile, 'should still have a profile')
    assert.deepEqual(seed.credit, [])
    assert.equal(canPersonalise({ score: null }), false)
  })

  it('the fresh persona lands in onboarding', () => {
    const seed = personaById('fresh')!.build(now)
    assert.equal(seed.profile, null)
    assert.deepEqual(seed.credit, [])
    assert.deepEqual(seed.savedComparisons, [])
  })

  it('seeds dates relative to now, never hard-coded', () => {
    const later = new Date('2027-01-01T00:00:00.000Z')
    const a = personaById('ready')!.build(now)
    const b = personaById('ready')!.build(later)
    assert.notEqual(a.credit[0].date, b.credit[0].date)
    assert.ok(new Date(b.credit[0].date) > new Date(a.credit[0].date))
  })

  it('seeds a document pack that matches the real pack definition', () => {
    for (const persona of DEMO_PERSONAS) {
      const seed = persona.build(now)
      assert.equal(seed.documents.length, DEFAULT_DOCS.length)
      assert.deepEqual(
        seed.documents.map((d) => d.id),
        DEFAULT_DOCS.map((d) => d.id),
      )
    }
  })

  it('seeds documents that pass the real currency rules', () => {
    const seed = personaById('ready')!.build(now)
    for (const doc of seed.documents.filter((d) => d.status === 'added' && d.maxAgeMonths)) {
      const currency = assessCurrency(doc, now)
      assert.equal(currency.state, 'valid', `${doc.id} seeded as ${currency.state}`)
    }
  })

  it('seeds comparisons that satisfy the persisted schema', () => {
    for (const persona of DEMO_PERSONAS) {
      for (const comparison of persona.build(now).savedComparisons) {
        const result = savedComparisonSchema.safeParse(comparison)
        assert.equal(result.success, true, `${persona.id}: ${JSON.stringify(comparison)}`)
      }
    }
  })

  it('references only catalogue ids that exist', async () => {
    const { VEHICLES } = await import('../lib/data')
    const known = new Set(VEHICLES.map((v) => v.id))
    for (const persona of DEMO_PERSONAS) {
      const seed = persona.build(now)
      for (const id of seed.savedVehicleIds) assert.ok(known.has(id), `${persona.id}: ${id}`)
      for (const c of seed.savedComparisons) {
        for (const id of c.carIds) assert.ok(known.has(id), `${persona.id}: ${id}`)
      }
    }
  })

  it('references only rights modules that exist', async () => {
    const { RIGHTS_MODULES } = await import('../lib/rights')
    const known = new Set(RIGHTS_MODULES.map((m) => m.id))
    for (const persona of DEMO_PERSONAS) {
      for (const id of persona.build(now).completedRights) {
        assert.ok(known.has(id), `${persona.id}: ${id}`)
      }
    }
  })
})
