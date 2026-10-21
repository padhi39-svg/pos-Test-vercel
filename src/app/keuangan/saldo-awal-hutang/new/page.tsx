"use client"
import ApOpeningBalanceForm from '@/components/keuangan/ApOpeningBalanceForm'

export default function ApOpeningNewPage() {
  return (
    <ApOpeningBalanceForm
      mode="new"
      backHref="/keuangan/saldo-awal-hutang"
    />
  )
}
