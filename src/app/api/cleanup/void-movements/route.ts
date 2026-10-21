import { NextResponse } from 'next/server'
import { rawAll, rawGet, rawRun } from '@/db/raw'
import { getDb } from '@/db'

/**
 * DELETE /api/cleanup/void-movements
 * Cleanup old void stock movements (reference_type = 'void')
 * These are reversal movements created by old void logic
 */
export async function DELETE() {
  try {
    const db = getDb()
    
    // Get count before deletion
    const countBefore = await rawGet(`
      SELECT COUNT(*) as count 
      FROM stock_movements 
      WHERE reference_type = 'void'
    `) as { count: number }
    
    console.log(`[Cleanup] Found ${countBefore.count} void movements to delete`)
    
    if (countBefore.count === 0) {
      return NextResponse.json({
        success: true,
        message: 'No void movements to cleanup',
        deleted: 0
      })
    }
    
    // Delete void movements
    const result = await rawRun(`
      DELETE FROM stock_movements 
      WHERE reference_type = 'void'
    `)
    
    console.log(`[Cleanup] Deleted ${result.rowCount} void movements`)
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.rowCount} void movements`,
      deleted: result.rowCount
    })
  } catch (error: any) {
    console.error('[Cleanup] Error deleting void movements:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to cleanup void movements', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
