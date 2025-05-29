'use client'

import { ReactNode } from 'react'
import { WalletContextProvider, createWalletConfig } from '@/lib/wallet-abstraction'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const walletConfig = createWalletConfig()
  
  return (
    <WalletContextProvider config={walletConfig}>
      {children}
    </WalletContextProvider>
  )
}