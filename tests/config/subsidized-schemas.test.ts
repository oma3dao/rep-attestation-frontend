import { describe, it, expect } from 'vitest';
import { isSubsidizedSchema, getSubsidizedSchemaUIDs } from '@/config/subsidized-schemas';
import { getSchema } from '@/config/schemas';

describe('subsidized-schemas', () => {
  const OMACHAIN_TESTNET = 66238;

  describe('isSubsidizedSchema', () => {
    const EXPECTED_USER_REVIEW_UID = '0x7ab3911527e5e47eaab9f5a2c571060026532dde8cb4398185553053963b2a47';
    const EXPECTED_LINKED_ID_UID = '0x26e21911c55587925afee4b17839ab091e9829321b4a4e1658c497eb0088b453';
    const EXPECTED_CERT_UID = '0x2b0d1100f7943c0c2ea29e35c1286bd860fa752124e035cafb503bb83f234805';

    it('returns true for user-review schema UID on OMAchain Testnet', () => {
      const uid = getSchema('user-review')?.deployedUIDs?.[OMACHAIN_TESTNET];
      expect(uid).toBe(EXPECTED_USER_REVIEW_UID);
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, uid!)).toBe(true);
    });

    it('returns true for linked-identifier schema UID on OMAchain Testnet', () => {
      const uid = getSchema('linked-identifier')?.deployedUIDs?.[OMACHAIN_TESTNET];
      expect(uid).toBe(EXPECTED_LINKED_ID_UID);
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, uid!)).toBe(true);
    });

    it('returns false for unknown schema UID', () => {
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, '0x' + 'ab'.repeat(32))).toBe(false);
    });

    it('returns false for certification schema UID (not subsidized)', () => {
      const uid = getSchema('certification')?.deployedUIDs?.[OMACHAIN_TESTNET];
      expect(uid).toBe(EXPECTED_CERT_UID);
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, uid!)).toBe(false);
    });

    it('normalizes UID to lowercase for comparison', () => {
      const uid = getSchema('user-review')?.deployedUIDs?.[OMACHAIN_TESTNET];
      expect(uid).toBe(EXPECTED_USER_REVIEW_UID);
      expect(isSubsidizedSchema(OMACHAIN_TESTNET, uid!.toUpperCase())).toBe(true);
    });
  });

  describe('getSubsidizedSchemaUIDs', () => {
    it('returns the exact subsidized UIDs for OMAchain Testnet', () => {
      const uids = getSubsidizedSchemaUIDs(OMACHAIN_TESTNET);
      expect(uids).toHaveLength(2);
      expect(uids).toContain(
        '0x7ab3911527e5e47eaab9f5a2c571060026532dde8cb4398185553053963b2a47' // user-review
      );
      expect(uids).toContain(
        '0x26e21911c55587925afee4b17839ab091e9829321b4a4e1658c497eb0088b453' // linked-identifier
      );
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
