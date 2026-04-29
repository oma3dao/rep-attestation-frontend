/**
 * Covers all-chains.ts line 73: chain.name || `Chain ${chain.id}` when chain.name is falsy
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('thirdweb/chains', () => ({
  ethereum: { id: 1, name: '', rpc: 'https://mainnet.rpc' },
  bsc: { id: 56, name: 'BNB Smart Chain', rpc: 'x' },
  polygon: { id: 137, name: 'Polygon', rpc: 'x' },
  avalanche: { id: 43114, name: 'Avalanche', rpc: 'x' },
  fantom: { id: 250, name: 'Fantom', rpc: 'x' },
  arbitrum: { id: 42161, name: 'Arbitrum', rpc: 'x' },
  optimism: { id: 10, name: 'Optimism', rpc: 'x' },
  celo: { id: 42220, name: 'Celo', rpc: 'x' },
  gnosis: { id: 100, name: 'Gnosis', rpc: 'x' },
  moonbeam: { id: 1284, name: 'Moonbeam', rpc: 'x' },
  cronos: { id: 25, name: 'Cronos', rpc: 'x' },
  base: { id: 8453, name: 'Base', rpc: 'x' },
  zora: { id: 7777777, name: 'Zora', rpc: 'x' },
  zkSync: { id: 324, name: 'zkSync', rpc: 'x' },
  polygonZkEvm: { id: 1101, name: 'Polygon zkEVM', rpc: 'x' },
  linea: { id: 59144, name: 'Linea', rpc: 'x' },
  scroll: { id: 534352, name: 'Scroll', rpc: 'x' },
  blast: { id: 81457, name: 'Blast', rpc: 'x' },
  mode: { id: 34443, name: 'Mode', rpc: 'x' },
}));

import { ALL_CHAINS } from '@/lib/utils/caip10/all-chains';

describe('all-chains name fallback', () => {
  it('uses "Chain ${id}" when chain.name is falsy', () => {
    const chain1 = ALL_CHAINS.find((c) => c.chainId === 1);
    expect(chain1).toBeDefined();
    expect(chain1?.name).toBe('Chain 1');
  });
});
