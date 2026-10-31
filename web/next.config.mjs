// Next sends anonymous usage telemetry unless this is set, and career-ops
// promises none. server.mjs sets it for dev and start; this covers `next build`,
// which npm runs directly and which loads this file before it records anything.
process.env.NEXT_TELEMETRY_DISABLED = "1";

import path from "node:path";

const ONLINE = process.env.CAREER_OPS_MODE === "online";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Two lockfiles exist on purpose (repo root + web/), so Next would infer the
  // repo root as the workspace root. On Windows that misinference can send
  // Turbopack's postcss workers into an unbounded respawn loop that exhausts
  // all RAM (vercel/next.js#92978) — pin the root to this app.
  // Online builds trace files from the repo root (must equal outputFileTracingRoot).
  turbopack: { root: ONLINE ? path.resolve(import.meta.dirname, "..") : import.meta.dirname },
  // Online setup (Vercel): ship the career-ops scripts that helpers import at
  // runtime from the data root; online.mjs copies them into the snapshot.
  ...(ONLINE
    ? {
        outputFileTracingRoot: path.resolve(import.meta.dirname, ".."),
        outputFileTracingIncludes: { "/**": ["../*.mjs", "../*.json", "../lib/**", "../providers/**", "../templates/**"] },
      }
    : {}),
  // Allow a throwaway build dir (e.g. BUILD_DIST=.next-prod) so a production
  // `next build` can run without clobbering a live `next dev` .next.
  ...(process.env.BUILD_DIST ? { distDir: process.env.BUILD_DIST } : {}),
};

export default nextConfig;
