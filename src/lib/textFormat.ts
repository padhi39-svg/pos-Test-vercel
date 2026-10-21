// Shared text formatting utilities for inputs across the app
// Use these helpers in forms to ensure consistent behavior

/**
 * smartTitleCase
 * - Changes only the letter casing while preserving all original spacing and symbols
 * - Does NOT trim
 * - Does NOT collapse multiple spaces
 * - Starts a new word after common separators (space, tabs, newlines, dashes, slashes, underscores, parentheses)
 */
export function smartTitleCase(input: string): string {
  let result = ''
  let startOfWord = true
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const isLetter = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(ch)

    if (isLetter) {
      if (startOfWord) {
        result += ch.toUpperCase()
      } else {
        result += ch.toLowerCase()
      }
      startOfWord = false
    } else {
      result += ch
      // Treat these as word separators; others (e.g., comma) keep current flag
      if (/[\s\-_/()]/.test(ch)) {
        startOfWord = true
      } else {
        // punctuation like ',' or '.' does not necessarily start a new word
        // leave startOfWord as-is
      }
    }
  }
  return result
}

/**
 * onlyDigits
 * - Keep only numeric characters 0-9
 */
export function onlyDigits(input: string): string {
  return input.replace(/[^0-9]/g, '')
}
