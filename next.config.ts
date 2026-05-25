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
  }
];

const nextConfig: NextConfig = {
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url))
  },
  async headers() {
    return [
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
        source: "/partner",
        headers: runtimeNoStoreHeaders
      },
      {
        source: "/ops",
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
  }
};

export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: false
});
