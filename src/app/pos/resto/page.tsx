"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import PosRestoPageInner from "./PosRestoPageInner"

type TempOrderItem = {
  id: number
  temp_order_id: number
  barang_id: number
  barang_code: string
  barang_name: string
  quantity: number
  unit_price: number
  total_price: number
  modifier: string | null
  kategori_id: number | null
}

type TempOrder = {
  id: number
  table_id: number
  customer_name: string | null
  waiter_name: string | null
  guest_count: number | null
  items?: TempOrderItem[]
}

export default function POSRestoPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <POSRestoContent />
    </Suspense>
  )
}

function POSRestoContent() {
  const searchParams = useSearchParams()
  const [tempOrder, setTempOrder] = useState<TempOrder | null>(null)

  const tableIdParam = searchParams.get("table_id")
  const tableId = tableIdParam ? Number(tableIdParam) || null : null
  const fromParam = searchParams.get('from')
  const openPayParam = searchParams.get('open_pay')
  const openBillParam = searchParams.get('open_bill')
  const openPayOnLoad = openPayParam === '1' || fromParam === 'table'
  const skipCaptionOnPay = fromParam === 'table'
  const billModeOnLoad = openBillParam === '1' && fromParam === 'bill'
  const isTakeAway = fromParam === 'takeaway'

  useEffect(() => {
    if (!tableId) {
      setTempOrder(null)
      return
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/pos/resto-temp?table_id=${encodeURIComponent(String(tableId))}`)
        if (!res.ok) return
        const data = await res.json()
        setTempOrder(data || null)
      } catch {
        setTempOrder(null)
      }
    }
    load()
  }, [tableId])

  const restoTableLabel = (() => {
    if (!tableId) return undefined
    const base = `Meja ID ${tableId}`
    if (!tempOrder) return base
    const cust = tempOrder.customer_name || "Umum"
    const waiter = tempOrder.waiter_name || "-"
    const guest = tempOrder.guest_count ?? 1
    return `${base} • Customer: ${cust} • Waiter: ${waiter} • Tamu: ${guest}`
  })()

  const hasSavedBefore = !!tempOrder

  return (
    <PosRestoPageInner
      restoTableLabel={restoTableLabel}
      tableId={tableId ?? undefined}
      hasSavedBefore={hasSavedBefore}
      tempOrderId={tempOrder?.id}
      initialTempItems={tempOrder?.items}
      openPayOnLoad={openPayOnLoad}
      skipCaptionOnPay={skipCaptionOnPay}
      billModeOnLoad={billModeOnLoad}
      isTakeAway={isTakeAway}
    />
  )
}

