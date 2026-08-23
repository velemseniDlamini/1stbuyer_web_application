// Live RLS check.
//
// Connects as the `anon` role (the role a browser client gets before sign-in)
// and confirms that every user-owned table returns nothing and rejects writes.
// This is the test that could not be written while the project had no database:
// it exercises the policies rather than reading the SQL that declares them.

import { withClient } from './db.mjs'

const USER_TABLES = [
  'profiles',
  'credit_history',
  'finance_scenarios',
  'quotations',
  'documents',
  'saved_vehicles',
  'notifications',
  'saved_comparisons',
  'comparison_shares',
  'tickets',
  'ticket_replies',
  'staff_audit_logs',
  'support_snippets',
]

const CATALOGUE_TABLES = ['cars', 'dealers', 'car_specs', 'price_snapshots']

const failures = []

await withClient(async (c) => {
  await c.query("set role anon")
  console.log('acting as: anon (no auth.uid())\n')

  for (const table of [...USER_TABLES, ...CATALOGUE_TABLES]) {
    let rows = null
    let error = null
    try {
      const res = await c.query(`select * from public.${table} limit 5`)
      rows = res.rowCount
    } catch (err) {
      error = err.code
    }
    const verdict = error ? `blocked (${error})` : `${rows} row(s)`
    console.log(`  select ${table.padEnd(20)} ${verdict}`)

    // An anon client must see nothing in any user-owned table.
    if (USER_TABLES.includes(table) && rows !== null && rows > 0) {
      failures.push(`anon read ${rows} row(s) from ${table}`)
    }
    // Catalogue tables are readable by authenticated users only, so anon
    // should also see nothing here.
    if (CATALOGUE_TABLES.includes(table) && rows !== null && rows > 0) {
      failures.push(`anon read ${rows} row(s) from catalogue table ${table}`)
    }
  }

  console.log('')
  // Writes must be refused too, not merely filtered on read.
  for (const [label, sql] of [
    ['insert profile', `insert into public.profiles (id, email) values (gen_random_uuid(), 'attacker@example.test')`],
    ['insert ticket', `insert into public.tickets (reference, profile_id, category, subject, body, sla_deadline)
                       values ('X', gen_random_uuid(), 'App bug', 'subject here', '${'x'.repeat(25)}', now())`],
    ['insert audit row', `insert into public.staff_audit_logs (staff_id, action) values (gen_random_uuid(), 'forged')`],
    ['read the ledger', `select * from public.schema_migrations`],
  ]) {
    try {
      const res = await c.query(sql)
      console.log(`  ${label.padEnd(20)} ALLOWED (${res.rowCount} row(s))`)
      failures.push(`anon was allowed to: ${label}`)
    } catch (err) {
      console.log(`  ${label.padEnd(20)} refused (${err.code})`)
    }
  }

  await c.query('reset role')
})

console.log('')
if (failures.length) {
  console.log(`RLS FAILURES (${failures.length}):`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('anon is fully contained: no reads, no writes, on any table.')
