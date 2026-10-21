export function sanitizeDateInput(value: string) {
  const v = String(value || '')
  if (!v) return ''

  if (v.includes('-')) {
    const parts = v.split('-')
    parts[0] = String(parts[0] || '').slice(0, 4)
    return parts.join('-').slice(0, 10)
  }

  if (v.includes('/')) {
    const parts = v.split('/')
    if (parts.length === 3) {
      parts[2] = String(parts[2] || '').slice(0, 4)
      return parts.join('/')
    }
  }

  return v.slice(0, 4)
}
