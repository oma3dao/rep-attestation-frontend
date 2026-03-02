/**
 * Chain Configuration
 * Plain JavaScript objects that can be imported by both runtime code and build scripts
 * Convert to thirdweb chains at runtime using defineChain() where needed
 */

/**
 * OMAchain Testnet
 * Chain ID: 66238
 * RPC: https://rpc.testnet.chain.oma3.org/
 * Explorer: https://explorer.testnet.chain.oma3.org/
 */
export const omachainTestnet = {
  id: 66238,
  chainId: 66238,
  rpc: "https://rpc.testnet.chain.oma3.org/",
  name: "OMAchain Testnet",
  nativeCurrency: {
    name: "OMA",
    symbol: "OMA",
    decimals: 18,
  },
  blockExplorers: [
    {
      name: "OMAchain Testnet Explorer",
      url: "https://explorer.testnet.chain.oma3.org",
      apiUrl: "https://explorer.testnet.chain.oma3.org/api",
    },
  ],
  testnet: true,
  contracts: {
    easSchemaRegistry: "0x7946127D2f517c8584FdBF801b82F54436EC6FC7",
    easContract: "0x8835AF90f1537777F52E482C8630cE4e947eCa32",
  }
};

/**
 * OMAchain Mainnet (Placeholder)
 * Chain ID: 6623
 * RPC: TBD
 * Explorer: TBD
 */
export const omachainMainnet = {
  id: 6623,
  chainId: 6623,
  rpc: "https://rpc.chain.oma3.org/", // TODO: Update when mainnet is available
  name: "OMAchain Mainnet",
  nativeCurrency: {
    name: "OMA",
    symbol: "OMA",
    decimals: 18,
  },
  blockExplorers: [
    {
      name: "OMAchain Explorer",
      url: "https://explorer.chain.oma3.org",
      apiUrl: "https://explorer.chain.oma3.org/api",
    },
  ],
  testnet: false,
  contracts: {
    easSchemaRegistry: "0x0000000000000000000000000000000000000000", // TODO: Deploy when mainnet is available
    easContract: "0x0000000000000000000000000000000000000000", // TODO: Deploy when mainnet is available
  }
};

/**
 * BSC Testnet
 * Chain ID: 97
 */
export const bscTestnet = {
  id: 97,
  chainId: 97,
  rpc: "https://data-seed-prebsc-1-s1.binance.org:8545/",
  name: "BSC Testnet",
  nativeCurrency: {
    name: "BNB",
    symbol: "tBNB",
    decimals: 18,
  },
  blockExplorers: [
    {
      name: "BscScan Testnet",
      url: "https://testnet.bscscan.com",
      apiUrl: "https://api-testnet.bscscan.com/api",
    },
  ],
  testnet: true,
  contracts: {
    basSchemaRegistry: "0x08C8b8417313fF130526862f90cd822B55002D72",
    basContract: "0x6c2270298b1e6046898a322acB3Cbad6F99f7CBD",
  }
};

/**
 * BSC Mainnet
 * Chain ID: 56
 */
export const bscMainnet = {
  id: 56,
  chainId: 56,
  rpc: "https://bsc-dataseed.binance.org/",
  name: "BSC Mainnet",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  blockExplorers: [
    {
      name: "BscScan",
      url: "https://bscscan.com",
      apiUrl: "https://api.bscscan.com/api",
    },
  ],
  testnet: false,
  contracts: {
    basSchemaRegistry: "0x5e905F77f59491F03eBB78c204986aaDEB0C6bDa",
    basContract: "0x247Fe62d887bc9410c3848DF2f322e52DA9a51bC",
  }
};

/**
 * Ethereum Sepolia Testnet
 * Chain ID: 11155111
 */
export const sepolia = {
  id: 11155111,
  chainId: 11155111,
  rpc: "https://rpc.sepolia.org/",
  name: "Sepolia",
  nativeCurrency: {
    name: "Sepolia ETH",
    symbol: "ETH",
    decimals: 18,
  },
  blockExplorers: [
    {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io",
      apiUrl: "https://api-sepolia.etherscan.io/api",
    },
  ],
  testnet: true,
  contracts: {}
};

/**
 * Ethereum Mainnet
 * Chain ID: 1
 */
export const mainnet = {
  id: 1,
  chainId: 1,
  rpc: "https://eth.llamarpc.com",
  name: "Ethereum",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  blockExplorers: [
    {
      name: "Etherscan",
      url: "https://etherscan.io",
      apiUrl: "https://api.etherscan.io/api",
    },
  ],
  testnet: false,
  contracts: {}
};

/**
 * Base Sepolia Testnet
 * Chain ID: 84532
 */
export const baseSepolia = {
  id: 84532,
  chainId: 84532,
  rpc: "https://sepolia.base.org",
  name: "Base Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  blockExplorers: [
    {
      name: "BaseScan Sepolia",
      url: "https://sepolia.basescan.org",
      apiUrl: "https://api-sepolia.basescan.org/api",
    },
  ],
  testnet: true,
  contracts: {}
};

/**
 * Base Mainnet
 * Chain ID: 8453
 */
export const base = {
  id: 8453,
  chainId: 8453,
  rpc: "https://mainnet.base.org",
  name: "Base",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  blockExplorers: [
    {
      name: "BaseScan",
      url: "https://basescan.org",
      apiUrl: "https://api.basescan.org/api",
    },
  ],
  testnet: false,
  contracts: {}
};

export const SUPPORTED_CHAINS = [omachainTestnet, bscTestnet, bscMainnet, sepolia, mainnet, baseSepolia, base];
export const DEFAULT_CHAIN = omachainTestnet;

/**
 * Chain ID constants for easy reference
 */
export const CHAIN_IDS = {
  OMACHAIN_TESTNET: 66238,
  OMACHAIN_MAINNET: 6623,
  BSC_TESTNET: 97,
  BSC_MAINNET: 56,
  SEPOLIA: 11155111,
  MAINNET: 1,
  BASE_SEPOLIA: 84532,
  BASE: 8453,
};

/**
 * Chain names mapped by chain ID
 */
export const CHAIN_NAMES = {
  [CHAIN_IDS.OMACHAIN_TESTNET]: 'OMAchain Testnet',
  [CHAIN_IDS.OMACHAIN_MAINNET]: 'OMAchain Mainnet',
  [CHAIN_IDS.BSC_TESTNET]: 'BSC Testnet',
  [CHAIN_IDS.BSC_MAINNET]: 'BSC Mainnet',
  [CHAIN_IDS.SEPOLIA]: 'Sepolia',
  [CHAIN_IDS.MAINNET]: 'Ethereum Mainnet',
  [CHAIN_IDS.BASE_SEPOLIA]: 'Base Sepolia',
  [CHAIN_IDS.BASE]: 'Base',
};

/**
 * Deployment file extensions mapped to chain IDs
 * Used by update-schemas.js to read deployment files
 */
export const DEPLOYMENT_FILE_MAPPINGS = {
  '.deployed.bastest.json': CHAIN_IDS.BSC_TESTNET,
  '.deployed.bas.json': CHAIN_IDS.BSC_MAINNET,
  '.deployed.eastest.json': CHAIN_IDS.OMACHAIN_TESTNET,
  '.deployed.eas.json': CHAIN_IDS.OMACHAIN_MAINNET,
};

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Unknown Chain (${chainId})`;
}

/**
 * Get chain configuration by chain ID
 */
export function getChainById(chainId: number) {
  return SUPPORTED_CHAINS.find(chain => chain.id === chainId);
} 