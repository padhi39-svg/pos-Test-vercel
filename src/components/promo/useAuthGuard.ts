'use client'

import { useEffect, useState } from 'react'

export function useAuthGuard() {
  // Area /promo (termasuk setting) diakses publik tanpa login, sejajar dengan landing /promo
  return true
}
