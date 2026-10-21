"use client"
import { useState } from 'react'

export default function FixStockPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runFix = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const res = await fetch('/api/fix-stock', { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to fix stock', details: error })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Fix Stock</h1>
      
      <button
        onClick={runFix}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Processing...' : 'Fix Stock Now'}
      </button>

      {result && (
        <div className="mt-4 p-4 border rounded">
          <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
