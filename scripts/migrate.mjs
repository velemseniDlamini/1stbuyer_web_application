// Migration runner.
//
// Applies supabase/migrations/*.sql in lexical order. Each file runs inside its
// own transaction, so a failure rolls that file back rather than leaving the
// schema half-built. Applied files are recorded with a checksum in
// public.schema_migrations, so re-running is a no-op and an edited file that
// has already been applied is reported rather than silently skipped.
//
// Usage:  node scripts/migrate.mjs [--dry]

import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { withClient } from './db.mjs'

const DIR = join(process.cwd(), 'supabase', 'migrations')
const dryRun = process.argv.includes('--dry')

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)

await withClient(async (client) => {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `)

  const applied = new Map(
    (await client.query('select filename, checksum from public.schema_migrations')).rows.map((r) => [
      r.filename,
      r.checksum,
    ]),
  )

  let ran = 0
  for (const file of files) {
    const sql = readFileSync(join(DIR, file), 'utf8')
    const checksum = sha(sql)

    if (applied.has(file)) {
      const status = applied.get(file) === checksum ? 'unchanged' : 'CHANGED SINCE APPLYING'
      console.log(`skip  ${file}  (${status})`)
      continue
    }

    if (dryRun) {
      console.log(`would apply  ${file}  (${sql.length} bytes)`)
      continue
    }

    process.stdout.write(`apply ${file} ... `)
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query(
        'insert into public.schema_migrations (filename, checksum) values ($1, $2)',
        [file, checksum],
      )
      await client.query('commit')
      console.log('ok')
      ran++
    } catch (err) {
      await client.query('rollback')
      console.log('FAILED')
      console.error(`\n${file}: ${err.message}`)
      if (err.position) {
        const pos = Number(err.position)
        console.error(`context: ...${sql.slice(Math.max(0, pos - 160), pos + 160)}...`)
      }
      process.exit(1)
    }
  }

  console.log(`\n${ran} migration(s) applied, ${files.length} file(s) total.`)
})
