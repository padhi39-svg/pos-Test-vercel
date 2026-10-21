import { NextRequest } from 'next/server'
import { rawAll, rawRun } from '@/db/raw'

export function getUserId(req: NextRequest): number {
  const h = req.headers.get('x-user-id')
  let id = h ? Number(h) : 0
  if (!Number.isFinite(id) || id <= 0) {
    try {
      const cookies = (req as any).cookies
      const names = [
        'x-user-id', 'user_id', 'userId', 'userid', 'uid', 'uid_number'
      ]
      for (const n of names) {
        const v = cookies?.get?.(n)?.value
        const nval = v ? Number(v) : 0
        if (Number.isFinite(nval) && nval > 0) { id = nval; break }
      }
      if (!(Number.isFinite(id) && id > 0)) {
        const jnames = ['current_user', 'user', 'session_user']
        for (const n of jnames) {
          const v = cookies?.get?.(n)?.value
          if (v) {
            try {
              const obj = JSON.parse(decodeURIComponent(v))
              const cand = Number(obj?.id ?? obj?.user_id)
              if (Number.isFinite(cand) && cand > 0) { id = cand; break }
            } catch {}
          }
        }
      }
    } catch {}
  }
  return Number.isFinite(id) && id > 0 ? id : 0
}

export async function addAuditColumns() {
  if ((globalThis as any).__auditColumnsDone) return
  ;(globalThis as any).__auditColumnsDone = true
  const tables = await rawAll<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  )
  for (const t of tables) {
    const name = t.table_name
    const cols = await rawAll<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = ?", [name]
    )
    const has = (n: string) => cols.some(c => c.column_name.toLowerCase() === n.toLowerCase())
    if (!has('created_at')) {
      try { await rawRun(`ALTER TABLE "${name}" ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`) } catch {}
    }
    if (!has('updated_at')) {
      try { await rawRun(`ALTER TABLE "${name}" ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`) } catch {}
    }
    if (!has('user_create')) {
      try { await rawRun(`ALTER TABLE "${name}" ADD COLUMN user_create INTEGER`) } catch {}
    }
    if (!has('user_edit')) {
      try { await rawRun(`ALTER TABLE "${name}" ADD COLUMN user_edit INTEGER`) } catch {}
    }
  }
}

export async function applyCreateAudit(table: string, id: number | string, userId: number, idCol: string = 'id') {
  try {
    await rawRun(
      `UPDATE "${table}" SET user_create = COALESCE(user_create, ?), created_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE "${idCol}" = ?`,
      [userId || 0, id]
    )
  } catch {}
}

export async function applyUpdateAudit(table: string, id: number | string, userId: number, idCol: string = 'id') {
  try {
    await rawRun(
      `UPDATE "${table}" SET user_edit = ?, updated_at = CURRENT_TIMESTAMP WHERE "${idCol}" = ?`,
      [userId || 0, id]
    )
  } catch {}
}

export async function applyCreateAuditWhere(table: string, whereClause: string, params: any[], userId: number) {
  try {
    await rawRun(
      `UPDATE "${table}" SET user_create = COALESCE(user_create, ?), created_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE ${whereClause}`,
      [userId || 0, ...params]
    )
  } catch {}
}

export async function applyUpdateAuditWhere(table: string, whereClause: string, params: any[], userId: number) {
  try {
    await rawRun(
      `UPDATE "${table}" SET user_edit = ?, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause}`,
      [userId || 0, ...params]
    )
  } catch {}
}
