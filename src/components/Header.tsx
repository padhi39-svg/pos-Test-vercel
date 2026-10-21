"use client"
import HeaderMenu from './HeaderMenu'

export default function Header({ onMenuToggle, onToggleNavbar, logoUrl }: { onMenuToggle?: () => void; onToggleNavbar?: () => void; logoUrl?: string }) {
  return <HeaderMenu onMenuToggle={onMenuToggle} onToggleNavbar={onToggleNavbar} logoUrl={logoUrl} />
}
