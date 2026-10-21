// Default values - will be overridden by settings from API
export const DEFAULT_CACHE_TTL_HOURS = 3;
export const DEFAULT_SELF_PAY = false;

// These will be populated at runtime from /api/self-order/settings
let _cacheTtlHours: number = DEFAULT_CACHE_TTL_HOURS;
let _selfPay: boolean = DEFAULT_SELF_PAY;

export function setSelfOrderSettings(cacheTtlHours: number, selfPay: boolean) {
  _cacheTtlHours = cacheTtlHours;
  _selfPay = selfPay;
}

export function getSelfOrderCacheTtlMs(): number {
  return _cacheTtlHours * 60 * 60 * 1000;
}

export function getSelfPay(): boolean {
  return _selfPay;
}

// For backward compatibility
export const SELF_ORDER_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
export const SELF_PAY = false;
