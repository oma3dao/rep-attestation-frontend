/**
 * Tests for Thirdweb maintenance mode handling
 *
 * Verifies that when Thirdweb returns 401 Unauthorized:
 * - MAINTENANCE_IN_PROGRESS=true → 503 with scheduled maintenance message
 * - MAINTENANCE_IN_PROGRESS=false → 503 with generic unavailable message + critical log
 * - MAINTENANCE_IN_PROGRESS unset → same as false
 * - Non-401 errors preserve existing behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isThirdwebAuthError, isMaintenanceMode } from '@/lib/server/eas-routes';

// ============================================================================
// Unit tests for isThirdwebAuthError helper
// ============================================================================

describe('isThirdwebAuthError', () => {
  it('returns false for null/undefined', () => {
    expect(isThirdwebAuthError(null)).toBe(false);
    expect(isThirdwebAuthError(undefined)).toBe(false);
  });

  it('detects error with status === 401', () => {
    const err = new Error('Unauthorized');
    (err as any).status = 401;
    expect(isThirdwebAuthError(err)).toBe(true);
  });

  it('detects error with statusCode === 401', () => {
    const err = new Error('Auth failed');
    (err as any).statusCode = 401;
    expect(isThirdwebAuthError(err)).toBe(true);
  });

  it('detects error with response.status === 401', () => {
    const err = new Error('Request failed');
    (err as any).response = { status: 401 };
    expect(isThirdwebAuthError(err)).toBe(true);
  });

  it('detects error with response.statusCode === 401', () => {
    const err = new Error('Request failed');
    (err as any).response = { statusCode: 401 };
    expect(isThirdwebAuthError(err)).toBe(true);
  });

  it('detects "401" in error message', () => {
    const err = new Error('HTTP error 401: Unauthorized');
    expect(isThirdwebAuthError(err)).toBe(true);
  });

  it('detects "Unauthorized" in error message (case-insensitive)', () => {
    const err = new Error('UNAUTHORIZED access denied');
    expect(isThirdwebAuthError(err)).toBe(true);
  });

  it('detects auth error in cause chain', () => {
    const cause = new Error('Unauthorized');
    (cause as any).status = 401;
    const wrapper = new Error('Thirdweb request failed');
    (wrapper as any).cause = cause;
    expect(isThirdwebAuthError(wrapper)).toBe(true);
  });

  it('returns false for 403 Forbidden', () => {
    const err = new Error('Forbidden');
    (err as any).status = 403;
    expect(isThirdwebAuthError(err)).toBe(false);
  });

  it('returns false for 500 Internal Server Error', () => {
    const err = new Error('Internal Server Error');
    (err as any).status = 500;
    expect(isThirdwebAuthError(err)).toBe(false);
  });

  it('returns false for generic network error', () => {
    const err = new Error('ECONNREFUSED');
    expect(isThirdwebAuthError(err)).toBe(false);
  });

  it('returns false for timeout error', () => {
    const err = new Error('Request timed out after 30000ms');
    expect(isThirdwebAuthError(err)).toBe(false);
  });
});

// ============================================================================
// Unit tests for isMaintenanceMode helper
// ============================================================================

describe('isMaintenanceMode', () => {
  const originalEnv = process.env.MAINTENANCE_IN_PROGRESS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MAINTENANCE_IN_PROGRESS;
    } else {
      process.env.MAINTENANCE_IN_PROGRESS = originalEnv;
    }
  });

  it('returns true when MAINTENANCE_IN_PROGRESS=true', () => {
    process.env.MAINTENANCE_IN_PROGRESS = 'true';
    expect(isMaintenanceMode()).toBe(true);
  });

  it('returns false when MAINTENANCE_IN_PROGRESS=false', () => {
    process.env.MAINTENANCE_IN_PROGRESS = 'false';
    expect(isMaintenanceMode()).toBe(false);
  });

  it('returns false when MAINTENANCE_IN_PROGRESS is unset', () => {
    delete process.env.MAINTENANCE_IN_PROGRESS;
    expect(isMaintenanceMode()).toBe(false);
  });

  it('returns false for non-"true" values', () => {
    process.env.MAINTENANCE_IN_PROGRESS = 'TRUE';
    expect(isMaintenanceMode()).toBe(false);
    process.env.MAINTENANCE_IN_PROGRESS = '1';
    expect(isMaintenanceMode()).toBe(false);
    process.env.MAINTENANCE_IN_PROGRESS = 'yes';
    expect(isMaintenanceMode()).toBe(false);
  });
});

// ============================================================================
// Integration tests: Thirdweb 401 in submitDelegatedAttestation
// ============================================================================

// These tests require the full mock environment for submitDelegatedAttestation.
// We mock getThirdwebManagedWallet to return a wallet (triggering the Thirdweb path)
// and mock Thirdweb SDK calls to throw 401 errors.

let hashCounter = 0;
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  return {
    ...actual,
    JsonRpcProvider: vi.fn(),
    Contract: vi.fn(),
    Wallet: vi.fn(),
    verifyTypedData: vi.fn(),
    keccak256: vi.fn(() => `0xmockhash_${++hashCounter}_${Date.now()}`),
    toUtf8Bytes: vi.fn((str: string) => str),
    isAddress: (actual as any).isAddress,
  };
});

vi.mock('@/config/attestation-services', () => ({
  getContractAddress: vi.fn((service: string, chainId: number) => {
    if (service === 'eas') {
      if (chainId === 66238) return '0x8835AF90f1537777F52E482C8630cE4e947eCa32';
    }
    return undefined;
  }),
}));

vi.mock('@/config/chains', () => ({
  omachainTestnet: {
    id: 66238,
    name: 'OMAChain Testnet',
    rpc: 'https://rpc.testnet.chain.oma3.org/',
  },
  omachainMainnet: {
    id: 6623,
    name: 'OMAChain Mainnet',
    rpc: 'https://rpc.chain.oma3.org/',
  },
}));

vi.mock('@/config/subsidized-schemas', () => ({
  isSubsidizedSchema: vi.fn(),
}));

vi.mock('@/lib/server/eas-delegate-key', () => ({
  loadEasDelegatePrivateKey: vi.fn(),
  getThirdwebManagedWallet: vi.fn(),
}));

vi.mock('@oma3/omatrust/reputation', () => ({
  splitSignature: vi.fn(() => ({ v: 27, r: '0x' + 'a'.repeat(64), s: '0x' + 'b'.repeat(64) })),
  buildDelegatedTypedDataFromEncoded: vi.fn((params: any) => ({
    domain: { name: 'EAS', version: '1.4.0', chainId: params.chainId, verifyingContract: params.easContractAddress },
    types: { Attest: [
      { name: 'attester', type: 'address' },
      { name: 'schema', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'expirationTime', type: 'uint64' },
      { name: 'revocable', type: 'bool' },
      { name: 'refUID', type: 'bytes32' },
      { name: 'data', type: 'bytes' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
    ] },
    message: {
      attester: params.attester,
      schema: params.schemaUid,
      recipient: params.recipient,
      expirationTime: BigInt(params.expirationTime ?? 0),
      revocable: params.revocable ?? true,
      refUID: params.refUid ?? '0x' + '0'.repeat(64),
      data: params.encodedData,
      value: BigInt(params.value ?? 0),
      nonce: BigInt(params.nonce ?? 0),
      deadline: BigInt(params.deadline ?? 0),
    },
  })),
}));

// Mock Thirdweb SDK — we control enqueueTransaction to throw
const mockEnqueueTransaction = vi.fn();
const mockServerWallet = vi.fn((_opts: any) => ({ enqueueTransaction: mockEnqueueTransaction }));
const mockWaitForTransactionHash = vi.fn((_opts: any) => Promise.resolve({ transactionHash: '0x' + 'f'.repeat(64) }));
const mockWaitForReceipt = vi.fn((_opts: any) => Promise.resolve({ transactionHash: '0x' + 'f'.repeat(64), blockNumber: BigInt(1), logs: [] }));

vi.mock('thirdweb', () => ({
  createThirdwebClient: vi.fn(() => ({ clientId: 'mock' })),
  getContract: vi.fn(() => ({ address: '0xmockcontract' })),
  prepareContractCall: vi.fn(() => ({ __mock: true })),
  defineChain: vi.fn((config: any) => config),
  waitForReceipt: (opts: any) => mockWaitForReceipt(opts),
  Engine: {
    serverWallet: (opts: any) => mockServerWallet(opts),
    waitForTransactionHash: (opts: any) => mockWaitForTransactionHash(opts),
  },
}));

// ============================================================================
// Shared test fixtures
// ============================================================================

const validAttester = '0x1234567890123456789012345678901234567890';
const validSignature = '0x' + 'a'.repeat(130);
const validSchema = '0x' + 'b'.repeat(64);
const validRecipient = '0x' + 'c'.repeat(40);
const futureDeadline = Math.floor(Date.now() / 1000) + 3600;

function makePrepared() {
  return {
    delegatedRequest: {
      schema: validSchema,
      schemaUid: validSchema,
      attester: validAttester,
      easContractAddress: '0x8835AF90f1537777F52E482C8630cE4e947eCa32',
      chainId: 66238,
      recipient: validRecipient,
      expirationTime: '0',
      revocable: false,
      refUID: '0x' + '0'.repeat(64),
      data: '0x1234',
      value: '0',
      nonce: '0',
      deadline: String(futureDeadline),
    },
    typedData: {
      domain: { name: 'EAS', version: '1.4.0', chainId: 66238, verifyingContract: '0x8835AF90f1537777F52E482C8630cE4e947eCa32' },
      types: { Attest: [
        { name: 'attester', type: 'address' },
        { name: 'schema', type: 'bytes32' },
        { name: 'recipient', type: 'address' },
        { name: 'expirationTime', type: 'uint64' },
        { name: 'revocable', type: 'bool' },
        { name: 'refUID', type: 'bytes32' },
        { name: 'data', type: 'bytes' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint64' },
      ] },
      message: {
        attester: validAttester,
        schema: validSchema,
        recipient: validRecipient,
        expirationTime: '0',
        revocable: false,
        refUID: '0x' + '0'.repeat(64),
        data: '0x1234',
        value: '0',
        nonce: '0',
        deadline: String(futureDeadline),
      },
    },
  };
}

const validParams = {
  prepared: makePrepared(),
  signature: validSignature,
  attester: validAttester,
};

describe('submitDelegatedAttestation — Thirdweb 401 handling', () => {
  const originalMaintenance = process.env.MAINTENANCE_IN_PROGRESS;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN = 'omachain-testnet';
    delete process.env.MAINTENANCE_IN_PROGRESS;

    const { isSubsidizedSchema } = await import('@/config/subsidized-schemas');
    (isSubsidizedSchema as any).mockReturnValue(true);

    const { verifyTypedData, Contract } = await import('ethers');
    (verifyTypedData as any).mockReturnValue(validAttester);

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

    // Enable Thirdweb server wallet path
    const { getThirdwebManagedWallet } = await import('@/lib/server/eas-delegate-key');
    (getThirdwebManagedWallet as any).mockReturnValue({
      secretKey: 'mock-secret-key',
      walletAddress: '0xServerWalletAddress1234567890123456789012',
    });
  });

  afterEach(() => {
    if (originalMaintenance === undefined) {
      delete process.env.MAINTENANCE_IN_PROGRESS;
    } else {
      process.env.MAINTENANCE_IN_PROGRESS = originalMaintenance;
    }
    vi.restoreAllMocks();
  });

  it('Thirdweb 401 + MAINTENANCE_IN_PROGRESS=true → 503 scheduled maintenance message', async () => {
    process.env.MAINTENANCE_IN_PROGRESS = 'true';

    const authError = new Error('Unauthorized');
    (authError as any).status = 401;
    mockEnqueueTransaction.mockRejectedValue(authError);

    const { submitDelegatedAttestation, EasRouteError } = await import('@/lib/server/eas-routes');

    try {
      await submitDelegatedAttestation(validParams);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EasRouteError);
      const e = error as InstanceType<typeof EasRouteError>;
      expect(e.statusCode).toBe(503);
      expect(e.code).toBe('MAINTENANCE_IN_PROGRESS');
      expect(e.message).toContain('scheduled maintenance');
      expect(e.message).toContain('try again in a few minutes');
    }
  });

  it('Thirdweb 401 + MAINTENANCE_IN_PROGRESS=false → 503 generic unavailable message', async () => {
    process.env.MAINTENANCE_IN_PROGRESS = 'false';

    const authError = new Error('HTTP 401 Unauthorized');
    (authError as any).statusCode = 401;
    mockEnqueueTransaction.mockRejectedValue(authError);

    const { submitDelegatedAttestation, EasRouteError } = await import('@/lib/server/eas-routes');

    try {
      await submitDelegatedAttestation(validParams);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EasRouteError);
      const e = error as InstanceType<typeof EasRouteError>;
      expect(e.statusCode).toBe(503);
      expect(e.code).toBe('THIRDWEB_AUTH_FAILURE');
      expect(e.message).toContain('temporarily unavailable');
      expect(e.message).toContain('try again later');
      expect(e.message).not.toContain('scheduled maintenance');
    }
  });

  it('Thirdweb 401 + MAINTENANCE_IN_PROGRESS unset → same as false (503 generic)', async () => {
    delete process.env.MAINTENANCE_IN_PROGRESS;

    const authError = new Error('Unauthorized');
    (authError as any).status = 401;
    mockEnqueueTransaction.mockRejectedValue(authError);

    const { submitDelegatedAttestation, EasRouteError } = await import('@/lib/server/eas-routes');

    try {
      await submitDelegatedAttestation(validParams);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EasRouteError);
      const e = error as InstanceType<typeof EasRouteError>;
      expect(e.statusCode).toBe(503);
      expect(e.code).toBe('THIRDWEB_AUTH_FAILURE');
      expect(e.message).not.toContain('scheduled maintenance');
    }
  });

  it('Non-401 Thirdweb error preserves existing behavior (rethrown as-is)', async () => {
    const networkError = new Error('ECONNREFUSED - Thirdweb API unreachable');
    (networkError as any).status = 500;
    mockEnqueueTransaction.mockRejectedValue(networkError);

    const { submitDelegatedAttestation, EasRouteError } = await import('@/lib/server/eas-routes');

    try {
      await submitDelegatedAttestation(validParams);
      expect.fail('Should have thrown');
    } catch (error) {
      // Non-401 errors are rethrown without wrapping in EasRouteError
      expect(error).not.toBeInstanceOf(EasRouteError);
      expect((error as Error).message).toContain('ECONNREFUSED');
    }
  });

  it('Thirdweb 401 on waitForTransactionHash is also caught', async () => {
    process.env.MAINTENANCE_IN_PROGRESS = 'true';

    // enqueueTransaction succeeds, but waitForTransactionHash fails with 401
    mockEnqueueTransaction.mockResolvedValue({ transactionId: 'tx-123' });
    const authError = new Error('Unauthorized');
    (authError as any).status = 401;
    mockWaitForTransactionHash.mockRejectedValue(authError);

    const { submitDelegatedAttestation, EasRouteError } = await import('@/lib/server/eas-routes');

    try {
      await submitDelegatedAttestation(validParams);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EasRouteError);
      const e = error as InstanceType<typeof EasRouteError>;
      expect(e.statusCode).toBe(503);
      expect(e.code).toBe('MAINTENANCE_IN_PROGRESS');
    }
  });

  it('does not expose Thirdweb error details to client', async () => {
    process.env.MAINTENANCE_IN_PROGRESS = 'false';

    const authError = new Error('Invalid API key sk_live_abc123... - 401 Unauthorized');
    (authError as any).status = 401;
    (authError as any).secretKey = 'sk_live_abc123_should_not_leak';
    mockEnqueueTransaction.mockRejectedValue(authError);

    const { submitDelegatedAttestation, EasRouteError } = await import('@/lib/server/eas-routes');

    try {
      await submitDelegatedAttestation(validParams);
      expect.fail('Should have thrown');
    } catch (error) {
      const e = error as InstanceType<typeof EasRouteError>;
      expect(e.message).not.toContain('sk_live');
      expect(e.message).not.toContain('abc123');
      expect(e.message).toBe('Delegated publishing is temporarily unavailable. Please try again later.');
    }
  });
});
