import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const cspDirectives = [
  "default-src 'self'",
  // Next.js requires 'unsafe-inline' for hydration scripts
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https://api.dicebear.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.dicebear.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
];

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

// CSP breaks Turbopack dev mode (requires 'unsafe-eval')
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  });
}

const nextConfig: NextConfig = {
  transpilePackages: ["@sugara/api", "@sugara/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default withSerwist(nextConfig);
