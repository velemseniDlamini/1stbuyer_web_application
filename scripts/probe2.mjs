import pg from 'pg'
import dns from 'node:dns/promises'

const REF = 'qpjqveipehhxqyxhlwmy'
const PASSWORD = process.env.SUPA_PW
const prefixes = ['aws-1', 'aws-0']
const regions = [
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-south-1',
  'ca-central-1', 'sa-east-1',
]

const hosts = []
for (const p of prefixes) {
  for (const r of regions) {
    const host = `${p}-${r}.pooler.supabase.com`
    try {
      await dns.resolve4(host)
      hosts.push(host)
    } catch {}
  }
}
console.log(`resolvable pooler hosts: ${hosts.length}`)

for (const host of hosts) {
  const client = new pg.Client({
    host, port: 5432,
    user: `postgres.${REF}`, password: PASSWORD, database: 'postgres',
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 7000,
  })
  try {
    await client.connect()
    const r = await client.query('select current_database() as db')
    console.log(`\nSUCCESS host=${host} db=${r.rows[0].db}`)
    await client.end()
    process.exit(0)
  } catch (err) {
    const msg = String(err.message)
    if (!/tenant\/user .* not found/.test(msg)) console.log(`${host}: ${msg.slice(0, 70)}`)
    try { await client.end() } catch {}
  }
}
console.log('\nNo pooler accepted this project ref.')
process.exit(1)
