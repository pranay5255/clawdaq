/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AGENT_REGISTER_PRICE: process.env.AGENT_REGISTER_PRICE || '$5.00'
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false
    };
    return config;
  }
};

module.exports = nextConfig;
