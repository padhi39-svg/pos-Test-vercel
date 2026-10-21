import { rawAll, rawGet } from '@/db/raw'

export type IngredientUnit = {
  id: number
  ingredient_id: number
  name: string
  ratio: number
}

export async function getIngredientUnits(ingredientId: number): Promise<IngredientUnit[]> {
  const units = await rawAll<IngredientUnit>('SELECT * FROM ingredient_units WHERE ingredient_id = ? ORDER BY ratio ASC', [ingredientId])
  return units
}

export async function getBaseUnit(ingredientId: number): Promise<IngredientUnit | null> {
  const unit = await rawGet<IngredientUnit>('SELECT * FROM ingredient_units WHERE ingredient_id = ? AND ratio = 1 LIMIT 1', [ingredientId])
  return unit || null
}

export async function convertToBaseUnit(qty: number, unitName: string, ingredientId: number): Promise<number> {
  const unit = await rawGet<{ ratio: number }>('SELECT ratio FROM ingredient_units WHERE ingredient_id = ? AND name = ? LIMIT 1', [ingredientId, unitName])

  if (!unit) {
    console.warn(`Unit ${unitName} not found for ingredient ${ingredientId}, assuming ratio 1`)
    return qty
  }

  return qty * unit.ratio
}

export async function convertFromBaseUnit(qtyBase: number, targetUnitName: string, ingredientId: number): Promise<number> {
  const unit = await rawGet<{ ratio: number }>('SELECT ratio FROM ingredient_units WHERE ingredient_id = ? AND name = ? LIMIT 1', [ingredientId, targetUnitName])

  if (!unit) {
    console.warn(`Unit ${targetUnitName} not found for ingredient ${ingredientId}, assuming ratio 1`)
    return qtyBase
  }

  return qtyBase / unit.ratio
}

export async function getIngredientBaseUnitName(ingredientId: number): Promise<string> {
  const ingredient = await rawGet<{ base_unit: string }>('SELECT base_unit FROM master_ingredient WHERE id = ?', [ingredientId])
  return ingredient?.base_unit || 'unit'
}

export async function calculateCurrentStock(ingredientId: number): Promise<number> {
  const result = await rawGet<{ total_in: number; total_out: number }>(`
    SELECT 
      COALESCE(SUM(CASE WHEN movement_type = 'in' THEN quantity ELSE 0 END), 0) as total_in,
      COALESCE(SUM(CASE WHEN movement_type = 'out' THEN quantity ELSE 0 END), 0) as total_out
    FROM stock_movements
    WHERE ingredient_id = ?
  `, [ingredientId])

  if (!result) return 0
  return result.total_in - result.total_out
}
