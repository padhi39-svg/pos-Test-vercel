"use client"
import { useEffect } from 'react'
import { initializeLocalStoragePrevention } from '@/lib/preventLocalStorage'

export default function LocalStorageProtection() {
  useEffect(() => {
    // Initialize localStorage prevention on client side
    initializeLocalStoragePrevention()
  }, [])

  // This component doesn't render anything, it just provides protection
  return null
}
