// Utility functions for handling regional number formats (Indonesian locale)

/**
 * Parse number with Indonesian regional settings
 * Handles formats like: 1.234.567,89 or 1234567,89 or 1234.56
 */
export function parseRegionalNumber(value: any): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  
  let str = String(value).trim()
  if (!str) return 0
  
  // Handle Indonesian regional format: 1.234.567,89 or 1234567,89
  // Replace comma with dot for decimal separator
  // If there are multiple dots and one comma, treat comma as decimal
  const hasComma = str.includes(',')
  const dotCount = (str.match(/\./g) || []).length
  
  if (hasComma && dotCount > 0) {
    // Format like 1.234.567,89 - dots are thousand separators, comma is decimal
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && dotCount === 0) {
    // Format like 1234567,89 - comma is decimal separator
    str = str.replace(',', '.')
  } else if (!hasComma && dotCount > 0) {
    // No comma present but dots exist -> treat dots as thousand separators (Indonesian style)
    // Example: "15.000" should be parsed as 15000, not 15
    str = str.replace(/\./g, '')
  }
  // If only dots (like 1234.56), keep as is - already in correct format
  
  const result = parseFloat(str)
  return isNaN(result) ? 0 : result
}

/**
 * Format number to Indonesian regional format
 * Example: 1234567.89 -> "1.234.567,89"
 */
export function formatRegionalNumber(value: number, decimals: number = 2): string {
  if (isNaN(value) || value === null || value === undefined) return '0'
  
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Format currency to Indonesian Rupiah format
 * Example: 1234567.89 -> "Rp 1.234.567,89"
 */
export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'Rp 0'
  
  return value.toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

/**
 * Parse input value from regional format to number for form inputs
 * Limits to 2 decimal places maximum
 */
export function parseInputNumber(inputValue: string): number {
  const parsed = parseRegionalNumber(inputValue)
  // Round to 2 decimal places to prevent floating point precision issues
  return Math.round(parsed * 100) / 100
}

/**
 * Format number for input display (with comma as decimal separator and thousand separators)
 * Shows up to 2 decimal places, removes trailing zeros
 */
export function formatInputNumber(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return ''
  
  // Round to 2 decimal places
  const rounded = Math.round(value * 100) / 100
  
  // Format with Indonesian locale (dots for thousands, comma for decimal)
  return rounded.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

/**
 * Validate and format input as user types (for real-time formatting)
 * Prevents more than 2 decimal places during input
 */
export function formatInputOnChange(inputValue: string): string {
  if (!inputValue) return ''

  // Remove any non-numeric characters except comma (we'll reconstruct thousand dots)
  let cleaned = inputValue.replace(/[^\d,]/g, '')

  // Ensure only one comma exists
  const commaIndex = cleaned.indexOf(',')
  let intRaw = commaIndex >= 0 ? cleaned.slice(0, commaIndex) : cleaned
  let decRaw = commaIndex >= 0 ? cleaned.slice(commaIndex + 1) : ''

  // Limit decimals to max 2 digits
  if (decRaw) decRaw = decRaw.replace(/[^\d]/g, '').slice(0, 2)

  // Remove leading zeros in integer part (but keep single zero if all zeros)
  intRaw = intRaw.replace(/^0+(?=\d)/, '')

  // Insert thousand separators (dots) into integer part
  const intWithSep = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // Reconstruct value (keep comma if user just typed it)
  if (commaIndex >= 0) {
    return decRaw.length > 0 ? `${intWithSep},${decRaw}` : `${intWithSep},`
  }
  return intWithSep
}
