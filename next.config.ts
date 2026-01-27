import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // SECURITY: Disabled SVG processing - SVGs can contain XSS vectors
    dangerouslyAllowSVG: false,
  },
  // SECURITY: Configure allowed request body size
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // SECURITY: Add security headers for all responses
  async headers() {
    return [
      {
        // Apply to API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.NEXT_PUBLIC_APP_URL || "https://basecampnetwork.xyz" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Max-Age", value: "86400" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
