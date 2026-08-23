import pg from 'pg'

const REF = 'qpjqveipehhxqyxhlwmy'
const PASSWORD = process.env.SUPA_PW
const regions = ['eu-west-1', 'eu-central-1', 'us-east-1', 'eu-west-2', 'us-west-1', 'ap-southeast-1']

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`
  const client = new pg.Client({
    host,
    port: 5432,
    user: `postgres.${REF}`,
    password: PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  })
  try {
    await client.connect()
    const r = await client.query('select current_database() as db, version() as v')
    console.log(`OK ${region}: ${r.rows[0].db}`)
    console.log(`HOST=${host}`)
    await client.end()
    process.exit(0)
  } catch (err) {
    console.log(`no ${region}: ${err.code ?? err.message.slice(0, 60)}`)
    try { await client.end() } catch {}
  }
}
process.exit(1)
