"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import UserForm from '../UserForm'

export default function ViewUserPage(){
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
      }catch(e){
        router.push('/users')
      }finally{
        setLoading(false)
      }
    }
    if(id) load()
  },[id, router])

  if (loading) return <div className="p-3">Memuat...</div>
  if (!initial) return <div className="p-3">Data tidak ditemukan</div>

  return (
    <div className="p-3">
      <UserForm title={`User: ${initial.name || initial.code}`} basePath="/users" initial={initial} currentId={id} readonly />
    </div>
  )
}
