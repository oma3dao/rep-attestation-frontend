import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Handle React Native dependencies for MetaMask SDK (via Web3Auth)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      'react-native': false,
      'react-native-crypto': false,
      'react-native-randombytes': false,
      'react-native-get-random-values': false,
    };
    
    return config;
  },
};

export default nextConfig;
