import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false 
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      '@x402/core': false,
      '@x402/evm': false,
      '@x402/svm': false,
    };
    return config;
  },
};

export default nextConfig;
