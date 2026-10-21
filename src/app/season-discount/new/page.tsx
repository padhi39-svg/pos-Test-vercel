"use client"

import { useState } from 'react'
import SeasonDiscountForm from '@/components/season/SeasonDiscountForm'

export default function NewSeasonDiscountPage() {
  const basePath = '/season-discount'
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (data: any) => {
    try {
      setSaving(true)
      const res = await fetch('/api/season-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Gagal menambah season discount')
      }
      return res
    } finally {
      setSaving(false)
    }
  }

  return (
    <SeasonDiscountForm
      title="Tambah Season Discount"
      basePath={basePath}
      onSubmit={handleSubmit}
    />
  )
}
