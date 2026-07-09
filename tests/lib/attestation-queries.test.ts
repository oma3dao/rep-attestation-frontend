import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getContractAddress } from '@/config/attestation-services';
import * as schemas from '@/config/schemas';
import * as chains from '@/config/chains';
import {
  getAttestationsForDIDWithMetadata,
  getVerifiedAttestationsForDIDWithMetadata,
  getLatestAttestationsWithMetadata,
  getAttestationsByAttesterWithMetadata,
  type EnrichedAttestationResult,
} from '@/lib/attestation-queries';
import * as reputation from '@oma3/omatrust/reputation';

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
  listAttestations: vi.fn().mockResolvedValue([]),
  verifyAttestation: vi.fn().mockResolvedValue({ valid: true, checks: { proofs: true }, reasons: [] }),
  getLatestAttestations: vi.fn().mockResolvedValue([]),
  getAttestationsByAttester: vi.fn().mockResolvedValue([]),
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
      const getAllSchemasSpy = vi.spyOn(schemas, 'getAllSchemas').mockReturnValue([]);
      const result = await getLatestAttestationsWithMetadata(66238);
      expect(result).toEqual([]);
      getAllSchemasSpy.mockRestore();
    });
  });

  describe('getAttestationsByAttesterWithMetadata', () => {
    beforeEach(() => {
      vi.mocked(getContractAddress).mockReset();
    });

    it('throws when EAS is not deployed on chain', async () => {
      vi.mocked(getContractAddress).mockReturnValue(null as unknown as string);
      vi.spyOn(chains, 'getChainById').mockReturnValue(undefined);
      await expect(
        getAttestationsByAttesterWithMetadata('0x' + '1'.repeat(40), 999)
      ).rejects.toThrow(/EAS not deployed|Unknown chain/i);
    });

    it('returns empty array when no schemas are deployed on chain', async () => {
      vi.mocked(getContractAddress).mockReturnValue('0x' + '1'.repeat(40));
      vi.spyOn(chains, 'getChainById').mockReturnValue({ id: 66238, rpc: 'https://rpc.testnet.chain.oma3.org/' } as any);
      const getAllSchemasSpy = vi.spyOn(schemas, 'getAllSchemas').mockReturnValue([]);
      const result = await getAttestationsByAttesterWithMetadata('0x' + '1'.repeat(40), 66238);
      expect(result).toEqual([]);
      getAllSchemasSpy.mockRestore();
    });

    it('returns empty array when SDK returns no results', async () => {
      vi.mocked(getContractAddress).mockReturnValue('0x' + '1'.repeat(40));
      vi.spyOn(chains, 'getChainById').mockReturnValue({ id: 66238, rpc: 'https://rpc.testnet.chain.oma3.org/' } as any);
      const result = await getAttestationsByAttesterWithMetadata('0x' + '1'.repeat(40), 66238);
      expect(result).toEqual([]);
    });
  });

  describe('getVerifiedAttestationsForDIDWithMetadata', () => {
    beforeEach(() => {
      vi.mocked(getContractAddress).mockReset();
      vi.mocked(reputation.listAttestations).mockReset();
      vi.mocked(reputation.verifyAttestation).mockReset();
      vi.mocked(reputation.verifyAttestation).mockResolvedValue({
        valid: true,
        checks: { proofs: true },
        reasons: [],
      });
    });

    it('runs proof verification only for user review schemas', async () => {
      vi.mocked(getContractAddress).mockReturnValue('0x' + '1'.repeat(40));
      vi.spyOn(chains, 'getChainById').mockReturnValue({ id: 66238, rpc: 'https://rpc.testnet.chain.oma3.org/' } as any);

      const userReviewSchema = {
        id: 'user-review',
        title: 'User Review',
        deployedUIDs: { 66238: '0x' + 'a'.repeat(64) },
      } as any;
      const responseSchema = {
        id: 'user-review-response',
        title: 'User Review Response',
        deployedUIDs: { 66238: '0x' + 'b'.repeat(64) },
      } as any;
      const certificationSchema = {
        id: 'certification',
        title: 'Certification',
        deployedUIDs: { 66238: '0x' + 'c'.repeat(64) },
      } as any;

      const getAllSchemasSpy = vi.spyOn(schemas, 'getAllSchemas').mockReturnValue([
        userReviewSchema,
        responseSchema,
        certificationSchema,
      ]);

      vi.mocked(reputation.listAttestations).mockResolvedValue([
        sdkAttestation(userReviewSchema.deployedUIDs[66238]),
        sdkAttestation(responseSchema.deployedUIDs[66238]),
        sdkAttestation(certificationSchema.deployedUIDs[66238]),
      ] as any);

      const results = await getVerifiedAttestationsForDIDWithMetadata('did:web:example.com');

      expect(reputation.verifyAttestation).toHaveBeenCalledTimes(2);
      expect(results).toEqual([
        expect.objectContaining({ schemaId: 'user-review', verification: expect.objectContaining({ valid: true }) }),
        expect.objectContaining({ schemaId: 'user-review-response', verification: expect.objectContaining({ valid: true }) }),
        expect.objectContaining({ schemaId: 'certification', verification: undefined }),
      ]);

      getAllSchemasSpy.mockRestore();
    });
  });
});

function sdkAttestation(schema: string) {
  return {
    uid: '0x' + '1'.repeat(64),
    schema,
    attester: '0x' + '2'.repeat(40),
    recipient: '0x' + '3'.repeat(40),
    data: {},
    raw: '0x',
    time: 1n,
    expirationTime: 0n,
    revocationTime: 0n,
    refUID: '0x' + '0'.repeat(64),
    revocable: true,
  };
}
