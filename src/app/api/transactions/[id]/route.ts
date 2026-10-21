import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { rawAll, rawGet, rawRun, withTransaction } from "@/db/raw";
import { getUserId } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { getAllowBackdate } from "@/lib/settingsHelper";
import { getPeriodByDate } from "@/lib/period";
import { getStockAllowNegative } from "@/lib/stockValidation";
import {
  calculateTieredDiscount,
  allocateHeaderDiscountProportional,
  calculatePpn,
  roundRp,
} from "@/lib/discountUtils";
import {
  generateEntriesForSingleSource,
  saveJournalEntriesForSource,
  deleteJournalEntriesForSource,
} from "@/lib/journalHelpers";
import { findTransactionItems } from "@/lib/repositories/transactionRepository";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const canViewTransaksi = hasPermission(_req as any, "transaksi", "view");
    const canViewSalesList = hasPermission(_req as any, "sales_list", "view");
    if (!canViewTransaksi && !canViewSalesList) {
      return NextResponse.json(
        { error: "Forbidden: tidak punya akses melihat transaksi" },
        { status: 403 },
      );
    }
    const db = getDb();
    const raw = params.id;
    const id = parseInt(raw);

    let tx = null as any;
    if (!isNaN(id)) {
      tx = await rawGet<any>(
        `SELECT t.*, c.name as customer_name, c.code as customer_code, s.name as sales_name, s.code as sales_code, w.code as warehouse_code, w.name as warehouse_name, so.so_number as so_number
         FROM transactions t
         LEFT JOIN master_customer c ON c.id = t.customer_id
         LEFT JOIN master_sales s ON s.id = t.sales_id
         LEFT JOIN master_gudang w ON w.id = t.warehouse_id
         LEFT JOIN sales_order so ON so.id = t.so_id
         WHERE t.id = ?`, [id]);
    }

    if (!tx) {
      tx = await rawGet<any>(
        `SELECT t.*, c.name as customer_name, c.code as customer_code, s.name as sales_name, s.code as sales_code, w.code as warehouse_code, w.name as warehouse_name, so.so_number as so_number
         FROM transactions t
         LEFT JOIN master_customer c ON c.id = t.customer_id
         LEFT JOIN master_sales s ON s.id = t.sales_id
         LEFT JOIN master_gudang w ON w.id = t.warehouse_id
         LEFT JOIN sales_order so ON so.id = t.so_id
         WHERE t.transaction_number = ?`,
        [raw],
      );
    }

    if (!tx)
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );

    let items = [] as any[];
    try {
      const itemsRaw = await findTransactionItems(tx.id);
      items = itemsRaw.map((it: any) => ({
        id: it.id,
        barang_id: it.barangId,
        barang_code: it.barangCode,
        barang_name: it.barangName,
        quantity: it.quantity,
        unit_name: it.unitName,
        unit_ratio: Number(it.unitRatio || 1) || 1,
        unit_price: Number(it.unitPrice ?? 0),
        unit_price_include_tax: Number(it.unitPriceIncludeTax ?? 0),
        discount_percent: Number(it.discountPercent ?? 0),
        discount_amount: Number(it.discountAmount ?? 0),
        discon_total: Number(it.disconTotal ?? it.discountAmount ?? 0),
        total_price: Number(
          it.totalPrice ?? (it.quantity ?? 0) * (it.unitPrice ?? 0),
        ),
        disc1_percent: Number(it.disc1Percent ?? 0),
        disc1_amount: Number(it.disc1Amount ?? 0),
        disc2_percent: Number(it.disc2Percent ?? 0),
        disc2_amount: Number(it.disc2Amount ?? 0),
        disc3_percent: Number(it.disc3Percent ?? 0),
        disc3_amount: Number(it.disc3Amount ?? 0),
        disc_nominal: Number(it.discNominal ?? 0),
        gross_amount: Number(it.grossAmount ?? 0),
        net_amount: Number(it.netAmount ?? 0),
      }));
    } catch (itemErr: any) {
      console.error("Error fetching items:", itemErr);
      items = [];
    }
    let cashierName: string | null = null;
    try {
      if (tx && tx.user_create != null) {
        const ms = await rawGet<any>(
          "SELECT name FROM master_sales WHERE COALESCE(isdelete,0)=0 AND COALESCE(aktif,1)=1 AND user_id = ? LIMIT 1",
          [tx.user_create],
        );
        if (ms && ms.name) cashierName = String(ms.name);
      }
      if (!cashierName) {
        const u = await rawGet<any>("SELECT name FROM users WHERE id = ?", [
          tx.user_create,
        ]);
        if (u && u.name) cashierName = String(u.name);
      }
    } catch {}

    const paidRow = await rawGet<any>(
      `SELECT COALESCE(SUM(ai.pay_amount), 0) AS paid
       FROM ar_payment_items ai
       JOIN ar_payments ap ON ap.id = ai.payment_id AND ap.status <> 'void'
       WHERE (ai.sale_id = ? OR (ai.source_type = 'transaction' AND ai.source_id = ?))`,
      [id, id],
    );
    const paidAmt = Number(paidRow?.paid || 0);
    const txTotal = Number((tx.total ?? tx.grand_total) || 0);
    const payment_status =
      Number(tx.void) === 1
        ? "Void"
        : Number(tx.transaction_type) <= 2
          ? "Lunas"
          : paidAmt === 0
            ? "Belum Bayar"
            : paidAmt + 0.0001 < txTotal
              ? "Belum Lunas"
              : "Lunas";

    const mapped = {
      id: tx.id,
      transaction_number: tx.transaction_number,
      transaction_date: tx.transaction_date ?? tx.created_at,
      customer_id: tx.customer_id ?? null,
      customer_name: tx.customer_name ?? null,
      customer_code: tx.customer_code ?? null,
      sales_id: tx.sales_id ?? null,
      sales_name: tx.sales_name ?? null,
      sales_code: tx.sales_code ?? null,
      reference_transaction_id: tx.reference_transaction_id ?? null,
      invoice_id: tx.invoice_id ?? null,
      so_id: tx.so_id ?? null,
      so_number: tx.so_number ?? null,
      warehouse_id: tx.warehouse_id ?? null,
      warehouse_code: tx.warehouse_code ?? null,
      warehouse_name: tx.warehouse_name ?? null,
      subtotal: Number(tx.subtotal || 0),
      discount_percent: Number(tx.discount_percent || 0),
      discount_amount: Number(tx.discount_amount || 0),
      ppn_percent: Number(
        (tx.ppn_percent ?? tx.tax_percent ?? tx.tax_rate_percent) || 0,
      ),
      ppn_amount: Number((tx.ppn_amount ?? tx.tax_amount) || 0),
      service_charge_percent: Number(tx.service_charge_percent || 0),
      service_charge_amount: Number(tx.service_charge_amount || 0),
      total: Number((tx.total ?? tx.grand_total) || 0),
      price_include_tax: Number(tx.price_include_tax ?? 0),
      tax_rate_percent: Number(tx.tax_rate_percent ?? tx.ppn_percent ?? 0),
      payment_method: tx.payment_method ?? "cash",
      payment_amount: Number((tx.payment_amount ?? tx.paid_amount) || 0),
      change_amount: Number(tx.change_amount || 0),
      void: Number(tx.void || 0),
      status: tx.status ?? (tx.void === 1 ? "void" : "completed"),
      payment_status,
      due_date: tx.due_date ?? null,
      notes: tx.notes ?? null,
      created_at: tx.created_at,
      cashier_name: cashierName,
      table_id: tx.table_id ?? null,
      items,
    };

    return NextResponse.json(mapped);
  } catch (err: any) {
    console.error("GET /api/transactions/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch transaction", details: err.message },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!hasPermission(request as any, "transaksi", "edit")) {
      return NextResponse.json(
        { error: "Forbidden: tidak punya akses mengubah transaksi" },
        { status: 403 },
      );
    }
    const db = getDb();
    const pool = (db as any).$client;
    const id = Number(params.id);
    if (!id || isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid transaction id" },
        { status: 400 },
      );
    }

    const data = await request.json();

    const existingTx = await rawGet<any>(
      "SELECT id, transaction_date, period_id FROM transactions WHERE id = ?",
      [id],
    );
    if (existingTx) {
      const currentPeriod = existingTx.period_id
        ? await rawGet<any>(
            "SELECT id, name, is_closed, status_buku FROM master_periode WHERE id = ? AND isdelete = 0",
            [existingTx.period_id],
          )
        : null;
      if (currentPeriod) {
        const closed = currentPeriod?.status_buku
          ? String(currentPeriod.status_buku).toUpperCase() === "CLOSED"
            ? 1
            : 0
          : Number(currentPeriod.is_closed);
        if (closed === 1) {
          return NextResponse.json(
            {
              error: `Periode '${currentPeriod.name}' sudah ditutup, tidak dapat mengedit transaksi.`,
            },
            { status: 400 },
          );
        }
      }
    }
    if (data.transactionDate) {
      const newDate = String(data.transactionDate).slice(0, 10);
      const newPeriod = await getPeriodByDate(newDate);
      if (!newPeriod) {
        return NextResponse.json(
          {
            error: `Periode belum ada untuk tanggal ${newDate}.`,
            code: "PERIOD_NOT_FOUND",
          },
          { status: 400 },
        );
      }
      if (Number(newPeriod.is_closed) === 1) {
        return NextResponse.json(
          {
            error: `Periode '${newPeriod.name}' sudah ditutup.`,
            code: "PERIOD_CLOSED",
          },
          { status: 400 },
        );
      }
    }

    try {
      await rawRun(
        "CREATE TABLE IF NOT EXISTS ar_payments (id SERIAL PRIMARY KEY, status TEXT DEFAULT 'active')",
      );
      await rawRun(
        "CREATE TABLE IF NOT EXISTS ar_payment_items (id SERIAL PRIMARY KEY, payment_id INTEGER NOT NULL, sale_id INTEGER NOT NULL, pay_amount REAL DEFAULT 0)",
      );
      const paidRow = await rawGet<any>(
        `
        SELECT COALESCE(SUM(ai.pay_amount),0) AS paid
        FROM ar_payment_items ai
        JOIN ar_payments ap ON ap.id = ai.payment_id AND ap.status <> 'void'
        WHERE ai.sale_id = ?
      `,
        [id],
      );
      if (Number(paidRow?.paid || 0) > 0) {
        return NextResponse.json(
          { error: "Penjualan yang sudah dibayarkan tidak dapat diedit" },
          { status: 400 },
        );
      }
    } catch {}
    try {
      await rawRun("ALTER TABLE transactions ADD COLUMN faktur_pajak TEXT");
    } catch {}

    const canBackdate =
      getAllowBackdate(db) ||
      hasPermission(request as any, "transaksi", "backdate");
    const payload: Record<string, any> = {
      customer_id: data.customerId ?? null,
      tgl_nota:
        canBackdate && (data.transactionDate || null)
          ? String(data.transactionDate).slice(0, 10)
          : null,
      transaction_date:
        canBackdate && (data.transactionDate || null)
          ? String(data.transactionDate).slice(0, 10)
          : null,
      due_date: data.dueDate ?? null,
      payment_terms: data.paymentTerms ?? null,
      notes: data.notes ?? null,
      discount_percent: data.discountPercent ?? null,
      discount_amount: data.discountAmount ?? null,
      ppn_percent: data.ppnPercent ?? null,
      ppn_amount: data.ppnAmount ?? null,
      subtotal: data.subtotal ?? null,
      total: data.total ?? null,
      status: data.status ?? null,
      sales_id: data.salesId ?? null,
      warehouse_id: data.warehouseId ?? null,
      faktur_pajak: data.fakturPajak ?? null,
    };

    const userId = getUserId(request);
    const sets: string[] = [];
    const values: any[] = [];
    Object.entries(payload).forEach(([key, val]) => {
      if (val !== null && val !== undefined) {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    });
    sets.push("user_edit = ?");
    values.push(userId);

    const oldTx = await rawGet<any>(
      "SELECT warehouse_id, COALESCE(is_return,0) as is_return, tgl_nota, period_id, transaction_date FROM transactions WHERE id = ?",
      [id],
    );
    const oldWarehouseId = Number(oldTx?.warehouse_id) || 1;
    const isReturn = Number(oldTx?.is_return || 0) === 1;
    const oldMovements = await rawAll<any>(
      "SELECT * FROM stock_movements WHERE reference_type IN ('sale','sale_return') AND reference_id = ?",
      [id],
    );
    const allowNegative = await getStockAllowNegative(pool);
    const txDate = data.transactionDate
      ? String(data.transactionDate).slice(0, 10)
      : oldTx?.tgl_nota || oldTx?.transaction_date || new Date().toISOString().slice(0, 10);
    const periodId = oldTx?.period_id || 3;

    await withTransaction(async (query) => {
      if (sets.length > 0) {
        const sql = `UPDATE transactions SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        values.push(id);
        const result = await query(sql, values);
        if (result.rowCount === 0) {
          throw new Error("Transaction not found");
        }
      }

      // --- STOCK: revert old movements ---
      for (const mov of oldMovements) {
        const revertQty = Number(mov.quantity) || 0;
        if (revertQty === 0) continue;
        if (mov.movement_type === "out") {
          await query(
            "UPDATE stock_balance SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND warehouse_id = ?",
            [revertQty, mov.ingredient_id, mov.warehouse_id],
          );
        } else if (mov.movement_type === "in") {
          await query(
            "UPDATE stock_balance SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND warehouse_id = ?",
            [revertQty, mov.ingredient_id, mov.warehouse_id],
          );
        }
      }
      await query(
        "DELETE FROM stock_movements WHERE reference_type IN ('sale','sale_return') AND reference_id = ?",
        [id],
      );

      if (Array.isArray(data.items) && data.items.length > 0) {
        try {
          const canEditPrice = hasPermission(
            request as any,
            "invoice",
            "edit_price",
          );
          if (!canEditPrice) {
            data.items = data.items.map((it: any) => {
              // Will be resolved per-item below
              return it;
            });
            for (let i = 0; i < data.items.length; i++) {
              const it = data.items[i];
              const refRow = await rawGet<any>(
                "SELECT price FROM barang_prices WHERE barang_id = ? ORDER BY id LIMIT 1",
                [Number(it.barangId)],
              );
              if (refRow && refRow.price != null)
                data.items[i] = { ...it, unitPrice: Number(refRow.price) };
            }
          }
        } catch {}
        await query("DELETE FROM transaction_items WHERE transaction_id = ?", [
          id,
        ]);
        for (const it of data.items) {
          const includeTax =
            it.unitPriceIncludeTax !== undefined
              ? Number(it.unitPriceIncludeTax)
              : null;
          const qty = Number(it.quantity) || 0;
          const price = Number(it.unitPrice) || 0;
          const d1Pct = Number(it.disc1Percent ?? 0) || 0;
          const d2Pct = Number(it.disc2Percent ?? 0) || 0;
          const d3Pct = Number(it.disc3Percent ?? 0) || 0;
          const discNominal = Number(it.discNominal ?? 0) || 0;
          const discPct = Number(it.discountPercent ?? 0) || 0;
          const tr = calculateTieredDiscount(
            qty,
            price,
            discPct,
            d1Pct,
            d2Pct,
            d3Pct,
            discNominal,
          );
          await query(
            `
            INSERT INTO transaction_items (
              transaction_id, barang_id, barang_code, barang_name, quantity, unit_name, unit_ratio,
              unit_price, discount_percent, discount_amount, discon_total,
              disc1_percent, disc1_amount, disc2_percent, disc2_amount, disc3_percent, disc3_amount,
              gross_amount, net_amount,
              total_price,
              unit_price_include_tax, modifier, paket_id,
              disc_nominal, bonus_barang_id, bonus_name, bonus_qty, bonus_unit, bonus_unit_ratio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              id,
              it.barangId ?? null,
              it.barangCode ?? "",
              it.barangName ?? "",
              it.quantity ?? 0,
              it.unitName ?? "",
              it.unitRatio ?? 1,
              it.unitPrice ?? 0,
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
              it.totalPrice ?? (it.quantity || 0) * (it.unitPrice || 0),
              includeTax,
              it.modifier ?? null,
              it.paketId ?? null,
              it.discNominal ?? 0,
              it.bonusBarangId ?? null,
              it.bonusName ?? null,
              Number(it.bonusQty ?? 0) || 0,
              it.bonusUnit ?? null,
              Number(it.bonusUnitRatio ?? 0) || null,
            ],
          );

          // --- STOCK: re-create movements for new items ---
          const barangId = it.barangId ?? null;
          if (!barangId) continue;
          const qtySold = Number(it.quantity) || 0;
          const unitRatio = Number(it.unitRatio) || 1;
          const usedBase = qtySold * unitRatio;
          if (usedBase === 0) continue;
          const movementType = isReturn ? "in" : "out";
          const refType = isReturn ? "sale_return" : "sale";
          const newWarehouseId = data.warehouseId ?? oldWarehouseId;

          const barangRows: any[] = await query(
            "SELECT jenis, code, name FROM master_barang WHERE id = ? AND COALESCE(isdelete,0)=0",
            [barangId],
          );
          const brg = barangRows?.[0];
          const barangCode = brg?.code || it.barangCode || "";
          const barangName = brg?.name || it.barangName || "";
          const jenis = Number(brg?.jenis || 0);
          const isEligible = jenis === 1 || jenis === 2 || jenis === 3;

          const paketComponents: any[] = it.paketId
            ? await query(
                "SELECT pi.*, mb.jenis, mb.code as barang_code, mb.name as barang_name FROM paket_items pi LEFT JOIN master_barang mb ON mb.id = pi.barang_id WHERE pi.paket_id = ?",
                [it.paketId],
              )
            : [];

          if (paketComponents.length > 0) {
            for (const pc of paketComponents) {
              const perUnit = Number(pc.quantity) || 0;
              const used = perUnit * qtySold;
              if (used === 0) continue;
              const sbRows2: any[] = await query(
                "SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ? FOR UPDATE",
                [pc.barang_id, newWarehouseId],
              );
              const sb2 = sbRows2?.[0] || {
                quantity: 0,
                avg_cost: 0,
                total_cost: 0,
              };
              const prevQty2 = Number(sb2.quantity) || 0;
              if (!isReturn && !allowNegative && prevQty2 < used) {
                const pcName = pc.barang_name || `#${pc.barang_id}`;
                throw new Error(
                  `Stok ${pcName} tidak cukup untuk paket. Tersedia: ${prevQty2}, Dibutuhkan: ${used}`,
                );
              }
              const pcJenis = Number(pc.jenis || 0);
              const pcIsEligible =
                pcJenis === 1 || pcJenis === 2 || pcJenis === 3;
              const prevAvg2 = Number(sb2.avg_cost) || 0;
              const dQty2 = isReturn ? used : -used;
              const dCost2 = pcIsEligible
                ? isReturn
                  ? prevAvg2 * used
                  : -(prevAvg2 * used)
                : 0;
              const newQty2 =
                (Number(sb2.quantity) || 0) + dQty2;
              const newTotal2 =
                (Number(sb2.total_cost) || 0) + dCost2;
              const newAvg2 = newQty2 > 0 ? newTotal2 / newQty2 : 0;
              await query(
                `INSERT INTO stock_movements (ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, transaction_date, notes, unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  pc.barang_id,
                  newWarehouseId,
                  movementType,
                  used,
                  "unit",
                  refType,
                  id,
                  periodId,
                  txDate,
                  `Paket ${it.paketName || ""} - ${pc.barang_code} x${used}`,
                  pcIsEligible ? prevAvg2 : null,
                  pcIsEligible ? prevAvg2 * used : null,
                  newQty2,
                  newTotal2,
                  newAvg2,
                ],
              );
              const existing2: any[] = await query(
                "SELECT id FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ?",
                [pc.barang_id, newWarehouseId],
              );
              if (existing2.length > 0) {
                await query(
                  "UPDATE stock_balance SET quantity = ?, avg_cost = ?, total_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND warehouse_id = ?",
                  [newQty2, newAvg2, newTotal2, pc.barang_id, newWarehouseId],
                );
              } else {
                await query(
                  "INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, avg_cost, total_cost) VALUES (?, ?, ?, ?, ?)",
                  [pc.barang_id, newWarehouseId, newQty2, newAvg2, newTotal2],
                );
              }
            }
          } else {
            const unitsRows: any[] = await query(
              "SELECT name, ratio FROM barang_units WHERE barang_id = ? ORDER BY ratio ASC",
              [barangId],
            );
            const baseUnitName =
              unitsRows?.[0]?.name || it.unitName || "unit";
            const sbRows3: any[] = await query(
              "SELECT quantity, avg_cost, total_cost FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ? FOR UPDATE",
              [barangId, newWarehouseId],
            );
            const sb3 = sbRows3?.[0] || {
              quantity: 0,
              avg_cost: 0,
              total_cost: 0,
            };
            const prevQty3 = Number(sb3.quantity) || 0;
            if (!isReturn && !allowNegative && prevQty3 < usedBase) {
              throw new Error(
                `Stok ${barangName} tidak cukup. Tersedia: ${prevQty3}, Dibutuhkan: ${usedBase}`,
              );
            }
            const prevAvg3 = Number(sb3.avg_cost) || 0;
            const dQty3 = isReturn ? usedBase : -usedBase;
            const dCost3 = isEligible
              ? isReturn
                ? prevAvg3 * usedBase
                : -(prevAvg3 * usedBase)
              : 0;
            const newQty3 = (Number(sb3.quantity) || 0) + dQty3;
            const newTotal3 = (Number(sb3.total_cost) || 0) + dCost3;
            const newAvg3 = newQty3 > 0 ? newTotal3 / newQty3 : 0;
            await query(
              `INSERT INTO stock_movements (ingredient_id, warehouse_id, movement_type, quantity, unit, reference_type, reference_id, period_id, transaction_date, notes, unit_cost, total_cost, balance_qty, balance_cost, balance_avg_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                barangId,
                newWarehouseId,
                movementType,
                usedBase,
                baseUnitName,
                refType,
                id,
                periodId,
                txDate,
                `${isReturn ? "Retur" : "Penjualan"} ${barangCode} x${qtySold} (${it.unitName || baseUnitName})`,
                isEligible ? prevAvg3 : null,
                isEligible ? prevAvg3 * usedBase : null,
                newQty3,
                newTotal3,
                newAvg3,
              ],
            );
            const existing3: any[] = await query(
              "SELECT id FROM stock_balance WHERE ingredient_id = ? AND warehouse_id = ?",
              [barangId, newWarehouseId],
            );
            if (existing3.length > 0) {
              await query(
                "UPDATE stock_balance SET quantity = ?, avg_cost = ?, total_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND warehouse_id = ?",
                [newQty3, newAvg3, newTotal3, barangId, newWarehouseId],
              );
            } else {
              await query(
                "INSERT INTO stock_balance (ingredient_id, warehouse_id, quantity, avg_cost, total_cost) VALUES (?, ?, ?, ?, ?)",
                [barangId, newWarehouseId, newQty3, newAvg3, newTotal3],
              );
            }
          }
        }
      }
    });

    const items =
      Array.isArray(data.items) && data.items.length > 0
        ? data.items
        : await rawAll<any>(
            `
          SELECT quantity as quantity, unit_price as unitPrice,
            COALESCE(disc1_percent, 0) as disc1Percent,
            COALESCE(disc2_percent, 0) as disc2Percent,
            COALESCE(disc3_percent, 0) as disc3Percent,
            COALESCE(disc_nominal, 0) as discNominal
          FROM transaction_items WHERE transaction_id = ?
        `,
            [id],
          );

    const existing = await rawGet<any>(
      "SELECT * FROM transactions WHERE id = ?",
      [id],
    );

    let dppSubtotal = 0;
    let itemsTotalItemDisc = 0;
    for (const it of items as any[]) {
      const qty = Number(it.quantity || 0);
      const unitPrice = Number(it.unitPrice || 0);
      const disc1Pct = Number(it.disc1Percent ?? 0) || 0;
      const disc2Pct = Number(it.disc2Percent ?? 0) || 0;
      const disc3Pct = Number(it.disc3Percent ?? 0) || 0;
      const discNominal = Number(it.discNominal ?? 0) || 0;
      const discPct = Number(it.discountPercent ?? 0) || 0;
      const tr = calculateTieredDiscount(
        qty,
        unitPrice,
        discPct,
        disc1Pct,
        disc2Pct,
        disc3Pct,
        discNominal,
      );
      dppSubtotal += tr.netAmount;
      itemsTotalItemDisc += tr.totalDiscount;
    }
    dppSubtotal = roundRp(Math.max(0, dppSubtotal));

    const headerDiscPct = Number(
      (data.discountPercent ?? existing?.discount_percent) || 0,
    );
    const headerDiscAmtInput = Number(
      (data.discountAmount ?? existing?.discount_amount) || 0,
    );
    const headerDiscount =
      headerDiscAmtInput > 0
        ? roundRp(headerDiscAmtInput)
        : roundRp((dppSubtotal * Math.max(0, headerDiscPct)) / 100);
    const totalDiscount = roundRp(itemsTotalItemDisc + headerDiscount);
    const svcPct = Number(
      (data.serviceChargePercent ?? existing?.service_charge_percent) || 0,
    );
    const dppAfterDisc = Math.max(0, dppSubtotal - headerDiscount);
    const serviceAmount = roundRp((dppAfterDisc * Math.max(0, svcPct)) / 100);
    const ppnPercent = Number(
      (data.ppnPercent ??
        existing?.ppn_percent ??
        existing?.tax_rate_percent ??
        existing?.tax_percent) ||
        0,
    );
    const ppnResult = calculatePpn(dppAfterDisc, ppnPercent, false);
    const ppnAmount = ppnResult.ppnAmount;
    const total = ppnResult.grandTotal + serviceAmount;

    const cols = await rawAll<any>(
      "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'transactions'",
    );
    const colNames = new Set(cols.map((c) => String(c.name)));
    const setParts: string[] = [];
    const setVals: any[] = [];
    if (colNames.has("subtotal")) {
      setParts.push("subtotal = ?");
      setVals.push(dppSubtotal);
    }
    if (colNames.has("discount_percent")) {
      setParts.push("discount_percent = ?");
      setVals.push(headerDiscPct);
    }
    if (colNames.has("discount_amount")) {
      setParts.push("discount_amount = ?");
      setVals.push(headerDiscount);
    }
    if (colNames.has("total_discount")) {
      setParts.push("total_discount = ?");
      setVals.push(totalDiscount);
    }
    if (colNames.has("service_charge_percent")) {
      setParts.push("service_charge_percent = ?");
      setVals.push(svcPct);
    }
    if (colNames.has("service_charge_amount")) {
      setParts.push("service_charge_amount = ?");
      setVals.push(serviceAmount);
    }
    if (colNames.has("ppn_percent")) {
      setParts.push("ppn_percent = ?");
      setVals.push(ppnPercent);
    } else if (colNames.has("tax_rate_percent")) {
      setParts.push("tax_rate_percent = ?");
      setVals.push(ppnPercent);
    } else if (colNames.has("tax_percent")) {
      setParts.push("tax_percent = ?");
      setVals.push(ppnPercent);
    }
    if (colNames.has("ppn_amount")) {
      setParts.push("ppn_amount = ?");
      setVals.push(ppnAmount);
    } else if (colNames.has("tax_amount")) {
      setParts.push("tax_amount = ?");
      setVals.push(ppnAmount);
    }
    if (colNames.has("total")) {
      setParts.push("total = ?");
      setVals.push(total);
    }

    setParts.push("updated_at = CURRENT_TIMESTAMP");
    const updSql = `UPDATE transactions SET ${setParts.join(", ")} WHERE id = ?`;
    setVals.push(id);
    await rawRun(updSql, setVals);

    try {
      const editTx = await rawGet<any>(
        "SELECT id, transaction_number, tgl_nota, is_return FROM transactions WHERE id = ?",
        [id],
      );
      if (editTx) {
        const srcType =
          Number(editTx.is_return) === 1 ? "Retur Penjualan" : "Penjualan";
        deleteJournalEntriesForSource("Penjualan", id);
        const entries = await generateEntriesForSingleSource(
          "Penjualan",
          editTx.transaction_number || "",
          editTx.tgl_nota || "",
        );
        if (entries.length > 0) {
          await saveJournalEntriesForSource(
            "Penjualan",
            id,
            editTx.transaction_number || "",
            editTx.tgl_nota || "",
            entries,
          );
        }
        deleteJournalEntriesForSource("Terima Piutang", id);
        const arEntries = await generateEntriesForSingleSource(
          "Terima Piutang",
          editTx.transaction_number || "",
          editTx.tgl_nota || "",
        );
        if (arEntries.length > 0) {
          await saveJournalEntriesForSource(
            "Terima Piutang",
            id,
            editTx.transaction_number || "",
            editTx.tgl_nota || "",
            arEntries,
          );
        }
      }
    } catch (e) {
      console.warn("[Transaction Edit] failed to save journal entries:", e);
    }

    const updated = await rawGet<any>(
      "SELECT * FROM transactions WHERE id = ?",
      [id],
    );
    const itemsOut = await rawAll<any>(
      "SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id ASC",
      [id],
    );
    return NextResponse.json({ ...updated, items: itemsOut });
  } catch (err: any) {
    console.error("PUT /api/transactions/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update transaction", details: err.message },
      { status: 500 },
    );
  }
}
