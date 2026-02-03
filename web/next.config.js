/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Match the Vercel Output Directory setting and avoid static export mode.
  distDir: 'dist',
  output: 'standalone'
};

module.exports = nextConfig;
