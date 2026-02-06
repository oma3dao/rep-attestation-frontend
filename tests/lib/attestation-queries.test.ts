import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getContractAddress } from '@/config/attestation-services';
import * as schemas from '@/config/schemas';
import {
  getAttestationsForDID,
  getAttestationsByAttester,
  getAttestationByUID,
  verifyAttestationIntegrity,
  getReviewsForApp,
  getResponsesForReview,
  getLatestAttestations,
  type AttestationQueryResult,
} from '@/lib/attestation-queries';

vi.mock('@/config/attestation-services', () => ({
  getContractAddress: vi.fn(),
  ATTESTATION_QUERY_CONFIG: {
    defaultLimit: 20,
    blockRanges: [{ label: 'test', blocks: 1000 }],
    fetchMultiplier: 2,
  },
}));

describe('attestation-queries', () => {
  describe('getAttestationsForDID', () => {
    it('throws placeholder error (not yet implemented)', async () => {
      await expect(
        getAttestationsForDID('did:web:example.com', { schemaUID: '0x' + '1'.repeat(64) })
      ).rejects.toThrow(/not yet implemented|placeholder/i);
    });
  });

  describe('getAttestationsByAttester', () => {
    it('throws placeholder error (not yet implemented)', async () => {
      await expect(
        getAttestationsByAttester('0x' + 'ab'.repeat(20), { schemaUID: '0x' + '1'.repeat(64) })
      ).rejects.toThrow(/not yet implemented|placeholder/i);
    });
  });

  describe('getAttestationByUID', () => {
    it('throws placeholder error (not yet implemented)', async () => {
      await expect(getAttestationByUID('0x' + '1'.repeat(64))).rejects.toThrow(
        /not yet implemented|placeholder/i
      );
    });
  });

  describe('verifyAttestationIntegrity', () => {
    it('returns true for valid-looking attestation (current placeholder behavior)', () => {
      const attestation: AttestationQueryResult = {
        uid: '0x' + '1'.repeat(64),
        attester: '0x' + 'ab'.repeat(20),
        recipient: '0x' + 'cd'.repeat(20),
        data: '0x',
        time: Math.floor(Date.now() / 1000),
        expirationTime: 0,
        revocationTime: 0,
        refUID: '0x' + '0'.repeat(64),
        revocable: false,
      };
      expect(verifyAttestationIntegrity(attestation)).toBe(true);
    });
  });

  describe('getReviewsForApp', () => {
    it('delegates to getAttestationsForDID and throws', async () => {
      await expect(
        getReviewsForApp('did:web:example.com', '0x' + '1'.repeat(64))
      ).rejects.toThrow();
    });
  });

  describe('getResponsesForReview', () => {
    it('throws placeholder error (not yet implemented)', async () => {
      await expect(
        getResponsesForReview('0x' + '1'.repeat(64), '0x' + '2'.repeat(64))
      ).rejects.toThrow(/not yet implemented|placeholder/i);
    });
  });

  describe('getLatestAttestations', () => {
    beforeEach(() => {
      vi.mocked(getContractAddress).mockReset();
    });

    it('throws when EAS is not deployed on chain', async () => {
      vi.mocked(getContractAddress).mockReturnValue(null as unknown as string);
      await expect(getLatestAttestations(999)).rejects.toThrow(/EAS not deployed on chain 999/i);
    });

    it('returns empty array when no schemas are deployed on chain', async () => {
      vi.mocked(getContractAddress).mockReturnValue('0x' + '1'.repeat(40));
      vi.spyOn(schemas, 'getAllSchemas').mockReturnValue([]);
      const result = await getLatestAttestations(66238);
      expect(result).toEqual([]);
      vi.restoreAllMocks();
    });
  });
});
