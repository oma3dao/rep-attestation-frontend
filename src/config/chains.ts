import { bscTestnet, bsc, sepolia, mainnet, defineChain } from "thirdweb/chains";

// OMAchain Testnet
export const omachainTestnet = defineChain({
  id: 66238,
  name: "OMAChain Testnet",
  nativeCurrency: {
    name: "OMA",
    symbol: "OMA",
    decimals: 18,
  },
  rpc: "https://rpc.testnet.chain.oma3.org/",
  blockExplorers: [
    {
      name: "OMAchain Testnet Explorer",
      url: "https://explorer.testnet.chain.oma3.org",
      apiUrl: "https://explorer.testnet.chain.oma3.org/api",
    },
  ],
});

// OMAchain Mainnet (placeholder for future)
export const omachainMainnet = defineChain({
  id: 6623,
  name: "OMAChain Mainnet", 
  nativeCurrency: {
    name: "OMA",
    symbol: "OMA",
    decimals: 18,
  },
  rpc: "https://rpc.chain.oma3.org/", // TODO: Update when mainnet is available
  blockExplorers: [
    {
      name: "OMAchain Explorer",
      url: "https://explorer.chain.oma3.org",
      apiUrl: "https://explorer.chain.oma3.org/api",
    },
  ],
});

export const SUPPORTED_CHAINS = [omachainTestnet, bscTestnet, bsc, sepolia, mainnet];
export const DEFAULT_CHAIN = omachainTestnet; 