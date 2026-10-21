"use client"
import IngredientList from '@/components/ingredient/IngredientList'
import { useEffect, useState } from 'react'

export default function IngredientMenuPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadIngredients = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/recipes')
      if (!response.ok) throw new Error('Failed to load recipes')
      const rows = await response.json() as any[]
      // Group by barang_id menjadi struktur untuk IngredientList
      const grouped: Record<number, any> = {}
      for (const r of rows) {
        const id = r.barang_id
        if (!grouped[id]) {
          grouped[id] = {
            id, // gunakan barang_id sebagai id
            barangJadiId: id,
            name: r.barang_name || r.barang_code || 'Resep', // fallback
            barangJadiName: r.barang_name || r.barang_code || 'Unknown',
            description: '',
            portion: 1,
            items: [],
            isActive: true,
            totalHpp: 0,
          }
        }
        grouped[id].items.push({
          bahanBakuId: r.ingredient_id,
          quantity: r.quantity,
          unitName: r.unit,
          notes: r.notes || ''
        })
        // HPP total = sum(qty * hpp bahan)
        const hpp = Number(r.ingredient_hpp || 0)
        const qty = Number(r.quantity || 0)
        grouped[id].totalHpp += qty * hpp
      }
      const list = Object.values(grouped)
      setItems(list as any[])
    } catch (error) {
      console.error('Error loading recipes:', error)
      alert('Gagal memuat data resep')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadIngredients()
  }, [])

  const onDelete = async (id: number) => {
    if (confirm('Yakin ingin menghapus resep ini?')) {
      try {
        // id di sini adalah barangId (barang_jadi)
        const response = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('Failed to delete recipe')
        await loadIngredients() // Refresh data
      } catch (error) {
        console.error('Error deleting recipe:', error)
        alert('Gagal menghapus resep')
      }
    }
  }

  const onRefresh = () => {
    loadIngredients()
  }

  return (
    <IngredientList 
      title="Master Ingredient (Resep)" 
      basePath="/ingredient" 
      items={items} 
      onDelete={onDelete}
      onRefresh={onRefresh}
    />
  )
}
