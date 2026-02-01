/**
 * Tests for server-side EAS route functions
 * 
 * These test the core business logic in lib/server/eas-routes.ts
 * without HTTP handling overhead.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNonce, EasRouteError } from '@/lib/server/eas-routes';

// Mock ethers
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  return {
    ...actual,
    JsonRpcProvider: vi.fn(),
    Contract: vi.fn(),
  };
});

// Mock config modules
vi.mock('@/config/attestation-services', () => ({
  getContractAddress: vi.fn((service: string, chainId: number) => {
    if (service === 'eas' && chainId === 66238) {
      return '0x8835AF90f1537777F52E482C8630cE4e947eCa32';
    }
    return undefined;
  }),
}));

vi.mock('@/config/chains', () => ({
  omachainTestnet: {
    id: 66238,
    name: 'OMAchain Testnet',
    rpc: 'https://rpc.testnet.chain.oma3.org/',
  },
  omachainMainnet: {
    id: 6623,
    name: 'OMAchain Mainnet',
    rpc: 'https://rpc.chain.oma3.org/',
  },
}));

describe('getNonce', () => {
  const validAddress = '0x1234567890123456789012345678901234567890';
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to testnet
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-testnet';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('input validation', () => {
    it('throws 400 for empty attester', async () => {
      await expect(getNonce('')).rejects.toThrow(EasRouteError);
      
      try {
        await getNonce('');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
        expect((error as EasRouteError).message).toContain('Missing');
      }
    });

    it('throws 400 for invalid address format', async () => {
      await expect(getNonce('not-an-address')).rejects.toThrow(EasRouteError);
      
      try {
        await getNonce('0xinvalid');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
        expect((error as EasRouteError).message).toContain('Invalid');
      }
    });

    it('throws 400 for address with wrong length', async () => {
      try {
        await getNonce('0x1234'); // Too short
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
      }
    });
  });

  describe('successful nonce fetch', () => {
    it('returns nonce and chain info for valid address', async () => {
      const { Contract } = await import('ethers');
      const mockGetNonce = vi.fn().mockResolvedValue(BigInt(42));
      (Contract as any).mockImplementation(() => ({
        getNonce: mockGetNonce,
      }));

      const result = await getNonce(validAddress);

      expect(result).toEqual({
        nonce: '42',
        chain: 'OMAchain Testnet',
        chainId: 66238,
        easAddress: '0x8835AF90f1537777F52E482C8630cE4e947eCa32',
      });
      expect(mockGetNonce).toHaveBeenCalledWith(validAddress);
    });

    it('returns nonce as string (not BigInt)', async () => {
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        getNonce: vi.fn().mockResolvedValue(BigInt(999)),
      }));

      const result = await getNonce(validAddress);

      expect(typeof result.nonce).toBe('string');
      expect(result.nonce).toBe('999');
    });

    it('handles zero nonce correctly', async () => {
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        getNonce: vi.fn().mockResolvedValue(BigInt(0)),
      }));

      const result = await getNonce(validAddress);

      expect(result.nonce).toBe('0');
    });
  });

  describe('RPC error handling', () => {
    it('throws 500 when RPC call fails', async () => {
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        getNonce: vi.fn().mockRejectedValue(new Error('RPC connection failed')),
      }));

      try {
        await getNonce(validAddress);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(500);
        expect((error as EasRouteError).message).toContain('RPC');
      }
    });

    it('includes original error message in thrown error', async () => {
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        getNonce: vi.fn().mockRejectedValue(new Error('Network timeout')),
      }));

      try {
        await getNonce(validAddress);
      } catch (error) {
        expect((error as EasRouteError).message).toContain('Network timeout');
      }
    });
  });
});

describe('EasRouteError', () => {
  it('has correct name property', () => {
    const error = new EasRouteError('Test error', 400);
    expect(error.name).toBe('EasRouteError');
  });

  it('stores statusCode', () => {
    const error = new EasRouteError('Test error', 403);
    expect(error.statusCode).toBe(403);
  });

  it('stores optional code', () => {
    const error = new EasRouteError('Test error', 400, 'INVALID_INPUT');
    expect(error.code).toBe('INVALID_INPUT');
  });

  it('is instanceof Error', () => {
    const error = new EasRouteError('Test', 500);
    expect(error).toBeInstanceOf(Error);
  });
});
