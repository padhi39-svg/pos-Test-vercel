"use client"
import BarangPembantuForm, { BarangPembantuFormData } from '@/components/barang-pembantu/BarangPembantuForm'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'

export default function Page() {
  const onSubmit = async (data: BarangPembantuFormData) => {
    const res = await fetch('/api/barang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, jenis: 3, prices: [{ price: data.price, effectiveDate: data.effectiveDate }] }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showError(err?.error || CrudErrors.createFailed('barang pembantu'))
      throw new Error('Save failed')
    }
    showSuccess(CrudMessages.created('barang pembantu'))
  }

  return (
    <BarangPembantuForm
      title="Tambah Barang Setengah Jadi"
      basePath="/master/barang-pembantu"
      onSubmit={onSubmit}
    />
  )
}
