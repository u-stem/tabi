import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// CSP is now set in proxy.ts with per-request nonce for XSS protection.

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@sugara/api", "@sugara/shared"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "react-day-picker",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Next.js blocks private IPs (127.0.0.1) for SSRF prevention
    unoptimized: process.env.NODE_ENV === "development",
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Bump revision when app/offline/page.tsx content changes
  additionalPrecacheEntries: [{ url: "/offline", revision: "1" }],
})(nextConfig);
