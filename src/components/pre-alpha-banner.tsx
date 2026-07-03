'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export function PreAlphaBanner() {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Check if banner was previously dismissed
    const isDismissed = sessionStorage.getItem('preAlphaBannerDismissed')
    if (isDismissed) {
      setIsVisible(false)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    sessionStorage.setItem('preAlphaBannerDismissed', 'true')
  }

  const isMainnet = process.env.NEXT_PUBLIC_ACTIVE_CHAIN === 'omachain-mainnet'

  if (!isVisible || !isMainnet) return null

  return (
    <div className="relative border-b border-primary/30 bg-primary/10 px-4 py-3 text-foreground shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <p className="text-sm font-medium">
          Public Beta running on mainnet- your data will not be lost. If you encounter an issue, please{' '}
          <a
            href="https://github.com/oma3dao/rep-attestation-frontend/issues/new/choose"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary"
          >
            file it on GitHub
          </a>.
        </p>
        <button
          onClick={handleDismiss}
          className="ml-4 rounded-full p-1 transition-colors hover:bg-primary/15"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
} 
