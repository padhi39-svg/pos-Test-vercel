"use client"
import { useRouter } from 'next/navigation'
import IngredientForm from '@/components/ingredient/IngredientForm'

export default function CreateIngredientPage() {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create recipe')
      }
      router.push('/ingredient?' + returnQuery)
    } catch (error: any) {
      console.error('Error creating recipe:', error)
      alert(`Gagal menyimpan resep: ${error.message}`)
    }
  }

  return (
    <IngredientForm
      title="Tambah Ingredient"
      basePath="/ingredient"
      onSubmit={handleSubmit}
    />
  )
}
