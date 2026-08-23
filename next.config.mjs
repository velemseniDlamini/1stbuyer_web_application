/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type errors must fail the build: this codebase has no test suite, so the
  // compiler is the safety net.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
