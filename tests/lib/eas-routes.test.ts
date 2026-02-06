/**
 * Tests for server-side EAS route functions
 * 
 * These test the core business logic in lib/server/eas-routes.ts
 * without HTTP handling overhead.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNonce, submitDelegatedAttestation, EasRouteError } from '@/lib/server/eas-routes';

// Mock ethers
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  return {
    ...actual,
    JsonRpcProvider: vi.fn(),
    Contract: vi.fn(),
    Wallet: vi.fn(),
    verifyTypedData: vi.fn(),
    keccak256: vi.fn(() => '0xmockhash'),
    toUtf8Bytes: vi.fn((str: string) => str),
    isAddress: (actual as any).isAddress,
  };
});

// Mock config modules
vi.mock('@/config/attestation-services', () => ({
  getContractAddress: vi.fn((service: string, chainId: number) => {
    if (service === 'eas') {
      if (chainId === 66238) {
        return '0x8835AF90f1537777F52E482C8630cE4e947eCa32';
      }
      if (chainId === 6623) {
        return '0x8835AF90f1537777F52E482C8630cE4e947eCa32'; // Mainnet address
      }
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

// Mock subsidized schemas
vi.mock('@/config/subsidized-schemas', () => ({
  isSubsidizedSchema: vi.fn(),
}));

// Mock EAS delegate key loader
vi.mock('@/lib/server/eas-delegate-key', () => ({
  loadEasDelegatePrivateKey: vi.fn(),
}));

// Mock EAS utilities
vi.mock('@/lib/eas', () => ({
  buildDelegatedAttestationTypedData: vi.fn(() => ({
    domain: { name: 'EAS', version: '1.4.0', chainId: 66238, verifyingContract: '0x8835AF90f1537777F52E482C8630cE4e947eCa32' },
    types: { Attest: [] },
    message: {},
  })),
  splitSignature: vi.fn(() => ({ v: 27, r: '0x' + 'a'.repeat(64), s: '0x' + 'b'.repeat(64) })),
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

describe('submitDelegatedAttestation', () => {
  const validAttester = '0x1234567890123456789012345678901234567890';
  const validSignature = '0x' + 'a'.repeat(130);
  const validSchema = '0x' + 'b'.repeat(64);
  const validRecipient = '0x' + 'c'.repeat(40);
  const futureDeadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const pastDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

  const validDelegated = {
    schema: validSchema as `0x${string}`,
    recipient: validRecipient as `0x${string}`,
    expirationTime: BigInt(0),
    revocable: false,
    refUID: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    data: '0x1234' as `0x${string}`,
    deadline: futureDeadline,
  };

  const validParams = {
    delegated: validDelegated,
    signature: validSignature,
    attester: validAttester,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default to testnet
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-testnet';

    // Setup default mocks
    const { isSubsidizedSchema } = await import('@/config/subsidized-schemas');
    (isSubsidizedSchema as any).mockReturnValue(true);

    const { verifyTypedData, Contract } = await import('ethers');
    (verifyTypedData as any).mockReturnValue(validAttester);

    // Mock Contract for nonce and schema registry lookups
    (Contract as any).mockImplementation(() => ({
      getNonce: vi.fn().mockResolvedValue(BigInt(0)),
      getSchemaRegistry: vi.fn().mockResolvedValue('0x' + 'd'.repeat(40)),
      getSchema: vi.fn().mockResolvedValue({
        uid: validSchema,
        resolver: '0x' + '0'.repeat(40),
        revocable: false,
        schema: 'string test',
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('input validation', () => {
    it('throws 400 for missing delegated field', async () => {
      try {
        await submitDelegatedAttestation({
          delegated: undefined as any,
          signature: validSignature,
          attester: validAttester,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
        expect((error as EasRouteError).message).toContain('Missing required fields');
      }
    });

    it('throws 400 for missing signature field', async () => {
      try {
        await submitDelegatedAttestation({
          delegated: validDelegated,
          signature: undefined as any,
          attester: validAttester,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
        expect((error as EasRouteError).message).toContain('Missing required fields');
      }
    });

    it('throws 400 for missing attester field', async () => {
      try {
        await submitDelegatedAttestation({
          delegated: validDelegated,
          signature: validSignature,
          attester: undefined as any,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
        expect((error as EasRouteError).message).toContain('Missing required fields');
      }
    });

    it('throws 400 for empty string attester', async () => {
      try {
        await submitDelegatedAttestation({
          delegated: validDelegated,
          signature: validSignature,
          attester: '',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
      }
    });
  });

  describe('schema validation', () => {
    it('throws 403 for non-subsidized schema', async () => {
      const { isSubsidizedSchema } = await import('@/config/subsidized-schemas');
      (isSubsidizedSchema as any).mockReturnValue(false);

      try {
        await submitDelegatedAttestation(validParams);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(403);
        expect((error as EasRouteError).code).toBe('SCHEMA_NOT_SUBSIDIZED');
        expect((error as EasRouteError).message).toContain('not eligible for gas subsidy');
      }
    });
  });

  describe('signature validation', () => {
    it('throws 400 for expired signature (deadline in past)', async () => {
      try {
        await submitDelegatedAttestation({
          ...validParams,
          delegated: {
            ...validDelegated,
            deadline: pastDeadline,
          },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
        expect((error as EasRouteError).code).toBe('SIGNATURE_EXPIRED');
        expect((error as EasRouteError).message).toContain('expired');
      }
    });

    it('throws 400 for invalid signature format', async () => {
      const { verifyTypedData } = await import('ethers');
      (verifyTypedData as any).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      try {
        await submitDelegatedAttestation(validParams);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
        expect((error as EasRouteError).code).toBe('INVALID_SIGNATURE');
        expect((error as EasRouteError).message).toContain('Invalid signature format');
      }
    });

    it('throws 400 for attester mismatch (recovered address different)', async () => {
      const differentAddress = '0x9999999999999999999999999999999999999999';
      const { verifyTypedData } = await import('ethers');
      (verifyTypedData as any).mockReturnValue(differentAddress);

      try {
        await submitDelegatedAttestation(validParams);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(400);
        expect((error as EasRouteError).code).toBe('ATTESTER_MISMATCH');
        expect((error as EasRouteError).message).toContain('attester mismatch');
      }
    });
  });

  describe('idempotency', () => {
    it('throws 409 for duplicate submission (same signature)', async () => {
      const { loadEasDelegatePrivateKey } = await import('@/lib/server/eas-delegate-key');
      (loadEasDelegatePrivateKey as any).mockReturnValue('0x' + 'f'.repeat(64));

      const { Wallet, Contract, keccak256 } = await import('ethers');
      
      // Use a unique hash for this test to track duplicates
      const uniqueHash = '0xuniquehash123';
      (keccak256 as any).mockReturnValue(uniqueHash);
      
      const mockWallet = {
        address: '0xdelegateaddress',
      };
      (Wallet as any).mockReturnValue(mockWallet);

      const mockTx = {
        hash: '0xtxhash',
        wait: vi.fn().mockResolvedValue({
          hash: '0xtxhash',
          blockNumber: 12345,
          logs: [{ topics: ['0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35', '0xuid123'] }],
        }),
      };
      
      const mockEasContract = {
        getNonce: vi.fn().mockResolvedValue(BigInt(0)),
        getSchemaRegistry: vi.fn().mockResolvedValue('0x' + 'd'.repeat(40)),
        attestByDelegation: Object.assign(vi.fn().mockResolvedValue(mockTx), {
          estimateGas: vi.fn().mockResolvedValue(BigInt(100000)),
        }),
      };

      // Need a read-only contract for nonce and a write contract for attestByDelegation
      let contractCallCount = 0;
      (Contract as any).mockImplementation(() => {
        contractCallCount++;
        if (contractCallCount <= 2) {
          // First two calls are for read-only contract (getNonce, getSchemaRegistry)
          return {
            getNonce: vi.fn().mockResolvedValue(BigInt(0)),
            getSchemaRegistry: vi.fn().mockResolvedValue('0x' + 'd'.repeat(40)),
            getSchema: vi.fn().mockResolvedValue({
              uid: validSchema,
              resolver: '0x' + '0'.repeat(40),
              revocable: false,
              schema: 'string test',
            }),
          };
        }
        return mockEasContract;
      });

      // First submission should succeed
      const result = await submitDelegatedAttestation(validParams);
      expect(result.success).toBe(true);

      // Reset contract call count for second submission
      contractCallCount = 0;

      // Second submission with same signature should fail with 409
      try {
        await submitDelegatedAttestation(validParams);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(409);
        expect((error as EasRouteError).code).toBe('DUPLICATE');
        expect((error as EasRouteError).message).toContain('Duplicate submission');
      }
    });
  });

  describe('mainnet rejection', () => {
    it('throws 501 for mainnet submissions (not yet supported)', async () => {
      process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-mainnet';

      const { Contract, verifyTypedData, keccak256 } = await import('ethers');
      (verifyTypedData as any).mockReturnValue(validAttester);
      (keccak256 as any).mockReturnValue('0xmainnethash_' + Date.now());
      
      (Contract as any).mockImplementation(() => ({
        getNonce: vi.fn().mockResolvedValue(BigInt(0)),
        getSchemaRegistry: vi.fn().mockResolvedValue('0x' + 'd'.repeat(40)),
        getSchema: vi.fn().mockResolvedValue({
          uid: validSchema,
          resolver: '0x' + '0'.repeat(40),
          revocable: false,
          schema: 'string test',
        }),
      }));

      try {
        await submitDelegatedAttestation(validParams);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(501);
        expect((error as EasRouteError).code).toBe('MAINNET_NOT_SUPPORTED');
        expect((error as EasRouteError).message).toContain('Mainnet');
      }
    });
  });

  describe('delegate key validation', () => {
    it('throws 500 when delegate key is not configured', async () => {
      const { loadEasDelegatePrivateKey } = await import('@/lib/server/eas-delegate-key');
      (loadEasDelegatePrivateKey as any).mockImplementation(() => {
        throw new Error('No private key found');
      });

      // Need a unique keccak hash to avoid idempotency check
      const { keccak256 } = await import('ethers');
      (keccak256 as any).mockReturnValue('0xnewuniquehash_' + Date.now());

      try {
        await submitDelegatedAttestation(validParams);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(500);
        expect((error as EasRouteError).code).toBe('NO_DELEGATE_KEY');
        expect((error as EasRouteError).message).toContain('delegate key');
      }
    });
  });

  describe('successful submission', () => {
    it('returns success with txHash and uid for valid attestation', async () => {
      const { loadEasDelegatePrivateKey } = await import('@/lib/server/eas-delegate-key');
      (loadEasDelegatePrivateKey as any).mockReturnValue('0x' + 'f'.repeat(64));

      const { Wallet, Contract, keccak256 } = await import('ethers');
      
      // Unique hash to avoid idempotency issues
      (keccak256 as any).mockReturnValue('0xsuccesstesthash_' + Date.now());
      
      const mockWallet = {
        address: '0xdelegateaddress',
      };
      (Wallet as any).mockReturnValue(mockWallet);

      const expectedTxHash = '0x' + 'e'.repeat(64);
      const expectedUid = '0x' + 'f'.repeat(64);
      const expectedBlockNumber = 99999;

      const mockTx = {
        hash: expectedTxHash,
        wait: vi.fn().mockResolvedValue({
          hash: expectedTxHash,
          blockNumber: expectedBlockNumber,
          logs: [{
            topics: [
              '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35',
              expectedUid,
            ],
          }],
        }),
      };
      
      const mockEasContract = {
        attestByDelegation: Object.assign(vi.fn().mockResolvedValue(mockTx), {
          estimateGas: vi.fn().mockResolvedValue(BigInt(150000)),
        }),
      };

      let contractCallCount = 0;
      (Contract as any).mockImplementation(() => {
        contractCallCount++;
        if (contractCallCount <= 2) {
          return {
            getNonce: vi.fn().mockResolvedValue(BigInt(5)),
            getSchemaRegistry: vi.fn().mockResolvedValue('0x' + 'd'.repeat(40)),
            getSchema: vi.fn().mockResolvedValue({
              uid: validSchema,
              resolver: '0x' + '0'.repeat(40),
              revocable: false,
              schema: 'string test',
            }),
          };
        }
        return mockEasContract;
      });

      const result = await submitDelegatedAttestation(validParams);

      expect(result.success).toBe(true);
      expect(result.txHash).toBe(expectedTxHash);
      expect(result.uid).toBe(expectedUid);
      expect(result.blockNumber).toBe(expectedBlockNumber);
      expect(result.chain).toBe('OMAchain Testnet');
    });

    it('handles case-insensitive attester address comparison', async () => {
      const { loadEasDelegatePrivateKey } = await import('@/lib/server/eas-delegate-key');
      (loadEasDelegatePrivateKey as any).mockReturnValue('0x' + 'f'.repeat(64));

      const { verifyTypedData, Wallet, Contract, keccak256 } = await import('ethers');
      
      // Return uppercase address from verification
      (verifyTypedData as any).mockReturnValue(validAttester.toUpperCase());
      (keccak256 as any).mockReturnValue('0xcaseinsensitivehash_' + Date.now());
      
      (Wallet as any).mockReturnValue({ address: '0xdelegateaddress' });

      const mockTx = {
        hash: '0xtxhash',
        wait: vi.fn().mockResolvedValue({
          hash: '0xtxhash',
          blockNumber: 12345,
          logs: [{ topics: ['0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35', '0xuid123'] }],
        }),
      };
      
      let contractCallCount = 0;
      (Contract as any).mockImplementation(() => {
        contractCallCount++;
        if (contractCallCount <= 2) {
          return {
            getNonce: vi.fn().mockResolvedValue(BigInt(0)),
            getSchemaRegistry: vi.fn().mockResolvedValue('0x' + 'd'.repeat(40)),
            getSchema: vi.fn().mockResolvedValue({
              uid: validSchema,
              resolver: '0x' + '0'.repeat(40),
              revocable: false,
              schema: 'string test',
            }),
          };
        }
        return {
          attestByDelegation: Object.assign(vi.fn().mockResolvedValue(mockTx), {
            estimateGas: vi.fn().mockResolvedValue(BigInt(100000)),
          }),
        };
      });

      // Should succeed despite case difference (lowercase attester vs uppercase recovered)
      const result = await submitDelegatedAttestation({
        ...validParams,
        attester: validAttester.toLowerCase(),
      });

      expect(result.success).toBe(true);
    });
  });

  describe('RPC error handling', () => {
    it('throws 500 when nonce fetch fails', async () => {
      const { Contract, keccak256 } = await import('ethers');
      (keccak256 as any).mockReturnValue('0xnoncefailhash_' + Date.now());
      
      (Contract as any).mockImplementation(() => ({
        getNonce: vi.fn().mockRejectedValue(new Error('RPC connection failed')),
      }));

      try {
        await submitDelegatedAttestation(validParams);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EasRouteError);
        expect((error as EasRouteError).statusCode).toBe(500);
        expect((error as EasRouteError).message).toContain('Failed to fetch nonce');
      }
    });
  });
});
