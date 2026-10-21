/**
 * Text formatting utilities for consistent data handling across the application
 */

/**
 * Converts text to Title Case (capitalize first letter of each word)
 * Example: "hello world" -> "Hello World"
 */
export function toTitleCase(text: string): string {
  if (!text) return ''
  
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Converts text to UPPERCASE
 * Example: "hello world" -> "HELLO WORLD"
 */
export function toUpperCase(text: string): string {
  return (text || '').toUpperCase()
}

/**
 * Converts text to lowercase
 * Example: "HELLO WORLD" -> "hello world"
 */
export function toLowerCase(text: string): string {
  return (text || '').toLowerCase()
}

/**
 * Capitalizes only the first letter of the entire text
 * Example: "hello world" -> "Hello world"
 */
export function capitalizeFirst(text: string): string {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Trims whitespace and normalizes spacing
 * Example: "  hello   world  " -> "hello world"
 */
export function normalizeSpacing(text: string): string {
  return (text || '').trim().replace(/\s+/g, ' ')
}

/**
 * Combined function: normalize spacing + title case
 * This is the main function to use for name fields
 */
export function formatName(text: string): string {
  return toTitleCase(normalizeSpacing(text))
}

/**
 * Combined function: normalize spacing + uppercase
 * This is the main function to use for code fields
 */
export function formatCode(text: string): string {
  return toUpperCase(normalizeSpacing(text))
}

/**
 * Real-time input handler for Title Case fields
 * Use this in onChange handlers for name fields
 */
export function handleTitleCaseInput(
  value: string,
  setter: (value: string) => void
) {
  const formatted = formatName(value)
  setter(formatted)
}

/**
 * Real-time input handler for Code fields
 * Use this in onChange handlers for code fields
 */
export function handleCodeInput(
  value: string,
  setter: (value: string) => void
) {
  const formatted = formatCode(value)
  setter(formatted)
}
