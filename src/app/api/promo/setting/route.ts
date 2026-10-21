import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { getLandingSettings, upsertLandingSettings } from '@/lib/repositories/promoRepository'

export async function GET(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'view'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  const settings = await getLandingSettings()
  return NextResponse.json({ settings })
}

export async function PUT(req: NextRequest) {
  if (!(await hasPermission(req, 'promo_settings', 'edit'))) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const data: any = {}
    if (body?.mainBackgroundType !== undefined) data.mainBackgroundType = String(body.mainBackgroundType)
    if (body?.mainBackgroundValue !== undefined) data.mainBackgroundValue = body.mainBackgroundValue ? String(body.mainBackgroundValue) : ''
    if (body?.menuBackgroundType !== undefined) data.menuBackgroundType = String(body.menuBackgroundType)
    if (body?.menuBackgroundValue !== undefined) data.menuBackgroundValue = body.menuBackgroundValue ? String(body.menuBackgroundValue) : ''
    if (body?.promoHeaderBg !== undefined) data.promoHeaderBg = body.promoHeaderBg ? String(body.promoHeaderBg) : ''
    if (body?.menuHeaderBg !== undefined) data.menuHeaderBg = body.menuHeaderBg ? String(body.menuHeaderBg) : ''
    if (body?.promoDiscountBg !== undefined) data.promoDiscountBg = body.promoDiscountBg ? String(body.promoDiscountBg) : ''
    if (body?.menuPriceColor !== undefined) data.menuPriceColor = body.menuPriceColor ? String(body.menuPriceColor) : ''
    if (body?.cardBorderColor !== undefined) data.cardBorderColor = body.cardBorderColor ? String(body.cardBorderColor) : ''
    if (body?.dividerColor !== undefined) data.dividerColor = body.dividerColor ? String(body.dividerColor) : ''
    if (body?.promoCardTextColor !== undefined) data.promoCardTextColor = body.promoCardTextColor ? String(body.promoCardTextColor) : ''
    if (body?.promoCardDescriptionColor !== undefined) data.promoCardDescriptionColor = body.promoCardDescriptionColor ? String(body.promoCardDescriptionColor) : ''
    if (body?.promoCardPriceColor !== undefined) data.promoCardPriceColor = body.promoCardPriceColor ? String(body.promoCardPriceColor) : ''
    if (body?.menuCardTextColor !== undefined) data.menuCardTextColor = body.menuCardTextColor ? String(body.menuCardTextColor) : ''
    if (body?.heroImage !== undefined) data.heroImage = body.heroImage ? String(body.heroImage) : ''
    if (body?.heroTitle !== undefined) data.heroTitle = body.heroTitle ? String(body.heroTitle) : ''
    if (body?.heroSubtitle !== undefined) data.heroSubtitle = body.heroSubtitle ? String(body.heroSubtitle) : ''
    if (body?.promoCardBg !== undefined) data.promoCardBg = body.promoCardBg ? String(body.promoCardBg) : ''
    if (body?.menuDescColor !== undefined) data.menuDescColor = body.menuDescColor ? String(body.menuDescColor) : ''
    if (body?.menuCaptionColor !== undefined) data.menuCaptionColor = body.menuCaptionColor ? String(body.menuCaptionColor) : ''
    if (body?.categoryActiveBg !== undefined) data.categoryActiveBg = body.categoryActiveBg ? String(body.categoryActiveBg) : ''
    if (body?.categoryActiveText !== undefined) data.categoryActiveText = body.categoryActiveText ? String(body.categoryActiveText) : ''
    if (body?.categoryInactiveBg !== undefined) data.categoryInactiveBg = body.categoryInactiveBg ? String(body.categoryInactiveBg) : ''
    if (body?.categoryInactiveText !== undefined) data.categoryInactiveText = body.categoryInactiveText ? String(body.categoryInactiveText) : ''
    if (body?.categoryInactiveBorder !== undefined) data.categoryInactiveBorder = body.categoryInactiveBorder ? String(body.categoryInactiveBorder) : ''
    if (body?.categoryLabelBg !== undefined) data.categoryLabelBg = body.categoryLabelBg ? String(body.categoryLabelBg) : ''
    if (body?.categoryLabelText !== undefined) data.categoryLabelText = body.categoryLabelText ? String(body.categoryLabelText) : ''
    if (body?.categoryLabelBorder !== undefined) data.categoryLabelBorder = body.categoryLabelBorder ? String(body.categoryLabelBorder) : ''
    await upsertLandingSettings(data)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal simpan' }, { status: 500 })
  }
}
