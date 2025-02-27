/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_MODE: process.env.NODE_ENV === 'production' ? 'true' : 'false',
  },
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