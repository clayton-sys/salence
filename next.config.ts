import type { NextConfig } from 'next'
import path from 'node:path'

// NOTE: next-pwa@5 injects a webpack config incompatible with Turbopack
// (Next 16's default bundler). The PWA manifest alone is enough for "Add to
// home screen" installability. A full service-worker implementation is
// deferred to v2 — it needs a Turbopack-compatible PWA setup (e.g. Serwist).
const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
