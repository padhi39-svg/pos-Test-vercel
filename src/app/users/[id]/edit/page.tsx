"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import UserForm from '../../UserForm'
import { showError } from '@/lib/notification'

export default function EditUserPage(){
  const params = useParams()
  const router = useRouter()
  const idStr = Array.isArray(params?.id) ? params.id[0] : params?.id
  const id = Number(idStr)
  const [initial, setInitial] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    const load = async ()=>{
      try{
        const res = await fetch(`/api/users/${id}`)
        if(!res.ok) throw new Error('Gagal memuat user')
        const data = await res.json()
        setInitial(data)
      }catch(e:any){
        showError(e.message || 'Gagal memuat user')
        router.push('/users')
      }finally{
        setLoading(false)
      }
    }
    if(id) load()
  },[id, router])

  const onSubmit = async (payload: any) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if(!res.ok){
      const d = await res.json().catch(()=>({}))
      showError(d?.error || 'Gagal menyimpan perubahan')
      return res
    }
    return res
  }

  if (loading) return <div className="p-3">Memuat...</div>
  if (!initial) return <div className="p-3">Data tidak ditemukan</div>

  return (
    <div className="p-3">
      <UserForm title={`Edit User: ${initial.name || initial.code}`} basePath="/users" initial={initial} onSubmit={onSubmit} currentId={id} />
    </div>
  )
}
