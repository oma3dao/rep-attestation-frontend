import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getContractAddress } from '@/config/attestation-services';
import * as schemas from '@/config/schemas';
import * as chains from '@/config/chains';
import {
  getAttestationsForDIDWithMetadata,
  getLatestAttestationsWithMetadata,
  type EnrichedAttestationResult,
} from '@/lib/attestation-queries';

vi.mock('@/config/attestation-services', () => ({
  getContractAddress: vi.fn(),
  ATTESTATION_QUERY_CONFIG: {
    defaultLimit: 20,
    blockRanges: [{ label: 'test', blocks: 1000 }],
    fetchMultiplier: 2,
  },
}));

vi.mock('@oma3/omatrust/reputation', () => ({
  decodeAttestationData: vi.fn().mockReturnValue({}),
  getAttestation: vi.fn().mockRejectedValue(new Error('not found')),
  getAttestationsForDid: vi.fn().mockResolvedValue([]),
  getLatestAttestations: vi.fn().mockResolvedValue([]),
}));

vi.mock('@oma3/omatrust/identity', () => ({
  didToAddress: vi.fn().mockReturnValue('0x1234567890123456789012345678901234567890'),
}));

vi.mock('@/lib/blockchain', () => ({
  getActiveChain: vi.fn().mockReturnValue({ id: 66238, rpc: 'https://rpc.testnet.chain.oma3.org/' }),
}));

vi.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
  },
}));

describe('attestation-queries', () => {
  describe('getAttestationsForDID', () => {
    it('returns empty array when no attestations found', async () => {
      vi.mocked(getContractAddress).mockReturnValue('0x' + '1'.repeat(40));
      vi.spyOn(chains, 'getChainById').mockReturnValue({ id: 66238, rpc: 'https://rpc.testnet.chain.oma3.org/' } as any);
      const result = await getAttestationsForDIDWithMetadata('did:web:example.com', { schemaUID: '0x' + '1'.repeat(64) });
      expect(result).toEqual([]);
    });

    it('throws when EAS not deployed', async () => {
      vi.mocked(getContractAddress).mockReturnValue(null as unknown as string);
      await expect(
        getAttestationsForDIDWithMetadata('did:web:example.com', { schemaUID: '0x' + '1'.repeat(64) })
      ).rejects.toThrow(/EAS not deployed/i);
    });
  });

  describe('getLatestAttestationsWithMetadata', () => {
    beforeEach(() => {
      vi.mocked(getContractAddress).mockReset();
    });

    it('throws when EAS is not deployed on chain', async () => {
      vi.mocked(getContractAddress).mockReturnValue(null as unknown as string);
      vi.spyOn(chains, 'getChainById').mockReturnValue(undefined);
      await expect(getLatestAttestationsWithMetadata(999)).rejects.toThrow(/EAS not deployed|Unknown chain/i);
    });

    it('returns empty array when no schemas are deployed on chain', async () => {
      vi.mocked(getContractAddress).mockReturnValue('0x' + '1'.repeat(40));
      vi.spyOn(chains, 'getChainById').mockReturnValue({ id: 66238, rpc: 'https://rpc.testnet.chain.oma3.org/' } as any);
      vi.spyOn(schemas, 'getAllSchemas').mockReturnValue([]);
      const result = await getLatestAttestationsWithMetadata(66238);
      expect(result).toEqual([]);
      vi.restoreAllMocks();
    });
  });
});
