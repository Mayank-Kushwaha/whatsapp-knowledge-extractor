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
  experimental: {
    proxyClientMaxBodySize: "100mb",
  },
  // ---------------------------------------------------------------------------
  // API + media proxy rewrites
  //
  // In production on Vercel these rewrites forward requests to the Render
  // backend. In local dev they forward to localhost:8000.
  //
  // Using `fallback` is load-bearing. Per Next.js's rewrite order:
  //   1. headers / redirects / proxy
  //   2. beforeFiles rewrites
  //   3. static files + non-dynamic pages
  //   4. afterFiles rewrites              <-- runs BEFORE dynamic routes
  //   5. dynamic routes                   <-- NextAuth's [...nextauth] lives here
  //   6. fallback rewrites                <-- only fire if nothing else matched
  //
  // If we used `afterFiles`, the wildcard `/api/:path*` source would match
  // `/api/auth/session` before NextAuth's catch-all handler at
  // `app/api/auth/[...nextauth]/route.ts` ever got a chance — so requests
  // intended for NextAuth would be proxied to FastAPI and 404 with
  // `{"detail":"Not Found"}`. With `fallback`, NextAuth's dynamic route
  // wins for /api/auth/*, and everything else under /api/* (which has no
  // local handler) falls through to FastAPI.
  // ---------------------------------------------------------------------------
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
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
      ],
    };
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
