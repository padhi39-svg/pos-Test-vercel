// Simple SQLite concurrency stress test using better-sqlite3 and cluster
// This tests concurrent writers against the same DB file to validate WAL and busy_timeout settings.

const os = require('os')
const path = require('path')
const cluster = require('cluster')
const fs = require('fs')
const Database = require('better-sqlite3')

const WORKERS = Number(process.env.WORKERS || 10) // simulate 10 users
const INSERTS_PER_WORKER = Number(process.env.INSERTS || 200)
const DATA_DIR = path.resolve(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'resto-system.db')

if (cluster.isPrimary) {
  const start = Date.now()
  let completed = 0
  let failed = 0

  console.log(`Starting stress test with ${WORKERS} workers x ${INSERTS_PER_WORKER} inserts (total ${WORKERS * INSERTS_PER_WORKER})`)

  for (let i = 0; i < WORKERS; i++) {
    const worker = cluster.fork({ WORKER_ID: String(i + 1), INSERTS_PER_WORKER, DB_PATH })
    worker.on('message', (msg) => {
      if (msg && msg.type === 'done') {
        completed += msg.ok || 0
        failed += msg.fail || 0
      }
    })
  }

  let exited = 0
  cluster.on('exit', () => {
    exited++
    if (exited === WORKERS) {
      const dur = Date.now() - start
      console.log(`All workers finished in ${dur} ms`)
      console.log(`OK: ${completed}, Failed: ${failed}`)
      const tps = (completed / (dur / 1000)).toFixed(1)
      console.log(`Throughput ~ ${tps} inserts/sec`)
      process.exit(failed > 0 ? 1 : 0)
    }
  })
} else {
  const workerId = process.env.WORKER_ID
  const insertsTarget = Number(process.env.INSERTS_PER_WORKER || 200)
  const dbPath = process.env.DB_PATH

  // Ensure data directory exists
  const dataDir = path.dirname(dbPath)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const db = new Database(dbPath)
  // Apply recommended pragmas (should already be set by app, but ensure here too)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  // Ensure WAL/busy_timeout not overridden, just use existing.

  db.exec(`
    CREATE TABLE IF NOT EXISTS stress_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker TEXT,
      ts TEXT,
      note TEXT
    );
  `)

  const insertStmt = db.prepare('INSERT INTO stress_log (worker, ts, note) VALUES (?, ?, ?)')
  const doTx = db.transaction((batch) => {
    for (let i = 0; i < batch; i++) {
      insertStmt.run(workerId, new Date().toISOString(), `w${workerId}-i${i}`)
    }
  })

  let ok = 0
  let fail = 0
  for (let i = 0; i < insertsTarget; i++) {
    try {
      // tiny transaction of 1 insert (most realistic lock pattern)
      doTx.immediate(1)
      ok++
    } catch (e) {
      fail++
    }
  }

  if (process.send) process.send({ type: 'done', ok, fail })
  process.exit(0)
}
