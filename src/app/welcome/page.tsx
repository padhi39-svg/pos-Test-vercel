"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function WelcomePage(){
  const [userName, setUserName] = useState<string>("")
  const [posPerm, setPosPerm] = useState({ retail: false, resto: false, table: false })

  useEffect(()=>{ (async()=>{
    try{
      const res = await fetch('/api/auth/me', { cache:'no-store' })
      const d = await res.json().catch(()=>({}))
      setUserName(d?.user?.name || "")
      const perms = Array.isArray(d?.user?.permissions) ? d.user.permissions : []
      const find = (code: string) => {
        const row = perms.find((p: any) => String(p.menu_code) === code)
        return row && Number(row.can_view) === 1
      }
      setPosPerm({ retail: find('pos_retail'), resto: find('pos_resto'), table: find('pos_resto_table') })
    }catch{}
  })() },[])

  const hasAny = posPerm.retail || posPerm.resto || posPerm.table

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Selamat Datang{userName? ", "+userName: ''} 👋</h1>
        <p className="text-sm text-slate-600 mt-1">Silakan pilih menu akses cepat di bawah ini.</p>
      </div>

      {hasAny && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {posPerm.resto && (
            <Link href="/pos" className="block p-5 bg-[#FFA16C] text-white rounded-xl shadow-sm hover:bg-[#FF8F55] transition text-center font-semibold text-lg">
              POS Resto
            </Link>
          )}
          {posPerm.table && (
            <Link href="/pos/resto-table" className="block p-5 bg-[#3C3C3C] text-white rounded-xl shadow-sm hover:bg-[#2A2A2A] transition text-center font-semibold text-lg">
              POS Table
            </Link>
          )}
          {posPerm.retail && (
            <Link href="/pos/retail" className="block p-5 bg-slate-600 text-white rounded-xl shadow-sm hover:bg-slate-700 transition text-center font-semibold text-lg">
              POS Retail
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
