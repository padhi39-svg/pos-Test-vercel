"use client"
import { useRouter } from 'next/navigation'
import BankForm from '@/components/master/BankForm'
import { showSuccess, showError, CrudMessages, CrudErrors } from '@/lib/notification'

export default function BankNewPage() {
  const router = useRouter()
  const returnQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('return') || '' : ''
  return (
    <BankForm
      title="Tambah Bank"
      basePath="/bank"
      onSubmit={async (form) => {
        try {
          const res = await fetch('/api/banks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            showError(err?.error || CrudErrors.createFailed('bank'))
            return
          }
          showSuccess(CrudMessages.created('bank'))
          router.push('/bank?' + returnQuery)
        } catch (e) {
          console.error('Create bank error:', e)
          showError(CrudErrors.createFailed('bank'))
        }
      }}
    />
  )
}
