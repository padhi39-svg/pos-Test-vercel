"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { SYSTEM_MENUS } from "@/lib/menus";

type MenuNode = { name: string; path: string };

export default function HeaderMenu({ onMenuToggle, onToggleNavbar, logoUrl: initialLogoUrl }: { onMenuToggle?: () => void; onToggleNavbar?: () => void; logoUrl?: string }) {
  const pathname = usePathname();
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>(initialLogoUrl || "");
  const [appTitle] = useState<string>("Magnus");
  const [searchQuery, setSearchQuery] = useState("");
  const [panelLeftOffset, setPanelLeftOffset] = useState(0);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  // Apply design variables (reuse sidebar settings so color customization still works)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings?group=design", {
          cache: "no-store",
        });
        const rows = await res.json().catch(() => []);
        const root = document.documentElement;
        const get = (k: string, def: string) => {
          const r = Array.isArray(rows)
            ? rows.find((x: any) => String(x.setting_key) === k)
            : null;
          return r ? String(r.setting_value ?? def) : def;
        };
        root.style.setProperty("--nav-bg", get("design_sidebar_bg", "#FFFFFF"));
        root.style.setProperty(
          "--nav-text",
          get("design_sidebar_text", "#111827"),
        );
        root.style.setProperty(
          "--nav-hover",
          get("design_sidebar_hover_bg", "#F3F4F6"),
        );
        root.style.setProperty(
          "--nav-active",
          get("design_sidebar_active_bg", "#E8F6F5"),
        );
        root.style.setProperty(
          "--nav-active-text",
          get("design_sidebar_active_text", "#2BA8A2"),
        );
      } catch {}
    })();
  }, []);

  // Load allowed paths for current user (simplified)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (Array.isArray(d?.user?.allowedPaths))
          setAllowed(d.user.allowedPaths);
        else setAllowed(null);
        if (d?.user) {
          setUserName(String(d.user.name || ""));
          setUserEmail(String(d.user.email || ""));
        }
      } catch {
        setAllowed(null);
      }
    })();
  }, []);

  // Load logo from settings (only if not provided via props)
  useEffect(() => {
    if (initialLogoUrl) return
    ;(async () => {
      try {
        const res = await fetch("/api/settings?group=company", {
          cache: "no-store",
        });
        const rows = await res.json().catch(() => []);
        if (Array.isArray(rows)) {
          const map: Record<string, string> = {};
          for (const r of rows) {
            if (r && r.setting_key)
              map[String(r.setting_key)] = String(r.setting_value ?? "");
          }
          const l = map["company_logo_url"]?.trim();
          if (l) setLogoUrl(l);
        }
      } catch {}
    })();
  }, [initialLogoUrl]);

  const filtAllowed = (path: string) => {
    if (!allowed) return false;
    if (allowed.includes("/")) return true;
    if (allowed.includes(path)) return true;
    return allowed.some(
      (base) => base !== "/" && (path === base || path.startsWith(base + "/")),
    );
  };

  // Domain list from SYSTEM_MENUS.group (unique, ordered by common groups)
  const domains = useMemo(() => {
    const normalizeGroup = (g?: string) => {
      if (!g) return "Lainnya";
      if (g === "Security") return "Setting";
      if (g === "Stok & Laporan") return "Stok";
      return g;
    };
    const order = [
      "Dashboard",
      "Reservasi",
      "Pembelian",
      "Penjualan",
      "Barang",
      "Stok",
      "Keuangan",
      "Laporan",
      "Setting",
    ];
    const groups = Array.from(
      new Set(SYSTEM_MENUS.map((m) => normalizeGroup(m.group))),
    );
    return groups
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .filter((d) => {
        if (d === "Dashboard") return true;
        if (!allowed) return false;
        return SYSTEM_MENUS.some((m) => {
          const g = normalizeGroup(m.group);
          return g === d && m.path && filtAllowed(m.path);
        });
      });
  }, [allowed]);

  // Build categories for a domain using heuristics
  const buildCats = (domain: string) => {
    const normalizeGroup = (g?: string) => {
      if (!g) return "";
      if (g === "Security") return "Setting";
      if (g === "Stok & Laporan") return "Stok";
      return g;
    };
    // Source items with overrides
    const src = SYSTEM_MENUS.map((m) => {
      let group = normalizeGroup(m.group);
      // Move Master Bank to Keuangan
      if (m.path === "/bank") group = "Keuangan";
      return { ...m, group };
    });
    const itemsAll = src
      .filter((m) => m.group === domain && m.path && filtAllowed(m.path))
      .map((m) => ({ name: m.name, path: m.path }));

    const by = {
      master: [] as MenuNode[],
      transaksi: [] as MenuNode[],
      laporan: [] as MenuNode[],
    };
    if (domain === "Dashboard") return by; // no submenu for dashboard

    // Custom shaping per domain
    if (domain === "Barang") {
      const allowMaster = new Set([
        "/barang/menu",
        "/barang/kategori",
        "/barang/spesifikasi",
        "/barang/merk",
        "/harga",
        "/master/barang-pembantu",
        "/master-paket",
      ]);
      for (const it of itemsAll) {
        if (allowMaster.has(it.path)) by.master.push(it);
      }
      return by;
    }

    if (domain === "Stok") {
      const masterSet = new Set(["/gudang", "/ingredient"]);
      const trxSet = new Set([
        "/barang/stock-initial",
        "/stock/transfer",
        "/stock/usage",
        "/stock/draftopname",
        "/stock/opname",
        "/persediaan/manufaktur",
      ]);
      const lapSet = new Set([
        "/stock",
        "/stock-hpp",
        "/reports/stock-recap-period",
        "/reports/konversi-stok",
      ]);
      for (const it of itemsAll) {
        if (masterSet.has(it.path)) by.master.push(it);
        else if (trxSet.has(it.path)) by.transaksi.push(it);
        else if (lapSet.has(it.path)) by.laporan.push(it);
      }
      return by;
    }

    if (domain === "Penjualan") {
      const masterSet = new Set([
        "/customer",
        "/jenis-customer",
        "/season-discount",
        "/sales-master",
        "/penjualan/setting-nota",
        "/penjualan/setting-nomor-faktur",
        "/penjualan/generate-faktur-pajak",
      ]);
      const trxSet = new Set([
        "/pos",
        "/pos/resto-table",
        "/pos/resto-table-qr",
        "/pos/retail",
        "/penjualan/tutup-kasir",
        "/penjualan-sales-order",
        "/penjualan-invoice",
        "/retur-penjualan",
      ]);
      const lapSet = new Set([
        "/sales",
        "/reports/sales-recap",
        "/reports/sales-rekap-pertanggal",
        "/reports/sales-detail",
        "/reports/sales-by-category",
        "/reports/sales-by-specification",
        "/reports/sales-gross-profit",
        "/reports/usage",
        "/reports/sales-vs-usage",
      ]);
      for (const it of itemsAll) {
        if (masterSet.has(it.path)) by.master.push(it);
        else if (trxSet.has(it.path)) by.transaksi.push(it);
        else if (lapSet.has(it.path)) by.laporan.push(it);
      }
      return by;
    }

    if (domain === "Keuangan") {
      const masterOrder = [
        "/keuangan/perkiraan",
        "/bank",
        "/keuangan/saldo-awal-hutang",
        "/keuangan/saldo-awal-piutang",
        "/keuangan/setting-perkiraan",
      ];
      const trxSet = new Set([
        "/keuangan/pembayaran-hutang",
        "/keuangan/pembayaran-piutang",
        "/keuangan/mutasi-kas-bank",
        "/keuangan/jurnal-memorial",
        "/keuangan/uang-muka-customer",
        "/keuangan/uang-muka-supplier",
      ]);
      const lapSet = new Set([
        "/reports/jurnal-harian",
        "/reports/buku-besar",
        "/reports/trial-balance",
        "/reports/neraca",
        "/reports/laba-rugi",
        "/reports/neraca-labarugi",
        "/reports/kartu-kas-bank",
        "/reports/kartu-piutang",
        "/reports/kartu-hutang",
        "/reports/piutang-jatuh-tempo",
        "/reports/hutang-jatuh-tempo",
        "/reports/kartu-uang-muka-customer",
        "/reports/kartu-uang-muka-supplier",
        "/reports/payment-recap-ar",
        "/reports/payment-detail-ar",
        "/reports/payment-recap-ap",
        "/reports/payment-detail-ap",
        "/keuangan/rekonsiliasi-fiskal",
        "/reports/coretax",
      ]);
      const itemsByPath = new Map(itemsAll.map((it) => [it.path, it]));
      for (const p of masterOrder) {
        const it = itemsByPath.get(p);
        if (it) by.master.push(it);
      }
      for (const it of itemsAll) {
        if (masterOrder.includes(it.path)) continue;
        if (trxSet.has(it.path)) by.transaksi.push(it);
        else if (lapSet.has(it.path)) by.laporan.push(it);
      }
      return by;
    }

    if (domain === "Setting") {
      // Exclude Bank from Setting, and no Laporan
      for (const it of itemsAll) {
        if (it.path === "/bank") continue;
        const nm = it.name.toLowerCase();
        const p = it.path.toLowerCase();
        if (nm.startsWith("master") || p.includes("/master"))
          by.master.push(it);
        else by.transaksi.push(it);
      }
      return by;
    }

    // Default grouping
    for (const it of itemsAll) {
      const nm = it.name.toLowerCase();
      const p = it.path.toLowerCase();
      if (
        nm.startsWith("master") ||
        p.includes("/master") ||
        p.endsWith("/gudang") ||
        p.endsWith("/ingredient")
      )
        by.master.push(it);
      else if (
        p.includes("/reports") ||
        nm.includes("laporan") ||
        nm.includes("list")
      )
        by.laporan.push(it);
      else by.transaksi.push(it);
    }
    return by;
  };

  // All menu items with domain/category context for search
  const allMenuItems = useMemo(() => {
    const items: {
      domain: string;
      category: string;
      name: string;
      path: string;
    }[] = [];
    const order = [
      "Dashboard",
      "Reservasi",
      "Pembelian",
      "Penjualan",
      "Barang",
      "Stok",
      "Keuangan",
      "Laporan",
      "Setting",
    ];
    for (const d of order) {
      if (!domains.includes(d)) continue;
      const cats = buildCats(d);
      for (const cat of ["master", "transaksi", "laporan"] as const) {
        const label =
          cat === "master"
            ? "Master"
            : cat === "transaksi"
              ? "Transaksi"
              : "Laporan";
        for (const it of (cats as any)[cat] || []) {
          items.push({
            domain: d,
            category: label,
            name: it.name,
            path: it.path,
          });
        }
      }
    }
    return items;
  }, [domains]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allMenuItems
      .filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.path.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [searchQuery, allMenuItems]);

  // Close search on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchQuery("");
      }
    };
    if (searchQuery) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [searchQuery]);

  // Outside click/esc close
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!openDomain) return;
      const t = e.target as Node;
      const anyBtn = Object.values(btnRefs.current || {}).some(
        (b) => b && b.contains(t),
      );
      if (anyBtn) return;
      if (panelRef.current && panelRef.current.contains(t)) return;
      setOpenDomain(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDomain(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openDomain]);

  // Close dropdown automatically on route change
  useEffect(() => {
    if (openDomain) setOpenDomain(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile Header */}
      <div
        className="md:hidden sticky top-0 z-30 border-b"
        style={{ background: "var(--nav-bg)", color: "var(--nav-text)" }}
      >
        <div className="h-10 flex items-center gap-2 px-2">
          <button
            onClick={() => onMenuToggle?.()}
            className="h-8 w-8 grid place-items-center rounded hover:bg-[var(--nav-hover)]"
            aria-label="Menu"
          >
            ☰
          </button>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-6 w-6 rounded object-cover"
            />
          ) : (
            <div className="h-6 w-6 rounded bg-slate-200 grid place-items-center text-[10px]">
              🍽️
            </div>
          )}
          <div className="text-[12px] font-semibold truncate" title={appTitle}>
            {appTitle || "Aplikasi"}
          </div>
          <button
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              } catch {
                window.location.href = "/login";
              }
            }}
            className="ml-auto px-2 py-0.5 text-[12px] rounded hover:bg-[var(--nav-hover)]"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Desktop Header */}
      <div
        ref={headerRef}
        className="hidden md:block border-b sticky top-0 z-30 shadow-sm"
        style={{ background: "var(--nav-bg)", color: "var(--nav-text)" }}
      >
        <div className="w-full px-3">
          <div className="h-10 flex items-center gap-2">
            {/* Brand */}
            <div className="flex items-center gap-2 pr-2 border-r">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <div className="h-6 w-6 rounded bg-slate-200 grid place-items-center text-[10px]">
                  🍽️
                </div>
              )}
              <div
                className="text-[12px] font-semibold truncate max-w-[200px]"
                title={appTitle}
              >
                {appTitle || "Aplikasi"}
              </div>
            </div>
            {/* Left: Domains */}
            <div className="flex items-center gap-1.5">
              {domains.map((d) =>
                d === "Dashboard" ? (
                  <Link
                    key={d}
                    href="/dashboard"
                    className={`px-2 py-1 text-[12px] rounded transition-colors hover:bg-[var(--nav-hover)]`}
                  >
                    Dashboard
                  </Link>
                ) : (
                  <button
                    key={d}
                    ref={(el) => {
                      btnRefs.current[d] = el;
                    }}
                    onClick={() => {
                      const next = openDomain === d ? null : d;
                      setOpenDomain(next);
                      if (next) {
                        const btn = btnRefs.current[d];
                        if (btn) {
                          const rect = btn.getBoundingClientRect();
                          setPanelLeftOffset(rect.left);
                        }
                      }
                    }}
                    className={`px-2 py-1 text-[12px] rounded transition-colors border-b-2 ${openDomain === d ? "bg-[var(--nav-active)] text-[var(--nav-active-text)] border-[var(--nav-active-text)]" : "hover:bg-[var(--nav-hover)] border-transparent"}`}
                    aria-expanded={openDomain === d}
                    aria-controls={`menu-${d}`}
                  >
                    {d} ▾
                  </button>
                ),
              )}
            </div>
            {/* Search */}
            <div ref={searchRef} className="relative ml-auto w-[200px]">
              <input
                type="text"
                placeholder="🔍 Cari menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 px-2 text-[12px] rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-teal-primary focus:ring-1 focus:ring-teal-bg"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <Link
                      key={i}
                      href={r.path}
                      onClick={() => setSearchQuery("")}
                      className="block px-3 py-2 text-[12px] text-slate-700 hover:bg-teal-bg border-b border-slate-100 last:border-0"
                    >
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 text-[10px] text-slate-400">
                        {r.domain} · {r.category}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {/* Right: User */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onToggleNavbar}
                className="px-1.5 py-1 text-[11px] rounded hover:bg-[var(--nav-hover)] opacity-40 hover:opacity-100 transition-opacity"
                title="Sembunyikan navbar"
              >
                ▲
              </button>
              <div className="hidden lg:flex items-center gap-2 max-w-[220px]">
                <div className="h-6 w-6 rounded-full bg-slate-200 grid place-items-center text-[10px] text-slate-700">
                  {(userName || userEmail || "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="leading-tight truncate">
                  <div
                    className="text-[12px] font-medium truncate"
                    title={userName}
                  >
                    {userName || "User"}
                  </div>
                  <div
                    className="text-[10px] opacity-70 truncate"
                    title={userEmail}
                  >
                    {userEmail}
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/login";
                  } catch {
                    window.location.href = "/login";
                  }
                }}
                className="px-2 py-0.5 text-[12px] rounded hover:bg-[var(--nav-hover)]"
                title="Sign Out"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
        {openDomain && (
          <div
            id={`menu-${openDomain}`}
            role="menu"
            className="fixed top-10 z-40"
            style={{ left: panelLeftOffset }}
          >
            <div className="px-3">
              {(() => {
                const cats = buildCats(openDomain);
                const blocks = [
                  { title: "Master", items: cats.master },
                  { title: "Transaksi", items: cats.transaksi },
                  { title: "Laporan", items: cats.laporan },
                ].filter((b) => b.items.length > 0);
                const cols = Math.min(blocks.length, 3);
                return (
                  <div
                    ref={panelRef}
                    className="gap-2 px-3 py-3 rounded-md shadow-lg"
                    style={{
                      display: "inline-grid",
                      gridTemplateColumns: `repeat(${cols}, minmax(180px, 1fr))`,
                      background: "#FFFFFF",
                      color: "#000000",
                    }}
                  >
                    {blocks.map((b, i) => (
                      <div key={i} className="min-w-[180px]">
                        <div className="text-[11px] font-semibold text-black mb-1.5">
                          {b.title}
                        </div>
                        <ul className="space-y-1 text-[12px] text-black">
                          {b.items.map((it, idx) => (
                            <li key={idx}>
                              <Link
                                href={it.path}
                                onClick={() => setOpenDomain(null)}
                                className="block px-2 py-0.5 rounded hover:bg-[var(--nav-hover)] text-black"
                              >
                                {it.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
