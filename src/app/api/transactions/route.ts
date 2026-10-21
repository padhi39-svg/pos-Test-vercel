import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { rawAll, rawGet, rawRun } from "@/db/raw";
import { getPeriodByDate } from "@/lib/period";
import { getUserId } from "@/lib/audit";
import { INTERNAL_SERVICE_TOKEN } from "@/lib/internalAuth";
import { DEFAULT_PPN_PERCENT } from "@/lib/constants";
import { checkStockAvailability, getStockAllowNegative } from "@/lib/stockValidation";
import { hasPermission } from "@/lib/permissions";
import {
  calculateTieredDiscount,
  allocateHeaderDiscountProportional,
  calculatePpn,
  roundRp,
  TieredDiscountResult,
} from "@/lib/discountUtils";
import {
  generateSaleEntries,
  generateEntriesForSingleSource,
  saveJournalEntriesForSource,
} from "@/lib/journalHelpers";
import { transactionItems } from "@/db/schema";
import { inArray } from "drizzle-orm";

function toPg(sql: string, params?: any[]): { text: string; values: any[] } {
  if (!params || params.length === 0) return { text: sql, values: [] };
  let idx = 0;
  const text = sql.replace(/\?/g, () => `$${++idx}`);
  return { text, values: params };
}

async function recordStockMovement(
  q: (sql: string, params?: any[]) => Promise<any>,
  params: {
    ingredientId: number;
    warehouseId: number;
    movementType: string;
    movementQty: number;
    unit: string | null;
    referenceType: string;
    referenceId: number;
    periodId: number;
    transactionDate: string;
    notes: string;
    isInbound: boolean;
    isEligible: boolean;
  },
): Promise<void> {
  const { text, values } = toPg(
    `
    WITH cur AS (
      SELECT COALESCE(quantity,0)::numeric AS qty, COALESCE(avg_cost,0)::numeric AS avg, COALESCE(total_cost,0)::numeric AS total
      FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2
      UNION ALL SELECT 0,0,0 WHERE NOT EXISTS (SELECT 1 FROM stock_balance WHERE ingredient_id = $1 AND warehouse_id = $2)
      LIMIT 1
    ),
    delta AS (
      SELECT
        CASE WHEN $11::int = 1 THEN $4::numeric ELSE -($4::numeric) END AS d_qty,
        CASE WHEN $12::int = 1 THEN (CASE WHEN $11::int = 1 THEN cur.avg * $4::numeric ELSE -(cur.avg * $4::numeric) END) ELSE 0::numeric END AS d_cost,
        CASE WHEN $11::int = 1 THEN cur.qty + $4::numeric ELSE cur.qty - $4::numeric END AS new_qty,
        CASE WHEN $12::int = 1 THEN
          CASE WHEN $11::int = 1 THEN cur.total + (cur.avg * $4::numeric) ELSE cur.total - (cur.avg * $4::numeric) END
        ELSE cur.total END AS new_total,
        CASE WHEN (CASE WHEN $11::int = 1 THEN cur.qty + $4::numeric ELSE cur.qty - $4::numeric END) > 0 THEN
          CASE WHEN $12::int = 1 THEN
            (CASE WHEN $11::int = 1 THEN cur.total + (cur.avg * $4::numeric) ELSE cur.total - (cur.avg * $4::numeric) END) /
            NULLIF(CASE WHEN $11::int = 1 THEN cur.qty + $4::numeric ELSE cur.qty - $4::numeric END, 0)
          ELSE 0::numeric END
        ELSE 0::numeric END AS new_avg
      FROM cur
    ),
    ins AS (
      INSERT INTO stock_movements (ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, transaction_date, notes, unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost)
      SELECT $1, $2, $3, $4::numeric, $5, $6, $7, $8, $9, $10,
        CASE WHEN $12::int = 1 THEN cur.avg ELSE NULL END,
        CASE WHEN $12::int = 1 THEN cur.avg * $4::numeric ELSE NULL END,
        delta.new_qty, delta.new_total, delta.new_avg
      FROM cur, delta
    )
    INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, unit, avg_cost, total_cost, updated_at)
    SELECT $1, $2, delta.new_qty, $5, delta.new_avg, delta.new_total, CURRENT_TIMESTAMP
    FROM delta
    ON CONFLICT (ingredient_id, warehouse_id) DO UPDATE SET
      quantity = EXCLUDED.quantity,
      avg_cost = EXCLUDED.avg_cost,
      total_cost = EXCLUDED.total_cost,
      updated_at = CURRENT_TIMESTAMP
  `,
    [
      params.ingredientId,
      params.warehouseId,
      params.movementType,
      params.movementQty,
      params.unit ?? null,
      params.referenceType,
      params.referenceId,
      params.periodId,
      params.transactionDate,
      params.notes,
      params.isInbound ? 1 : 0,
      params.isEligible ? 1 : 0,
    ],
  );
  await q(text, values);
}

const _periodCache = new Map<string, any>();

async function _cachedGetPeriodByDate(dateISO: string) {
  const d = (dateISO || new Date().toISOString()).slice(0, 10);
  if (_periodCache.has(d)) return _periodCache.get(d) || null;
  const p = await getPeriodByDate(d);
  _periodCache.set(d, p);
  return p;
}

export async function GET(req: NextRequest) {
  try {
    const canViewTransaksi = hasPermission(req as any, "transaksi", "view");
    const canViewSalesList = hasPermission(req as any, "sales_list", "view");
    if (!canViewTransaksi && !canViewSalesList) {
      return NextResponse.json(
        { error: "Forbidden: tidak punya akses melihat transaksi" },
        { status: 403 },
      );
    }
    const db = getDb();
    const pool = (db as any).$client;
    try {
      const url = new URL(req.url);
      const mig = url.searchParams.get("migrate");
      if (mig === "items") {
        const cols = await rawAll<any>(
          "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transaction_items'",
        );
        const names = new Set(cols.map((c) => c.name));
        if (!names.has("discon_total")) {
          await rawRun(
            "ALTER TABLE transaction_items ADD COLUMN discon_total REAL DEFAULT 0",
          );
        }
        const colsAfter = await rawAll<any>(
          "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transaction_items'",
        );
        return NextResponse.json({ ok: true, columns: colsAfter });
      } else if (mig === "tgl_nota") {
        const colsTx = await rawAll<any>(
          "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions'",
        );
        const txNames = new Set(colsTx.map((c) => c.name));
        if (!txNames.has("tgl_nota") && !txNames.has("Tgl_Nota")) {
          await rawRun("ALTER TABLE transactions ADD COLUMN tgl_nota TEXT");
        } else if (txNames.has("Tgl_Nota") && !txNames.has("tgl_nota")) {
          try {
            await rawRun("ALTER TABLE transactions ADD COLUMN tgl_nota TEXT");
          } catch {}
        }
        const namesAfter = new Set(
          (
            await rawAll<any>(
              "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions'",
            )
          ).map((c) => c.name),
        );
        let updates: string[] = [];
        if (namesAfter.has("Tgl_Nota")) {
          await rawRun(
            'UPDATE transactions SET tgl_nota = COALESCE(tgl_nota, "Tgl_Nota"::text)',
          );
          updates.push("from Tgl_Nota");
        }
        if (namesAfter.has("transaction_date")) {
          await rawRun(
            "UPDATE transactions SET tgl_nota = COALESCE(tgl_nota, transaction_date::text)",
          );
          updates.push("from transaction_date");
        }
        await rawRun(
          "UPDATE transactions SET tgl_nota = COALESCE(tgl_nota, substr(created_at,1,10))",
        );
        updates.push("from created_at");
        const finalCols = await rawAll<any>(
          "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions'",
        );
        const sample = await rawAll<any>(
          "SELECT id, tgl_nota FROM transactions ORDER BY id DESC LIMIT 5",
        );
        return NextResponse.json({
          ok: true,
          action: "migrated tgl_nota",
          updates,
          columns: finalCols,
          sample,
        });
      } else if (mig === "unit_price_include") {
        const roundRp = (n: number) => Math.round(Number(n) || 0);
        const rows = await rawAll<any>(
          "SELECT id, quantity, unit_price, total_price FROM transaction_items",
        );
        let updated = 0;
        for (const r of rows) {
          const qty = Math.max(1, Number(r.quantity) || 1);
          const includeUnit = roundRp((Number(r.total_price) || 0) / qty);
          if (Number(r.unit_price) !== includeUnit) {
            await rawRun(
              "UPDATE transaction_items SET unit_price = ? WHERE id = ?",
              [includeUnit, r.id],
            );
            updated++;
          }
        }
        const sample = await rawAll<any>(
          "SELECT id, quantity, unit_price, total_price FROM transaction_items ORDER BY id DESC LIMIT 10",
        );
        return NextResponse.json({
          ok: true,
          action: "migrated unit_price to include",
          updated,
          sample,
        });
      } else if (mig === "fix_header_totals") {
        const roundRp = (n: number) => Math.round(Number(n) || 0);
        const txs = await rawAll<any>("SELECT * FROM transactions");
        const cols = await rawAll<any>(
          "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions'",
        );
        const names = new Set(cols.map((c) => c.name));
        const getNum = (o: any, ...keys: string[]) => {
          for (const k of keys) {
            if (o[k] != null && o[k] !== "") return Number(o[k]) || 0;
          }
          return 0;
        };
        let changed = 0;
        for (const t of txs) {
          const subtotal = getNum(t, "subtotal");
          const discPct = getNum(t, "discount_percent");
          const discAmtRaw = getNum(t, "discount_amount");
          const svcPct = getNum(t, "service_charge_percent");
          const ppnPct = getNum(
            t,
            "ppn_percent",
            "tax_rate_percent",
            "tax_percent",
          );
          const headerDiscount =
            discAmtRaw > 0
              ? roundRp(discAmtRaw)
              : roundRp((subtotal * Math.max(0, discPct)) / 100);
          const dppAfterDisc = Math.max(0, subtotal - headerDiscount);
          const serviceAmount = roundRp(
            (dppAfterDisc * Math.max(0, svcPct)) / 100,
          );
          const ppnAmount = roundRp((dppAfterDisc * Math.max(0, ppnPct)) / 100);
          const total = dppAfterDisc + serviceAmount + ppnAmount;
          const same =
            roundRp(getNum(t, "total")) === total &&
            roundRp(getNum(t, "ppn_amount", "tax_amount")) === ppnAmount &&
            roundRp(getNum(t, "service_charge_amount")) === serviceAmount;
          if (!same) {
            const vals: any[] = [];
            const setParts: string[] = [];
            if (names.has("subtotal")) {
              setParts.push("subtotal = ?");
              vals.push(subtotal);
            }
            if (names.has("discount_percent")) {
              setParts.push("discount_percent = ?");
              vals.push(discPct);
            }
            if (names.has("discount_amount")) {
              setParts.push("discount_amount = ?");
              vals.push(headerDiscount);
            }
            if (names.has("service_charge_percent")) {
              setParts.push("service_charge_percent = ?");
              vals.push(svcPct);
            }
            if (names.has("service_charge_amount")) {
              setParts.push("service_charge_amount = ?");
              vals.push(serviceAmount);
            }
            if (names.has("ppn_percent")) {
              setParts.push("ppn_percent = ?");
              vals.push(ppnPct);
            }
            if (names.has("ppn_amount") || names.has("tax_amount")) {
              setParts.push(
                names.has("ppn_amount") ? "ppn_amount = ?" : "tax_amount = ?",
              );
              vals.push(ppnAmount);
            }
            if (names.has("total")) {
              setParts.push("total = ?");
              vals.push(total);
            }
            setParts.push("updated_at = CURRENT_TIMESTAMP");
            vals.push(t.id);
            await rawRun(
              `UPDATE transactions SET ${setParts.join(", ")} WHERE id = ?`,
              vals,
            );
            changed++;
          }
        }
        const sample = await rawAll<any>(
          "SELECT id, subtotal, discount_percent, discount_amount, service_charge_percent, service_charge_amount, ppn_percent, ppn_amount, total FROM transactions ORDER BY id DESC LIMIT 5",
        );
        return NextResponse.json({
          ok: true,
          action: "fixed header totals",
          updated: changed,
          sample,
        });
      }
    } catch (e) {
      console.warn("GET migrate=items warning:", e);
    }

    const orderBy =
      "COALESCE(t.transaction_date, t.tgl_nota, t.created_at::date) DESC, t.created_at DESC";
    let startDateIso: string | null = null;
    let endDateIso: string | null = null;
    try {
      const url = new URL(req.url);
      const s = (url.searchParams.get("startDate") || "").trim();
      const e = (url.searchParams.get("endDate") || "").trim();
      const toIso = (v: string): string | null => {
        if (!v) return null;
        const v2 = v.replace(/\s+/g, "");
        const m1 = v2.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/);
        if (m1) {
          const d = m1[1].padStart(2, "0");
          const m = m1[2].padStart(2, "0");
          const y = m1[3];
          return `${y}-${m}-${d}`;
        }
        const m2 = v2.match(/^(\d{4})-([0-1]?\d)-([0-3]?\d)$/);
        if (m2) {
          const y = m2[1];
          const m = m2[2].padStart(2, "0");
          const d = m2[3].padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
        return null;
      };
      startDateIso = toIso(s);
      endDateIso = toIso(e);
    } catch {}

    const dateExpr =
      "COALESCE(t.transaction_date, t.tgl_nota, t.created_at::date)";
    const whereParts: string[] = [];
    const params: any[] = [];
    if (startDateIso) {
      whereParts.push(`${dateExpr} >= ?`);
      params.push(startDateIso);
    }
    if (endDateIso) {
      whereParts.push(`${dateExpr} <= ?`);
      params.push(endDateIso);
    }
    const whereSql =
      whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const sql = `
      SELECT 
        t.*,
        c.name as customer_name,
        c.code as customer_code,
        so.so_number as so_number
      FROM transactions t
      LEFT JOIN master_customer c ON t.customer_id = c.id
      LEFT JOIN sales_order so ON so.id = t.so_id
      ${whereSql}
      ORDER BY ${orderBy}
    `;
    const transactions =
      params.length > 0 ? await rawAll(sql, params) : await rawAll(sql);

    const txIds = transactions.map((t: any) => Number(t.id));

    let paidSalesMap = new Map<number, number>();
    let paidReturnMap = new Map<number, number>();
    try {
      const paidRows1 = await rawAll<any>(
        `
        SELECT COALESCE(ai.sale_id, ai.source_id) AS tx_id, COALESCE(SUM(ai.pay_amount),0) AS paid
        FROM ar_payment_items ai
        JOIN ar_payments ap ON ap.id = ai.payment_id AND ap.status <> 'void'
        WHERE ((ai.sale_id IS NOT NULL AND ai.sale_id > 0) OR (ai.source_type = 'transaction'))
          AND COALESCE(ai.sale_id, ai.source_id) = ANY($1::int[])
        GROUP BY COALESCE(ai.sale_id, ai.source_id)
      `,
        [txIds],
      );
      for (const r of paidRows1) {
        paidSalesMap.set(Number(r.tx_id), Number(r.paid) || 0);
      }
      const paidRows2 = await rawAll<any>(
        `
        SELECT ai.source_id AS tx_id, COALESCE(SUM(ai.pay_amount),0) AS paid
        FROM ar_payment_items ai
        JOIN ar_payments ap ON ap.id = ai.payment_id AND ap.status <> 'void'
        WHERE ai.source_type = 'sales_return'
          AND ai.source_id = ANY($1::int[])
        GROUP BY ai.source_id
      `,
        [txIds],
      );
      for (const r of paidRows2) {
        paidReturnMap.set(Number(r.tx_id), Number(r.paid) || 0);
      }
    } catch {}

    const allItems = await db
      .select()
      .from(transactionItems)
      .where(inArray(transactionItems.transactionId, txIds))
      .orderBy(transactionItems.id);
    const itemsByTx = new Map<number, typeof allItems>();
    for (const it of allItems) {
      const list = itemsByTx.get(it.transactionId) || [];
      list.push(it);
      itemsByTx.set(it.transactionId, list);
    }

    const transactionsWithItems = transactions.map((transaction: any) => {
      const itemsRaw = itemsByTx.get(Number(transaction.id)) || [];
      const items = itemsRaw.map((it: any) => {
        let unit_price = it.unitPrice;
        const qty = Number(it.quantity) || 0;
        const total = Number(it.totalPrice) || 0;
        if ((!unit_price || Number(unit_price) === 0) && qty > 0 && total > 0) {
          unit_price = Math.round((total / qty) * 100) / 100;
        }
        return { ...it, unit_price };
      });
      const roundRp = (n: number) => Math.round(Number(n) || 0);
      const subtotal = roundRp(Number(transaction.subtotal || 0));
      const discountAmount = roundRp(Number(transaction.discount_amount || 0));
      const serviceAmount = roundRp(
        Number(transaction.service_charge_amount || 0),
      );
      const ppnAmount = roundRp(
        Number(transaction.ppn_amount || transaction.tax_amount || 0),
      );
      const total =
        Math.max(0, subtotal - discountAmount) + serviceAmount + ppnAmount;
      const paidAmt =
        Number(transaction.is_return) === 1
          ? paidReturnMap.get(Number(transaction.id)) || 0
          : paidSalesMap.get(Number(transaction.id)) || 0;
      const payment_status =
        Number(transaction.void) === 1
          ? "Void"
          : Number(transaction.transaction_type) <= 2
            ? String(transaction.status) === "void"
              ? "Void"
              : "Lunas"
            : !paidAmt || Number(paidAmt) === 0
              ? "Belum Bayar"
              : Number(paidAmt) + 0.0001 < total
                ? "Belum Lunas"
                : "Lunas";
      return { ...transaction, total, items, is_paid: paidAmt, payment_status };
    });

    return NextResponse.json(transactionsWithItems);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const pool = (db as any).$client;
  const rawTimings: { sql: string; ms: number }[] = [];
  const origPoolQuery = pool.query.bind(pool);
  let rawQueryCount = 0;
  let txClient: any;
  pool.query = ((text: string, values?: any[]) => {
    rawQueryCount++;
    const start = Date.now();
    const p = origPoolQuery(text, values);
    const short = (typeof text === "string" ? text : String(text))
      .replace(/\s+/g, " ")
      .slice(0, 100);
    if (!p || !p.then) {
      rawTimings.push({ sql: short, ms: Date.now() - start });
      return p;
    }
    return p
      .then((r: any) => {
        rawTimings.push({ sql: short, ms: Date.now() - start });
        return r;
      })
      .catch((e: any) => {
        rawTimings.push({ sql: short, ms: Date.now() - start });
        throw e;
      });
  }) as any;
  console.log("[TIMING] POST /api/transactions START");
  try {
    const data = await request.json();
    const tType = Number(data?.transactionType) || 1;
    const isReturn = Number(data?.isReturn) === 1 || data?.isReturn === true;
    const menuByType =
      tType === 1
        ? "pos_resto"
        : tType === 2
          ? "pos_retail"
          : tType === 3
            ? "invoice"
            : "transaksi";
    const allowBypass = process.env.ALLOW_TEST_BYPASS === "1";
    const testBypass =
      allowBypass && (request.headers.get("x-test") || "").toString() === "1";
    const internalService =
      (request.headers.get("x-internal-service") || "").toString() ===
      INTERNAL_SERVICE_TOKEN;
    const userId = internalService ? 0 : getUserId(request);

    const priceIncludeTax = false;
    const taxRatePercent = Number(data.ppnPercent) || DEFAULT_PPN_PERCENT;
    const serviceDefaultPercent = 0;
    const allowNegative = tType === 1 ? true : await getStockAllowNegative(pool);
    const autoManufaktur = false;
    const tanpaStok = false;
    const invoicePrefix = isReturn ? "RJ" : "JL";

    const r = Math.max(0, taxRatePercent) / 100;

    const today = new Date().toISOString().slice(0, 10);
    const canBackdate = testBypass;
    const txDate = (
      (canBackdate ? data.transactionDate || today : today) || today
    ).slice(0, 10);
    const transactionType = Number(data.transactionType) || 1;
    const selectedWarehouseId =
      transactionType === 3 ? Number(data.warehouseId || 1) : 1;
    let period = await _cachedGetPeriodByDate(txDate);

    if (!period && testBypass) {
      try {
        const yearStr = txDate.slice(0, 4);
        const start = `${yearStr}-01-01`;
        const end = `${yearStr}-12-31`;
        await rawRun(`CREATE TABLE IF NOT EXISTS master_periode (
          id SERIAL PRIMARY KEY,
          code TEXT UNIQUE,
          name TEXT,
          start_date TEXT,
          end_date TEXT,
          is_active INTEGER DEFAULT 0,
          is_closed INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
        const code = `PER-${yearStr}`;
        const name = `Periode ${yearStr}`;
        await rawRun(
          "INSERT INTO master_periode (code, name, start_date, end_date, is_active, is_closed) SELECT ?, ?, ?, ?, 1, 0 WHERE NOT EXISTS (SELECT 1 FROM master_periode WHERE code = ?)",
          [code, name, start, end, code],
        );
      } catch {}
      period = await _cachedGetPeriodByDate(txDate);
    }

    if (!period) {
      return NextResponse.json(
        {
          error: `Periode belum ada untuk tanggal ${txDate}.`,
          code: "PERIOD_NOT_FOUND",
        },
        { status: 400 },
      );
    }
    if (Number(period.is_closed) === 1) {
      return NextResponse.json(
        {
          error: `Periode '${period.name}' sudah ditutup.`,
          code: "PERIOD_CLOSED",
        },
        { status: 400 },
      );
    }

    const year = String(txDate).slice(0, 4);
    const seqRow = await rawGet<any>(
      `
      INSERT INTO transaction_sequences (prefix, year, last_number)
      VALUES ($1, $2, 1) ON CONFLICT (prefix, year) DO UPDATE SET last_number = transaction_sequences.last_number + 1
      RETURNING last_number
    `,
      [invoicePrefix, year],
    );
    const seqNum = Number(seqRow?.last_number || 0);
    const transactionNumber = `${invoicePrefix}/${year}/${String(seqNum).padStart(6, "0")}`;

    const method = (data.paymentMethod || "cash") as string;
    const payAmount = Number(data.paymentAmount) || 0;
    const paymentsRaw = Array.isArray(data.payments) ? data.payments : [];

    let headerSubtotal = 0;
    let headerPPN = 0;
    let headerTotal = 0;
    let includeSumAll = 0;
    const itemsInputRaw = Array.isArray(data.items) ? data.items : [];
    let itemsInput = itemsInputRaw.filter(
      (it: any) => Number(it?.barangId) > 0 && Number(it?.quantity) > 0,
    );

    // --- Season Discount Auto-Apply ---
    const customerId = Number(data.customerId) || 0;
    const jenisCustomerId = Number(data.jenisCustomerId) || 0;
    if (customerId > 0 && jenisCustomerId > 0) {
      try {
        const seasonDiscs = await rawAll<any>(
          `SELECT sdi.barang_id, sdi.discount_type, sdi.discount_value
           FROM master_season_discount sd
           JOIN master_season_discount_items sdi ON sdi.season_discount_id = sd.id
           WHERE sd.is_active = 1 AND COALESCE(sd.isdelete, 0) = 0
             AND sd.jenis_customer_id = ?
             AND sd.start_date <= ? AND sd.end_date >= ?`,
          [jenisCustomerId, txDate, txDate],
        );
        if (seasonDiscs.length > 0) {
          const seasonMap: Record<number, { type: string; value: number }> = {};
          const allItemsDiscounts: { type: string; value: number }[] = [];
          for (const sd of seasonDiscs) {
            if (sd.barang_id && !seasonMap[sd.barang_id]) {
              seasonMap[sd.barang_id] = {
                type: sd.discount_type,
                value: Number(sd.discount_value) || 0,
              };
            } else if (!sd.barang_id && sd.discount_value > 0) {
              allItemsDiscounts.push({
                type: sd.discount_type,
                value: Number(sd.discount_value) || 0,
              });
            }
          }
          for (const it of itemsInput) {
            const bId = Number(it.barangId);
            const match = seasonMap[bId];
            if (match && match.value > 0) {
              switch (match.type) {
                case "disc_percent":
                  if (!it.discountPercent) it.discountPercent = match.value;
                  break;
                case "disc1":
                  if (!it.disc1Percent) it.disc1Percent = match.value;
                  break;
                case "disc2":
                  if (!it.disc2Percent) it.disc2Percent = match.value;
                  break;
                case "disc3":
                  if (!it.disc3Percent) it.disc3Percent = match.value;
                  break;
                case "disc_rp":
                  if (!it.discNominal) it.discNominal = match.value;
                  break;
              }
            } else {
              for (const allDisc of allItemsDiscounts) {
                switch (allDisc.type) {
                  case "disc_percent":
                    if (!it.discountPercent) it.discountPercent = allDisc.value;
                    break;
                  case "disc1":
                    if (!it.disc1Percent) it.disc1Percent = allDisc.value;
                    break;
                  case "disc2":
                    if (!it.disc2Percent) it.disc2Percent = allDisc.value;
                    break;
                  case "disc3":
                    if (!it.disc3Percent) it.disc3Percent = allDisc.value;
                    break;
                  case "disc_rp":
                    if (!it.discNominal) it.discNominal = allDisc.value;
                    break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("[SeasonDiscount] Error:", e);
      }
    }
    // --- End Season Discount ---

    const itemTierResults: {
      barangId: number;
      tiered: TieredDiscountResult;
    }[] = [];
    let itemsNetTotal = 0;
    for (const it of itemsInput) {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const discPct = Number(it.discountPercent ?? 0) || 0;
      const disc1Pct = Number(it.disc1Percent ?? 0) || 0;
      const disc2Pct = Number(it.disc2Percent ?? 0) || 0;
      const disc3Pct = Number(it.disc3Percent ?? 0) || 0;
      const discNominal = Number(it.discNominal ?? 0) || 0;
      const tr = calculateTieredDiscount(
        qty,
        price,
        discPct,
        disc1Pct,
        disc2Pct,
        disc3Pct,
        discNominal,
      );
      itemTierResults.push({ barangId: Number(it.barangId), tiered: tr });
      let lineDpp: number;
      if (priceIncludeTax) {
        const ppnRes = calculatePpn(tr.netAmount, taxRatePercent, true);
        lineDpp = ppnRes.dpp;
      } else {
        lineDpp = tr.netAmount;
      }
      itemsNetTotal += lineDpp;
      includeSumAll += priceIncludeTax
        ? tr.netAmount
        : tr.netAmount + roundRp(tr.netAmount * r);
    }

    const headerDiscPct = Number(data.discountPercent) || 0;
    const headerDiscAmt = Number(data.discountAmount) || 0;
    const headerDiscount =
      headerDiscAmt > 0
        ? roundRp(headerDiscAmt)
        : roundRp(itemsNetTotal * (Math.max(0, headerDiscPct) / 100));
    const itemsTotalItemDiscount = itemTierResults.reduce(
      (s, i) => s + i.tiered.totalDiscount,
      0,
    );
    const totalDiscount = roundRp(itemsTotalItemDiscount + headerDiscount);
    const dppAfterHeader = Math.max(0, itemsNetTotal - headerDiscount);
    const headerServicePercent =
      Number(data.serviceChargePercent ?? serviceDefaultPercent) || 0;
    const headerServiceAmount = roundRp(
      dppAfterHeader * (Math.max(0, headerServicePercent) / 100),
    );
    const ppnResult = calculatePpn(dppAfterHeader, taxRatePercent, false);
    headerPPN = ppnResult.ppnAmount;
    headerTotal = ppnResult.grandTotal + headerServiceAmount;
    headerSubtotal = itemsNetTotal;
    const totalAmount = headerTotal;

    let headerPaymentMethod: string = (data.paymentMethod || "cash") as string;
    let headerPaymentAmount: number = Number(data.paymentAmount) || 0;
    let headerChangeAmount: number = Number(data.changeAmount) || 0;
    let headerBankId: number | null =
      data.bankId != null ? Number(data.bankId) : null;
    let headerCardNumber: string | null =
      data.cardNumber != null ? String(data.cardNumber) : null;

    type PaymentClean = {
      method: string;
      amount: number;
      bankId: number | null;
      cardNumber: string | null;
      notes: string | null;
    };
    const paymentsClean: PaymentClean[] = paymentsRaw
      .map((p: any): PaymentClean => {
        const rawMethod = String(p.method || p.paymentMethod || "").trim();
        const lower = rawMethod.toLowerCase();
        let normalized = rawMethod;
        if (lower === "cash" || lower === "tunai") normalized = "cash";
        else if (lower === "transfer") normalized = "transfer";
        else if (
          lower === "kartu debit" ||
          lower === "debit card" ||
          lower === "debit"
        )
          normalized = "Debit Card";
        else if (
          lower === "kartu kredit" ||
          lower === "credit card" ||
          lower === "kredit"
        )
          normalized = "Credit Card";
        const amount = Number(p.amount ?? p.paymentAmount ?? 0) || 0;
        const bankId = p.bankId != null ? Number(p.bankId) : null;
        const cardNumber =
          p.cardNumber != null
            ? String(p.cardNumber)
            : p.card_no != null
              ? String(p.card_no)
              : null;
        const notes = p.notes != null ? String(p.notes) : null;
        return { method: normalized, amount, bankId, cardNumber, notes };
      })
      .filter((p: PaymentClean) => p.method && p.amount > 0);

    if (paymentsClean.length > 0) {
      if (paymentsClean.length > 2) {
        return NextResponse.json(
          { error: "Maksimal hanya boleh 2 cara bayar per transaksi." },
          { status: 400 },
        );
      }
      const totalPaid = paymentsClean.reduce(
        (sum: number, p: PaymentClean) => sum + (Number(p.amount) || 0),
        0,
      );
      const cashPaid = paymentsClean
        .filter((p: PaymentClean) => String(p.method).toLowerCase() === "cash")
        .reduce(
          (sum: number, p: PaymentClean) => sum + (Number(p.amount) || 0),
          0,
        );
      const nonCashPaid = totalPaid - cashPaid;
      if (totalPaid < totalAmount) {
        return NextResponse.json(
          { error: "Total pembayaran kurang dari total nota." },
          { status: 400 },
        );
      }
      if (nonCashPaid > totalAmount) {
        return NextResponse.json(
          {
            error: "Total pembayaran non-cash tidak boleh melebihi total nota.",
          },
          { status: 400 },
        );
      }
      headerPaymentAmount = totalPaid;
      const excess = totalPaid - totalAmount;
      headerChangeAmount = excess > 0 ? excess : 0;
      const primary = paymentsClean[0];
      headerPaymentMethod =
        paymentsClean.length === 1 ? primary.method : "multi";
      const firstNonCash = paymentsClean.find((p: PaymentClean) => {
        const m = String(p.method).toLowerCase();
        return m === "transfer" || m === "debit card" || m === "credit card";
      });
      if (firstNonCash) {
        if (firstNonCash.bankId != null)
          headerBankId = Number(firstNonCash.bankId);
        if (firstNonCash.cardNumber != null)
          headerCardNumber = String(firstNonCash.cardNumber);
      }
    } else {
      if (method !== "piutang") {
        const isCard =
          method === "card" ||
          method === "Debit Card" ||
          method === "Credit Card";
        if (method === "cash") {
          if (payAmount < totalAmount) {
            return NextResponse.json(
              {
                error: "Nominal pembayaran cash tidak boleh kurang dari total.",
              },
              { status: 400 },
            );
          }
        } else if (method === "transfer" || isCard) {
          if (payAmount !== totalAmount) {
            const label = isCard ? "kartu" : "transfer";
            return NextResponse.json(
              {
                error: `Nominal pembayaran ${label} harus TEPAT sama dengan total.`,
              },
              { status: 400 },
            );
          }
        }
      }
      headerPaymentMethod = method;
      headerPaymentAmount = payAmount;
      headerChangeAmount = Number(data.changeAmount) || 0;
      headerBankId = data.bankId != null ? Number(data.bankId) : null;
      headerCardNumber =
        data.cardNumber != null ? String(data.cardNumber) : null;
    }

    const hasUserCreate = true;

    // --- End DDL ensure ---

    const insertTransactionSql = `
      INSERT INTO transactions (
        transaction_number, customer_id, subtotal, discount_percent, discount_amount, total_discount,
        service_charge_percent, service_charge_amount,
        ppn_percent, ppn_amount, total, payment_method, payment_amount, change_amount,
        card_number, bank_id, status, transaction_type, period_id, warehouse_id, table_id,
        due_date, payment_terms, notes, price_include_tax, tax_rate_percent,
        tgl_nota, transaction_date, sales_id, user_create, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32) RETURNING id
    `;

    const pad2 = (n: number) => String(n).padStart(2, "0");
    const normDate = (
      s?: string | null,
    ): { y: number; m: number; d: number } | null => {
      if (!s) return null;
      const str = String(s).trim();
      const m1 = str.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/);
      if (m1) {
        const d = parseInt(m1[1], 10);
        const m = parseInt(m1[2], 10);
        const y = parseInt(m1[3], 10);
        return { y, m, d };
      }
      const m2 = str.match(/^(\d{4})-([0-1]?\d)-([0-3]?\d)$/);
      if (m2) {
        const y = parseInt(m2[1], 10);
        const m = parseInt(m2[2], 10);
        const d = parseInt(m2[3], 10);
        return { y, m, d };
      }
      return null;
    };
    const normTime = (
      s?: string | null,
    ): { hh: number; mm: number; ss: number } | null => {
      if (!s) return null;
      const str = String(s).trim();
      const m = str.match(/^([0-2]?\d):([0-5]?\d)(?::([0-5]?\d))?$/);
      if (!m) return null;
      const hh = Math.min(23, parseInt(m[1], 10) || 0);
      const mm = Math.min(59, parseInt(m[2], 10) || 0);
      const ss = Math.min(59, m[3] != null ? parseInt(m[3], 10) || 0 : 0);
      return { hh, mm, ss };
    };
    const dPart = normDate(
      (data as any)?.tanggalcreate || (data as any)?.createdDate,
    );
    const tPart = normTime(
      (data as any)?.jamcreate || (data as any)?.createdTime,
    );
    let createdAtLocal: string;
    if (dPart && tPart) {
      const y = dPart.y;
      const m = dPart.m;
      const d = dPart.d;
      const hh = tPart.hh;
      const mm = tPart.mm;
      const ss = tPart.ss;
      createdAtLocal = `${y}-${pad2(m)}-${pad2(d)} ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
    } else {
      const nowLocal = new Date();
      createdAtLocal = `${nowLocal.getFullYear()}-${pad2(nowLocal.getMonth() + 1)}-${pad2(nowLocal.getDate())} ${pad2(nowLocal.getHours())}:${pad2(nowLocal.getMinutes())}:${pad2(nowLocal.getSeconds())}`;
    }

    // === DB TRANSACTION START ===
    const queryStartTime = Date.now();
    let queryCount = 0;
    txClient = await pool.connect();
    let transactionId: number | null = null;
    let finalTransactionNumber = transactionNumber;
    try {
      await txClient.query("BEGIN");

      const cq = (sql: string, params?: any[]) => {
        const { text, values } = toPg(sql, params);
        const start = Date.now();
        const p = txClient.query(text, values);
        const short = text.replace(/\s+/g, " ").slice(0, 100);
        queryCount++;
        return p
          .then((r: any) => {
            const elapsed = Date.now() - start;
            if (elapsed > 50)
              console.log(`[SQL>50ms] q#${queryCount} ${elapsed}ms — ${short}`);
            return r;
          })
          .catch((e: any) => {
            console.log(
              `[SQL ERROR] q#${queryCount} ${Date.now() - start}ms — ${short}`,
            );
            throw e;
          });
      };
      const cqGet = async <T>(
        sql: string,
        params?: any[],
      ): Promise<T | undefined> => {
        const r = await cq(sql, params);
        return r.rows[0] as T | undefined;
      };
      const cqAll = async <T>(sql: string, params?: any[]): Promise<T[]> => {
        const r = await cq(sql, params);
        return r.rows as T[];
      };

      // --- TRANSACTION INSERT ---
      try {
        await txClient.query("SAVEPOINT tx_sp");
        const paymentMethodFinal =
          paymentsClean.length > 1
            ? "multi"
            : String(data.paymentMethod || paymentsClean[0]?.method || "cash");
        const paymentAmountFromRows = (
          paymentsClean as Array<{ amount: number }>
        ).reduce((sum: number, p) => sum + (Number(p.amount) || 0), 0);
        const paymentAmountFinal =
          Number(data.paymentAmount ?? payAmount) || paymentAmountFromRows || 0;
        const changeAmountFromRows = Math.max(
          0,
          paymentAmountFromRows - headerTotal,
        );
        const changeAmountFinal =
          Number(data.changeAmount ?? 0) || changeAmountFromRows || 0;
        const cardNumberFinal = data.cardNumber ?? null;
        const bankIdFinal = data.bankId ?? null;
        const statusFinal = String(data.status || "completed");
        const userCreateFinal = hasUserCreate ? userId || null : null;

        const poolResult = await txClient.query(insertTransactionSql, [
          finalTransactionNumber,
          data.customerId ?? null,
          headerSubtotal,
          data.discountPercent || 0,
          data.discountAmount || 0,
          totalDiscount,
          headerServicePercent,
          headerServiceAmount,
          taxRatePercent,
          headerPPN,
          headerTotal,
          paymentMethodFinal,
          paymentAmountFinal,
          changeAmountFinal,
          cardNumberFinal,
          bankIdFinal,
          statusFinal,
          transactionType,
          period.id,
          selectedWarehouseId,
          data.tableId ?? null,
          data.dueDate || null,
          data.paymentTerms || null,
          data.notes || null,
          priceIncludeTax ? 1 : 0,
          taxRatePercent,
          txDate,
          txDate,
          data.salesId ? Number(data.salesId) : null,
          userCreateFinal,
          createdAtLocal,
          createdAtLocal,
        ]);
        await txClient.query("RELEASE SAVEPOINT tx_sp");
        transactionId = poolResult.rows[0].id as number;
        finalTransactionNumber = transactionNumber;
      } catch (e: any) {
        await txClient.query("ROLLBACK TO SAVEPOINT tx_sp");
        throw e;
      }
      if (!transactionId) {
        throw new Error(
          "Gagal membuat transaksi: nomor nota tidak bisa dibuat unik",
        );
      }

      // --- ITEMS + STOCK ---
      if (itemsInput.length > 0) {
        const canStockOps = true;
        const stockWarehouseId = selectedWarehouseId;

        // --- Batch load data sebelum loop ---
        const itemBarangIds = [
          ...new Set(
            itemsInput
              .map((it: any) => Number(it.barangId || 0))
              .filter(Boolean),
          ),
        ] as number[];
        const paketIds = [
          ...new Set(
            itemsInput.map((it: any) => Number(it.paketId)).filter(Boolean),
          ),
        ] as number[];
        const paketCompMap = new Map<
          number,
          {
            barang_id: number;
            quantity: number;
            barang_code: string;
            barang_name: string;
          }[]
        >();
        const paketCompBarangIds: number[] = [];
        if (paketIds.length > 0) {
          const paketRows = await rawAll<any>(`
          SELECT pd.paket_id, pd.barang_id, pd.quantity, b.code as barang_code, b.name as barang_name
          FROM master_paket_detail pd
          JOIN master_barang b ON b.id = pd.barang_id
          WHERE pd.paket_id IN (${paketIds.join(",")})
        `);
          for (const p of paketRows) {
            const list = paketCompMap.get(Number(p.paket_id)) || [];
            list.push({
              barang_id: Number(p.barang_id),
              quantity: Number(p.quantity),
              barang_code: p.barang_code,
              barang_name: p.barang_name,
            });
            paketCompMap.set(Number(p.paket_id), list);
            paketCompBarangIds.push(Number(p.barang_id));
          }
        }
        const allBarangIds = [
          ...new Set([...itemBarangIds, ...paketCompBarangIds]),
        ];
        type BarangInfo = { code: string; name: string; jenis: number };
        const barangInfoMap = new Map<number, BarangInfo>();
        async function getBarangInfo(
          id: number,
        ): Promise<BarangInfo | undefined> {
          let bi = barangInfoMap.get(id);
          if (bi) return bi;
          const missingIds = [
            ...new Set([...itemBarangIds, ...paketCompBarangIds]),
          ].filter((bid) => !barangInfoMap.has(bid));
          if (missingIds.length > 0) {
            const rows = await rawAll<any>(
              `SELECT id, code, name, jenis FROM master_barang WHERE id IN (${missingIds.join(",")})`,
            );
            for (const b of rows) {
              barangInfoMap.set(Number(b.id), {
                code: b.code,
                name: b.name,
                jenis: Number(b.jenis),
              });
            }
          }
          return barangInfoMap.get(id);
        }

        const recipesMap = new Map<
          number,
          { ingredient_id: number; quantity: number; unit: string }[]
        >();
        if (autoManufaktur && allBarangIds.length > 0) {
          const recipeRows = await rawAll<any>(
            `SELECT barang_id, ingredient_id, quantity, unit FROM barang_recipes WHERE barang_id IN (${allBarangIds.join(",")})`,
          );
          for (const r of recipeRows) {
            const list = recipesMap.get(Number(r.barang_id)) || [];
            list.push({
              ingredient_id: Number(r.ingredient_id),
              quantity: Number(r.quantity),
              unit: r.unit,
            });
            recipesMap.set(Number(r.barang_id), list);
          }
        }

        const unitsMap = new Map<number, { name: string; ratio: number }[]>();
        if (allBarangIds.length > 0) {
          const unitRows = await rawAll<any>(
            `SELECT barang_id, name, ratio FROM barang_units WHERE barang_id IN (${allBarangIds.join(",")}) ORDER BY barang_id, ratio ASC`,
          );
          for (const u of unitRows) {
            const list = unitsMap.get(Number(u.barang_id)) || [];
            list.push({ name: u.name, ratio: Number(u.ratio) });
            unitsMap.set(Number(u.barang_id), list);
          }
        }

        // --- Batch load stock_balance before loop ---
        const stockIngredientIds = new Set<number>();
        for (const it of itemsInput) {
          stockIngredientIds.add(Number(it.barangId || 1));
        }
        for (const pId of paketIds) {
          const comps = paketCompMap.get(pId) || [];
          for (const c of comps) stockIngredientIds.add(Number(c.barang_id));
        }
        if (autoManufaktur) {
          for (const [, recipes] of recipesMap) {
            for (const rcp of recipes)
              stockIngredientIds.add(rcp.ingredient_id);
          }
          for (const it of itemsInput) {
            stockIngredientIds.add(Number(it.barangId || 1));
          }
        }
        // Urutkan ascending agar SELECT ... FOR UPDATE mengunci baris dalam
        // urutan deterministik (anti deadlock saat banyak transaksi bersamaan).
        const stockIdsArr = [...stockIngredientIds].sort((a, b) => a - b);
        const stockBalanceMap = new Map<
          string,
          { quantity: number; avg_cost: number; total_cost: number }
        >();
        if (stockIdsArr.length > 0) {
          const sbRows = await cqAll<any>(
            `SELECT ingredient_id, warehouse_id, COALESCE(quantity,0) AS qty, COALESCE(avg_cost,0) AS avg, COALESCE(total_cost,0) AS total FROM stock_balance WHERE ingredient_id IN (${stockIdsArr.map(() => "?").join(",")}) AND warehouse_id = ? FOR UPDATE`,
            [...stockIdsArr, stockWarehouseId],
          );
          for (const r of sbRows) {
            stockBalanceMap.set(`${r.ingredient_id}:${r.warehouse_id}`, {
              quantity: Number(r.qty),
              avg_cost: Number(r.avg),
              total_cost: Number(r.total),
            });
          }
        }
        const getStock = (ingId: number, whId: number) =>
          stockBalanceMap.get(`${ingId}:${whId}`) || {
            quantity: 0,
            avg_cost: 0,
            total_cost: 0,
          };

        const insertItemCols = [
          "transaction_id",
          "barang_id",
          "barang_code",
          "barang_name",
          "quantity",
          "unit_name",
          "unit_ratio",
          "unit_price",
          "discount_percent",
          "discount_amount",
          "discon_total",
          "disc1_percent",
          "disc1_amount",
          "disc2_percent",
          "disc2_amount",
          "disc3_percent",
          "disc3_amount",
          "gross_amount",
          "net_amount",
          "total_price",
          "unit_price_include_tax",
          "modifier",
          "paket_id",
          "disc_nominal",
          "bonus_barang_id",
          "bonus_name",
          "bonus_qty",
          "bonus_unit",
          "bonus_unit_ratio",
        ];
        const itemBatchParams: any[][] = [];
        const itemBatchMeta: any[] = [];
        const smInsertBatch: any[] = [];
        const sbUpsertBatch: any[] = [];
        const cogsUpdateBatch: {
          id: number;
          cogsUnit: number;
          cogsTotal: number;
        }[] = [];
        // --- End batch load ---

        for (const item of itemsInput) {
          let actualBarangId = item.barangId;
          let paketComponents: any[] = [];
          if (item.paketId) {
            paketComponents = paketCompMap.get(Number(item.paketId)) || [];
            if (paketComponents.length > 0) {
              actualBarangId = paketComponents[0].barang_id;
            }
          }

          const bi = await getBarangInfo(Number(actualBarangId));
          const barangCode = bi?.code || "UNKNOWN";
          const barangName = bi?.name || "Unknown";
          const jenis = bi?.jenis;
          const isBarangHppEligible = jenis === 1 || jenis === 2 || jenis === 3;

          const unitRatio = Number(item.unitRatio) || 1;

          const qty = Number(item.quantity) || 0;
          const price = Number(item.unitPrice) || 0;
          const disc1Pct = Number(item.disc1Percent ?? 0) || 0;
          const disc2Pct = Number(item.disc2Percent ?? 0) || 0;
          const disc3Pct = Number(item.disc3Percent ?? 0) || 0;
          const discNominal = Number(item.discNominal ?? 0) || 0;
          const discPct = Number(item.discountPercent ?? 0) || 0;
          const tr = calculateTieredDiscount(
            qty,
            price,
            discPct,
            disc1Pct,
            disc2Pct,
            disc3Pct,
            discNominal,
          );

          let lineNetEx: number, taxAmount: number, lineTotal: number;
          if (priceIncludeTax) {
            lineTotal = tr.netAmount;
            lineNetEx = roundRp(lineTotal / (1 + r));
            taxAmount = lineTotal - lineNetEx;
          } else {
            lineNetEx = tr.netAmount;
            taxAmount = roundRp(lineNetEx * r);
            lineTotal = lineNetEx + taxAmount;
          }

          const uiUnitPrice = Number(item.unitPrice) || 0;
          const uiTotalPrice = Number(item.totalPrice) || 0;
          const uiUnitPriceIncludeTax =
            item.unitPriceIncludeTax !== undefined
              ? Number(item.unitPriceIncludeTax)
              : null;
          const _itemParams = [
            transactionId,
            actualBarangId,
            barangCode,
            item.paketName || barangName,
            qty,
            item.unitName || "PCS",
            unitRatio,
            uiUnitPrice,
            tr.discountPercent,
            tr.discountAmount,
            tr.totalDiscount,
            tr.disc1Percent,
            tr.disc1Amount,
            tr.disc2Percent,
            tr.disc2Amount,
            tr.disc3Percent,
            tr.disc3Amount,
            tr.grossAmount,
            tr.netAmount,
            uiTotalPrice > 0 ? uiTotalPrice : lineTotal,
            uiUnitPriceIncludeTax,
            item.modifier || null,
            item.paketId || null,
            Number(item.discNominal ?? 0) || 0,
            item.bonusBarangId ?? null,
            item.bonusName ?? null,
            Number(item.bonusQty ?? 0) || 0,
            item.bonusUnit ?? null,
            Number(item.bonusUnitRatio ?? 0) || null,
          ];
          itemBatchParams.push(_itemParams);
          const _itemIdx = itemBatchParams.length - 1;
          itemBatchMeta.push({
            itemIdx: _itemIdx,
            barangId: actualBarangId,
            barangCode,
            barangName,
            jenis,
            isBarangHppEligible,
            unitRatio,
            item,
            paketComponents,
          });
        }
        // --- Execute item batch INSERT ---
        if (itemBatchParams.length > 0) {
          const nCols = insertItemCols.length;
          const placeholders = itemBatchParams
            .map(
              (_, i) =>
                `(${insertItemCols.map((_, j) => `$${i * nCols + j + 1}`).join(",")})`,
            )
            .join(",");
          const flatParams = itemBatchParams.flat();
          const batResult = await txClient.query(
            `INSERT INTO transaction_items (${insertItemCols.join(",")}) VALUES ${placeholders} RETURNING id`,
            flatParams,
          );
          const insertedIds = batResult.rows.map((r: any) => Number(r.id));
          for (let i = 0; i < itemBatchMeta.length; i++) {
            const meta = itemBatchMeta[i];
            const {
              item,
              barangId,
              barangCode,
              barangName,
              jenis,
              isBarangHppEligible,
              unitRatio,
              paketComponents,
            } = meta;
            const actualBarangId = barangId;
            const insertedItemId = insertedIds[i];

            try {
              if (!canStockOps) {
                continue;
              }
              if (tanpaStok) {
                continue;
              }
              const qtySold = Number(item.quantity) || 1;
              const recipes = autoManufaktur
                ? recipesMap.get(Number(item.barangId || 1)) || []
                : [];

              const autoProduction = autoManufaktur;
              const hasRecipes = !!(recipes && recipes.length > 0);

              let itemCogsAccumulator = 0;

              if (autoProduction && hasRecipes && !isReturn && !item.paketId) {
                const mfQty = qtySold;
                const mfWarehouseId = stockWarehouseId;
                const mfPeriodId = period.id;
                const mfTxDate = txDate;
                let totalBiayaBahan = 0;
                const detailRows: Array<{
                  barang_id: number;
                  barang_code: string;
                  barang_name: string;
                  quantity: number;
                  hpp_satuan: number;
                  total_hpp: number;
                }> = [];

                const ingIds = recipes
                  .map((r: any) => r.ingredient_id)
                  .filter(Boolean);
                const ingInfoMap = new Map<
                  number,
                  { code: string; name: string }
                >();
                if (ingIds.length > 0) {
                  const ingRows = await cqAll<any>(
                    `SELECT id, code, name FROM master_barang WHERE id IN (${ingIds.map(() => "?").join(",")})`,
                    ingIds,
                  );
                  for (const ir of ingRows)
                    ingInfoMap.set(Number(ir.id), {
                      code: ir.code,
                      name: ir.name,
                    });
                }

                for (const rcp of recipes) {
                  const perUnit = Number(rcp.quantity) || 0;
                  const used = perUnit * mfQty;
                  if (used <= 0) continue;
                  const ing = ingInfoMap.get(rcp.ingredient_id) || {
                    code: "UNKNOWN",
                    name: "Unknown",
                  };
                  const bal = getStock(rcp.ingredient_id, mfWarehouseId);
                  const unitCost = bal.avg_cost;
                  const lineTotal = unitCost * used;
                  totalBiayaBahan += lineTotal;
                  detailRows.push({
                    barang_id: rcp.ingredient_id,
                    barang_code: ing?.code || "UNKNOWN",
                    barang_name: ing?.name || "Unknown",
                    quantity: used,
                    hpp_satuan: unitCost,
                    total_hpp: lineTotal,
                  });
                  if (!allowNegative) {
                    const available = bal.quantity;
                    if (available < used) {
                      const ingName = ing?.name || `ID ${rcp.ingredient_id}`;
                      throw new Error(
                        `Stok ${ingName} tidak cukup untuk produksi otomatis. Tersedia: ${available}, Dibutuhkan: ${used}`,
                      );
                    }
                  }
                }

                if (detailRows.length > 0) {
                  const mfPrefix = `MF-AUTO/${new Date().getFullYear()}/`;
                  const lastMf = await cqGet<any>(
                    "SELECT nomor FROM manufaktur WHERE nomor LIKE ? ORDER BY id DESC LIMIT 1",
                    [`${mfPrefix}%`],
                  );
                  let mfSeq = 1;
                  if (lastMf?.nomor) {
                    const parts = String(lastMf.nomor).split("/");
                    const lastSeq = parseInt(parts[2] || "0", 10);
                    mfSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
                  }
                  const mfNomor = `${mfPrefix}${String(mfSeq).padStart(6, "0")}`;
                  const finishGood = await cqGet<any>(
                    "SELECT code, name, hpp FROM master_barang WHERE id = ?",
                    [actualBarangId],
                  );
                  const hppSebelum = finishGood
                    ? Number(finishGood.hpp) || 0
                    : 0;
                  const totalBiaya = totalBiayaBahan;

                  const mfResult = await txClient.query(
                    `
                  INSERT INTO manufaktur (
                    nomor, tanggal, barang_id, barang_code, barang_name,
                    quantity, status, notes, warehouse_id,
                    hpp_sebelum, total_biaya_bahan, total_biaya_lain, total_biaya,
                    user_create, created_at, updated_at,
                    user_approve, approved_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7, $8, $9, $10, 0, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $13, CURRENT_TIMESTAMP) RETURNING id
                `,
                    [
                      mfNomor,
                      mfTxDate,
                      actualBarangId,
                      finishGood?.code || barangCode,
                      finishGood?.name || barangName,
                      mfQty,
                      `Auto-produksi dari penjualan ${finalTransactionNumber}`,
                      mfWarehouseId,
                      hppSebelum,
                      totalBiayaBahan,
                      totalBiaya,
                      userId || null,
                      userId || null,
                    ],
                  );
                  const mfId = Number(mfResult.rows[0].id);

                  const mfDetailCols = [
                    "manufaktur_id",
                    "barang_id",
                    "barang_code",
                    "barang_name",
                    "quantity",
                    "hpp_satuan",
                    "total_hpp",
                  ];
                  const mfDetailParams: any[][] = [];
                  for (const d of detailRows) {
                    mfDetailParams.push([
                      mfId,
                      d.barang_id,
                      d.barang_code,
                      d.barang_name,
                      d.quantity,
                      d.hpp_satuan,
                      d.total_hpp,
                    ]);
                  }
                  if (mfDetailParams.length > 0) {
                    const nCols = mfDetailCols.length;
                    const phs = mfDetailParams
                      .map(
                        (_, i) =>
                          `(${mfDetailCols.map((_, j) => `$${i * nCols + j + 1}`).join(",")})`,
                      )
                      .join(",");
                    const fp = mfDetailParams.flat();
                    await txClient.query(
                      `INSERT INTO manufaktur_detail (${mfDetailCols.join(",")}) VALUES ${phs}`,
                      fp,
                    );
                  }

                  for (const d of detailRows) {
                    const dBal = getStock(d.barang_id, mfWarehouseId);
                    const dPrevQty = dBal.quantity;
                    const dPrevTotalCost = dBal.total_cost;
                    const dAvgCost = dBal.avg_cost;
                    const dDeltaQty = -d.quantity;
                    const dDeltaCost = -(dAvgCost * d.quantity);
                    const dNewQty = Math.max(0, dPrevQty + dDeltaQty);
                    const dNewTotalCost = Math.max(
                      0,
                      dPrevTotalCost + dDeltaCost,
                    );
                    const dNewAvgCost =
                      dNewQty > 0 ? dNewTotalCost / dNewQty : 0;
                    smInsertBatch.push({
                      ingredient_id: d.barang_id,
                      warehouse_id: mfWarehouseId,
                      movement_type: "manufaktur_out",
                      quantity: d.quantity,
                      unit: null,
                      reference_type: "manufaktur",
                      reference_id: mfId,
                      period_id: mfPeriodId,
                      transaction_date: mfTxDate,
                      notes: `manufaktur_out: ${mfNomor}`,
                      unit_cost: dAvgCost,
                      total_cost: dAvgCost * d.quantity,
                      balance_qty: dNewQty,
                      balance_cost: dNewTotalCost,
                      balance_avg_cost: dNewAvgCost,
                    });
                    sbUpsertBatch.push({
                      ingredient_id: d.barang_id,
                      warehouse_id: mfWarehouseId,
                      quantity: dNewQty,
                      avg_cost: dNewAvgCost,
                      total_cost: dNewTotalCost,
                    });
                    stockBalanceMap.set(`${d.barang_id}:${mfWarehouseId}`, {
                      quantity: dNewQty,
                      avg_cost: dNewAvgCost,
                      total_cost: dNewTotalCost,
                    });
                  }

                  const hasilBal = getStock(actualBarangId, mfWarehouseId);
                  const prevHasilQty = hasilBal.quantity;
                  const prevHasilTotalCost = hasilBal.total_cost;
                  const hppSatuanHasil = mfQty > 0 ? totalBiaya / mfQty : 0;
                  const newHasilQty = prevHasilQty + mfQty;
                  const newHasilTotalCost = prevHasilTotalCost + totalBiaya;
                  const newHasilAvgCost =
                    newHasilQty > 0 ? newHasilTotalCost / newHasilQty : 0;
                  smInsertBatch.push({
                    ingredient_id: actualBarangId,
                    warehouse_id: mfWarehouseId,
                    movement_type: "manufaktur_in",
                    quantity: mfQty,
                    unit: null,
                    reference_type: "manufaktur",
                    reference_id: mfId,
                    period_id: mfPeriodId,
                    transaction_date: mfTxDate,
                    notes: `manufaktur_in: ${mfNomor}`,
                    unit_cost: hppSatuanHasil,
                    total_cost: totalBiaya,
                    balance_qty: newHasilQty,
                    balance_cost: newHasilTotalCost,
                    balance_avg_cost: newHasilAvgCost,
                  });
                  sbUpsertBatch.push({
                    ingredient_id: actualBarangId,
                    warehouse_id: mfWarehouseId,
                    quantity: newHasilQty,
                    avg_cost: newHasilAvgCost,
                    total_cost: newHasilTotalCost,
                  });
                  stockBalanceMap.set(`${actualBarangId}:${mfWarehouseId}`, {
                    quantity: newHasilQty,
                    avg_cost: newHasilAvgCost,
                    total_cost: newHasilTotalCost,
                  });
                  await cq(
                    "UPDATE master_barang SET hpp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [newHasilAvgCost, actualBarangId],
                  );
                  await cq(
                    `UPDATE manufaktur SET hpp_sesudah = ?, total_biaya_bahan = ?, total_biaya = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [newHasilAvgCost, totalBiayaBahan, totalBiaya, mfId],
                  );
                }
              }

              if (item.paketId && paketComponents.length > 0) {
                if (!isReturn && !allowNegative) {
                  for (const pc of paketComponents) {
                    const used = Number(pc.quantity) * qtySold;
                    if (used > 0) {
                      const currentStock = getStock(
                        pc.barang_id,
                        stockWarehouseId,
                      ).quantity;
                      if (currentStock < used) {
                        const pn =
                          (await getBarangInfo(pc.barang_id))?.name ||
                          pc.barang_name;
                        throw new Error(
                          `Stok ${pn} tidak cukup untuk paket. Tersedia: ${currentStock}, Dibutuhkan: ${used}`,
                        );
                      }
                    }
                  }
                }
                for (const pc of paketComponents) {
                  const perUnit = Number(pc.quantity) || 0;
                  const used = perUnit * qtySold;
                  if (used > 0) {
                    const pcJenis = (await getBarangInfo(pc.barang_id))?.jenis;
                    const pcIsEligible =
                      pcJenis === 1 || pcJenis === 2 || pcJenis === 3;
                    let pcPrevAvg = 0;
                    if (!isReturn) {
                      pcPrevAvg = getStock(
                        pc.barang_id,
                        stockWarehouseId,
                      ).avg_cost;
                    }
                    const _pcPrevStock = getStock(
                      pc.barang_id,
                      stockWarehouseId,
                    );
                    const _pcSbItem = _pcPrevStock;
                    const _pcPrevAvg = _pcSbItem.avg_cost;
                    const _pcDQty = isReturn ? used : -used;
                    const _pcDCost = pcIsEligible
                      ? isReturn
                        ? _pcPrevAvg * used
                        : -(_pcPrevAvg * used)
                      : 0;
                    const _pcNewQty = _pcSbItem.quantity + _pcDQty;
                    const _pcNewTotal = (_pcSbItem.total_cost || 0) + _pcDCost;
                    const _pcNewAvg =
                      _pcNewQty > 0 ? _pcNewTotal / _pcNewQty : 0;
                    smInsertBatch.push({
                      ingredient_id: pc.barang_id,
                      warehouse_id: stockWarehouseId,
                      movement_type: isReturn ? "in" : "out",
                      quantity: used,
                      unit: "unit",
                      reference_type: isReturn ? "sale_return" : "sale",
                      reference_id: transactionId,
                      period_id: period.id,
                      transaction_date: txDate,
                      notes: `Paket ${item.paketName || ""} - ${pc.barang_code} x${used}`,
                      unit_cost: pcIsEligible ? _pcPrevAvg : null,
                      total_cost: pcIsEligible ? _pcPrevAvg * used : null,
                      balance_qty: _pcNewQty,
                      balance_cost: _pcNewTotal,
                      balance_avg_cost: _pcNewAvg,
                    });
                    sbUpsertBatch.push({
                      ingredient_id: pc.barang_id,
                      warehouse_id: stockWarehouseId,
                      quantity: _pcNewQty,
                      avg_cost: _pcNewAvg,
                      total_cost: _pcNewTotal,
                    });
                    stockBalanceMap.set(`${pc.barang_id}:${stockWarehouseId}`, {
                      quantity: _pcNewQty,
                      avg_cost: _pcNewAvg,
                      total_cost: _pcNewTotal,
                    });
                    if (!isReturn && pcIsEligible)
                      itemCogsAccumulator += _pcPrevAvg * used;
                  }
                }
              } else {
                const unitsAsc = unitsMap.get(Number(item.barangId || 1)) || [
                  { name: item.unitName || "unit", ratio: 1 },
                ];
                const baseUnitName = unitsAsc[0]?.name || "unit";
                const usedBase = qtySold * unitRatio;
                const biJenis = (
                  await getBarangInfo(Number(item.barangId || 1))
                )?.jenis;
                const isEligible =
                  biJenis === 1 || biJenis === 2 || biJenis === 3;
                let prevAvg = 0;
                if (!isReturn) {
                  const sbItem = getStock(
                    Number(item.barangId || 1),
                    stockWarehouseId,
                  );
                  prevAvg = sbItem.avg_cost;
                  if (!allowNegative) {
                    const currentStock = sbItem.quantity;
                    if (currentStock < usedBase) {
                      throw new Error(
                        `Stok ${barangName} tidak cukup. Tersedia: ${currentStock}, Dibutuhkan: ${usedBase}`,
                      );
                    }
                  }
                }
                const _prevStock = getStock(
                  Number(item.barangId || 1),
                  stockWarehouseId,
                );
                const _sbItem = _prevStock;
                const _prevAvg = _sbItem.avg_cost;
                const _dQty = isReturn ? usedBase : -usedBase;
                const _dCost = isEligible
                  ? isReturn
                    ? _prevAvg * usedBase
                    : -(_prevAvg * usedBase)
                  : 0;
                const _newQty = _sbItem.quantity + _dQty;
                const _newTotal = (_sbItem.total_cost || 0) + _dCost;
                const _newAvg = _newQty > 0 ? _newTotal / _newQty : 0;
                smInsertBatch.push({
                  ingredient_id: Number(item.barangId || 1),
                  warehouse_id: stockWarehouseId,
                  movement_type: isReturn ? "in" : "out",
                  quantity: usedBase,
                  unit: baseUnitName,
                  reference_type: isReturn ? "sale_return" : "sale",
                  reference_id: transactionId,
                  period_id: period.id,
                  transaction_date: txDate,
                  notes: `${isReturn ? "Retur" : "Penjualan"} ${barangCode} x${qtySold} (${item.unitName || baseUnitName})`,
                  unit_cost: isEligible ? _prevAvg : null,
                  total_cost: isEligible ? _prevAvg * usedBase : null,
                  balance_qty: _newQty,
                  balance_cost: _newTotal,
                  balance_avg_cost: _newAvg,
                });
                sbUpsertBatch.push({
                  ingredient_id: Number(item.barangId || 1),
                  warehouse_id: stockWarehouseId,
                  quantity: _newQty,
                  avg_cost: _newAvg,
                  total_cost: _newTotal,
                });
                stockBalanceMap.set(
                  `${Number(item.barangId || 1)}:${stockWarehouseId}`,
                  {
                    quantity: _newQty,
                    avg_cost: _newAvg,
                    total_cost: _newTotal,
                  },
                );
                if (!isReturn && isEligible)
                  itemCogsAccumulator = _prevAvg * usedBase;
              }
              if (!isReturn && isBarangHppEligible) {
                const cogsTotal = Number(itemCogsAccumulator) || 0;
                const qtySoldBase = qtySold;
                const cogsUnit = qtySoldBase > 0 ? cogsTotal / qtySoldBase : 0;
                cogsUpdateBatch.push({
                  id: insertedItemId,
                  cogsUnit,
                  cogsTotal,
                });
              }
            } catch (e: any) {
              console.error("Error processing stock for sale:", e);
              throw new Error(e.message || "Gagal memproses stok");
            }
          }
        }
        // --- Execute batch stock movements ---
        if (smInsertBatch.length > 0) {
          const smCols = [
            "ingredient_id",
            "warehouse_id",
            "movement_type",
            "quantity",
            "unit",
            "reference_type",
            "reference_id",
            "period_id",
            "transaction_date",
            "notes",
            "unit_cost",
            "total_cost",
            "balance_qty",
            "balance_cost",
            "balance_avg_cost",
          ];
          const smVals = smInsertBatch
            .map(
              (_, i) =>
                `(${smCols.map((_, j) => `$${i * smCols.length + j + 1}`).join(", ")})`,
            )
            .join(", ");
          const smFlat = smInsertBatch.flatMap((sm: any) =>
            smCols.map((c) => (sm as any)[c]),
          );
          await txClient.query(
            `INSERT INTO stock_movements (${smCols.join(", ")}) VALUES ${smVals}`,
            smFlat,
          );
        }
        if (sbUpsertBatch.length > 0) {
          const sbCols = [
            "ingredient_id",
            "warehouse_id",
            "quantity",
            "avg_cost",
            "total_cost",
          ];
          const sbVals = sbUpsertBatch
            .map(
              (_, i) =>
                `(${sbCols.map((_, j) => `$${i * sbCols.length + j + 1}`).join(", ")}, CURRENT_TIMESTAMP)`,
            )
            .join(", ");
          const sbFlat = sbUpsertBatch.flatMap((sb: any) =>
            sbCols.map((c) => (sb as any)[c as keyof typeof sb]),
          );
          await txClient.query(
            `INSERT INTO stock_balance (${sbCols.join(", ")}, updated_at) VALUES ${sbVals} ON CONFLICT (ingredient_id, warehouse_id) DO UPDATE SET quantity = EXCLUDED.quantity, avg_cost = EXCLUDED.avg_cost, total_cost = EXCLUDED.total_cost, updated_at = CURRENT_TIMESTAMP`,
            sbFlat,
          );
        }
        if (cogsUpdateBatch.length > 0) {
          const cgFlat: any[] = [];
          for (const cg of cogsUpdateBatch) {
            cgFlat.push(cg.cogsUnit, cg.cogsTotal, cg.id);
          }
          await txClient.query(
            `UPDATE transaction_items SET cogs_unit = CASE id ${cogsUpdateBatch.map((_, i) => `WHEN $${i * 3 + 3} THEN $${i * 3 + 1}::real`).join(" ")} END, cogs_total = CASE id ${cogsUpdateBatch.map((_, i) => `WHEN $${i * 3 + 3} THEN $${i * 3 + 2}::real`).join(" ")} END WHERE id IN (${cogsUpdateBatch.map((_, i) => `$${i * 3 + 3}`).join(", ")})`,
            cgFlat,
          );
        }
      }

      await txClient.query("COMMIT");
    } catch (e) {
      try {
        await txClient.query("ROLLBACK");
      } catch {}
      throw e;
    } finally {
      txClient.release();
      txClient = null;
    }
    // === DB TRANSACTION END ===

    // --- RETURN FLAGS (best-effort, after commit) ---
    try {
      const invId = data.invoiceId ?? data.referenceTransactionId ?? null;
      await rawRun("UPDATE transactions SET is_return = COALESCE(is_return, 0) + ?, invoice_id = COALESCE(?, invoice_id), so_id = COALESCE(?, so_id), reference_transaction_id = COALESCE(?, reference_transaction_id), return_reason = COALESCE(?, return_reason) WHERE id = ?", [
        isReturn ? 1 : 0,
        invId,
        data.soId ?? null,
        invId,
        data.returnReason ?? null,
        transactionId,
      ]);
    } catch (e) {
      console.warn("[Transactions] failed to update return flags:", e);
    }

    // --- SO REALIZATION (best-effort, after commit) ---
    try {
      const soId = data.soId ? Number(data.soId) : null;
      if (soId && itemsInput.length > 0 && transactionType === 3 && !isReturn) {
        const soHeader = await rawGet<any>("SELECT id, so_status, realisasi_manual FROM sales_order WHERE id = ? AND COALESCE(so_status,'') != 'void'", [soId]);
        if (soHeader && Number(soHeader.realisasi_manual || 0) !== 1) {
          const soItems = await rawAll<any>("SELECT id, barang_id, quantity, unit_ratio, realized_qty, realized_qty_base FROM sales_order_items WHERE sales_order_id = ?", [soId]);
          if (soItems && soItems.length > 0) {
            // Group transaction items by barangId
            const txQtyByBarang: Record<number, number> = {};
            for (const it of itemsInput) {
              const barangId = Number(it.barangId || it.barang_id || 0);
              if (!barangId) continue;
              const qty = Number(it.quantity || 0) || 0;
              const unitRatio = Number(it.unitRatio || it.unit_ratio || 1) || 1;
              const qtyBase = qty * unitRatio;
              txQtyByBarang[barangId] = (txQtyByBarang[barangId] || 0) + qtyBase;
            }
            if (Object.keys(txQtyByBarang).length > 0) {
              let allFullyRealized = true;
              for (const soi of soItems) {
                const barangId = Number(soi.barang_id);
                const txQtyBase = txQtyByBarang[barangId] || 0;
                if (txQtyBase <= 0) continue;
                const maxQty = Number(soi.quantity || 0) * Number(soi.unit_ratio || 1);
                const currentRealized = Number(soi.realized_qty_base || 0);
                const remaining = maxQty - currentRealized;
                if (txQtyBase > remaining + 0.0001) {
                  console.warn(`[SO realization] Qty melebihi sisa SO: barang ${barangId}, invoice ${txQtyBase}, sisa ${remaining}`);
                  continue;
                }
                const newRealized = currentRealized + txQtyBase;
                const unitRatioItem = Number(soi.unit_ratio || 1);
                const newRealizedQty = unitRatioItem > 0 ? Math.round((newRealized / unitRatioItem) * 100) / 100 : 0;
                await rawRun("UPDATE sales_order_items SET realized_qty_base = ?, realized_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newRealized, newRealizedQty, soi.id]);
              }
              // Recalculate so_status
              const remainingItems = await rawAll<any>("SELECT id, quantity, unit_ratio, realized_qty_base FROM sales_order_items WHERE sales_order_id = ?", [soId]);
              if (remainingItems) {
                for (const soi of remainingItems) {
                  const maxQty = Number(soi.quantity || 0) * Number(soi.unit_ratio || 1);
                  const currentRealized = Number(soi.realized_qty_base || 0);
                  if (maxQty > currentRealized + 0.0001) {
                    allFullyRealized = false;
                    break;
                  }
                }
              }
              await rawRun("UPDATE sales_order SET so_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [allFullyRealized ? 'realisasi' : 'outstanding', soId]);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Transactions] gagal update SO realization:", e instanceof Error ? e.message : e);
    }

    if (data.fakturPajak) {
      try {
        await rawRun("UPDATE transactions SET faktur_pajak = ? WHERE id = ?", [
          String(data.fakturPajak),
          transactionId,
        ]);
      } catch (e) {
        console.warn("[Transactions] failed to save faktur_pajak:", e);
      }
    }

    // --- PAYMENT (best-effort, after commit) ---
    try {
      if (paymentsClean.length > 0) {
        const payTable = await rawGet<any>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_payments'");
        if (payTable) {
          const totalPaid = paymentsClean.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const excess = totalPaid - headerTotal;
          const changeAmt = excess > 0 ? excess : 0;
          for (const p of paymentsClean) {
            const isCash = String(p.method).toLowerCase() === "cash";
            await rawRun("INSERT INTO transaction_payments (transaction_id, method, amount, bank_id, card_number, notes, change_amount) VALUES (?, ?, ?, ?, ?, ?, ?)", [
              transactionId, p.method, p.amount,
              p.bankId ?? null, p.cardNumber ?? null, p.notes ?? null,
              isCash ? changeAmt : 0,
            ]);
          }
        }
      }
    } catch (e) {
      console.warn("[Transactions] gagal menyimpan transaction_payments:", e);
    }

    // --- AR AUTO-CREATION (best-effort, after commit) ---
    try {
      if (!isReturn && paymentsClean.length > 0 && transactionType <= 2) {
        const existingAr = await rawGet<any>("SELECT COUNT(*)::int as cnt FROM ar_payment_items pai JOIN ar_payments ap ON ap.id = pai.payment_id AND ap.status = 'active' WHERE pai.sale_id = ?", [transactionId]);
        if (!existingAr?.cnt) {
          const year = txDate.slice(0, 4);
          const last = await rawGet<any>("SELECT payment_number FROM ar_payments WHERE payment_number LIKE ? ORDER BY payment_number DESC LIMIT 1", [`AR/${year}/%`]);
          let seq = 1;
          if (last?.payment_number) {
            const parts = String(last.payment_number).split("/");
            seq = (parseInt(parts[2] || "0", 10) || 0) + 1;
          }
          const paymentNumber = `AR/${year}/${String(seq).padStart(6, "0")}`;
          let custName = String(data.Nm_cust || data.customerName || "").slice(0, 255) || null;
          const arPayment = await rawGet<any>("INSERT INTO ar_payments (payment_number, payment_date, customer_id, customer_name, period_id, status, subtotal, total, notes, user_create, created_at, auto_created) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, CURRENT_TIMESTAMP, 1) RETURNING id", [
            paymentNumber, txDate, data.customerId ?? 1, custName, period.id,
            headerTotal, headerTotal,
            `Auto: ${custName || "POS"} - ${finalTransactionNumber}`,
            userId || null,
          ]);
          const paymentId = arPayment?.id;
          if (paymentId) {
            // Insert into ar_payment_items
            await rawRun("INSERT INTO ar_payment_items (payment_id, sale_id, invoice_number, due_amount, pay_amount, remarks, source_type, source_id) VALUES (?, ?, ?, ?, ?, ?, 'transaction', ?)", [
              paymentId, transactionId, finalTransactionNumber,
              headerTotal, headerTotal, null, transactionId,
            ]);
            // Insert into ar_payment_methods
            for (const p of paymentsClean) {
              const m = String(p.method).toLowerCase();
              let accountId = null;
              if (m === "cash" || m === "tunai") {
                const mapping = await rawGet<any>("SELECT account_id FROM account_mappings WHERE map_group = 'pelanggan' AND map_key = 'default_cash_account'");
                accountId = mapping?.account_id ?? null;
                if (!accountId) {
                  const cashAcc = await rawGet<any>("SELECT id FROM accounts WHERE is_cash = 1 AND is_active = 1 ORDER BY code LIMIT 1");
                  accountId = cashAcc?.id ?? null;
                }
              } else if (p.bankId) {
                const bank = await rawGet<any>("SELECT account_id FROM master_banks WHERE id = ? AND account_id IS NOT NULL", [p.bankId]);
                accountId = bank?.account_id ?? null;
                if (!accountId) {
                  const bankAcc = await rawGet<any>("SELECT id FROM accounts WHERE is_bank_account = 1 AND is_active = 1 ORDER BY code LIMIT 1");
                  accountId = bankAcc?.id ?? null;
                }
              } else {
                const bankAcc = await rawGet<any>("SELECT id FROM accounts WHERE is_bank_account = 1 AND is_active = 1 ORDER BY code LIMIT 1");
                accountId = bankAcc?.id ?? null;
              }
              let accountCode = null, accountName = null;
              if (accountId) {
                const acc = await rawGet<any>("SELECT code, name FROM accounts WHERE id = ?", [accountId]);
                if (acc) { accountCode = acc.code; accountName = acc.name; }
              }
              await rawRun("INSERT INTO ar_payment_methods (payment_id, account_id, account_code, account_name, amount, notes) VALUES (?, ?, ?, ?, ?, ?)", [
                paymentId, accountId, accountCode, accountName, p.amount, null,
              ]);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Transactions] gagal auto-create AR Payment:", e instanceof Error ? e.message : e);
    }

    try {
      const restoTempId = Number(data.restoTempId || 0) || 0;
      if (restoTempId) {
        await rawRun("UPDATE transactions SET resto_temp_id = ? WHERE id = ?", [
          restoTempId,
          transactionId,
        ]);
        await rawRun(
          "UPDATE resto_temp_orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [restoTempId],
        );
      }
    } catch (e) {
      console.warn(
        "[Transactions] gagal meng-update relasi resto_temp_orders:",
        e,
      );
    }

    try {
      if (data.Nm_cust) {
        await rawRun("UPDATE transactions SET Nm_cust = ? WHERE id = ?", [
          data.Nm_cust,
          transactionId,
        ]);
      }
    } catch (e) {
      console.warn("[Transactions] failed to update Nm_cust:", e);
    }

    let salesId = Number(data.salesId) || null;
    let salesName: string | null = String(data.salesName || "");
    let salesEmail: string | null = String(data.salesEmail || "");

    try {
      const txEntries = await generateSaleEntries({
        transactionId,
        transactionNumber: finalTransactionNumber,
        entryDate: txDate,
        total: headerTotal,
        subtotal: headerSubtotal,
        discountAmount: totalDiscount,
        ppnAmount: headerPPN,
        serviceChargeAmount: headerServiceAmount,
        customerId: Number(data.customerId) || null,
      });
      if (txEntries.length > 0) {
        const srcType = isReturn ? "Retur Penjualan" : "Penjualan";
        await saveJournalEntriesForSource(
          srcType,
          transactionId,
          finalTransactionNumber,
          txDate,
          txEntries,
        );
      }
      // Simpan auto-generated Terima Piutang entries jika ada payment methods
      try {
        const arEntries = await generateEntriesForSingleSource('Terima Piutang', finalTransactionNumber, txDate)
        if (arEntries.length > 0) {
          await saveJournalEntriesForSource('Terima Piutang', transactionId, finalTransactionNumber, txDate, arEntries)
        }
      } catch (e) {
        console.warn("[Transactions] failed to save AR payment journal entries:", e)
      }
    } catch (e) {
      console.warn("[Transactions] failed to save journal entries:", e);
    }

    (pool as any).query = origPoolQuery;

    const txElapsed = Date.now() - queryStartTime;
    const rawCumulative = rawTimings.reduce((s, q) => s + q.ms, 0);
    console.log(
      `[TIMING] rawQueries=${rawQueryCount} txQueries=${queryCount} wall=${txElapsed}ms rawCumulative=${rawCumulative}ms`,
    );
    if (rawTimings.length > 0) {
      const groups = new Map<string, { count: number; total: number }>();
      for (const q of rawTimings) {
        const key = q.sql
          .replace(/\s+/g, " ")
          .replace(/IN \([\s\S]*?\)/g, "IN (...)")
          .replace(/= \$?\d+/g, "= ?")
          .replace(/'[^']*'/g, "'?'");
        const g = groups.get(key) || { count: 0, total: 0 };
        g.count++;
        g.total += q.ms;
        groups.set(key, g);
      }
      const sorted = [...groups.entries()].sort(
        (a, b) => b[1].total - a[1].total,
      );
      console.log("[TIMING] Raw queries by group:");
      sorted.forEach(([sql, { count, total }], i) =>
        console.log(
          `  ${i + 1}. ${count}x ${total}ms avg=${Math.round(total / count)}ms — ${sql}`,
        ),
      );
    }

    return NextResponse.json({
      success: true,
      transactionId,
      transactionNumber: finalTransactionNumber,
      sales_id: salesId,
      sales_name: salesName,
      sales_email: salesEmail,
      message: "Transaction created successfully",
    });
  } catch (error: any) {
    (pool as any).query = origPoolQuery;
    if (txClient) {
      try { await txClient.query("ROLLBACK"); } catch {}
      try { txClient.release(); } catch {}
    }
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      {
        error: "Failed to create transaction",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
