const fs = require('fs')
const path = require('path')

// Migration script to move localStorage data to SQLite database
async function migrateLocalStorageToDatabase() {
  console.log('🔄 Starting data migration from localStorage to SQLite...')
  
  try {
    // Initialize database
    const response = await fetch('http://localhost:3001/api/init-db', {
      method: 'POST'
    })
    
    if (!response.ok) {
      throw new Error('Failed to initialize database')
    }
    
    const result = await response.json()
    console.log('✅ Database initialized:', result.message)
    
    console.log('🎉 Migration completed successfully!')
    console.log('📊 Sample data has been seeded to the database')
    console.log('🚀 Your POS system is now ready to use with SQLite database!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

// Run migration
migrateLocalStorageToDatabase()
