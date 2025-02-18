/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable SWC for compilation
  swcMinify: true,
  // Disable Babel for production/development
  experimental: {
    forceSwcTransforms: true
  }
}

module.exports = nextConfig 