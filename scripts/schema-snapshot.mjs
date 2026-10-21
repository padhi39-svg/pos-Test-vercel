import pg from 'pg';
import fs from 'fs';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web'
});

async function snapshot() {
  // 1. Tables
  const tablesRes = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
  );

  const schema = {};

  for (const t of tablesRes.rows) {
    const table = t.table_name;
    const colsRes = await pool.query(
      `SELECT column_name, data_type, character_maximum_length, is_nullable,
              column_default, is_identity, identity_generation
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`,
      [table]
    );

    const pkRes = await pool.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='PRIMARY KEY'`,
      [table]
    );

    schema[table] = {
      columns: Object.fromEntries(
        colsRes.rows.map(c => [
          c.column_name,
          {
            type: c.data_type,
            maxLen: c.character_maximum_length,
            nullable: c.is_nullable === 'YES',
            default: c.column_default,
            identity: c.is_identity === 'YES' ? c.identity_generation : null
          }
        ])
      ),
      primaryKey: pkRes.rows.map(r => r.column_name)
    };
  }

  const outPath = process.argv[2] || 'schema-reference.json';
  fs.writeFileSync(outPath, JSON.stringify(schema, null, 2), 'utf8');
  console.log(`Schema snapshot saved to ${outPath}`);
  console.log(`Tables: ${Object.keys(schema).length}`);
  await pool.end();
}

snapshot().catch(e => { console.error(e); process.exit(1); });
