'use client'

import React from 'react'
import { ReactNode } from 'react'
import { ThirdwebProvider } from 'thirdweb/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BackendSessionProvider } from '@/components/backend-session-provider'

interface ProvidersProps {
  children: ReactNode
}

// Create a client for react-query
const queryClient = new QueryClient()

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThirdwebProvider>
        <BackendSessionProvider>
          {children}
        </BackendSessionProvider>
      </ThirdwebProvider>
    </QueryClientProvider>
  )
}
