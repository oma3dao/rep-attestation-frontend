import { describe, it, expect } from 'vitest';
import { isSubsidizedSchema, getSubsidizedSchemaUIDs } from '@/config/subsidized-schemas';
import { getSchema } from '@/config/schemas';

describe('subsidized-schemas', () => {
  const OMACHAIN_TESTNET = 66238;

  describe('isSubsidizedSchema', () => {
    it('returns true for user-review schema UID on OMAchain Testnet', () => {
      const userReviewSchema = getSchema('user-review');
      const uid = userReviewSchema?.deployedUIDs?.[OMACHAIN_TESTNET];
      expect(uid).toBeDefined();
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, uid!)).toBe(true);
    });

    it('returns true for linked-identifier schema UID on OMAchain Testnet', () => {
      const linkedSchema = getSchema('linked-identifier');
      const uid = linkedSchema?.deployedUIDs?.[OMACHAIN_TESTNET];
      expect(uid).toBeDefined();
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, uid!)).toBe(true);
    });

    it('returns false for unknown schema UID', () => {
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, '0x' + 'ab'.repeat(32))).toBe(false);
    });

    it('returns false for certification schema UID (not subsidized)', () => {
      const certSchema = getSchema('certification');
      const uid = certSchema?.deployedUIDs?.[OMACHAIN_TESTNET];
      expect(uid).toBeDefined();
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, uid!)).toBe(false);
    });

    it('normalizes UID to lowercase for comparison', () => {
      const userReviewSchema = getSchema('user-review');
      const uid = userReviewSchema?.deployedUIDs?.[OMACHAIN_TESTNET];
      expect(uid).toBeDefined();
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, uid!.toUpperCase())).toBe(true);
    });
  });

  describe('getSubsidizedSchemaUIDs', () => {
    it('returns array of subsidized UIDs for a chain', () => {
      const uids = getSubsidizedSchemaUIDs(OMACHAIN_TESTNET);
      expect(Array.isArray(uids)).toBe(true);
      expect(uids.length).toBe(2); // user-review and linked-identifier
      uids.forEach(uid => {
        expect(typeof uid).toBe('string');
        expect(uid).toMatch(/^0x[a-fA-F0-9]+$/);
      });
    });

    it('excludes zero UIDs', () => {
      const uids = getSubsidizedSchemaUIDs(OMACHAIN_TESTNET);
      const zeroUid = '0x' + '0'.repeat(64);
      expect(uids).not.toContain(zeroUid);
    });

    it('returned UIDs are considered subsidized by isSubsidizedSchema', () => {
      const uids = getSubsidizedSchemaUIDs(OMACHAIN_TESTNET);
      for (const uid of uids) {
        expect(isSubsidizedSchema(OMACHAIN_TESTNET, uid)).toBe(true);
      }
    });
  });
});
