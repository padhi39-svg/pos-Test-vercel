import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5432/pos',
})

async function main() {
  const client = await pool.connect()
  try {
    // Create or reuse level
    let levelId
    const existing = await client.query("SELECT id FROM master_level_manager WHERE code = 'ADMIN_ENTRY' AND isdelete = 0")
    if (existing.rows.length > 0) {
      levelId = existing.rows[0].id
      console.log(`Reusing existing level "Admin Entry" (id=${levelId})`)
      // Clear existing permissions
      await client.query('DELETE FROM level_permissions WHERE level_id = $1', [levelId])
    } else {
      const r = await client.query(
        `INSERT INTO master_level_manager (code, name, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
        ['ADMIN_ENTRY', 'Admin Entry']
      )
      levelId = r.rows[0].id
      console.log(`Created level "Admin Entry" (id=${levelId})`)
    }

    // 2. Get all distinct menu_code + permission_code combinations from ADMIN level
    const adminPerms = await client.query(
      `SELECT DISTINCT menu_code, permission_code FROM level_permissions WHERE level_id = (SELECT id FROM master_level_manager WHERE code = 'ADMIN' AND isdelete = 0 LIMIT 1)`
    )

    // 3. Only allow VIEW and CREATE, deny everything else
    const allowed = new Set(['VIEW', 'CREATE'])

    await client.query('BEGIN')
    let count = 0
    for (const row of adminPerms.rows) {
      const allowValue = allowed.has(row.permission_code) ? 1 : 0
      await client.query(
        `INSERT INTO level_permissions (level_id, menu_code, permission_code, allowed)
         VALUES ($1, $2, $3, $4)`,
        [levelId, row.menu_code, row.permission_code, allowValue]
      )
      count++
    }
    await client.query('COMMIT')

    console.log(`Inserted/updated ${count} permission rows.`)
    console.log('Done! Level "Admin Entry" has only VIEW and CREATE permissions.')
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('Error:', e.message || e)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
