// Small psql replacement: reads DATABASE_URL from .env.local and runs SQL.
import { readFileSync } from 'node:fs'
import pg from 'pg'

export function connectionString() {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='))
  if (!line) throw new Error('DATABASE_URL missing from .env.local')
  return line.slice('DATABASE_URL='.length).trim()
}

export async function withClient(fn) {
  const client = new pg.Client({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000,
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}
