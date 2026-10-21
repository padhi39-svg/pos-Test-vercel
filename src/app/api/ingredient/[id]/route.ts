import { NextRequest, NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'
import { formatName, formatCode } from '@/lib/textUtils'
import { getUserId } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'ingredient', 'view')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses melihat ingredient' }, { status: 403 })
    }
    const id = parseInt(params.id)
    
    const ingredient = await rawGet(`
      SELECT 
        i.id, i.code, i.name, i.unit, i.hpp, i.stock_minimum, i.stock_current,
        i.kategori_id, k.name as kategori_name,
        i.spesifikasi_id, s.name as spesifikasi_name,
        i.merk_id, m.name as merk_name,
        i.isdelete, i.created_at, i.updated_at
      FROM master_ingredient i
      LEFT JOIN master_kategori k ON i.kategori_id = k.id
      LEFT JOIN master_spesifikasi s ON i.spesifikasi_id = s.id
      LEFT JOIN master_merk m ON i.merk_id = m.id
      WHERE i.id = ? AND i.COALESCE(isdelete, 0) = 0
    `, [id]) as any
    
    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 })
    }
    
    return NextResponse.json(ingredient)
  } catch (error) {
    console.error('Error fetching ingredient:', error)
    return NextResponse.json({ error: 'Failed to fetch ingredient' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'ingredient', 'edit')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses mengubah ingredient' }, { status: 403 })
    }
    const data = await request.json()
    const id = parseInt(params.id)
    
    const existing = await rawGet('SELECT id FROM master_ingredient WHERE id = ? AND COALESCE(isdelete, 0) = 0', [id])
    if (!existing) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 })
    }
    
    const name = formatName(data.name) || ''
    const unit = data.unit || 'Kg'
    const hpp = parseFloat(data.hpp) || 0
    const stockMinimum = parseFloat(data.stockMinimum) || 0
    const stockCurrent = parseFloat(data.stockCurrent) || 0
    const kategoriId = data.kategoriId || null
    const spesifikasiId = data.spesifikasiId || null
    const merkId = data.merkId || null
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    const userId = getUserId(request)
    await rawRun(`
      UPDATE master_ingredient 
      SET name = ?, kategori_id = ?, spesifikasi_id = ?, merk_id = ?, unit = ?, hpp = ?, 
          stock_minimum = ?, stock_current = ?, updated_at = CURRENT_TIMESTAMP, user_edit = ? 
      WHERE id = ?
    `, [name, kategoriId, spesifikasiId, merkId, unit, hpp, stockMinimum, stockCurrent, userId, id])
    
    const updatedIngredient = await rawGet(`
      SELECT 
        i.id, i.code, i.name, i.unit, i.hpp, i.stock_minimum, i.stock_current,
        i.kategori_id, k.name as kategori_name,
        i.spesifikasi_id, s.name as spesifikasi_name,
        i.merk_id, m.name as merk_name,
        i.isdelete, i.created_at, i.updated_at
      FROM master_ingredient i
      LEFT JOIN master_kategori k ON i.kategori_id = k.id
      LEFT JOIN master_spesifikasi s ON i.spesifikasi_id = s.id
      LEFT JOIN master_merk m ON i.merk_id = m.id
      WHERE i.id = ?
    `, [id])
    
    return NextResponse.json(updatedIngredient)
  } catch (error) {
    console.error('Error updating ingredient:', error)
    return NextResponse.json({ error: 'Failed to update ingredient' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasPermission(request as any, 'ingredient', 'delete')) {
      return NextResponse.json({ error: 'Forbidden: tidak punya akses menghapus ingredient' }, { status: 403 })
    }
    const id = parseInt(params.id)
    
    const existing = await rawGet('SELECT id FROM master_ingredient WHERE id = ? AND COALESCE(isdelete, 0) = 0', [id])
    if (!existing) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 })
    }
    
    const usageCheck = await rawGet(`
      SELECT COUNT(*) as count FROM barang_recipes 
      WHERE ingredient_id = ?
    `, [id]) as { count: number }
    
    if (usageCheck.count > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete ingredient that is being used in recipes' 
      }, { status: 400 })
    }
    
    const userId = getUserId(request)
    await rawRun(`
      UPDATE master_ingredient 
      SET isdelete = 1, updated_at = CURRENT_TIMESTAMP, user_edit = ? 
      WHERE id = ?
    `, [userId, id])
    
    return NextResponse.json({ message: 'Ingredient deleted successfully' })
  } catch (error) {
    console.error('Error deleting ingredient:', error)
    return NextResponse.json({ error: 'Failed to delete ingredient' }, { status: 500 })
  }
}
