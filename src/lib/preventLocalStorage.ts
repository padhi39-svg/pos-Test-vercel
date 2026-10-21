// Utility to prevent localStorage usage and enforce SQLite API usage
// This ensures NO DATA goes to localStorage - everything must use SQLite database

export function preventLocalStorageUsage() {
  if (typeof window === 'undefined') return

  // Override localStorage methods to prevent accidental usage
  const originalSetItem = localStorage.setItem
  const originalGetItem = localStorage.getItem
  const originalRemoveItem = localStorage.removeItem
  const originalClear = localStorage.clear

  // Override setItem to prevent data storage
  localStorage.setItem = function(key: string, value: string) {
    // Allow only UI preferences, block all data storage
    if (key === 'sidebar_collapsed' || key.startsWith('ui_')) {
      return originalSetItem.call(this, key, value)
    }
    
    console.error(`🚫 BLOCKED localStorage.setItem("${key}") - Use SQLite API instead!`)
    console.trace('Stack trace for localStorage usage:')
    throw new Error(`localStorage usage blocked for key: ${key}. Use SQLite API endpoints instead.`)
  }

  // Override getItem to prevent data reading
  localStorage.getItem = function(key: string) {
    // Allow only UI preferences, block all data reading
    if (key === 'sidebar_collapsed' || key.startsWith('ui_')) {
      return originalGetItem.call(this, key)
    }
    
    console.error(`🚫 BLOCKED localStorage.getItem("${key}") - Use SQLite API instead!`)
    console.trace('Stack trace for localStorage usage:')
    return null // Return null to simulate empty localStorage
  }

  // Override removeItem to prevent data deletion
  localStorage.removeItem = function(key: string) {
    // Allow only UI preferences, block all data deletion
    if (key === 'sidebar_collapsed' || key.startsWith('ui_')) {
      return originalRemoveItem.call(this, key)
    }
    
    console.error(`🚫 BLOCKED localStorage.removeItem("${key}") - Use SQLite API instead!`)
    console.trace('Stack trace for localStorage usage:')
  }

  // Override clear to prevent mass deletion
  localStorage.clear = function() {
    console.error('🚫 BLOCKED localStorage.clear() - Use SQLite API instead!')
    console.trace('Stack trace for localStorage usage:')
  }

  console.log('✅ localStorage protection enabled - Only UI preferences allowed, all data must use SQLite API')
}

// Clean up any existing data in localStorage (except UI preferences)
export function cleanupLocalStorageData() {
  if (typeof window === 'undefined') return

  const keysToRemove: string[] = []
  
  // Find all data keys (not UI preferences)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key !== 'sidebar_collapsed' && !key.startsWith('ui_')) {
      keysToRemove.push(key)
    }
  }

  // Remove all data keys
  keysToRemove.forEach(key => {
    localStorage.removeItem(key)
    console.log(`🧹 Cleaned up localStorage key: ${key}`)
  })

  console.log(`✅ Cleaned up ${keysToRemove.length} localStorage data keys - Only SQLite database should be used now`)
}

// Initialize localStorage prevention
export function initializeLocalStoragePrevention() {
  cleanupLocalStorageData()
  preventLocalStorageUsage()
  
  console.log('🛡️ localStorage prevention initialized - All data must use SQLite API endpoints')
}
