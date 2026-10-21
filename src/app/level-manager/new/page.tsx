"use client"

import LevelForm from '../LevelForm'
import { showError } from '@/lib/notification'

export default function NewLevelPage() {
  const submit = async (payload: any) => {
    try {
      const res = await fetch('/api/level-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      return res
    } catch (e: any) {
      showError(e.message || 'Gagal menyimpan')
      throw e
    }
  }
  return (
    <LevelForm title="Tambah Level Manager" basePath="/level-manager" onSubmit={submit} />
  )
}
