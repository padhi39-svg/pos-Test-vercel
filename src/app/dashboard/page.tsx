"use client"
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChartBarIcon, UserGroupIcon, BanknotesIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'
import CardStat from '@/components/CardStat'
import QuickAction from '@/components/QuickAction'

type Summary = {
  totalMenu: number
  customerCount: number
  todaySalesCount: number
  todayRevenue: number
  recentTransactions: { id:number; transaction_number:string; tdate:string; total:number; customer_name:string|null; item_count:number }[]
}

type KPI = {
  todayOrders: number
  todayRevenue: number
  monthOrders: number
  monthRevenue: number
  avgOrderValue: number
  newCustomers: number
  totalMenu: number
}

type TrendRow = { tdate: string; orders: number; revenue: number }
type StockAlert = { id: number; code: string; name: string; qty: number; min_stock: number }
type TopMonthly = { id: number; code: string; name: string; qty: number; omzet: number }
type Top7 = { id: number; code: string; name: string; qty: number; omzet: number }
type ApRow = { ym: string; outstanding: number }
type ApSummary = { rows: ApRow[]; totalOutstanding: number }
type StockTop = { id:number; code:string; name:string; total_cost:number }
type StockSummary = { totalValue: number; top: StockTop[] }

type ComparisonData = {
  yesterdayOrders: number
  yesterdayRevenue: number
  lastMonthOrders: number
  lastMonthRevenue: number
  lastMonthAvgOrderValue: number
  lastMonthHutang: number
  lastMonthLabaRugi: number
}

type Comparison = { pct: number; label: string } | null

type CardDef = {
  id: string
  title: string
  getValue?: (kpi: KPI | null, data: Summary | null, ap: ApSummary | null, stock: StockSummary | null, loading: boolean, labaRugi?: number) => string
  icon?: React.ReactNode
}

const fmt = (n:number) => new Intl.NumberFormat('id-ID').format(n)
const fmtRp = (n:number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
const fmtRb = (n:number) => { const v = Math.round(n / 1000); return `Rp ${new Intl.NumberFormat('id-ID').format(v)}rb` }
const fmtNumRb = (n:number) => { const v = Math.round(n / 1000); return `${new Intl.NumberFormat('id-ID').format(v)}rb` }
const fmtMonth = (ym:string) => {
  if (!ym) return ''
  const [y,m] = ym.split('-')
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const idx = Math.max(0, Math.min(11, Number(m)-1))
  return `${bulan[idx]} ${y}`
}
const calcPct = (curr: number, prev: number): number => {
  if (prev === 0 && curr === 0) return 0
  if (prev === 0) return 100
  return Math.round(((curr - prev) / prev) * 100)
}

const fmtDate = (d:string) => {
  if (!d) return ''
  const [y,m,day] = d.split('-')
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return `${Number(day)} ${bulan[Math.max(0, Math.min(11, Number(m)-1))]}`
}

const ALL_CARDS: CardDef[] = [
  { id: 'total_menu', title: 'Total Menu', getValue: (k,d)=>String(k?.totalMenu ?? d?.totalMenu ?? 0), icon: <ChartBarIcon className="h-5 w-5" /> },
  { id: 'pesanan_hari_ini', title: 'Pesanan Hari Ini', getValue: (k,d)=>String(k?.todayOrders ?? d?.todaySalesCount ?? 0), icon: <ShoppingCartIcon className="h-5 w-5" /> },
  { id: 'omzet_hari_ini', title: 'Omzet Hari Ini', getValue: (k,d,_a,_b,loading)=>loading?'...':fmtRp(k?.todayRevenue ?? d?.todayRevenue ?? 0), icon: <BanknotesIcon className="h-5 w-5" /> },
  { id: 'order_bulan_ini', title: 'Order Bulan Ini', getValue: (k)=>String(k?.monthOrders ?? 0), icon: <ShoppingCartIcon className="h-5 w-5" /> },
  { id: 'omzet_bulan_ini', title: 'Omzet Bulan Ini', getValue: (k,_a,_b,_c,loading)=>loading?'...':fmtRp(k?.monthRevenue ?? 0), icon: <BanknotesIcon className="h-5 w-5" /> },
  { id: 'avg_order_value', title: 'Avg Order Value', getValue: (k,_a,_b,_c,loading)=>loading?'...':fmtRp(k?.avgOrderValue ?? 0), icon: <UserGroupIcon className="h-5 w-5" /> },
  { id: 'total_hutang', title: 'Hutang Outstanding', getValue: (_k,_d,ap,_s,loading)=>loading?'...':fmtRp(ap?.totalOutstanding ?? 0), icon: <BanknotesIcon className="h-5 w-5" /> },
  { id: 'nilai_persediaan', title: 'Nilai Persediaan', getValue: (_k,_d,_a,stock,loading)=>loading?'...':fmtRp(stock?.totalValue ?? 0), icon: <ChartBarIcon className="h-5 w-5" /> },
  { id: 'laba_rugi', title: 'Laba Rugi', getValue: (_k,_a,_b,_c,loading,lr)=>loading?'...':fmtRp(lr ?? 0), icon: <BanknotesIcon className="h-5 w-5" /> },
  { id: 'trend_chart', title: 'Tren 7 Hari (Omzet)' },
  { id: 'recent_transactions', title: 'Transaksi Terbaru' },
  { id: 'top_monthly', title: 'Top 5 Barang Terlaris Bulan Ini' },
  { id: 'top_7_days', title: 'Top 5 Barang Terlaris (7 Hari)' },
  { id: 'ap_chart', title: 'Hutang per Bulan' },
  { id: 'stock_top', title: 'Top 5 Nilai Stok' },
  { id: 'stock_alerts', title: 'Stok Menipis' },
]

const DEFAULT_VISIBLE = ['total_menu','pesanan_hari_ini','omzet_hari_ini','order_bulan_ini','omzet_bulan_ini','avg_order_value','total_hutang','nilai_persediaan','laba_rugi','trend_chart','recent_transactions','top_monthly','top_7_days','ap_chart','stock_top','stock_alerts']

type QAction = { id: string; label: string; color: 'blue' | 'green' | 'indigo' | 'amber' }

const ALL_QUICK_ACTIONS: QAction[] = [
  { id: 'buat_pesanan', label: 'Buat Pesanan', color: 'blue' },
  { id: 'menu', label: 'Menu', color: 'green' },
  { id: 'customer', label: 'Customer', color: 'indigo' },
  { id: 'meja', label: 'Meja', color: 'amber' },
]

const DEFAULT_QUICK_ACTIONS = ['buat_pesanan', 'menu', 'customer', 'meja']

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [trend, setTrend] = useState<TrendRow[]>([])
  const [trendType, setTrendType] = useState<string>('')
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [topMonthly, setTopMonthly] = useState<TopMonthly[]>([])
  const [top7, setTop7] = useState<Top7[]>([])
  const [canViewDashboard, setCanViewDashboard] = useState<boolean | null>(null)
  const [posPerm, setPosPerm] = useState({ retail: false, resto: false, table: false })
  const [ap, setAp] = useState<ApSummary | null>(null)
  const [stock, setStock] = useState<StockSummary | null>(null)
  const [labaRugi, setLabaRugi] = useState<number | null>(null)
  const [comp, setComp] = useState<ComparisonData | null>(null)
  const [hoveredLegend, setHoveredLegend] = useState<number | null>(null)

  // Card configuration state
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_VISIBLE)
  const [quickActionOrder, setQuickActionOrder] = useState<string[]>(DEFAULT_QUICK_ACTIONS)
  const [editing, setEditing] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showAddQaDialog, setShowAddQaDialog] = useState(false)
  const [dragQuickIdx, setDragQuickIdx] = useState<number | null>(null)

  const loadCardConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/user-settings/dashboard-cards')
      if (res.ok) {
        const { value } = await res.json()
        if (value) {
          if (Array.isArray(value.cards)) setCardOrder(value.cards)
          if (Array.isArray(value.quickActions)) setQuickActionOrder(value.quickActions)
        }
      }
    } catch {}
  }, [])

  const saveCardConfig = useCallback(async (cards: string[], qa: string[]) => {
    try {
      await fetch('/api/user-settings/dashboard-cards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, quickActions: qa }),
      })
    } catch {}
  }, [])

  // Cek hak akses Dashboard dari /api/auth/me
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const d = await res.json().catch(() => ({}))
        const perms = Array.isArray(d?.user?.permissions) ? (d.user.permissions as any[]) : []
        const rowDashboard = perms.find(p => String(p.menu_code || '').toLowerCase().trim() === 'dashboard') as any | undefined
        const canView = rowDashboard && Number(rowDashboard.can_view) === 1
        setCanViewDashboard(!!canView)
        const findPos = (code: string) => {
          const r = perms.find((p: any) => String(p.menu_code) === code)
          return r && Number(r.can_view) === 1
        }
        setPosPerm({ retail: findPos('pos_retail'), resto: findPos('pos_resto'), table: findPos('pos_resto_table') })
      } catch {
        setCanViewDashboard(false)
      }
    })()
    loadCardConfig()
  }, [loadCardConfig])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const trendUrl = `/api/dashboard/sales-trend?days=7${trendType ? `&type=${encodeURIComponent(trendType)}` : ''}`
        const [resSummary, resKpi, resTrend, resAlerts, resTopMonthly, resTop7, resAp, resStock, resComp] = await Promise.all([
          fetch('/api/dashboard/summary'),
          fetch('/api/dashboard/kpi'),
          fetch(trendUrl),
          fetch('/api/dashboard/stock-alerts'),
          fetch('/api/dashboard/top-products-monthly'),
          fetch('/api/dashboard/top-products-7days'),
          fetch('/api/dashboard/ap-summary?months=12'),
          fetch('/api/dashboard/stock-summary'),
          fetch('/api/dashboard/comparison'),
        ])
        if (resSummary.ok) {
          const d = await resSummary.json()
          setData(d)
        }
        if (resKpi.ok) {
          const k = await resKpi.json()
          setKpi(k)
        }
        if (resTrend.ok) {
          const apiRows: TrendRow[] = (await resTrend.json()).rows || []
          const filled: TrendRow[] = []
          for (let i = 6; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const key = d.toISOString().slice(0, 10)
            const match = apiRows.find(r => String(r.tdate).startsWith(key))
            filled.push(match || { tdate: key, orders: 0, revenue: 0 } as TrendRow)
          }
          setTrend(filled)
        }
        if (resAlerts.ok) {
          const a = await resAlerts.json()
          setAlerts(a.rows || [])
        }
        if (resTopMonthly.ok) {
          const t = await resTopMonthly.json()
          setTopMonthly(t.rows || [])
        }
        if (resTop7.ok) {
          const t = await resTop7.json()
          setTop7(t.rows || [])
        }
        if (resAp.ok) {
          const a = await resAp.json()
          setAp(a)
        }
        if (resStock.ok) {
          const s = await resStock.json()
          setStock(s)
        }
        if (resComp.ok) {
          const c = await resComp.json()
          setComp(c)
        }
        try {
          const lr = await (await fetch('/api/reports/laba-rugi?periodId=2')).json()
          setLabaRugi(Number(lr?.laba_bersih ?? 0))
        } catch {
          setLabaRugi(null)
        }
      } catch (e) {
        console.error('Dashboard load error:', e)
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [trendType])

  // Drag-and-drop handlers — swap pattern
  const handleDragStart = (idx: number) => setDragIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const swapped = [...cardOrder]
    ;[swapped[dragIdx], swapped[idx]] = [swapped[idx], swapped[dragIdx]]
    setCardOrder(swapped)
    setDragIdx(idx)
  }
  const handleDragEnd = () => {
    setDragIdx(null)
    saveCardConfig(cardOrder, quickActionOrder)
  }

  const visibleCards = cardOrder.map(id => ALL_CARDS.find(c => c.id === id)).filter(Boolean) as CardDef[]

  const getComparison = (cardId: string): Comparison => {
    if (!comp) return null
    switch (cardId) {
      case 'pesanan_hari_ini':
        return { pct: calcPct(kpi?.todayOrders ?? 0, comp.yesterdayOrders), label: 'dari kemarin' }
      case 'omzet_hari_ini':
        return { pct: calcPct(kpi?.todayRevenue ?? 0, comp.yesterdayRevenue), label: 'dari kemarin' }
      case 'order_bulan_ini':
        return { pct: calcPct(kpi?.monthOrders ?? 0, comp.lastMonthOrders), label: 'dr bulan lalu' }
      case 'omzet_bulan_ini':
        return { pct: calcPct(kpi?.monthRevenue ?? 0, comp.lastMonthRevenue), label: 'dr bulan lalu' }
      case 'avg_order_value':
        return { pct: calcPct(kpi?.avgOrderValue ?? 0, comp.lastMonthAvgOrderValue), label: 'dr bulan lalu' }
      case 'total_hutang':
        return { pct: calcPct(ap?.totalOutstanding ?? 0, comp.lastMonthHutang), label: 'dr bulan lalu' }
      case 'laba_rugi':
        return { pct: calcPct(labaRugi ?? 0, comp.lastMonthLabaRugi), label: 'dr bulan lalu' }
      default:
        return null
    }
  }

  // Simple area chart using SVG
  const TrendChart = ({ rows }: { rows: TrendRow[] }) => {
    const [hovered, setHovered] = useState<number | null>(null)
    const w = 520, h = 160
    const l = 56, r = 16, t = 20, b = 28
    const chartW = w - l - r, chartH = h - t - b
    const ys = rows.map(r => Number(r.revenue || 0))
    const dataMax = Math.max(1, ...ys)
    const stepX = rows.length > 1 ? chartW / (rows.length - 1) : 0
    const ticks = 5
    const yTickStep = Math.ceil(dataMax / ticks / 1000) * 1000 || 1
    const chartMax = yTickStep * (ticks + 1)
    const yTicks = Array.from({ length: ticks + 2 }, (_, i) => i * yTickStep)
    const points = rows.map((r, i) => {
      const x = l + i * stepX
      const y = t + chartH * (1 - (Number(r.revenue || 0) / chartMax))
      return `${x},${y}`
    }).join(' ')
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full h-auto block" preserveAspectRatio="xMinYMin meet">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.15"/>
          </filter>
        </defs>
        {yTicks.map((tv, i) => {
          const y = t + chartH * (1 - tv / chartMax)
          return (
            <g key={i}>
              <line x1={l} y1={y} x2={w - r} y2={y} stroke="#E2E8F0" strokeWidth={1} />
              <text x={l - 6} y={y + 3} textAnchor="end" fontSize={6} fill="#94A3B8">{fmtRp(tv)}</text>
            </g>
          )
        })}
        <polyline fill="none" stroke="#2BA8A2" strokeWidth={2} points={points} />
        {rows.map((r, i) => {
          const x = l + i * stepX
          const y = t + chartH * (1 - (Number(r.revenue || 0) / chartMax))
          return (
            <g key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}>
              {hovered === i && (() => {
                const label = fmtRp(Number(r.revenue || 0))
                const tw = label.length * 3.8 + 10
                return (
                  <>
                    <rect x={x - tw / 2} y={y - 14} width={tw} height={12} rx={6} fill="#334155" filter="url(#shadow)" />
                    <text x={x} y={y - 5} textAnchor="middle" fontSize={6} fill="#fff" fontWeight="600">{label}</text>
                  </>
                )
              })()}
              <circle cx={x} cy={y} r={2} fill="#2BA8A2" />
              <text x={x} y={h - b + 12} textAnchor="middle" fontSize={5} fill="#94A3B8">{fmtDate(r.tdate || '')}</text>
            </g>
          )
        })}
      </svg>
    )
  }

  // Lightweight reusable BarChart (inline SVG)
  const BarChart = ({ labels, values, color = '#0ea5e9', colors, hideLabels }: { labels: string[]; values: number[]; color?: string; colors?: string[]; hideLabels?: boolean }) => {
    const [hovered, setHovered] = useState<number | null>(null)
    const w = 520, h = hideLabels ? 180 : 160
    const l = 56, r = 16, t = 20, b = hideLabels ? 8 : 28
    const chartW = w - l - r, chartH = h - t - b
    const dataMaxV = Math.max(1, ...values)
    const bw = values.length > 0 ? chartW / values.length : 0
    const ticks = 4
    const yTickStep = Math.ceil(dataMaxV / ticks / 1000) * 1000 || 1
    const chartMaxV = yTickStep * (ticks + 1)
    const yTicks = Array.from({ length: ticks + 2 }, (_, i) => i * yTickStep)
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full h-auto block" preserveAspectRatio="xMinYMin meet">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.15"/>
          </filter>
        </defs>
        {yTicks.map((tv, i) => {
          const y = t + chartH * (1 - tv / chartMaxV)
          return (
            <g key={i}>
              <line x1={l} y1={y} x2={w - r} y2={y} stroke="#E2E8F0" strokeWidth={1} />
              <text x={l - 6} y={y + 3} textAnchor="end" fontSize={8} fill="#94A3B8">{fmt(tv)}</text>
            </g>
          )
        })}
        {values.map((v, i) => {
          const x = l + i * bw
          const barW = Math.max(4, bw - 4)
          const barH = chartH * (v / chartMaxV)
          const y = t + chartH - barH
          return (
            <g key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width={barW} height={barH} rx={2} fill={colors?.[i] || color} />
              {!hideLabels && <text x={x + barW / 2} y={h - b + 14} textAnchor="middle" fontSize={7} fill="#94A3B8" transform={labels.length > 6 ? `rotate(-30 ${x + barW / 2},${h - b + 14})` : ''}>{labels[i]}</text>}
            </g>
          )
        })}
        {hovered !== null && (() => {
          const v = values[hovered]
          const x = l + hovered * bw
          const barW = Math.max(4, bw - 4)
          const barH = chartH * (v / chartMaxV)
          const y = t + chartH - barH
          const label = fmt(v)
          const tw = label.length * 4.5 + 12
          return (
            <g>
              <rect x={x + barW / 2 - tw / 2} y={y - 16} width={tw} height={14} rx={7} fill="#334155" filter="url(#shadow)" />
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={7} fill="#fff" fontWeight="600">{label}</text>
            </g>
          )
        })()}
      </svg>
    )
  }

  // Jika hak akses dashboard belum diketahui, tampilkan loader ringan
  if (canViewDashboard === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-sm text-slate-500">Memuat dashboard...</div>
      </div>
    )
  }

  // Jika TIDAK punya VIEW untuk Dashboard → tampilan sederhana "Selamat Datang"
  if (canViewDashboard === false) {
    const hasAnyPos = posPerm.retail || posPerm.resto || posPerm.table
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-[#FAFAFA] p-4">
        <div className="text-center px-4 max-w-lg">
          <h1 className="text-3xl md:text-4xl font-bold text-[#3C3C3C] mb-2">Selamat Datang</h1>
          <p className="text-sm md:text-base text-slate-500 mb-6">
            Silakan pilih menu di sebelah kiri sesuai hak akses yang Anda miliki.
          </p>
          {hasAnyPos && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {posPerm.resto && (
                <Link href="/pos" className="block p-4 bg-[#FFA16C] text-white rounded-xl shadow-sm hover:bg-[#FF8F55] transition text-center font-semibold">
                  POS Resto
                </Link>
              )}
              {posPerm.table && (
                <Link href="/pos/resto-table" className="block p-4 bg-[#3C3C3C] text-white rounded-xl shadow-sm hover:bg-[#2A2A2A] transition text-center font-semibold">
                  POS Table
                </Link>
              )}
              {posPerm.retail && (
                <Link href="/pos/retail" className="block p-4 bg-slate-600 text-white rounded-xl shadow-sm hover:bg-slate-700 transition text-center font-semibold">
                  POS Retail
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 mx-auto w-full max-w-[360px] md:max-w-none" style={{ background: '#EFF8F7' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#3C3C3C' }}>Dashboard</h1>
          <p className="mt-1 text-xs" style={{ color: '#8E8E8E' }}>Ringkasan performa sistem resto Anda</p>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95 ${
            editing
              ? 'bg-[#2BA8A2] text-white shadow-[0_4px_20px_rgba(43,168,162,0.3)]'
              : 'bg-white text-[#2BA8A2] border-2 border-[#2BA8A2] hover:bg-[#E8F6F5]'
          }`}
        >
          {editing ? 'Selesai' : 'Atur Kartu'}
        </button>
      </div>

      {/* KPI Info Cards (small, compact) */}
      <section className="grid gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visibleCards.filter(c => c.getValue).map((card, idx) => {
          const realIdx = cardOrder.indexOf(card.id)
          return (
          <div
            key={card.id}
            draggable={editing}
            onDragStart={() => editing && handleDragStart(realIdx)}
            onDragOver={(e) => editing && handleDragOver(e, realIdx)}
            onDragEnd={handleDragEnd}
            className={`relative ${editing ? 'cursor-grab active:cursor-grabbing' : ''} ${dragIdx === realIdx ? 'opacity-50' : ''}`}
          >
            <CardStat title={card.title} value={card.getValue!(kpi, data, ap, stock, loading, labaRugi ?? undefined)} icon={card.icon} comparison={getComparison(card.id)} />
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setCardOrder(prev => {
                    const next = prev.filter(x => x !== card.id)
                    saveCardConfig(next, quickActionOrder)
                    return next
                  })
                }}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-white text-xs leading-none shadow z-10"
                style={{ backgroundColor: '#EF6C4A' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#D45233'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#EF6C4A'}
              >
                ✕
              </button>
            )}
            <div className={`absolute top-1 left-1 ${editing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
              <span className="text-xs" style={{ color: '#8E8E8E' }}>⠿</span>
            </div>
          </div>
          )
        })}
        {editing && (
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="h-full min-h-[80px] rounded-2xl border-2 border-dashed transition-colors flex items-center justify-center"
          style={{ borderColor: '#CBD5E1', color: '#94A3B8' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#2BA8A2'; e.currentTarget.style.backgroundColor = '#E8F6F5'; e.currentTarget.style.color = '#2BA8A2' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        )}
      </section>

      {/* Aksi Cepat Section */}
      <section>
        <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-dashed" style={{ borderColor: '#2BA8A260' }}>
          <h3 className="text-sm font-medium" style={{ color: '#3C3C3C' }}>Aksi Cepat</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {quickActionOrder.map((id, idx) => {
            const qa = ALL_QUICK_ACTIONS.find(a => a.id === id)
            if (!qa) return null
            return (
              <div key={qa.id} className={`relative ${editing ? 'cursor-grab' : ''}`}
                draggable={editing}
                onDragStart={(e) => {
                  if (!editing) return
                  e.dataTransfer.effectAllowed = 'move'
                  setDragQuickIdx(idx)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!editing || dragQuickIdx === null || dragQuickIdx === idx) return
                  const swapped = [...quickActionOrder]
                  ;[swapped[dragQuickIdx], swapped[idx]] = [swapped[idx], swapped[dragQuickIdx]]
                  setQuickActionOrder(swapped)
                  setDragQuickIdx(idx)
                }}
                onDragEnd={() => {
                  setDragQuickIdx(null)
                  saveCardConfig(cardOrder, quickActionOrder)
                }}
              >
                <QuickAction label={qa.label} color={qa.color} />
                {editing && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = quickActionOrder.filter(x => x !== qa.id)
                      setQuickActionOrder(next)
                      saveCardConfig(cardOrder, next)
                    }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-white text-xs leading-none shadow z-10"
                    style={{ backgroundColor: '#EF6C4A' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#D45233'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#EF6C4A'}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
          {editing && quickActionOrder.length < 4 && (
            <button
              type="button"
              onClick={() => setShowAddQaDialog(true)}
              className="h-full min-h-[56px] rounded-xl border-2 border-dashed transition-colors flex items-center justify-center"
              style={{ borderColor: '#CBD5E1', color: '#94A3B8' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#2BA8A2'; e.currentTarget.style.backgroundColor = '#E8F6F5'; e.currentTarget.style.color = '#2BA8A2' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {/* Quick Actions Add Dialog */}
      {showAddQaDialog && (() => {
        const hidden = ALL_QUICK_ACTIONS.filter(a => !quickActionOrder.includes(a.id))
        return (
          <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6 z-50">
            <div className="w-full max-w-sm mt-20 overflow-hidden" style={{ backgroundColor: '#FFF8E7', borderRadius: '16px', boxShadow: '0 4px 20px rgba(43,168,162,0.15)' }}>
              <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: '#E8F6F5' }}>
                <div className="font-semibold text-sm" style={{ color: '#3C3C3C' }}>Tambah Aksi Cepat</div>
                <button type="button" onClick={() => setShowAddQaDialog(false)}
                  className="text-xs px-3 py-1 rounded-full border transition-all active:scale-95"
                  style={{ borderColor: '#CBD5E1', color: '#64748B' }}>Tutup</button>
              </div>
              <div className="p-3 space-y-1">
                {hidden.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Semua aksi sudah ditampilkan</p>
                ) : (
                  hidden.map(qa => (
                    <button
                      key={qa.id}
                      type="button"
                      onClick={() => {
                        const next = [...quickActionOrder, qa.id]
                        setQuickActionOrder(next)
                        saveCardConfig(cardOrder, next)
                        setShowAddQaDialog(false)
                      }}
                    className="w-full text-left px-3 py-2 rounded-pill border text-sm transition-all hover:scale-[1.01] active:scale-95"
                    style={{ borderColor: '#E8F6F5', backgroundColor: 'white', color: '#3C3C3C' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2BA8A2'; e.currentTarget.style.backgroundColor = '#E8F6F5' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8F6F5'; e.currentTarget.style.backgroundColor = 'white' }}
                  >
                    {qa.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Big Cards Grid (charts & tables) */}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
        {visibleCards.filter(c => !c.getValue).map((card, idx) => {
          const realIdx = cardOrder.indexOf(card.id)
          return (
          <div
            key={card.id}
            draggable={editing}
            onDragStart={() => editing && handleDragStart(realIdx)}
            onDragOver={(e) => editing && handleDragOver(e, realIdx)}
            onDragEnd={handleDragEnd}
            className={`relative ${editing ? 'cursor-grab active:cursor-grabbing' : ''} ${dragIdx === realIdx ? 'opacity-50' : ''}`}
          >
            <div className="rounded-2xl border p-2 md:p-3 h-full shadow-[0_4px_20px_rgba(43,168,162,0.1)]" style={{ backgroundColor: 'white', borderColor: '#E8F6F5' }}>
              {(() => {
                switch (card.id) {
                  case 'trend_chart':
                    return (
                      <>
                        <div className="flex items-start justify-between mb-2 gap-1.5 flex-wrap">
                          <h3 className="font-medium text-sm shrink-0" style={{ color: '#3C3C3C' }}>{card.title}</h3>
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <select value={trendType} onChange={e=>setTrendType(e.target.value)}
                              className="px-2 py-1 rounded-lg text-xs focus:outline-none focus:ring-2"
                              style={{ backgroundColor: '#FFF8E7', borderColor: '#CBD5E1', borderWidth: 1 }}
                              onFocus={e => { e.currentTarget.style.borderColor = '#2BA8A2'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(43,168,162,0.2)' }}
                              onBlur={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.boxShadow = 'none' }}>
                              <option value="">Semua</option>
                              <option value="1">POS Resto</option>
                              <option value="2">POS Retail</option>
                              <option value="3">Invoice</option>
                            </select>
                            <div className="text-[11px] text-slate-500">Total: {fmtRp((trend||[]).reduce((s,r)=>s+Number(r.revenue||0),0))}</div>
                          </div>
                        </div>
                        {trend.length === 0 ? (
                          <div className="text-slate-500 text-xs">Belum ada data tren</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <TrendChart rows={trend} />
                          </div>
                        )}
                      </>
                    )
                  case 'recent_transactions':
                    return (
                      <>
                        <h3 className="font-medium mb-3 text-sm text-[#3C3C3C]">{card.title}</h3>
                        {loading && (<div className="text-slate-500 text-xs">Memuat...</div>)}
                        {!loading && (!data || data.recentTransactions.length === 0) && (
                          <div className="text-slate-500 text-xs">Belum ada transaksi</div>
                        )}
                        {!loading && data && data.recentTransactions.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead style={{ backgroundColor: '#E8F6F5' }}>
                                <tr>
                                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: '#2BA8A2' }}>Nomor</th>
                                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: '#2BA8A2' }}>Tanggal</th>
                                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: '#2BA8A2' }}>Customer</th>
                                  <th className="text-right px-3 py-2 font-medium text-xs" style={{ color: '#2BA8A2' }}>Items</th>
                                  <th className="text-right px-3 py-2 font-medium text-xs" style={{ color: '#2BA8A2' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.recentTransactions.map((t) => (
                                  <tr key={t.id} className="transition-colors" style={{ borderTop: '1px solid #E8F6F5' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F6F580'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <td className="px-3 py-1.5" style={{ color: '#3C3C3C' }}>{t.transaction_number}</td>
                                    <td className="px-3 py-1.5" style={{ color: '#8E8E8E' }}>{String(t.tdate).slice(0,10)}</td>
                                    <td className="px-3 py-1.5" style={{ color: '#8E8E8E' }}>{t.customer_name || '-'}</td>
                                    <td className="px-3 py-1.5 text-right" style={{ color: '#8E8E8E' }}>{t.item_count}</td>
                                    <td className="px-3 py-1.5 text-right font-semibold" style={{ color: '#3C3C3C' }}>Rp {fmt(t.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )
                  case 'top_monthly':
                    return (
                      <>
                        <h3 className="font-medium mb-3 text-sm" style={{ color: '#3C3C3C' }}>{card.title}</h3>
                        {topMonthly.length === 0 ? (
                          <div className="text-xs" style={{ color: '#8E8E8E' }}>Belum ada data penjualan bulan ini</div>
                        ) : (() => {
                          const raw = topMonthly.slice(0, 5)
                          const top5 = raw.length < 5
                            ? [...raw, ...Array(5 - raw.length).fill(null)]
                            : raw
                          const maxVal = Math.max(...top5.filter(Boolean).map(r => Number(r.omzet||0)), 1)
                          return (
                            <div className="space-y-2.5">
                              {top5.map((r, index) => {
                                if (!r) return (
                                  <div key={`empty-${index}`} className="flex items-center gap-2 opacity-30">
                                    <span className="text-xs text-slate-400 w-4 shrink-0 text-right">{index+1}</span>
                                    <span className="text-xs text-[#3C3C3C] w-28 truncate shrink-0">—</span>
                                    <div className="flex-1 h-7 rounded-lg" style={{ background: 'linear-gradient(90deg, #E8F6F5 0%, #f0fdfa 100%)' }} />
                                  </div>
                                )
                                const val = Number(r.omzet||0)
                                const qty = Number(r.qty||0)
                                const pct = Math.max(8, (val / maxVal) * 100)
                                return (
                                  <div key={r.id} className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 w-4 shrink-0 text-right">{index+1}</span>
                                    <span className="text-xs text-[#3C3C3C] w-28 truncate shrink-0" title={r.name}>{r.name}</span>
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                      <div className="flex-1 h-7 rounded-lg overflow-hidden relative" style={{ background: 'linear-gradient(90deg, #E8F6F5 0%, #f0fdfa 100%)' }}>
                                        <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2BA8A2, #3CC4BD)' }} />
                                        <div className="absolute inset-y-0 left-0 flex items-center px-2.5">
                                          <span className="text-xs font-bold text-white">• {fmtRp(val)}</span>
                                        </div>
                                      </div>
                                      <span className="text-xs shrink-0" style={{ color: '#8E8E8E' }}>{fmt(qty)} pcs</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </>
                    )
                  case 'top_7_days':
                    return (
                      <>
                        <h3 className="font-medium mb-3 text-sm" style={{ color: '#3C3C3C' }}>{card.title}</h3>
                        {top7.length === 0 ? (
                          <div className="text-xs" style={{ color: '#8E8E8E' }}>Belum ada data 7 hari terakhir</div>
                        ) : (() => {
                          const raw = top7.slice(0, 5)
                          const rows = raw.length < 5
                            ? [...raw, ...Array(5 - raw.length).fill(null)]
                            : raw
                          const maxVal = Math.max(...rows.filter(Boolean).map(r => Number(r.omzet||0)), 1)
                          return (
                            <div className="space-y-2.5">
                              {rows.map((r, index) => {
                                if (!r) return (
                                  <div key={`empty-${index}`} className="flex items-center gap-2 opacity-30">
                                    <span className="text-xs text-slate-400 w-4 shrink-0 text-right">{index+1}</span>
                                    <span className="text-xs text-[#3C3C3C] w-28 truncate shrink-0">—</span>
                                    <div className="flex-1 h-7 rounded-lg" style={{ background: 'linear-gradient(90deg, #E8F6F5 0%, #f0fdfa 100%)' }} />
                                  </div>
                                )
                                const val = Number(r.omzet||0)
                                const qty = Number(r.qty||0)
                                const pct = Math.max(8, (val / maxVal) * 100)
                                return (
                                  <div key={r.id} className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 w-4 shrink-0 text-right">{index+1}</span>
                                    <span className="text-xs text-[#3C3C3C] w-28 truncate shrink-0" title={r.name}>{r.name}</span>
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                      <div className="flex-1 h-7 rounded-lg overflow-hidden relative" style={{ background: 'linear-gradient(90deg, #E8F6F5 0%, #f0fdfa 100%)' }}>
                                        <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2BA8A2, #3CC4BD)' }} />
                                        <div className="absolute inset-y-0 left-0 flex items-center px-2.5">
                                          <span className="text-xs font-bold text-white">• {fmtRp(val)}</span>
                                        </div>
                                      </div>
                                      <span className="text-xs shrink-0" style={{ color: '#8E8E8E' }}>{fmt(qty)} pcs</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </>
                    )
                  case 'ap_chart':
                    return (
                      <>
                        <div className="flex items-start justify-between mb-2 gap-1.5 flex-wrap">
                          <h3 className="font-medium text-sm shrink-0" style={{ color: '#3C3C3C' }}>{card.title}</h3>
                          <div className="text-[11px] shrink-0" style={{ color: '#8E8E8E' }}>Total: {fmtRp(ap?.totalOutstanding ?? 0)}</div>
                        </div>
                        {!ap || (ap.rows||[]).length === 0 ? (
                          <div className="text-xs" style={{ color: '#8E8E8E' }}>Belum ada data hutang</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <BarChart labels={(ap.rows||[]).map(r=>fmtMonth(r.ym))} values={(ap.rows||[]).map(r=>Number(r.outstanding||0))} color="#2BA8A2" />
                          </div>
                        )}
                      </>
                    )
                  case 'stock_top':
                    return (
                      <>
                        <div className="flex items-start justify-between mb-3 gap-1.5 flex-wrap">
                          <h3 className="font-medium text-sm shrink-0" style={{ color: '#3C3C3C' }}>Top 5 Nilai Stok</h3>
                          <select className="px-2 py-1 rounded-lg text-xs focus:outline-none focus:ring-2"
                            style={{ backgroundColor: '#FFF8E7', borderColor: '#CBD5E1', borderWidth: 1 }}
                            onFocus={e => { e.currentTarget.style.borderColor = '#2BA8A2'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(43,168,162,0.2)' }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.boxShadow = 'none' }}>
                            <option>Bulan Ini</option>
                            <option>Bulan Lalu</option>
                          </select>
                        </div>
                        {!stock || (stock.top||[]).length === 0 ? (
                          <div className="text-slate-500 text-xs">Belum ada data persediaan</div>
                        ) : (() => {
                          const top5 = (stock.top||[]).slice(0, 5)
                          const maxVal = Math.max(...top5.map(r => Number(r.total_cost||0)), 1)
                          return (
                            <div className="space-y-2.5">
                              {top5.map((r, i) => {
                                const val = Number(r.total_cost||0)
                                const pct = Math.max(8, (val / maxVal) * 100)
                                return (
                                  <div key={r.id} className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 w-4 shrink-0 text-right">{i+1}</span>
                                    <span className="text-xs text-[#3C3C3C] w-28 truncate shrink-0" title={r.name}>{r.name}</span>
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                        <div className="flex-1 h-7 rounded-lg overflow-hidden relative" style={{ background: 'linear-gradient(90deg, #E8F6F5 0%, #f0fdfa 100%)' }}>
                                        <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2BA8A2, #3CC4BD)' }} />
                                        <div className="absolute inset-y-0 left-0 flex items-center px-2.5">
                                          <span className="text-xs font-bold text-white">• Rp {fmt(val)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </>
                    )
                  case 'stock_alerts':
                    return (
                      <>
                        <h3 className="font-medium mb-3 text-sm" style={{ color: '#3C3C3C' }}>{card.title}</h3>
                        {alerts.length === 0 ? (
                          <div className="text-xs" style={{ color: '#8E8E8E' }}>Tidak ada peringatan stok</div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead style={{ backgroundColor: '#E8F6F5' }}>
                              <tr>
                                <th className="text-left px-2 py-2 font-medium text-xs" style={{ color: '#2BA8A2' }}>Kode</th>
                                <th className="text-left px-2 py-2 font-medium text-xs" style={{ color: '#2BA8A2' }}>Nama</th>
                                <th className="text-right px-2 py-2 font-medium text-xs" style={{ color: '#2BA8A2' }}>Qty</th>
                                <th className="text-right px-2 py-2 font-medium text-xs" style={{ color: '#2BA8A2' }}>Min</th>
                              </tr>
                            </thead>
                            <tbody>
                              {alerts.map((a)=> (
                                <tr key={a.id} style={{ borderTop: '1px solid #E8F6F5' }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F6F580'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                  <td className="px-2 py-1.5" style={{ color: '#3C3C3C' }}>{a.code}</td>
                                  <td className="px-2 py-1.5" style={{ color: '#8E8E8E' }}>{a.name}</td>
                                  <td className="px-2 py-1.5 text-right" style={{ color: '#8E8E8E' }}>{fmt(Number(a.qty||0))}</td>
                                  <td className="px-2 py-1.5 text-right" style={{ color: '#8E8E8E' }}>{fmt(Number(a.min_stock||0))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </>
                    )
                  default:
                    return <div className="text-xs" style={{ color: '#8E8E8E' }}>Unknown card</div>
                }
              })()}
            </div>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setCardOrder(prev => {
                    const next = prev.filter(x => x !== card.id)
                    saveCardConfig(next, quickActionOrder)
                    return next
                  })
                }}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-white text-xs leading-none shadow z-10"
                style={{ backgroundColor: '#EF6C4A' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#D45233'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#EF6C4A'}
              >
                ✕
              </button>
            )}
            <div className={`absolute top-1 left-1 ${editing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
              <span className="text-xs" style={{ color: '#8E8E8E' }}>⠿</span>
            </div>
          </div>
          )
        })}
        {editing && (
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="h-full min-h-[80px] rounded-2xl border-2 border-dashed transition-colors flex items-center justify-center"
          style={{ borderColor: '#CBD5E1', color: '#94A3B8' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#2BA8A2'; e.currentTarget.style.backgroundColor = '#E8F6F5'; e.currentTarget.style.color = '#2BA8A2' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        )}
      </section>

      {/* Dialog: pilih kartu yang akan ditambahkan */}
      {showAddDialog && (() => {
        const hiddenCards = ALL_CARDS.filter(c => !cardOrder.includes(c.id))
        if (hiddenCards.length === 0) {
          return (
            <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6 z-50">
              <div className="w-full max-w-sm mt-20 p-6 text-center" style={{ backgroundColor: '#FFF8E7', borderRadius: '16px', boxShadow: '0 4px 20px rgba(43,168,162,0.15)' }}>
                <p className="text-sm mb-4" style={{ color: '#8E8E8E' }}>Semua kartu sudah ditampilkan</p>
                <button type="button" onClick={() => setShowAddDialog(false)}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all active:scale-95"
                  style={{ backgroundColor: '#2BA8A2', color: 'white', boxShadow: '0 4px 20px rgba(43,168,162,0.3)' }}>Tutup</button>
              </div>
            </div>
          )
        }
        return (
          <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6 z-50">
            <div className="w-full max-w-sm mt-20 overflow-hidden" style={{ backgroundColor: '#FFF8E7', borderRadius: '16px', boxShadow: '0 4px 20px rgba(43,168,162,0.15)' }}>
              <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: '#E8F6F5' }}>
                <div className="font-semibold text-sm" style={{ color: '#3C3C3C' }}>Tambah Kartu</div>
                <button type="button" onClick={() => setShowAddDialog(false)}
                  className="text-xs px-3 py-1 rounded-full border transition-all active:scale-95"
                  style={{ borderColor: '#CBD5E1', color: '#64748B' }}>Tutup</button>
              </div>
              <div className="p-3 space-y-1">
                {hiddenCards.map(card => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setCardOrder(prev => {
                        const next = [...prev, card.id]
                    saveCardConfig(next, quickActionOrder)
                        return next
                      })
                      setShowAddDialog(false)
                    }}
                    className="w-full text-left px-3 py-2 rounded-pill border text-sm flex items-center gap-2 transition-all hover:scale-[1.01] active:scale-95"
                    style={{ borderColor: '#E8F6F5', backgroundColor: 'white', color: '#3C3C3C' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2BA8A2'; e.currentTarget.style.backgroundColor = '#E8F6F5' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8F6F5'; e.currentTarget.style.backgroundColor = 'white' }}
                  >
                    <span className="shrink-0" style={{ color: '#2BA8A2' }}>{card.icon}</span>
                    <span>{card.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}




    </div>
  )
}
