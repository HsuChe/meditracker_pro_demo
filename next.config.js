/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable SWC for compilation
  swcMinify: true,
  // Disable Babel for production/development
  experimental: {
    forceSwcTransforms: true
  },
  // Disable type checking during build (we'll do it separately)
  typescript: {
    ignoreBuildErrors: true
  },
  // Disable ESLint during build (we'll do it separately)
  eslint: {
    ignoreDuringBuilds: true
  }
}

module.exports = nextConfig 