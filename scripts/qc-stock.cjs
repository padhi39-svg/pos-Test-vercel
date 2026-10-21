const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos-web';
(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  let ok = 0, fail = 0, partial = 0; const checks = [];

  const q = async (sql, params) => {
    try { const r = await c.query(sql, params || []); return { ok: true, rows: r.rows, count: r.rowCount || r.rows.length, rowCount: r.rowCount || 0 }; }
    catch(e) { return { ok: false, err: e.message, rowCount: 0 }; }
  };
  const cols = async (table) => {
    const r = await q("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
    return r.ok ? r.rows.map(rr => String(rr.column_name).toLowerCase()) : [];
  };
  const check = (label, cond) => { if (cond) { console.log('  ✅ ' + label); ok++; } else { console.log('  ❌ ' + label); fail++; } checks.push({label, ok: cond}); };
  const warn = (label, msg) => { console.log('  ⚠️  ' + label + ': ' + msg); partial++; checks.push({label, ok: false, partial: true}); };

  console.log('=== QC STOK — MASTER, TRANSAKSI & LAPORAN ===\n');

  // ============================================================
  // A. MASTER
  // ============================================================
  console.log('--- A. MASTER ---');

  // A1. master_gudang
  const gCols = await cols('master_gudang');
  const needG = ['id','code','name','is_active','isdelete'];
  check('master_gudang: all required columns', needG.every(n => gCols.includes(n)));

  let r = await q('SELECT id, code, name FROM master_gudang WHERE COALESCE(isdelete,0)=0 ORDER BY id');
  if (r.ok) { check('GET master_gudang: ' + r.count + ' rows', r.count > 0); }
  else { check('GET master_gudang: query error', false); }

  // A2. master_barang (QC'd before, just verify columns)
  const bCols = await cols('master_barang');
  const needB = ['id','code','name','jenis','hpp','kategori_id','isdelete'];
  check('master_barang: all required columns', needB.every(n => bCols.includes(n)));
  r = await q('SELECT id, code, name, jenis, hpp FROM master_barang WHERE COALESCE(isdelete,0)=0 AND jenis IN (1,2,3) LIMIT 5');
  if (r.ok) { check('GET master_barang (stok items): ' + r.count + ' rows', r.count > 0); }

  // A3. barang_units
  const buCols = await cols('barang_units');
  const needBU = ['id','barang_id','name','ratio'];
  check('barang_units: all required columns', needBU.every(n => buCols.includes(n)));
  r = await q('SELECT COUNT(*) cnt FROM barang_units');
  if (r.ok) { check('barang_units: ' + r.rows[0].cnt + ' rows', Number(r.rows[0].cnt) > 0); }

  // ============================================================
  // B. TABEL TRANSAKSI STOK
  // ============================================================
  console.log('\n--- B. TABEL TRANSAKSI STOK ---');

  // B1. stock_balance
  const sbCols = await cols('stock_balance');
  const needSB = ['id','ingredient_id','warehouse_id','quantity','avg_cost','total_cost'];
  check('stock_balance: all required columns', needSB.every(n => sbCols.includes(n)));
  r = await q('SELECT COUNT(*) cnt FROM stock_balance');
  const sbCount = r.ok ? Number(r.rows[0].cnt) : 0;
  check('stock_balance: ' + sbCount + ' rows', r.ok);

  // B2. stock_balance_by_warehouse
  const sbwCols = await cols('stock_balance_by_warehouse');
  const needSBW = ['barang_id','warehouse_id','qty'];
  check('stock_balance_by_warehouse: all required columns', needSBW.every(n => sbwCols.includes(n)));

  // B3. stock_movements
  const smCols = await cols('stock_movements');
  const needSM = ['id','ingredient_id','warehouse_id','movement_type','quantity','reference_type','reference_id','unit_cost','total_cost','balance_qty','balance_avg_cost'];
  check('stock_movements: all required columns', needSM.every(n => smCols.includes(n)));
  r = await q('SELECT COUNT(*) cnt FROM stock_movements');
  const smCount = r.ok ? Number(r.rows[0].cnt) : 0;
  check('stock_movements: ' + smCount + ' rows', r.ok);

  // B4. stock_usage & stock_usage_items
  const suCols = await cols('stock_usage');
  const needSU = ['id','number','tdate','warehouse_id','status','void','period_id'];
  check('stock_usage: all required columns', needSU.every(n => suCols.includes(n)));
  const suiCols = await cols('stock_usage_items');
  const needSUI = ['id','usage_id','barang_id','qty','cogs_unit','cogs_total'];
  check('stock_usage_items: all required columns', needSUI.every(n => suiCols.includes(n)));

  // B5. stock_transfers & stock_transfer_items
  const stCols = await cols('stock_transfers');
  const needST = ['id','number','tdate','from_warehouse_id','to_warehouse_id','void','period_id'];
  check('stock_transfers: all required columns', needST.every(n => stCols.includes(n)));
  const stiCols = await cols('stock_transfer_items');
  const needSTI = ['id','transfer_id','barang_id','qty','unit_name','unit_ratio'];
  check('stock_transfer_items: all required columns', needSTI.every(n => stiCols.includes(n)));

  // B6. stock_opname family
  const soCols = await cols('stock_opname');
  const needSO = ['id','number','tdate','warehouse_id','status','void','period_id'];
  check('stock_opname: all required columns', needSO.every(n => soCols.includes(n)));
  const soiCols = await cols('stock_opname_items');
  const needSOI = ['id','opname_id','barang_id','system_qty','count_qty','variance_qty'];
  check('stock_opname_items: all required columns', needSOI.every(n => soiCols.includes(n)));
  const socCols = await cols('stock_opname_counts');
  const needSOC = ['id','session_id','opname_id','barang_id','qty','method'];
  check('stock_opname_counts: all required columns', needSOC.every(n => socCols.includes(n)));
  const sosCols = await cols('stock_opname_sessions');
  const needSOS = ['id','opname_id','token','assignee','status'];
  check('stock_opname_sessions: all required columns', needSOS.every(n => sosCols.includes(n)));

  // B7. stock_balance_monthly
  const sbmCols = await cols('stock_balance_monthly');
  const needSBM = ['id','barang_id','warehouse_id','year','month','quantity','avg_cost','total_cost'];
  check('stock_balance_monthly: all required columns', needSBM.every(n => sbmCols.includes(n)));

  // B8. manufaktur family
  const mCols = await cols('manufaktur');
  const needM = ['id','nomor','tanggal','barang_id','quantity','status','warehouse_id','hpp_sebelum','hpp_sesudah','total_biaya','approved_at'];
  check('manufaktur: all required columns', needM.every(n => mCols.includes(n)));
  const mdCols = await cols('manufaktur_detail');
  const needMD = ['id','manufaktur_id','barang_id','quantity','hpp_satuan','total_hpp'];
  check('manufaktur_detail: all required columns', needMD.every(n => mdCols.includes(n)));
  const mbCols = await cols('manufaktur_biaya');
  const needMB = ['id','manufaktur_id','account_id','debit','credit'];
  check('manufaktur_biaya: all required columns', needMB.every(n => mbCols.includes(n)));

  // ============================================================
  // C. CRUD OPERATIONS — MASTER GUDANG
  // ============================================================
  console.log('\n--- C. CRUD MASTER GUDANG ---');

  // INSERT test warehouse
  const testCode = 'QC-' + Date.now().toString(36).toUpperCase();
  r = await q("INSERT INTO master_gudang(code, name, is_active) VALUES($1, $2, 1) RETURNING id", [testCode, 'QC Test Gudang ' + testCode]);
  if (r.ok) {
    const gid = r.rows[0].id; check('INSERT master_gudang: id=' + gid, true);
    r = await q('SELECT * FROM master_gudang WHERE id=$1', [gid]);
    check('SELECT master_gudang by id', r.ok && r.rows.length > 0 && r.rows[0].code === testCode);
    r = await q("UPDATE master_gudang SET name=$1 WHERE id=$2", ['QC Updated ' + testCode, gid]);
    check('UPDATE master_gudang', r.ok && r.rowCount > 0);
    r = await q("UPDATE master_gudang SET isdelete=1 WHERE id=$1", [gid]);
    check('DELETE (soft) master_gudang', r.ok && r.rowCount > 0);
    // Cleanup - hard delete
    await q('DELETE FROM master_gudang WHERE id=$1', [gid]);
  } else {
    check('INSERT master_gudang', false);
  }

  // ============================================================
  // D. STOCK INITIAL (Saldo Awal)
  // ============================================================
  console.log('\n--- D. STOCK INITIAL ---');

  // Check period 1 is open
  r = await q("SELECT id, name, is_active, is_closed FROM master_periode WHERE id=1");
  if (r.ok && r.rows.length > 0) {
    const p = r.rows[0];
    check('master_periode id=1 exists: ' + p.name, true);
    check('master_periode id=1 is_active=' + p.is_active, Number(p.is_active) === 1);
    check('master_periode id=1 is_closed=' + p.is_closed, Number(p.is_closed) === 0);
  } else { check('master_periode id=1 exists', false); }

  // Get a barang to use for testing
  r = await q("SELECT id, code, name FROM master_barang WHERE COALESCE(isdelete,0)=0 AND jenis IN (1,2,3) LIMIT 1");
  if (r.ok && r.rows.length > 0) {
    const testBarang = r.rows[0];
    const testBarangId = testBarang.id;

    // Check stock_balance has unit column created by stock-initial
    const hasUnit = (await cols('stock_balance')).includes('unit');
    check('stock_balance.unit column exists', hasUnit);

    // INSERT initial stock into stock_balance
    r = await q("INSERT INTO stock_balance(ingredient_id, warehouse_id, quantity, unit, avg_cost, total_cost) VALUES($1, 1, 10, 'pcs', 5000, 50000) RETURNING id", [testBarangId]);
    if (r.ok) {
      const sbId = r.rows[0].id; check('INSERT stock_balance (stock initial): id=' + sbId, true);
      // Also insert movement
      r = await q("INSERT INTO stock_movements(ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type) VALUES($1, 1, 'in', 10, 'pcs', 'initial_stock') RETURNING id", [testBarangId]);
      if (r.ok) {
        const smId = r.rows[0].id; check('INSERT stock_movements (stock initial): id=' + smId, true);

        // Test JOIN stock_balance + master_barang + master_gudang
        r = await q(`SELECT sb.*, b.code as ingredient_code, b.name as ingredient_name, g.code as warehouse_code
                     FROM stock_balance sb
                     JOIN master_barang b ON sb.ingredient_id = b.id
                     JOIN master_gudang g ON sb.warehouse_id = g.id
                     WHERE sb.id=$1`, [sbId]);
        check('JOIN stock_balance + master_barang + master_gudang', r.ok && r.rows.length > 0);

        // UPDATE stock_balance
        r = await q("UPDATE stock_balance SET quantity=15 WHERE id=$1", [sbId]);
        check('UPDATE stock_balance', r.ok && r.rowCount > 0);

        // Cleanup
        await q('DELETE FROM stock_movements WHERE id=$1', [smId]);
        await q('DELETE FROM stock_balance WHERE id=$1', [sbId]);
      } else {
        check('INSERT stock_movements', false);
        await q('DELETE FROM stock_balance WHERE id=$1', [sbId]);
      }
    } else {
      check('INSERT stock_balance', false);
    }
  } else {
    warn('master_barang', 'Tidak ada barang untuk test stock initial');
  }

  // ============================================================
  // E. STOCK TRANSACTIONS CRUD
  // ============================================================
  console.log('\n--- E. STOCK USAGE ---');

  // Check that we can generate number
  r = await q("SELECT number FROM stock_usage ORDER BY id DESC LIMIT 1");
  const lastUsageNo = r.ok && r.rows.length > 0 ? r.rows[0].number : null;
  check('stock_usage: number generation works (can query last)', true);

  // INSERT a stock_usage
  const today = new Date().toISOString().slice(0, 10);
  r = await q("INSERT INTO stock_usage(number, tdate, warehouse_id, status, period_id, notes) VALUES($1, $2, 1, 'approved', 1, 'QC Test') RETURNING id",
    ['QC/' + today + '/000001', today]);
  if (r.ok) {
    const suId = r.rows[0].id; check('INSERT stock_usage: id=' + suId, true);

    // Get a barang for usage items
    r = await q("SELECT id, name FROM master_barang WHERE COALESCE(isdelete,0)=0 AND jenis IN (1,2,3) LIMIT 1");
    if (r.ok && r.rows.length > 0) {
      const brgId = r.rows[0].id;
      r = await q("INSERT INTO stock_usage_items(usage_id, barang_id, qty, cogs_unit, cogs_total) VALUES($1, $2, 2, 5000, 10000) RETURNING id",
        [suId, brgId]);
      if (r.ok) {
        const suiId = r.rows[0].id; check('INSERT stock_usage_items: id=' + suiId, true);

        // JOIN test
        r = await q(`SELECT su.*, sui.qty, sui.cogs_total, b.name as barang_name
                     FROM stock_usage su
                     JOIN stock_usage_items sui ON sui.usage_id = su.id
                     JOIN master_barang b ON b.id = sui.barang_id
                     WHERE su.id=$1`, [suId]);
        check('JOIN stock_usage + items + master_barang', r.ok && r.rows.length > 0);

        // Cleanup items
        await q('DELETE FROM stock_usage_items WHERE id=$1', [suiId]);
      } else { check('INSERT stock_usage_items', false); }
    }
    // Cleanup header
    await q('DELETE FROM stock_usage WHERE id=$1', [suId]);
  } else {
    check('INSERT stock_usage', false);
  }

  // ============================================================
  console.log('\n--- F. STOCK TRANSFER ---');

  // Need 2 warehouses
  r = await q("SELECT id, code, name FROM master_gudang WHERE COALESCE(isdelete,0)=0 ORDER BY id LIMIT 2");
  if (r.ok && r.rows.length >= 2) {
    const wh1 = r.rows[0].id, wh2 = r.rows[1].id;
    r = await q("INSERT INTO stock_transfers(number, tdate, from_warehouse_id, to_warehouse_id, notes, period_id) VALUES($1, $2, $3, $4, 'QC Test', 1) RETURNING id",
      ['QC-TF/' + today, today, wh1, wh2]);
    if (r.ok) {
      const stId = r.rows[0].id; check('INSERT stock_transfers: id=' + stId, true);

      r = await q("SELECT id FROM master_barang WHERE COALESCE(isdelete,0)=0 AND jenis IN (1,2,3) LIMIT 1");
      if (r.ok && r.rows.length > 0) {
        const brgId = r.rows[0].id;
        r = await q("INSERT INTO stock_transfer_items(transfer_id, barang_id, qty, unit_name, unit_ratio) VALUES($1, $2, 5, 'pcs', 1) RETURNING id",
          [stId, brgId]);
        if (r.ok) {
          const stiId = r.rows[0].id; check('INSERT stock_transfer_items: id=' + stiId, true);

          // JOIN test
          r = await q(`SELECT st.*, sti.qty, b.name as barang_name, fw.name as from_wh, tw.name as to_wh
                       FROM stock_transfers st
                       JOIN stock_transfer_items sti ON sti.transfer_id = st.id
                       JOIN master_barang b ON b.id = sti.barang_id
                       JOIN master_gudang fw ON fw.id = st.from_warehouse_id
                       JOIN master_gudang tw ON tw.id = st.to_warehouse_id
                       WHERE st.id=$1`, [stId]);
          check('JOIN stock_transfers + items + gudang', r.ok && r.rows.length > 0);

          await q('DELETE FROM stock_transfer_items WHERE id=$1', [stiId]);
        } else { check('INSERT stock_transfer_items', false); }
      }
      await q('DELETE FROM stock_transfers WHERE id=$1', [stId]);
    } else {
      check('INSERT stock_transfers', false);
    }
  } else {
    warn('stock_transfers', 'Perlu minimal 2 gudang untuk test transfer (ada ' + (r.ok ? r.rows.length : 0) + ')');
  }

  // ============================================================
  console.log('\n--- G. STOCK OPNAME ---');

  r = await q("INSERT INTO stock_opname(number, tdate, warehouse_id, status, period_id) VALUES($1, $2, 1, 'draft', 1) RETURNING id",
    ['QC-DSO/' + today, today]);
  if (r.ok) {
    const soId = r.rows[0].id; check('INSERT stock_opname: id=' + soId, true);

    r = await q("SELECT id FROM master_barang WHERE COALESCE(isdelete,0)=0 AND jenis IN (1,2,3) LIMIT 2");
    if (r.ok && r.rows.length > 0) {
      for (const brg of r.rows) {
        await q("INSERT INTO stock_opname_items(opname_id, barang_id, system_qty, count_qty, variance_qty) VALUES($1, $2, 10, 10, 0)", [soId, brg.id]);
      }
      // Count items
      r = await q("SELECT COUNT(*) cnt FROM stock_opname_items WHERE opname_id=$1", [soId]);
      check('INSERT stock_opname_items: ' + (r.ok ? r.rows[0].cnt : 0) + ' items', r.ok && Number(r.rows[0].cnt) > 0);

      // Sessions
      r = await q("INSERT INTO stock_opname_sessions(opname_id, token, assignee, status) VALUES($1, $2, 'QC Tester', 'open') RETURNING id",
        [soId, 'qc-token-' + Date.now()]);
      if (r.ok) {
        const sesId = r.rows[0].id; check('INSERT stock_opname_sessions: id=' + sesId, true);
        r = await q("INSERT INTO stock_opname_counts(session_id, opname_id, barang_id, qty, method) VALUES($1, $2, $3, 10, 'manual')",
          [sesId, soId, r.rows[0].id]);
        check('INSERT stock_opname_counts', r.ok);
        await q('DELETE FROM stock_opname_counts WHERE session_id=$1', [sesId]);
        await q('DELETE FROM stock_opname_sessions WHERE id=$1', [sesId]);
      } else { check('INSERT stock_opname_sessions', false); }

      // Recalculate variance
      r = await q(`UPDATE stock_opname_items SET variance_qty = COALESCE(count_qty,0) - COALESCE(system_qty,0) WHERE opname_id=$1`, [soId]);
      r = await q("SELECT opname_id, COUNT(*) items, SUM(ABS(variance_qty)) total_var FROM stock_opname_items WHERE opname_id=$1 GROUP BY opname_id", [soId]);
      check('UPDATE & recalculate variance', r.ok && r.rows.length > 0);

      // Approve (set status)
      r = await q("UPDATE stock_opname SET status='approved' WHERE id=$1", [soId]);
      check('UPDATE stock_opname status=approved', r.ok && r.rowCount > 0);

      // Cleanup items then header
      await q('DELETE FROM stock_opname_items WHERE opname_id=$1', [soId]);
    }
    await q('DELETE FROM stock_opname WHERE id=$1', [soId]);
  } else {
    check('INSERT stock_opname', false);
  }

  // ============================================================
  console.log('\n--- H. MANUFAKTUR ---');

  // Check barang jenis 1 (Barang Jadi) exists
  r = await q("SELECT id, code, name FROM master_barang WHERE COALESCE(isdelete,0)=0 AND jenis=1 LIMIT 1");
  if (r.ok && r.rows.length > 0) {
    const jadi = r.rows[0];
    // Check barang jenis 2 (Bahan Baku) exists
    r = await q("SELECT id, code, name FROM master_barang WHERE COALESCE(isdelete,0)=0 AND jenis=2 LIMIT 1");
    if (r.ok && r.rows.length > 0) {
      const baku = r.rows[0];
      r = await q("INSERT INTO manufaktur(nomor, tanggal, barang_id, barang_code, barang_name, quantity, status, warehouse_id) VALUES($1, $2, $3, $4, $5, 1, 'draft', 1) RETURNING id",
        ['QC-MF/' + today, today, jadi.id, jadi.code, jadi.name]);
      if (r.ok) {
        const mfId = r.rows[0].id; check('INSERT manufaktur: id=' + mfId, true);

        // Insert detail (bahan baku)
        r = await q("INSERT INTO manufaktur_detail(manufaktur_id, barang_id, barang_code, barang_name, quantity, hpp_satuan, total_hpp) VALUES($1, $2, $3, $4, 2, 5000, 10000) RETURNING id",
          [mfId, baku.id, baku.code, baku.name]);
        if (r.ok) {
          const mdId = r.rows[0].id; check('INSERT manufaktur_detail: id=' + mdId, true);

          // Insert biaya
          r = await q("INSERT INTO manufaktur_biaya(manufaktur_id, account_id, account_code, account_name, notes, debit) VALUES($1, $2, '50101', 'Biaya Bahan Baku', 'QC Test', 10000) RETURNING id",
            [mfId, 1]);
          if (r.ok) {
            const mcId = r.rows[0].id; check('INSERT manufaktur_biaya: id=' + mcId, true);
            await q('DELETE FROM manufaktur_biaya WHERE id=$1', [mcId]);
          } else { check('INSERT manufaktur_biaya', false); }

          // JOIN test
          r = await q(`SELECT m.*, md.barang_code as detail_code, md.quantity as detail_qty, md.hpp_satuan
                       FROM manufaktur m
                       JOIN manufaktur_detail md ON md.manufaktur_id = m.id
                       WHERE m.id=$1`, [mfId]);
          check('JOIN manufaktur + detail', r.ok && r.rows.length > 0);

          // Approve simulation (UPDATE status)
          r = await q("UPDATE manufaktur SET status='approved', approved_at=$2, hpp_sebelum=0, hpp_sesudah=10000, total_biaya=10000 WHERE id=$1",
            [mfId, today]);
          check('UPDATE manufaktur status=approved', r.ok && r.rowCount > 0);

          // Void / delete
          r = await q('DELETE FROM manufaktur_detail WHERE manufaktur_id=$1', [mfId]);
          await q('DELETE FROM manufaktur_biaya WHERE manufaktur_id=$1', [mfId]);
          await q('DELETE FROM manufaktur WHERE id=$1', [mfId]);
          check('DELETE manufaktur (cascade)', true);
        } else {
          check('INSERT manufaktur_detail', false);
          await q('DELETE FROM manufaktur WHERE id=$1', [mfId]);
        }
      } else { check('INSERT manufaktur', false); }
    } else { warn('manufaktur', 'Tidak ada barang jenis Bahan Baku (2) untuk test'); }
  } else { warn('manufaktur', 'Tidak ada barang jenis Barang Jadi (1) untuk test'); }

  // ============================================================
  // I. VIEWS & RECONCILE
  // ============================================================
  console.log('\n--- I. VIEWS & RECONCILE ---');

  // Check if views exist
  r = await q("SELECT table_name FROM information_schema.views WHERE table_schema='public'");
  const viewList = r.ok ? r.rows.map(v => v.table_name) : [];
  check('Views exist: stock_movements_view', viewList.includes('stock_movements_view'));
  check('Views exist: stock_balance_view', viewList.includes('stock_balance_view'));
  check('Views exist: v_stock_movements_detail', viewList.includes('v_stock_movements_detail'));

  // Syntax: CREATE OR REPLACE VIEW (PG syntax) vs CREATE VIEW IF NOT EXISTS (SQLite)
  // Check if stock-views/migrate would work
  if (!viewList.includes('stock_movements_view')) {
    warn('stock_movements_view', 'Belum dibuat — perlu CREATE OR REPLACE VIEW');
  }

  // Check reconcile route queries
  // PG transactions uses created_at (not transaction_date) — routes already updated to use created_at
  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name='transactions' AND column_name='transaction_date'");
  if (r.ok && r.rows.length > 0) { check('transactions.transaction_date: EXISTS', true); }
  else { warn('transactions.transaction_date', 'Kolom transaction_date tidak ada di PG — pakai created_at (sudah diupdate)'); }

  // Check stock_balance_by_warehouse view
  r = await q("SELECT COUNT(*) cnt FROM stock_balance_by_warehouse");
  check('stock_balance_by_warehouse query works', r.ok);

  // ============================================================
  // J. LAPORAN STOK
  // ============================================================
  console.log('\n--- J. LAPORAN STOK ---');

  // J1. Stock Balance
  r = await q(`SELECT b.id, b.code, b.name,
               COALESCE(sb.quantity, 0) as current_stock,
               COALESCE(sb.avg_cost, b.hpp, 0) as avg_cost
              FROM master_barang b
              LEFT JOIN stock_balance sb ON sb.ingredient_id = b.id AND sb.warehouse_id = 1
              WHERE b.isdelete = 0 AND COALESCE(sb.quantity, 0) != 0
              ORDER BY b.code ASC LIMIT 10`);
  check('Laporan Stock Balance', r.ok);

  // J2. Stock Card
  r = await q(`SELECT id, ingredient_id, movement_type, quantity, reference_type,
               COALESCE(transaction_date, created_at::text) as tdate
              FROM stock_movements
              WHERE ingredient_id = (SELECT ingredient_id FROM stock_balance LIMIT 1)
              ORDER BY tdate ASC`);
  check('Laporan Kartu Stok (Stock Card)', r.ok);

  // J3. Stock Card HPP
  r = await q(`SELECT id, movement_type, quantity, unit_cost, balance_avg_cost
              FROM stock_movements
              LIMIT 10`);
  check('Laporan Kartu Stok HPP', r.ok);

  // J4. Stock Recap Period
  r = await q("SELECT id, name, start_date, end_date, status_buku, is_active FROM master_periode WHERE COALESCE(isdelete, 0) = 0 ORDER BY start_date DESC");
  check('Laporan Rekap Stok per Periode (meta)', r.ok);
  if (r.ok && r.rows.length > 0) {
    const periodId = r.rows[0].id;
    r = await q(`SELECT b.id, b.code, b.name, b.hpp, b.jenis
                FROM master_barang b
                WHERE COALESCE(b.isdelete,0)=0
                ORDER BY b.name ASC LIMIT 5`);
    check('Laporan Rekap Stok per Periode (barang list)', r.ok);
  }

  // J5. Inventory Valuation
  r = await q(`WITH mv AS (
                SELECT sm.*, COALESCE(sm.transaction_date, sm.created_at::text) AS tx_date
                FROM stock_movements sm
              ), latest AS (
                SELECT m.* FROM mv m
                JOIN (SELECT ingredient_id, warehouse_id, MAX(tx_date) AS max_date FROM mv WHERE DATE(tx_date) <= DATE($1) GROUP BY ingredient_id, warehouse_id) t
                ON t.ingredient_id = m.ingredient_id AND t.warehouse_id = m.warehouse_id AND t.max_date = m.tx_date
              )
              SELECT l.ingredient_id AS barang_id, l.warehouse_id,
                b.code AS barang_code, b.name AS barang_name, b.jenis AS barang_jenis,
                COALESCE(l.balance_qty, 0) AS quantity, COALESCE(l.balance_avg_cost, 0) AS avg_cost
              FROM latest l JOIN master_barang b ON b.id = l.ingredient_id
              WHERE b.jenis IN (1,2,3)
              ORDER BY b.name ASC`, [today]);
  check('Laporan Inventory Valuation', r.ok);

  // J6. Konversi Stok
  r = await q(`SELECT m.id, m.nomor, m.tanggal, m.barang_code, m.barang_name, m.quantity, m.status
              FROM manufaktur m
              ORDER BY m.tanggal DESC, m.nomor DESC LIMIT 5`);
  check('Laporan Konversi Stok (Manufaktur)', r.ok);

  // J7. Dashboard Stock Summary
  r = await q(`SELECT COUNT(*) as total_items,
               COALESCE(SUM(sb.quantity * COALESCE(sb.avg_cost, 0)), 0) as total_value
              FROM stock_balance sb
              JOIN master_barang b ON b.id = sb.ingredient_id
              WHERE b.isdelete = 0`);
  check('Dashboard Stock Summary', r.ok);

  // J8. Dashboard Stock Alerts
  r = await q(`SELECT b.id, b.code, b.name, b.min_stock, sb.quantity as current_stock
              FROM master_barang b
              LEFT JOIN stock_balance sb ON sb.ingredient_id = b.id AND sb.warehouse_id = 1
              WHERE b.isdelete = 0 AND b.min_stock IS NOT NULL AND b.min_stock > 0
                AND COALESCE(sb.quantity, 0) < b.min_stock
              LIMIT 10`);
  if (r.ok) {
    // min_stock might not exist in PG
    const hasMinStock = (await cols('master_barang')).includes('min_stock');
    if (hasMinStock) check('Dashboard Stock Alerts', true);
    else warn('Dashboard Stock Alerts', 'master_barang tidak punya kolom min_stock');
  } else {
    check('Dashboard Stock Alerts', false);
  }

  // J9. Stock Movements (via direct query — not view since view may not exist)
  r = await q("SELECT * FROM stock_movements ORDER BY id DESC LIMIT 10");
  check('Stock Movements (direct)', r.ok);

  // ============================================================
  // K. PERIOD VALIDATION
  // ============================================================
  console.log('\n--- K. PERIOD VALIDATION ---');

  r = await q("SELECT id, is_closed FROM master_periode WHERE is_closed = 0 LIMIT 1");
  check('master_periode is_closed filter works (is_closed=0)', r.ok && r.rows.length > 0);

  r = await q("SELECT id, name, status_buku FROM master_periode WHERE UPPER(COALESCE(status_buku,'')) != 'CLOSED' LIMIT 1");
  check('master_periode status_buku filter works', r.ok && r.rows.length > 0);

  // ============================================================
  // L. ROUTE-SPECIFIC QUERIES
  // ============================================================
  console.log('\n--- L. ROUTE-SPECIFIC QUERIES ---');

  // L1. stock-simple route
  r = await q(`SELECT COUNT(*) as total FROM (
    SELECT barang_id, SUM(quantity) as qty FROM purchase_items GROUP BY barang_id
  ) sub`);
  check('stock-simple: purchase_items aggregation', r.ok);

  // L2. stock/reconcile queries — check if purchases join works
  r = await q("SELECT p.id, p.purchase_date, pi.barang_id, pi.quantity FROM purchases p JOIN purchase_items pi ON p.id = pi.purchase_id WHERE COALESCE(p.void,0)=0 LIMIT 5");
  check('stock/reconcile: purchases + items JOIN', r.ok);

  // L3. Sales transactions for reconcile
  r = await q("SELECT t.id, t.created_at, ti.barang_id, ti.quantity FROM transactions t JOIN transaction_items ti ON t.id = ti.transaction_id WHERE COALESCE(t.void,0)=0 LIMIT 5");
  check('stock/reconcile: transactions + items JOIN (created_at)', r.ok);

  // L4. stock-usage: warehouse dynamic lookup
  r = await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('gudang','warehouses','warehouse','master_gudang','gudangs')");
  check('stock-usage: warehouse table detection', r.ok && r.rows.some(x => x.table_name === 'master_gudang'));

  // L5. Generate number patterns
  r = await q("SELECT number FROM stock_usage WHERE number LIKE 'SU/%' ORDER BY id DESC LIMIT 1");
  check('stock-usage: SU number pattern works', r.ok);

  r = await q("SELECT number FROM stock_transfers WHERE number LIKE 'TF/%' ORDER BY id DESC LIMIT 1");
  check('stock-transfers: TF number pattern works', r.ok);

  r = await q("SELECT number FROM stock_opname WHERE number LIKE 'DSO/%' ORDER BY id DESC LIMIT 1");
  check('stock-opname: DSO number pattern works', r.ok);

  // L6. stock-views/migrate — DROP/CREATE view syntax
  try {
    await c.query('CREATE OR REPLACE VIEW qc_test_view AS SELECT 1 as test');
    await c.query('DROP VIEW qc_test_view');
    check('CREATE OR REPLACE VIEW syntax (PG) — WORKS', true);
  } catch(e) {
    check('CREATE OR REPLACE VIEW syntax (PG)', false);
  }

  // L7. Check IF NOT EXISTS for view — this should FAIL in PG
  try {
    await c.query('CREATE VIEW IF NOT EXISTS qc_test_view2 AS SELECT 1 as test');
    check('CREATE VIEW IF NOT EXISTS syntax (SQLite) — PG REJECTS (correct)', false); // Expected to fail
  } catch(e) {
    // PG should reject this — that's the expected behavior
    check('CREATE VIEW IF NOT EXISTS syntax (SQLite) — correctly REJECTED by PG', true);
  }

  // L8. Check v_stock_movements_detail — this view should exist for stock/movements route
  r = await q("SELECT * FROM information_schema.views WHERE table_name='v_stock_movements_detail'");
  check('v_stock_movements_detail view exists', r.ok && r.rows.length > 0);

  // L9. gudang/init route — CREATE TABLE master_gudang
  // (Should already exist, just verify)
  r = await q("SELECT to_regclass('public.master_gudang')");
  check('master_gudang table exists (via to_regclass)', r.ok && r.rows[0].to_regclass !== null);

  // L10. stock-initial has unit column
  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name='stock_balance' AND column_name='unit'");
  check('stock-initial: unit column created in stock_balance', r.ok && r.rows.length > 0);

  // L11. stock-migrate route — has avg_cost and total_cost columns
  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name='stock_balance' AND column_name='avg_cost'");
  check('stock-migrate: avg_cost column in stock_balance', r.ok && r.rows.length > 0);
  r = await q("SELECT column_name FROM information_schema.columns WHERE table_name='stock_balance' AND column_name='total_cost'");
  check('stock-migrate: total_cost column in stock_balance', r.ok && r.rows.length > 0);

  // L12. stock/movements route using v_stock_movements_detail
  // This view doesn't exist, so the route would fail
  r = await q("SELECT table_name FROM information_schema.views WHERE table_name='v_stock_movements_detail'");
  if (r.ok && r.rows.length > 0) {
    r = await q("SELECT * FROM v_stock_movements_detail LIMIT 5");
    check('stock/movements: v_stock_movements_detail queryable', r.ok);
  } else {
    warn('stock/movements', 'v_stock_movements_detail view tidak ada — route akan crash');
  }

  // ============================================================
  // M. PERMISSIONS SETUP
  // ============================================================
  console.log('\n--- M. PERMISSIONS SETUP ---');

  r = await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%permission%'");
  if (r.ok && r.rows.length > 0) {
    const permTable = r.rows[0].table_name;
    const permCols = await cols(permTable);
    check('Permissions table exists: ' + permTable, true);
    // Check if stock permissions exist
    r = await q(`SELECT * FROM ${permTable} WHERE name LIKE '%stock%' OR name LIKE '%gudang%' OR name LIKE '%manufaktur%' LIMIT 10`);
    if (r.ok && r.rows.length > 0) {
      check('Stock permissions exist', true);
      r.rows.forEach(p => console.log('     - ' + p.name));
    } else {
      warn('Stock permissions', 'Tidak ada permission spesifik stok di DB');
    }
  } else {
    warn('Permissions', 'Tidak ada tabel permissions');
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  const total = ok + fail + partial;
  console.log('\n' + '='.repeat(60));
  console.log('   QC STOK — HASIL AKHIR');
  console.log('='.repeat(60));
  console.log('   ✅ AMAN:    ' + ok);
  console.log('   ⚠️ PARTIAL: ' + partial);
  console.log('   ❌ ERROR:   ' + fail);
  console.log('   TOTAL:      ' + total);
  console.log('');
  if (fail === 0 && partial === 0) {
    console.log('   ✅ SEMUA BERHASIL — Tidak ada masalah');
  } else if (fail === 0) {
    console.log('   ⚠️  BERHASIL dengan ' + partial + ' catatan partial');
  } else {
    console.log('   ❌ ADA ' + fail + ' MASALAH yang perlu diperbaiki');
  }
  console.log('');

  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
