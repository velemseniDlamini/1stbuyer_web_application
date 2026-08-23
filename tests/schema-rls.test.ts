import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  carSpecSchema,
  comparisonShareSchema,
  preferencesSchema,
  priceSnapshotSchema,
  savedComparisonSchema,
} from '../lib/validations'

/**
 * The brief asks for RLS to be verified by comparing a service-role client with
 * an anon client through supabase-js. This build has no Supabase project and no
 * client, so that test cannot run and is NOT faked here.
 *
 * What is verified instead is the artefact we actually ship: the migration SQL.
 * Every per-user table must enable RLS and carry all four verbs scoped through
 * auth.uid(). A select/insert-only policy set is the specific mistake these
 * assertions exist to catch.
 */
// Resolved from the project root: the compiled tests run from .tests-build/.
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

function sqlFor(fragment: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.includes(fragment))
  assert.ok(file, `no migration found for ${fragment}`)
  return readFileSync(join(MIGRATIONS_DIR, file!), 'utf8').toLowerCase()
}

const PER_USER_TABLES = [
  { fragment: 'saved_comparisons', table: 'saved_comparisons' },
  { fragment: 'comparison_shares', table: 'comparison_shares' },
]

const CATALOGUE_TABLES = [
  { fragment: 'car_specs', table: 'car_specs' },
  { fragment: 'price_snapshots', table: 'price_snapshots' },
]

describe('migrations: per-user tables', () => {
  for (const { fragment, table } of PER_USER_TABLES) {
    it(`${table} enables row level security`, () => {
      assert.match(sqlFor(fragment), new RegExp(`alter table public\\.${table}\\s+enable row level security`))
    })

    it(`${table} defines all four CRUD policies`, () => {
      const sql = sqlFor(fragment)
      for (const verb of ['select', 'insert', 'update', 'delete']) {
        assert.match(sql, new RegExp(`for ${verb}`), `${table} is missing a ${verb} policy`)
      }
    })

    it(`${table} scopes every owner policy through auth.uid()`, () => {
      const sql = sqlFor(fragment)
      const policyCount = (sql.match(/create policy/g) ?? []).length
      const uidCount = (sql.match(/auth\.uid\(\) = profile_id/g) ?? []).length
      assert.ok(policyCount >= 4, `${table} has only ${policyCount} policies`)
      // update carries both USING and WITH CHECK, so uid references exceed 4.
      assert.ok(uidCount >= 4, `${table} scopes only ${uidCount} clauses through auth.uid()`)
    })

    it(`${table} cascades when the profile is deleted`, () => {
      assert.match(sqlFor(fragment), /references public\.profiles \(id\) on delete cascade/)
    })
  }
})

describe('migrations: catalogue tables', () => {
  for (const { fragment, table } of CATALOGUE_TABLES) {
    it(`${table} enables RLS and grants read only to authenticated users`, () => {
      const sql = sqlFor(fragment)
      assert.match(sql, new RegExp(`alter table public\\.${table}\\s+enable row level security`))
      assert.match(sql, /for select\s+to authenticated/)
      // No client-side write path may exist for catalogue data.
      assert.doesNotMatch(sql, /for insert\s+to authenticated/)
      assert.doesNotMatch(sql, /for update\s+to authenticated/)
      assert.doesNotMatch(sql, /for delete\s+to authenticated/)
    })
  }
})

describe('migrations: share links cannot be enumerated', () => {
  const sql = sqlFor('comparison_shares')

  it('grants anon a read only against an unexpired token', () => {
    assert.match(sql, /to anon/)
    assert.match(sql, /expires_at > now\(\)/)
    assert.match(sql, /current_setting\('request\.share_token', true\)/)
  })

  it('holds no personal financial columns at all', () => {
    for (const column of ['instalment', 'credit', 'income', 'score', 'band']) {
      assert.doesNotMatch(sql.split('alter table')[0], new RegExp(`\\n\\s+${column}`))
    }
  })
})

describe('migrations: spec provenance is enforced in the database', () => {
  it('car_specs requires a source whenever a value is present', () => {
    const sql = sqlFor('car_specs')
    assert.match(sql, /constraint car_specs_requires_source check/)
    assert.match(sql, /source is not null and source_url is not null and captured_at is not null/)
  })
})

/* ------------------------------------------------------------- schemas --- */

describe('zod schemas mirror the migrations', () => {
  it('rejects a spec value with no provenance', () => {
    const base = {
      engineCc: null,
      powerKw: 81,
      torqueNm: null,
      drivetrain: null,
      seats: null,
      bootLitres: null,
      combinedLper100km: null,
      ncapStars: null,
      ncapProgramme: null,
      ncapYear: null,
      source: null,
      sourceUrl: null,
      capturedAt: null,
    }
    assert.equal(carSpecSchema.safeParse(base).success, false)
    assert.equal(
      carSpecSchema.safeParse({
        ...base,
        source: 'Manufacturer spec sheet',
        sourceUrl: 'https://example.com/spec',
        capturedAt: '2026-08-01',
      }).success,
      true,
    )
  })

  it('accepts a fully empty spec without a source', () => {
    const empty = {
      engineCc: null,
      powerKw: null,
      torqueNm: null,
      drivetrain: null,
      seats: null,
      bootLitres: null,
      combinedLper100km: null,
      ncapStars: null,
      ncapProgramme: null,
      ncapYear: null,
      source: null,
      sourceUrl: null,
      capturedAt: null,
    }
    assert.equal(carSpecSchema.safeParse(empty).success, true)
  })

  it('enforces the 2-3 car rule and rejects duplicates', () => {
    const base = { id: 'c1', name: 'Polo vs Swift', createdAt: '2026-08-20T10:00:00Z' }
    assert.equal(savedComparisonSchema.safeParse({ ...base, carIds: ['v1'] }).success, false)
    assert.equal(
      savedComparisonSchema.safeParse({ ...base, carIds: ['v1', 'v2', 'v3', 'v4'] }).success,
      false,
    )
    assert.equal(savedComparisonSchema.safeParse({ ...base, carIds: ['v1', 'v1'] }).success, false)
    assert.equal(savedComparisonSchema.safeParse({ ...base, carIds: ['v1', 'v2'] }).success, true)
  })

  it('validates share records and price snapshots', () => {
    assert.equal(
      comparisonShareSchema.safeParse({
        token: 'a'.repeat(32),
        carIds: ['v1', 'v2'],
        createdAt: '2026-08-20T10:00:00Z',
        expiresAt: '2026-08-21T10:00:00Z',
      }).success,
      true,
    )
    assert.equal(comparisonShareSchema.safeParse({ token: 'short', carIds: ['v1', 'v2'], createdAt: 'x', expiresAt: 'y' }).success, false)
    assert.equal(priceSnapshotSchema.safeParse({ at: '2026-08-20', price: 329900 }).success, true)
    assert.equal(priceSnapshotSchema.safeParse({ at: '2026-08-20', price: 0 }).success, false)
  })

  it('defaults preferences so a first-run profile is valid', () => {
    const parsed = preferencesSchema.parse({})
    assert.deepEqual(parsed.dismissedSuggestionIds, [])
    assert.equal(parsed.glanceBarDismissed, false)
    assert.deepEqual(parsed.decisionWeights, {})
  })

  it('rejects an out-of-range decision weight', () => {
    assert.equal(preferencesSchema.safeParse({ decisionWeights: { affordability: 9 } }).success, false)
  })
})

/* --------------------------------------------- privilege escalation ------ */

describe('privileged profile columns are not self-serve', () => {
  const sql = sqlFor('lock_privileged_columns')

  it('revokes column-level UPDATE from the client roles', () => {
    // RLS is row level. Without this revoke a buyer can update their own row's
    // role column and become staff, which is what a live probe actually did.
    assert.match(sql, /revoke update \(role, is_suspended, suspension_reason\) on public\.profiles from authenticated/)
    assert.match(sql, /revoke update \(role, is_suspended, suspension_reason\) on public\.profiles from anon/)
  })

  it('backs the revoke with a trigger', () => {
    assert.match(sql, /create or replace function public\.guard_privileged_profile_columns/)
    assert.match(sql, /profiles_guard_privileged_columns/)
    assert.match(sql, /raise exception/)
  })

  it('still allows a super admin or the service role to grant a role', () => {
    assert.match(sql, /auth\.uid\(\) is not null and not public\.is_super_admin\(\)/)
  })
})
