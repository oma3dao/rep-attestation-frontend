import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Preview environment: route to preview widget
      {
        source: "/widgets/:path*",
        has: [{ type: "host", value: "preview.reputation.omatrust.org" }],
        destination: "https://preview.widgets.omatrust.org/widgets/:path*",
      },
      {
        source: "/api/proof/:path*",
        has: [{ type: "host", value: "preview.reputation.omatrust.org" }],
        destination: "https://preview.widgets.omatrust.org/api/proof/:path*",
      },
      // Production (fallback): route to production widget
      {
        source: "/widgets/:path*",
        destination: "https://widgets.omatrust.org/widgets/:path*",
      },
      {
        source: "/api/proof/:path*",
        destination: "https://widgets.omatrust.org/api/proof/:path*",
      },
    ];
  },
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
