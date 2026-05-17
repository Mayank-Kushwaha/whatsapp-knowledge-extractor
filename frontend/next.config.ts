import type { NextConfig } from "next";

/**
 * NEXT_PUBLIC_API_URL  — set this in Vercel environment variables to your
 * Render backend URL, e.g. https://whatsapp-extractor-api.onrender.com
 *
 * When not set (local dev), the rewrite proxy below forwards /api/* and
 * /media/* to http://localhost:8000, so the frontend never needs to know
 * the backend address at build time.
 */
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  // ---------------------------------------------------------------------------
  // API + media proxy rewrites
  // In production on Vercel these rewrites forward requests to the Render
  // backend. In local dev they forward to localhost:8000.
  // ---------------------------------------------------------------------------
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${BACKEND_URL}/media/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },

  // ---------------------------------------------------------------------------
  // Security headers
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // ---------------------------------------------------------------------------
  // Image domains — allow OG images from the backend and external sources
  // ---------------------------------------------------------------------------
  images: {
    remotePatterns: [
      // Local dev backend
      { protocol: "http", hostname: "localhost", port: "8000" },
      // Production Render backend — update hostname to match your Render URL
      { protocol: "https", hostname: "*.onrender.com" },
      // Common OG image sources
      { protocol: "https", hostname: "**.ytimg.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.twimg.com" },
      { protocol: "https", hostname: "opengraph.githubassets.com" },
    ],
  },
};

export default nextConfig;
