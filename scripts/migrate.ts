import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

async function main() {
  const url = 'postgresql://ahmdhsm@localhost:5432/pos_web'
  console.log('Running migrations on:', url.replace(/\/\/.*@/, '//user@'))
  const pool = new Pool({ connectionString: url })
  const db = drizzle(pool)
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations complete!')
  await pool.end()
}

main().catch((e) => {
  console.error('Migration failed:', e)
  process.exit(1)
})
