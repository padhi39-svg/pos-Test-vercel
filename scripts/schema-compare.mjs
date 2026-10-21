import pg from 'pg';
import fs from 'fs';

const REFERENCE_FILE = process.argv[2] || 'schema-reference.json';
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';

if (!fs.existsSync(REFERENCE_FILE)) {
  console.error(`File referensi ${REFERENCE_FILE} tidak ditemukan.`);
  console.error('Jalankan dulu: node scripts/schema-snapshot.mjs');
  process.exit(1);
}

const reference = JSON.parse(fs.readFileSync(REFERENCE_FILE, 'utf8'));
const pool = new pg.Pool({ connectionString: DB_URL });

async function compare() {
  const tablesRes = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
  );
  const localTables = new Set(tablesRes.rows.map(r => r.table_name));

  let hasDiff = false;

  // Check tables in reference but not in local
  for (const table of Object.keys(reference)) {
    if (!localTables.has(table)) {
      console.log(`❌ TABLE MISSING: "${table}"`);
      hasDiff = true;
      continue;
    }

    const colsRes = await pool.query(
      `SELECT column_name, data_type, character_maximum_length, is_nullable,
              column_default, is_identity, identity_generation
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`,
      [table]
    );
    const localCols = Object.fromEntries(
      colsRes.rows.map(c => [c.column_name, {
        type: c.data_type,
        maxLen: c.character_maximum_length,
        nullable: c.is_nullable === 'YES',
        default: c.column_default,
        identity: c.is_identity === 'YES' ? c.identity_generation : null
      }])
    );

    const refCols = reference[table].columns;

    // Missing columns
    for (const col of Object.keys(refCols)) {
      if (!localCols[col]) {
        console.log(`  ❓ "${table}" → kolom "${col}" tidak ada`);
        hasDiff = true;
        continue;
      }
      // Type mismatch
      const ref = refCols[col];
      const loc = localCols[col];
      const issues = [];
      if (ref.type !== loc.type) issues.push(`type: ${ref.type} ≠ ${loc.type}`);
      if (ref.nullable !== loc.nullable) issues.push(`nullable: ${ref.nullable} ≠ ${loc.nullable}`);
      if (ref.identity !== loc.identity) issues.push(`identity: ${ref.identity || 'NO'} ≠ ${loc.identity || 'NO'}`);
      if (issues.length > 0) {
        console.log(`  ⚠️  "${table}"."${col}": ${issues.join(', ')}`);
        hasDiff = true;
      }
    }

    // Extra columns in local (not in reference)
    for (const col of Object.keys(localCols)) {
      if (!refCols[col]) {
        console.log(`  ➕ "${table}" → kolom tambahan "${col}"`);
        hasDiff = true;
      }
    }
  }

  // Tables in local but not in reference
  for (const table of [...localTables].sort()) {
    if (!reference[table]) {
      console.log(`➕ TABLE EXTRA: "${table}"`);
      hasDiff = true;
    }
  }

  if (!hasDiff) {
    console.log('✅ Schema COCOK 100% dengan referensi.');
  } else {
    console.log('\n⚠️  Ada perbedaan schema. Cek daftar di atas.');
  }

  await pool.end();
}

compare().catch(e => { console.error(e); process.exit(1); });
