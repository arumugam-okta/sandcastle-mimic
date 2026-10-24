import type { NextConfig } from "next";

// Mimic needs a cross-origin isolated page (SharedArrayBuffer).
const isolation = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
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
    return [{ source: "/:path*", headers: isolation }];
  },
};

export default nextConfig;
