'use client'

import { Web3AuthProvider } from '@web3auth/modal/react'
import { web3AuthContextConfig } from '@/lib/web3auth'
import { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <Web3AuthProvider config={web3AuthContextConfig}>
      {children}
    </Web3AuthProvider>
  )
} 