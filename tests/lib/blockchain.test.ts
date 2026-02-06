import { renderHook } from '@testing-library/react'
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest'
import { useWallet } from '@/lib/blockchain'
import * as thirdwebReact from 'thirdweb/react'

// Mock environment variable to use BSC Testnet for tests
const originalEnv = process.env.NEXT_PUBLIC_ACTIVE_CHAIN
beforeEach(() => {
  process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'bsc-testnet'
})
afterEach(() => {
  process.env.NEXT_PUBLIC_ACTIVE_CHAIN = originalEnv
})

// Mock thirdweb/react and thirdweb/chains at the top level
const mockAccount = {
  address: '0x123',
  foo: 'bar',
  sendTransaction: vi.fn(),
  signMessage: vi.fn(),
  signTypedData: vi.fn(),
}
const mockChain = { id: 97, name: 'BSC Testnet', rpc: 'https://bsc-testnet-rpc' }

vi.mock('thirdweb/react', () => ({
  useActiveAccount: vi.fn(() => mockAccount),
  useActiveWalletChain: vi.fn(() => mockChain),
}))

vi.mock('thirdweb/chains', () => {
  const chainMock = { id: 97, rpc: 'https://bsc-testnet-rpc' }
  const bscMock = { id: 56, rpc: 'https://bsc-rpc' }
  const sepoliaMock = { id: 11155111, rpc: 'https://sepolia-rpc' }
  const mainnetMock = { id: 1, rpc: 'https://mainnet-rpc' }
  return {
    bscTestnet: chainMock,
    bsc: bscMock,
    sepolia: sepoliaMock,
    mainnet: mainnetMock,
  }
})

describe('useWallet', () => {
  const mockedUseActiveAccount = vi.mocked(thirdwebReact.useActiveAccount)
  const mockedUseActiveWalletChain = vi.mocked(thirdwebReact.useActiveWalletChain)

  beforeEach(() => {
    mockedUseActiveAccount.mockImplementation(() => mockAccount)
    mockedUseActiveWalletChain.mockImplementation(() => mockChain)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct wallet and chain info when connected to supported chain', () => {
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'bsc-testnet'
    const { result } = renderHook(() => useWallet())
    expect(result.current.isConnected).toBe(true)
    expect(result.current.address).toBe('0x123')
    expect(result.current.chainId).toBe(97)
    expect(result.current.isChainSupported).toBe(true)
    expect(result.current.isAttestationSupported).toBe(true)
    expect(result.current.account).toEqual(mockAccount)
    expect(result.current.chain.id).toBe(97) // Active chain from environment
    expect(result.current.supportedChainIds).toEqual([66238, 6623, 97, 56, 11155111, 1])
  })

  it('returns not connected and null address if no account', () => {
    mockedUseActiveAccount.mockImplementation(() => undefined)
    const { result } = renderHook(() => useWallet())
    expect(result.current.isConnected).toBe(false)
    expect(result.current.address).toBeNull()
  })

  it('returns default chainId if no chain', () => {
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'bsc-testnet'
    mockedUseActiveWalletChain.mockImplementation(() => undefined)
    const { result } = renderHook(() => useWallet())
    expect(result.current.chainId).toBe(97)
    expect(result.current.isChainSupported).toBe(true)
    expect(result.current.isAttestationSupported).toBe(true)
  })

  it('returns isChainSupported and isAttestationSupported false for unsupported chain', () => {
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'mainnet'
    mockedUseActiveWalletChain.mockImplementation(() => ({ id: 1, rpc: 'https://mainnet-rpc' })) // mainnet
    const { result } = renderHook(() => useWallet())
    expect(result.current.chainId).toBe(1)
    expect(result.current.isChainSupported).toBe(false)
    expect(result.current.isAttestationSupported).toBe(false)
  })

  it('uses omachain-mainnet when NEXT_PUBLIC_ACTIVE_CHAIN is omachain-mainnet', () => {
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-mainnet'
    const { result } = renderHook(() => useWallet())
    expect(result.current.chainId).toBe(6623)
    expect(result.current.chain.name).toMatch(/OMAchain Mainnet/i)
  })

  it('uses bsc-mainnet when NEXT_PUBLIC_ACTIVE_CHAIN is bsc-mainnet', () => {
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'bsc-mainnet'
    const { result } = renderHook(() => useWallet())
    expect(result.current.chainId).toBe(56)
    expect(result.current.chain.name).toMatch(/BSC Mainnet/i)
  })

  it('uses sepolia when NEXT_PUBLIC_ACTIVE_CHAIN is sepolia', () => {
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'sepolia'
    const { result } = renderHook(() => useWallet())
    expect(result.current.chainId).toBe(11155111)
    expect(result.current.chain.name).toMatch(/Sepolia/i)
  })

  it('uses omachain-testnet when NEXT_PUBLIC_ACTIVE_CHAIN is omachain-testnet', () => {
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-testnet'
    const { result } = renderHook(() => useWallet())
    expect(result.current.chainId).toBe(66238)
    expect(result.current.chain.name).toMatch(/OMAchain Testnet/i)
  })

  it('uses omachain-testnet when NEXT_PUBLIC_ACTIVE_CHAIN is invalid (default)', () => {
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'invalid-or-unset'
    const { result } = renderHook(() => useWallet())
    expect(result.current.chainId).toBe(66238)
    expect(result.current.chain.name).toMatch(/OMAchain Testnet/i)
  })
}) 