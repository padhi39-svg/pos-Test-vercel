import pg from 'pg'
import crypto from 'crypto'

const pool = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/pos-web' })

async function main() {
  await pool.query(`INSERT INTO master_level_manager (code, name) VALUES ('ADMIN', 'Administrator') ON CONFLICT (code) DO NOTHING`)

  const salt = crypto.randomBytes(8).toString('hex')
  const hash = crypto.createHash('sha256').update(salt + 'admin123').digest('hex')
  const passwordHash = `sha256:${salt}:${hash}`

  await pool.query(`
    INSERT INTO master_users (code, name, level_id, aktif, is_active, email, password_hash)
    VALUES ('USR/000001', 'Admin', 1, 1, 1, 'admin@posweb.local', $1)
    ON CONFLICT (code) DO UPDATE SET password_hash = $1
  `, [passwordHash])

  const { rows: [user] } = await pool.query('SELECT id FROM master_users WHERE code = $1', ['USR/000001'])
  console.log('User ID:', user.id)

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  await pool.query('INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, token, expires])
  console.log('SESSION_TOKEN=' + token)
  console.log('')
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
