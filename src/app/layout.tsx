import type { Metadata, Viewport } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'
import PwaRegister from '@/components/PwaRegister'
import { ReactNode } from 'react'
import { getDb } from '@/db'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1c1917',
}

export async function generateMetadata(): Promise<Metadata> {
  let iconUrl: string | null = null
  try {
    const db = getDb()
    const pool = (db as any).$client
    const { rows } = await pool.query("SELECT setting_key, setting_value FROM settings WHERE setting_group = 'company'")
    const map: Record<string, string> = {}
    for (const r of rows) map[r.setting_key] = r.setting_value ?? ''
    iconUrl = (map['company_favicon_url'] || map['company_logo_url'] || '').trim() || null
  } catch (e) {
    console.warn('generateMetadata: fallback to defaults', e)
  }
  const icons = iconUrl ? { icon: iconUrl, apple: iconUrl } : { icon: '/icon.svg', apple: '/icon.svg' }
  return {
    title: 'Magnus',
    description: 'Magnus - Management System',
    icons,
    manifest: '/manifest.json',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Magnus' },
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
    },
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Defaults (same as Settings page)
  let sidebarBg = '#FFFFFF'
  let sidebarText = '#969BA0'
  let sidebarHoverBg = '#EFF6FF'
  let sidebarActiveBg = '#DBEAFE'
  let sidebarActiveText = '#1D4ED8'
  let logoUrl = ''
  try {
    const db = getDb()
    const pool = (db as any).$client
    const { rows } = await pool.query("SELECT setting_key, setting_value FROM settings WHERE setting_group = 'company'")
    const map: Record<string, string> = {}
    for (const r of rows) map[r.setting_key] = r.setting_value ?? ''
    logoUrl = (map['company_logo_url'] || '').trim()
    sidebarBg = map['design_sidebar_bg'] || sidebarBg
    sidebarText = map['design_sidebar_text'] || sidebarText
    sidebarHoverBg = map['design_sidebar_hover_bg'] || sidebarHoverBg
    sidebarActiveBg = map['design_sidebar_active_bg'] || sidebarActiveBg
    sidebarActiveText = map['design_sidebar_active_text'] || sidebarActiveText
  } catch (e) {
    console.warn('Skip reading design settings for SSR:', e)
  }
  const css = `:root{--sidebar-bg:${sidebarBg};--sidebar-text:${sidebarText};--sidebar-hover-bg:${sidebarHoverBg};--sidebar-active-bg:${sidebarActiveBg};--sidebar-active-text:${sidebarActiveText};}`

  return (
    <html lang="en" className="overflow-x-hidden">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap" rel="stylesheet" />
      </head>
      <body className="overflow-x-hidden w-full">
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <PwaRegister />
        <AppShell logoUrl={logoUrl}>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
