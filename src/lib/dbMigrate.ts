import { Pool } from 'pg'

export async function migrateDatabase(pool: Pool) {
  const actions: string[] = []

  // Migrate existing MF numbers from MF-YYYYMM-NNN to MF/YYYY/NNNNNN
  try {
    const { rows: mfRows } = await pool.query(
      `SELECT id, nomor FROM manufaktur WHERE nomor LIKE 'MF-%' ORDER BY id`
    )
    if (mfRows.length > 0) {
      const yearGroups = new Map<string, { id: number }[]>()
      for (const r of mfRows) {
        const parts = String(r.nomor).split('-')
        if (parts.length < 3) continue
        const year = (parts[1] || '').slice(0, 4)
        if (!year) continue
        if (!yearGroups.has(year)) yearGroups.set(year, [])
        yearGroups.get(year)!.push({ id: Number(r.id) })
      }
      for (const [year, items] of yearGroups) {
        for (let idx = 0; idx < items.length; idx++) {
          const seq = String(idx + 1).padStart(6, '0')
          await pool.query(
            `UPDATE manufaktur SET nomor = $1 WHERE id = $2`,
            [`MF/${year}/${seq}`, items[idx].id]
          )
        }
      }
      actions.push(`Migrated ${mfRows.length} MF numbers to MF/YYYY/NNNNNN`)
    }
  } catch (e) {
    console.warn('MF migration error:', e)
  }

  return { actions }
}
