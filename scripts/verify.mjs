// Post-migration verification. Asserts the security properties that matter,
// against the live database rather than against the SQL text.
import { withClient } from './db.mjs'

const problems = []

await withClient(async (c) => {
  const tables = (
    await c.query(`
      select c.relname as table, c.relrowsecurity as rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `)
  ).rows

  console.log(`TABLES (${tables.length}):`)
  for (const t of tables) {
    const marker = t.rls ? 'RLS' : 'NO RLS'
    console.log(`  ${t.table.padEnd(24)} ${marker}`)
    if (!t.rls && t.table !== 'schema_migrations') {
      problems.push(`${t.table} has no row level security`)
    }
  }

  const policies = (
    await c.query(`
      select tablename, cmd, count(*)::int as n
      from pg_policies where schemaname = 'public'
      group by tablename, cmd order by tablename, cmd
    `)
  ).rows

  const byTable = new Map()
  for (const p of policies) {
    if (!byTable.has(p.tablename)) byTable.set(p.tablename, new Set())
    byTable.get(p.tablename).add(p.cmd)
  }

  console.log('\nPOLICIES:')
  for (const [table, cmds] of [...byTable].sort()) {
    console.log(`  ${table.padEnd(24)} ${[...cmds].sort().join(', ')}`)
  }

  // Per-user tables must carry all four verbs.
  const perUser = [
    'profiles', 'credit_history', 'finance_scenarios', 'quotations', 'documents',
    'saved_vehicles', 'notifications', 'saved_comparisons', 'comparison_shares',
  ]
  for (const table of perUser) {
    const cmds = byTable.get(table) ?? new Set()
    for (const verb of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      if (!cmds.has(verb)) problems.push(`${table} is missing a ${verb} policy`)
    }
  }

  // The audit log must be append-only.
  const auditCmds = byTable.get('staff_audit_logs') ?? new Set()
  if (auditCmds.has('UPDATE') || auditCmds.has('DELETE')) {
    problems.push('staff_audit_logs allows UPDATE or DELETE; an audit log must be append-only')
  }

  // The support directory must not expose financial columns.
  const viewCols = (
    await c.query(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'buyer_directory'
      order by ordinal_position
    `)
  ).rows.map((r) => r.column_name)
  console.log(`\nbuyer_directory columns: ${viewCols.join(', ')}`)
  for (const forbidden of ['credit_score', 'monthly_income', 'id_number', 'date_of_birth']) {
    if (viewCols.includes(forbidden)) problems.push(`buyer_directory exposes ${forbidden} to support`)
  }

  // The provenance constraint must be live, not just written down.
  const specConstraint = (
    await c.query(`
      select conname from pg_constraint
      where conname = 'car_specs_requires_source'
    `)
  ).rowCount
  console.log(`car_specs_requires_source constraint: ${specConstraint ? 'present' : 'MISSING'}`)
  if (!specConstraint) problems.push('car_specs_requires_source constraint is missing')

  const enums = (
    await c.query(`
      select t.typname, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as labels
      from pg_type t join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' group by t.typname order by t.typname
    `)
  ).rows
  console.log('\nENUMS:')
  for (const e of enums) console.log(`  ${e.typname}: ${e.labels}`)

  const migrations = (
    await c.query('select filename, applied_at from public.schema_migrations order by filename')
  ).rows
  console.log(`\nAPPLIED (${migrations.length}):`)
  for (const m of migrations) console.log(`  ${m.filename}`)
})

console.log('')
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):`)
  for (const p of problems) console.log(`  - ${p}`)
  process.exit(1)
}
console.log('All security assertions passed.')
