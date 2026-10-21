import { NextRequest, NextResponse } from "next/server";
import { rawAll, rawGet, rawRun } from "@/db/raw";
import { getDb } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { getPeriodByDate } from "@/lib/period";
import { getUserId } from "@/lib/audit";
import {
  generateEntriesForSingleSource,
  saveJournalEntriesForSource,
  deleteJournalEntriesForSource,
} from "@/lib/journalHelpers";

const pool = (getDb() as any).$client;

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS memorial_journals (
      id SERIAL PRIMARY KEY,
      journal_number TEXT NOT NULL,
      journal_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      total_debit REAL NOT NULL DEFAULT 0,
      total_credit REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      user_create INTEGER,
      user_update INTEGER,
      CONSTRAINT uq_memorial_journals_number UNIQUE (journal_number)
    )
  `);
  await rawRun(
    "CREATE INDEX IF NOT EXISTS idx_mj_date ON memorial_journals (journal_date)",
  ).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS memorial_journal_details (
      id SERIAL PRIMARY KEY,
      memorial_journal_id INTEGER NOT NULL,
      line_no INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      account_code TEXT NOT NULL,
      notes TEXT DEFAULT '',
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (memorial_journal_id) REFERENCES memorial_journals(id) ON DELETE CASCADE
    )
  `);
  await rawRun(
    "CREATE INDEX IF NOT EXISTS idx_mjd_hdr ON memorial_journal_details (memorial_journal_id)",
  ).catch(() => {});
  await rawRun(
    "CREATE INDEX IF NOT EXISTS idx_mjd_acc ON memorial_journal_details (account_id)",
  ).catch(() => {});
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (
      !hasPermission(req as any, "keu_jurnal_memorial", "view") &&
      !hasPermission(req as any, "transaksi", "view")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await ensureTables();
    const id = Number(params.id);
    const hdr = await rawGet<any>(
      "SELECT id, journal_number, journal_date::text as journal_date, notes, total_debit, total_credit, status, created_at, updated_at, user_create, user_edit FROM memorial_journals WHERE id = $1",
      [id],
    );
    if (!hdr) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const det = await rawAll<any>(
      `
      SELECT 
        d.id,
        d.line_no,
        d.account_id,
        d.account_code,
        (SELECT name FROM accounts a WHERE a.id = d.account_id LIMIT 1) AS account_name,
        d.notes,
        d.debit,
        d.credit
      FROM memorial_journal_details d
      WHERE d.memorial_journal_id = $1
      ORDER BY d.line_no ASC
    `,
      [id],
    );

    return NextResponse.json({ ...hdr, detail: det });
  } catch (e) {
    console.error("GET /memorial-journals/[id] error", e);
    return NextResponse.json(
      { error: "Failed to fetch memorial journal" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (
      !hasPermission(req as any, "keu_jurnal_memorial", "edit") &&
      !hasPermission(req as any, "transaksi", "edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await ensureTables();
    const id = Number(params.id);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toLowerCase();

    const hdr = await rawGet<any>(
      "SELECT status FROM memorial_journals WHERE id = $1",
      [id],
    );
    if (!hdr) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "void") {
      if (String(hdr.status) === "void")
        return NextResponse.json({ id, status: "void" });
      const userId = getUserId(req);
      await rawRun(
        "UPDATE memorial_journals SET status = 'void', user_edit = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [userId || null, id],
      );
      try {
        deleteJournalEntriesForSource("Jurnal Memorial", id);
      } catch (e) {
        console.warn(
          "[Memorial Journal Void] failed to delete journal entries:",
          e,
        );
      }
      return NextResponse.json({ id, status: "void" });
    }

    if (String(hdr.status) === "void") {
      return NextResponse.json(
        { error: "Tidak dapat mengubah jurnal yang sudah void" },
        { status: 400 },
      );
    }

    const payload = body || {};
    const newJournalDate = payload.journal_date
      ? String(payload.journal_date).slice(0, 10)
      : null;

    const existingMj = await rawGet<any>(
      "SELECT journal_date FROM memorial_journals WHERE id = $1",
      [id],
    );
    const mjDate = newJournalDate || existingMj?.journal_date || "";
    const mjPeriod = await getPeriodByDate(mjDate);
    if (!mjPeriod) {
      return NextResponse.json(
        { error: `Periode belum ada untuk tanggal ${mjDate}.` },
        { status: 400 },
      );
    }
    if (Number(mjPeriod.is_closed) === 1) {
      return NextResponse.json(
        { error: `Periode '${mjPeriod.name}' sudah ditutup.` },
        { status: 400 },
      );
    }

    const journal_date = payload.journal_date
      ? String(payload.journal_date).slice(0, 10)
      : undefined;
    const notes =
      payload.notes !== undefined ? String(payload.notes || "") : undefined;
    const detail = Array.isArray(payload.detail) ? payload.detail : null;
    const userId = getUserId(req);

    await pool.query("BEGIN");
    try {
      if (journal_date !== undefined || notes !== undefined) {
        await rawRun(
          `
          UPDATE memorial_journals
          SET journal_date = COALESCE($1, journal_date), notes = COALESCE($2, notes), user_edit = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `,
          [journal_date, notes, userId || null, id],
        );
      }

      if (detail) {
        const normalized = detail.map((d: any) => ({
          account_id: Number(d.account_id || 0),
          account_code: String(d.account_code || ""),
          notes: String(d.notes || ""),
          debit: Math.max(0, Number(d.debit || 0)),
          credit: Math.max(0, Number(d.credit || 0)),
        }));

        for (const r of normalized) {
          if (!r.account_id || !r.account_code) {
            throw new Error("Invalid detail row");
          }
          const hasDebit = r.debit > 0;
          const hasCredit = r.credit > 0;
          if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
            throw new Error(
              "Set salah satu debit atau kredit pada setiap baris",
            );
          }
        }

        const total_debit = normalized.reduce(
          (a: number, b: any) => a + (Number(b.debit) || 0),
          0,
        );
        const total_credit = normalized.reduce(
          (a: number, b: any) => a + (Number(b.credit) || 0),
          0,
        );

        if (
          total_debit <= 0 ||
          total_credit <= 0 ||
          Math.abs(total_debit - total_credit) > 0.0001
        ) {
          throw new Error("Total debit dan kredit harus balance");
        }

        await rawRun(
          `UPDATE memorial_journals SET total_debit = $1, total_credit = $2, user_edit = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
          [total_debit, total_credit, userId || null, id],
        );
        await rawRun(
          "DELETE FROM memorial_journal_details WHERE memorial_journal_id = $1",
          [id],
        );

        for (let idx = 0; idx < normalized.length; idx++) {
          const d = normalized[idx];
          await rawRun(
            `
            INSERT INTO memorial_journal_details (
              memorial_journal_id, line_no, account_id, account_code, notes, debit, credit, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
            [
              id,
              idx + 1,
              d.account_id,
              d.account_code,
              d.notes,
              d.debit,
              d.credit,
            ],
          );
        }
      }

      const out = await rawGet<any>(
        "SELECT id, journal_number, journal_date::text as journal_date, notes, total_debit, total_credit, status, created_at, updated_at, user_create, user_edit FROM memorial_journals WHERE id = $1",
        [id],
      );

      await pool.query("COMMIT");

      // Re-generate journal entries for edited memorial journal
      try {
        const mjRow = out;
        if (mjRow) {
          deleteJournalEntriesForSource("Jurnal Memorial", id);
          const entries = await generateEntriesForSingleSource(
            "Jurnal Memorial",
            mjRow.journal_number || "",
            mjRow.journal_date || "",
          );
          if (entries.length > 0) {
            await saveJournalEntriesForSource(
              "Jurnal Memorial",
              id,
              mjRow.journal_number || "",
              mjRow.journal_date || "",
              entries,
            );
          }
        }
      } catch (e) {
        console.warn(
          "[Memorial Journal Edit] failed to save journal entries:",
          e,
        );
      }

      return NextResponse.json(out);
    } catch (e) {
      await pool.query("ROLLBACK");
      throw e;
    }
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (
      msg &&
      (msg.includes("balance") ||
        msg.includes("debit") ||
        msg.includes("kredit") ||
        msg.includes("detail"))
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("PATCH /memorial-journals/[id] error", e);
    return NextResponse.json(
      { error: "Failed to update memorial journal" },
      { status: 500 },
    );
  }
}
