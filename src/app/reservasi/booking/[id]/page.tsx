"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

export default function ViewReservationPage(){
  const router = useRouter()
  const params = useParams()
  const id = Number(params?.id)
  const [item, setItem] = useState<any|null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/reservations/${id}`)
      const data = res.ok ? await res.json() : null
      setItem(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ if(Number.isFinite(id)) load() },[id])

  const statusColor = (s:string)=> ({pending:'#64748b',confirmed:'#0284c7',seated:'#16a34a',completed:'#0ea5e9',canceled:'#ef4444',no_show:'#f97316'} as any)[s] || '#64748b'

  if(loading) return <div className="text-slate-500">Memuat...</div>
  if(!item) return <div className="text-slate-500">Data tidak ditemukan</div>

  const tableCodes = Array.isArray(item?.tables) ? item.tables.map((t:any)=> t.code).join(', ') : '-'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Detail Reservasi {item.number}</h1>
          <p className="text-slate-500 text-xs mt-1">Informasi lengkap reservasi</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=> router.push('/reservasi/booking')} className="px-3 py-1.5 rounded border">Kembali</button>
          <Link href={`/reservasi/booking/${id}/edit`} className="px-3 py-1.5 rounded bg-teal-primary hover:bg-teal-dark text-white">Edit</Link>
        </div>
      </div>

      <div className="container-card p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-slate-600">Nomor</div>
            <div className="font-semibold text-sm">{item.number}</div>
          </div>
          <span className="px-2 py-0.5 rounded text-white" style={{backgroundColor: statusColor(item.status)}}>{item.status}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-slate-600">Tanggal</div>
            <div>{item.date}</div>
          </div>
          <div>
            <div className="text-slate-600">Waktu</div>
            <div>{item.start_time} - {item.end_time}</div>
          </div>
          <div>
            <div className="text-slate-600">Jumlah Tamu (Pax)</div>
            <div>{item.pax}</div>
          </div>
          <div>
            <div className="text-slate-600">Meja</div>
            <div>{tableCodes || '-'}</div>
          </div>
          <div>
            <div className="text-slate-600">Customer</div>
            <div>{item.customer_name || '-'}</div>
          </div>
          <div>
            <div className="text-slate-600">PIC</div>
            <div>{item.pic || '-'}</div>
          </div>
          <div>
            <div className="text-slate-600">Perusahaan</div>
            <div>{item.company || '-'}</div>
          </div>
          <div>
            <div className="text-slate-600">Telp</div>
            <div>{item.phone || '-'}</div>
          </div>
          <div>
            <div className="text-slate-600">Transfer A/N</div>
            <div>{item.transfer_name || '-'}</div>
          </div>
          <div>
            <div className="text-slate-600">DP</div>
            <div>{item.dp_amount ? `Rp ${Number(item.dp_amount).toLocaleString('id-ID')}` : '-'}{item.dp_amount ? (item.dp_paid? ' (Terbayar)' : ' (Belum)') : ''}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-slate-600">Catatan</div>
            <div className="whitespace-pre-wrap">{item.notes || '-'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
