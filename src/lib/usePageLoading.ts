import { useState } from 'react'

export function usePageLoading() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const run = async <T>(fn: () => Promise<T>, mode?: 'refresh') => {
    const set = mode === 'refresh' ? setRefreshing : setLoading
    set(true)
    try {
      return await fn()
    } finally {
      set(false)
    }
  }

  return { loading, refreshing, run }
}
