"use client"
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import IngredientForm from '@/components/ingredient/IngredientForm'

export default function IngredientViewPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params.id)
  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/recipes?barangId=${id}`)
        if (!res.ok) throw new Error('Failed to load recipe')
        const rows = await res.json() as any[]
        if (!rows || rows.length === 0) {
          setItem(null)
        } else {
          const first = rows[0]
          const mapped = {
            barangJadiId: id,
            name: first.barang_name || first.barang_code || 'Resep',
            description: '',
            portion: 1,
            items: rows.map(r => ({
              bahanBakuId: r.ingredient_id,
              quantity: r.quantity,
              unitName: r.unit,
              notes: r.notes || ''
            })),
            isActive: true,
          }
          setItem(mapped)
        }
      } catch (e) {
        console.error(e)
        setItem(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div className="text-sm">Loading...</div>

  if (!item) {
    return (
      <div className="space-y-3">
        <div className="text-sm">Data tidak ditemukan.</div>
        <a href={"/ingredient?" + returnQuery} className="underline text-primary-600">Kembali</a>
      </div>
    )
  }

  return (
    <IngredientForm
      title="Detail Ingredient"
      basePath="/ingredient"
      currentId={id}
      readonly
      initial={item}
      onSubmit={() => {}}
    />
  )
}
