"use client"

import UserForm from '../UserForm'

export default function NewUserPage(){
  const onSubmit = async (payload: any) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const d = await res.json().catch(()=>({}))
      throw new Error(d?.error || 'Gagal menyimpan')
    }
    return res
  }

  return (
    <UserForm title="Tambah User" basePath="/users" onSubmit={onSubmit} />
  )
}
