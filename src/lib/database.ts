export { getDb as getDatabase } from '@/db'

export function handleDatabaseError(error: any) {
  console.error('Database error:', error)
  throw new Error(`Database operation failed: ${error.message}`)
}
