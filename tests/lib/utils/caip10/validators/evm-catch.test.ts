/**
 * Covers evm.ts catch block (lines 69-73): getAddress throws → "Failed to checksum address"
 * Uses a mock of ethers so getAddress throws while isAddress returns true.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('ethers', () => ({
  getAddress: vi.fn(() => {
    throw new Error('checksum');
  }),
  isAddress: vi.fn(() => true),
}));

import { validateEvm } from '@/lib/utils/caip10/validators/evm';

describe('evm validateEvm catch path', () => {
  it('returns "Failed to checksum address" when getAddress throws', () => {
    const result = validateEvm('1', '0x' + 'a'.repeat(40));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Failed to checksum address');
  });
});
