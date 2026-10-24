import type { NextConfig } from "next";

// Mimic needs a cross-origin isolated page (SharedArrayBuffer).
const isolation = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

// Mimic's runtime files are loaded by its hidden runtime-host frame and registered as a service
// worker, so they also need a CORP header and a service worker scope of /.
const mimicAssets = [
  ...isolation,
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
  { key: "Service-Worker-Allowed", value: "/" },
  // The platform gateway adds X-Frame-Options: DENY. Browsers ignore X-Frame-Options when
  // frame-ancestors is present, so this lets the page frame its own runtime host.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  // Self-contained server output (.next/standalone) for container deploys.
  output: "standalone",
  // The page reads templates/ at render time; make sure they ship with the standalone trace.
  outputFileTracingIncludes: { "/": ["./templates/**/*"] },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: isolation },
      { source: "/mimic/:path*", headers: mimicAssets },
    ];
  },
};

export default nextConfig;
