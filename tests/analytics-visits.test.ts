import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  VISIT_TOKEN_TTL_MS,
  deviceClassFor,
  normalisePath,
  trendPct,
} from '../lib/analytics-visits'
import { HERO_IMAGES, HERO_FADE_MS, HERO_INTERVAL_MS } from '../lib/hero-images'

/**
 * The privacy properties are the point of these assertions. A regression that
 * writes a share token or a query string into the analytics table would be a
 * data-protection incident, not a cosmetic bug, so it is pinned by a test.
 */

describe('visit path normalisation', () => {
  it('never records a live share token', () => {
    // /share/<token> is a working secret. Recording it verbatim would put a
    // credential into an analytics table that support staff can read.
    assert.equal(normalisePath('/share/abc123def456'), '/share/[token]')
    assert.equal(normalisePath('/share/abc123?x=1'), '/share/[token]')
  })

  it('drops query strings and fragments', () => {
    // ?cars=v1,v2 is the user's own shortlist and nobody else's business.
    assert.equal(normalisePath('/compare?cars=v1,v2'), '/compare')
    assert.equal(normalisePath('/explore#results'), '/explore')
  })

  it('normalises the root and trailing slashes', () => {
    assert.equal(normalisePath('/'), '/')
    assert.equal(normalisePath('/credit/'), '/credit')
  })

  it('refuses anything that is not a path', () => {
    assert.equal(normalisePath('https://evil.example/steal'), '/')
    assert.equal(normalisePath('javascript:alert(1)'), '/')
  })

  it('bounds the length, so the column cannot be used as a text sink', () => {
    assert.ok(normalisePath('/' + 'a'.repeat(500)).length <= 120)
  })
})

describe('device classification', () => {
  it('uses the same breakpoints as the layout', () => {
    assert.equal(deviceClassFor(375), 'phone')
    assert.equal(deviceClassFor(767), 'phone')
    assert.equal(deviceClassFor(768), 'tablet')
    assert.equal(deviceClassFor(1279), 'tablet')
    assert.equal(deviceClassFor(1280), 'desktop')
  })
})

describe('trend', () => {
  it('reports null rather than infinity when there is no previous period', () => {
    // A first week has nothing to compare against. "No prior period" and
    // "no change" are different facts and the dashboard shows them differently.
    assert.equal(trendPct(10, 0), null)
    assert.equal(trendPct(0, 0), null)
  })

  it('computes a percentage change in both directions', () => {
    assert.equal(trendPct(150, 100), 50)
    assert.equal(trendPct(50, 100), -50)
    assert.equal(trendPct(100, 100), 0)
  })
})

describe('visit token', () => {
  it('rotates daily, so a visitor cannot be followed across days', () => {
    assert.equal(VISIT_TOKEN_TTL_MS, 24 * 60 * 60 * 1000)
  })
})

/* ---------------------------------------------------------------- hero --- */

describe('hero images', () => {
  const publicDir = join(process.cwd(), 'public')

  it('every image the landing page references actually exists', () => {
    for (const image of HERO_IMAGES) {
      const file = join(publicDir, image.src.replace(/^\//, ''))
      assert.doesNotThrow(
        () => readFileSync(file),
        `${image.src} is referenced but not present in public/`,
      )
    }
  })

  it('every image carries alt text, even though it renders as scenery', () => {
    for (const image of HERO_IMAGES) {
      assert.ok(image.alt.length > 10, `${image.src} has no usable alt text`)
    }
  })

  it('fades faster than it holds, so two photographs never blur together', () => {
    assert.ok(
      HERO_FADE_MS < HERO_INTERVAL_MS,
      `fade ${HERO_FADE_MS}ms must be shorter than the ${HERO_INTERVAL_MS}ms hold`,
    )
  })

  it('holds each frame for the two seconds the brief asked for', () => {
    assert.equal(HERO_INTERVAL_MS, 2000)
  })

  it('ships web-optimised images rather than the original screenshots', () => {
    // The sources were ~400kB PNGs each, 4MB for the set. Anything that large
    // in a hero is a bad first impression on a South African mobile connection.
    for (const image of HERO_IMAGES) {
      assert.match(image.src, /\.webp$/, `${image.src} should be webp`)
      const bytes = readFileSync(join(publicDir, image.src.replace(/^\//, ''))).length
      assert.ok(bytes < 120_000, `${image.src} is ${Math.round(bytes / 1024)}kB, too heavy`)
    }
  })
})

/* ------------------------------------------------------------ migration -- */

describe('app_visits migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '20260823_0011_app_visits.sql'),
    'utf8',
  ).toLowerCase()

  it('enables row level security and grants clients nothing', () => {
    assert.match(sql, /alter table public\.app_visits\s+enable row level security/)
    assert.match(sql, /revoke all on public\.app_visits from anon, authenticated/)
  })

  it('has no policy, so no browser can read or write it directly', () => {
    assert.doesNotMatch(sql, /create policy/)
  })

  it('stores a hash of fixed length rather than a raw token', () => {
    assert.match(sql, /session_hash text not null check \(char_length\(session_hash\) = 64\)/)
  })

  it('records no column that could identify a person', () => {
    for (const forbidden of ['ip_address', 'user_agent', 'referrer', 'profile_id', 'user_id', 'email']) {
      assert.doesNotMatch(sql, new RegExp(`\\n\\s+${forbidden}\\s`), `must not store ${forbidden}`)
    }
  })

  it('keeps the aggregate functions away from client roles', () => {
    assert.match(sql, /revoke execute on function public\.visit_summary\(\) from public, anon, authenticated/)
    assert.match(sql, /grant execute on function public\.visit_summary\(\) to service_role/)
  })
})
