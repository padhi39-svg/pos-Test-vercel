"use client"
import { useState } from 'react'

export default function StockSimplePage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runSimpleFix = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const res = await fetch('/api/stock-simple', { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to fix stock', details: error })
    } finally {
      setLoading(false)
    }
  }

  const checkStock = async () => {
    setLoading(true)
    
    try {
      const res = await fetch('/api/stock-simple')
      const data = await res.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to check stock', details: error })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Simple Stock Fix</h1>
      <p className="text-gray-600">Perbaiki stok dengan metode sederhana yang pasti bekerja</p>
      
      <div className="space-x-2">
        <button
          onClick={runSimpleFix}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? 'Processing...' : '🔧 Fix Stock Simple'}
        </button>
        
        <button
          onClick={checkStock}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Loading...' : '📊 Check Stock'}
        </button>
      </div>

      {result && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h3 className="font-semibold mb-2">Result:</h3>
          <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
