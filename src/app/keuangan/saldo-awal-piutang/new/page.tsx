"use client"
import ArOpeningBalanceForm from '@/components/keuangan/ArOpeningBalanceForm'

export default function ArOpeningNewPage() {
  return (
    <ArOpeningBalanceForm
      mode="new"
      backHref="/keuangan/saldo-awal-piutang"
    />
  )
}
