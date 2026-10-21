"use client"
import BarangForm, { BarangFormData } from '@/components/barang/BarangForm'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'

export default function NewBarangPage() {
  const onSubmit = async (data: BarangFormData) => {
    const res = await fetch('/api/barang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: data.code,
        name: data.name,
        kategoriId: data.kategoriId ?? null,
        spesifikasiId: data.spesifikasiId ?? null,
        merkId: data.merkId ?? null,
        hpp: data.hpp,
        jenis: data.jenis,
        aktif: data.aktif,
        tampilMenu: data.tampilMenu,
        accountId: data.accountId ?? null,
        photoUrl: data.photoUrl ?? null,
        units: data.units,
        prices: [{ price: data.price, effectiveDate: data.effectiveDate }],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showError(err?.error || CrudErrors.createFailed('barang'))
      throw new Error('Save failed')
    }
    showSuccess(CrudMessages.created('barang'))
  }

  return (
    <BarangForm
      title="Tambah Barang"
      basePath="/barang/menu"
      onSubmit={onSubmit}
    />
  )
}
