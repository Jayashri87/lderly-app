import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const runtimeNoStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, proxy-revalidate"
  },
  {
    key: "Pragma",
    value: "no-cache"
  },
  {
    key: "Expires",
    value: "0"
  },
  {
    key: "Surrogate-Control",
    value: "no-store"
  },
  {
    key: "X-LDERLY-Cache-Policy",
    value: "runtime-routes-no-store"
  },
  {
    key: "X-LDERLY-Build",
    value:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
      process.env.NEXT_PUBLIC_LDERLY_BUILD_ID ||
      "local"
  }
];

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), microphone=(), camera=()"
  }
];

const nextConfig: NextConfig = {
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url))
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/",
        headers: runtimeNoStoreHeaders
      },
      {
        source: "/signin",
        headers: runtimeNoStoreHeaders
      },
      {
        source: "/login",
        headers: runtimeNoStoreHeaders
      },
      {
        source: "/superadmin",
        headers: runtimeNoStoreHeaders
      },
      {
        source: "/partner",
        headers: runtimeNoStoreHeaders
      },
      {
        source: "/ops",
        headers: runtimeNoStoreHeaders
      },
      {
        source: "/offline",
        headers: runtimeNoStoreHeaders
      },
      {
        source: "/manifest.webmanifest",
        headers: runtimeNoStoreHeaders
      },
      {
        source: "/api/:path*",
        headers: runtimeNoStoreHeaders
      }
    ];
  },
  async redirects() {
    return [
      {
        source: "/caregiver",
        destination: "/partner",
        permanent: false
      }
    ];
  },
  experimental: {
    optimizePackageImports: [
      "@react-google-maps/api",
      "framer-motion",
      "lucide-react",
      "firebase",
      "@firebase/app",
      "@firebase/auth",
      "@firebase/database"
    ]
  }
};

export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: false
});
