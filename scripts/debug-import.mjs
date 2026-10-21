import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'data/resto-system.db')
const db = new Database(dbPath)

// Check accounts table columns
const cols = db.prepare("PRAGMA table_info('accounts')").all()
console.log('accounts cols:', JSON.stringify(cols))

// Check account 1340-11
const acct = db.prepare("SELECT * FROM accounts WHERE code = '1340-11'").get()
console.log('1340-11:', JSON.stringify(acct))

// Check all non-header accounts with code containing 1340
const nonHeader = db.prepare("SELECT code, name, is_header FROM accounts WHERE is_header = 0 AND code LIKE '%1340%'").all()
console.log('non-header 1340*:', JSON.stringify(nonHeader))

// Check kategori K008
const kat = db.prepare("SELECT * FROM master_kategori WHERE code = 'K008'").get()
console.log('K008:', JSON.stringify(kat))

// Check spesifikasi S001
const spes = db.prepare("SELECT * FROM master_spesifikasi WHERE code = 'S001'").get()
console.log('S001:', JSON.stringify(spes))

// Check merk M001
const merk = db.prepare("SELECT * FROM master_merk WHERE code = 'M001'").get()
console.log('M001:', JSON.stringify(merk))

db.close()
