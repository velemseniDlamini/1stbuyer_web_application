/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type errors must fail the build. The compiler is the first safety net and
  // the test suite is the second; neither is optional.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // The dev-mode indicator is a black circle pinned to the bottom-left corner,
  // which is exactly where the Chatbot launcher sits. It reads as a stray
  // second button when reviewing the interface, so it is off. It never
  // appeared in a production build either way.
  devIndicators: false,
}

export default nextConfig
