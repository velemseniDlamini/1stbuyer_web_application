import { withClient } from './db.mjs'

await withClient(async (c) => {
  const version = await c.query('select version()')
  console.log('CONNECTED:', version.rows[0].version.split(',')[0])

  const tables = await c.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `)
  console.log('\nPUBLIC TABLES:', tables.rows.length ? tables.rows.map((r) => r.table_name).join(', ') : '(none)')

  const authUsers = await c.query(`select count(*)::int as n from auth.users`)
  console.log('AUTH USERS:', authUsers.rows[0].n)

  const ext = await c.query(`select extname from pg_extension order by extname`)
  console.log('EXTENSIONS:', ext.rows.map((r) => r.extname).join(', '))
})
