'use client'

import { ReactNode } from 'react'
import { WalletContextProvider, createWalletConfig } from '@/lib/wallet-abstraction'
import { ThirdwebProvider } from 'thirdweb/react'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const walletConfig = createWalletConfig()
  
  return (
    <ThirdwebProvider>
      <WalletContextProvider config={walletConfig}>
        {children}
      </WalletContextProvider>
    </ThirdwebProvider>
  )
}