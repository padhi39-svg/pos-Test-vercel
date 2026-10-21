export const roundRp = (v: number) => Math.round(v || 0)

export type TieredDiscountResult = {
  grossAmount: number
  discountPercent: number
  discountAmount: number
  disc1Percent: number
  disc1Amount: number
  disc2Percent: number
  disc2Amount: number
  disc3Percent: number
  disc3Amount: number
  discNominal: number
  totalDiscount: number
  netAmount: number
}

export function calculateTieredDiscount(
  qty: number,
  price: number,
  discountPercent: number = 0,
  disc1Percent: number = 0,
  disc2Percent: number = 0,
  disc3Percent: number = 0,
  discNominal: number = 0,
): TieredDiscountResult {
  const grossAmount = roundRp(qty * price)
  const dp = Math.min(Math.max(discountPercent || 0, 0), 100)
  const d1 = Math.min(Math.max(disc1Percent || 0, 0), 100)
  const d2 = Math.min(Math.max(disc2Percent || 0, 0), 100)
  const d3 = Math.min(Math.max(disc3Percent || 0, 0), 100)
  const dn = Math.max(0, discNominal || 0)

  let remaining = grossAmount

  const discountAmount = roundRp(remaining * (dp / 100))
  remaining -= discountAmount

  const disc1Amount = roundRp(remaining * (d1 / 100))
  remaining -= disc1Amount

  const disc2Amount = roundRp(remaining * (d2 / 100))
  remaining -= disc2Amount

  const disc3Amount = roundRp(remaining * (d3 / 100))
  remaining -= disc3Amount

  const discNominalAmount = Math.min(dn, remaining)
  remaining -= discNominalAmount

  const totalDiscount = discountAmount + disc1Amount + disc2Amount + disc3Amount + discNominalAmount
  const netAmount = Math.max(0, remaining)

  return {
    grossAmount,
    discountPercent: dp,
    discountAmount,
    disc1Percent: d1,
    disc1Amount,
    disc2Percent: d2,
    disc2Amount,
    disc3Percent: d3,
    disc3Amount,
    discNominal: discNominalAmount,
    totalDiscount,
    netAmount,
  }
}

export type AllocatedItem = {
  netAmount: number
  allocatedDiscount: number
  finalNetAmount: number
}

export function allocateHeaderDiscountProportional(
  items: { netAmount: number }[],
  headerDiscountAmount: number,
): AllocatedItem[] {
  const totalNet = items.reduce((s, i) => s + i.netAmount, 0)
  if (totalNet <= 0) {
    return items.map(i => ({ netAmount: i.netAmount, allocatedDiscount: 0, finalNetAmount: i.netAmount }))
  }

  const allocated: AllocatedItem[] = items.map((item, idx) => {
    const rawAlloc = roundRp(headerDiscountAmount * (item.netAmount / totalNet))
    return { netAmount: item.netAmount, allocatedDiscount: rawAlloc, finalNetAmount: 0 }
  })

  const allocatedSum = allocated.reduce((s, i) => s + i.allocatedDiscount, 0)
  let diff = roundRp(headerDiscountAmount - allocatedSum)

  // allocate rounding difference to last item
  if (diff !== 0 && allocated.length > 0) {
    allocated[allocated.length - 1].allocatedDiscount += diff
  }

  for (const a of allocated) {
    a.finalNetAmount = Math.max(0, a.netAmount - a.allocatedDiscount)
  }

  return allocated
}

export type PpnResult = {
  dpp: number
  ppnAmount: number
  grandTotal: number
}

export function calculatePpn(
  dppBase: number,
  ppnPercent: number,
  priceIncludeTax: boolean = false,
): PpnResult {
  const pct = Math.min(Math.max(ppnPercent || 0, 0), 100)

  if (priceIncludeTax) {
    const dpp = roundRp(dppBase / (1 + pct / 100))
    const ppnAmount = roundRp(dppBase - dpp)
    return { dpp, ppnAmount, grandTotal: dppBase }
  } else {
    const dpp = dppBase
    const ppnAmount = roundRp(dpp * (pct / 100))
    const grandTotal = dpp + ppnAmount
    return { dpp, ppnAmount, grandTotal }
  }
}
