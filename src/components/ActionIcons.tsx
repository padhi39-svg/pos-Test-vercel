"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type AksesOverrideConfig = {
  menuCode: string
  canEdit: boolean
  canVoid: boolean
  canPrint: boolean
}

export default function ActionIcons({
  viewHref,
  editHref,
  showEdit = true,
  showView = true,
  onVoid,
  disabledVoid = false,
  titleView = 'Lihat Detail',
  titleEdit = 'Edit',
  titleVoid = 'Void',
  disabledEdit = false,
  forceShowVoid = false,
  onPrint,
  disabledPrint = false,
  titlePrint = 'Print',
  showPrint = true,
  aksesOverride,
  onAksesOverride,
}: {
  viewHref: string
  editHref?: string
  showEdit?: boolean
  showView?: boolean
  onVoid?: () => void | Promise<void>
  disabledVoid?: boolean
  titleView?: string
  titleEdit?: string
  titleVoid?: string
  disabledEdit?: boolean
  forceShowVoid?: boolean
  onPrint?: () => void
  disabledPrint?: boolean
  titlePrint?: string
  showPrint?: boolean
  aksesOverride?: AksesOverrideConfig
  onAksesOverride?: (action: 'edit' | 'void' | 'print') => void
}) {
  const router = useRouter()

  const needsOverride = (action: 'edit' | 'void' | 'print') => {
    if (!aksesOverride || !onAksesOverride) return false
    if (action === 'edit' && !aksesOverride.canEdit) return true
    if (action === 'void' && !aksesOverride.canVoid) return true
    if (action === 'print' && !aksesOverride.canPrint) return true
    return false
  }

  const handleEditClick = (e: React.MouseEvent) => {
    if (needsOverride('edit')) {
      e.preventDefault()
      onAksesOverride!('edit')
    }
  }

  const handleVoidClick = () => {
    if (needsOverride('void')) {
      onAksesOverride!('void')
      return
    }
    if (onVoid) onVoid()
  }

  const handlePrintClick = () => {
    if (needsOverride('print')) {
      onAksesOverride!('print')
      return
    }
    if (onPrint) onPrint()
  }

  return (
    <div className="inline-flex items-center gap-2">
      {showView && (
        <Link
          href={viewHref}
          className="text-teal-primary hover:text-teal-dark"
          title={titleView}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </Link>
      )}
      {showEdit && (
        editHref ? (
          <Link
            href={editHref}
            onClick={handleEditClick}
            title={titleEdit}
            className="p-1 rounded-pill text-teal-primary hover:text-teal-dark"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Link>
        ) : (
          <button disabled title={titleEdit} className="p-1 rounded-pill text-slate-300 cursor-not-allowed">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )
      )}
      {(forceShowVoid || onVoid) && (
        <button
          onClick={handleVoidClick}
          title={titleVoid}
          className={(!onVoid && !needsOverride('void')) ? 'text-slate-300 cursor-not-allowed' : 'text-red-600 hover:text-red-800'}
          disabled={!onVoid && !needsOverride('void')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {showPrint && (
        <button
          onClick={handlePrintClick}
          title={titlePrint}
          className={!onPrint && !needsOverride('print') ? 'p-1 rounded-pill text-slate-300 cursor-not-allowed' : 'p-1 rounded-pill text-slate-600 hover:text-slate-800'}
          disabled={!onPrint && !needsOverride('print')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        </button>
      )}
    </div>
  )
}
