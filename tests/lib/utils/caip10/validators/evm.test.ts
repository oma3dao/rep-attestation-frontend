import { describe, it, expect } from 'vitest';
import { validateEvm, toEip55, isEvmAddress } from '@/lib/utils/caip10/validators/evm';

// Valid checksummed address (Ethereum mainnet)
const validAddress = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

describe('caip10/validators/evm', () => {
  describe('validateEvm', () => {
    it('returns valid and normalized address for valid EVM CAIP-10', () => {
      const result = validateEvm('1', validAddress);
      expect(result.valid).toBe(true);
      expect(result.normalizedAddress).toBeDefined();
      expect(result.chainId).toBe(1);
    });

    it('returns error for invalid chainId (negative)', () => {
      const result = validateEvm('-1', validAddress);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/chain|chainId/i);
    });

    it('returns error for non-numeric reference', () => {
      const result = validateEvm('mainnet', validAddress);
      expect(result.valid).toBe(false);
    });

    it('returns error when address does not start with 0x', () => {
      const result = validateEvm('1', validAddress.slice(2));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/0x/i);
    });

    it('returns error when address length is not 42', () => {
      const result = validateEvm('1', '0x' + 'a'.repeat(38));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/20 bytes|40 hex/i);
    });

    it('returns error for non-hex characters', () => {
      const result = validateEvm('1', '0x' + 'g'.repeat(40));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/hex|hexadecimal/i);
    });

    it('returns error when checksum fails (invalid mixed case)', () => {
      const invalidChecksum = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAe0';
      const result = validateEvm('1', invalidChecksum);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/checksum|Invalid EVM/i);
    });
  });

  describe('toEip55', () => {
    it('returns checksummed address for valid input', () => {
      const result = toEip55(validAddress.toLowerCase());
      expect(result).not.toBeInstanceOf(Error);
      expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('returns Error for invalid address', () => {
      const result = toEip55('not-an-address');
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toMatch(/invalid/i);
    });
  });

  describe('isEvmAddress', () => {
    it('returns true for valid address', () => {
      expect(isEvmAddress(validAddress)).toBe(true);
    });

    it('returns false for invalid string', () => {
      expect(isEvmAddress('')).toBe(false);
      expect(isEvmAddress('0xshort')).toBe(false);
    });
  });
});
