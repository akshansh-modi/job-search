import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { createUsageScanner } from "@/lib/claude-usage-scan.mjs";
import { rateLimitsPath, readPlanUsage, setupInstruction } from "@/lib/claude-rate-limits.mjs";
import { careerOpsRoot } from "@/lib/career-ops";
import { resolveCodeRoot } from "@/lib/core/code-root.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Two separate things, kept apart on purpose:
//
// `plan` — the account's REAL 5h / 7d plan usage and reset times, as Claude
// Code reports them to a status-line command (lib/claude-rate-limits.mjs). Read
// fresh on every request; it is one small file. When the capture is not set up
// this says so, with the setup line, instead of inventing a percentage.
//
// `tokens` — raw token totals from ~/.claude/projects/**/*.jsonl over rolling
// 5h / 7d windows (lib/claude-usage-scan.mjs). An activity signal only: plan
// limits are not raw tokens, so no percentage is ever derived from these.
// Cached 60s; the scanner reads only what was appended since its last scan.

type Tokens = { window5h: { tokens: number; messages: number }; window7d: { tokens: number; messages: number }; computedAt: number };
let tokenCache: { at: number; data: Tokens } | null = null;

const scanner = createUsageScanner({ root: path.join(os.homedir(), ".claude", "projects") });

function captureScriptPath(): string {
  // Assembled from parts so the bundler does not trace it as a module to bundle.
  const name = ["claude-usage-statusline", "mjs"].join(".");
  return path.join(resolveCodeRoot(process.cwd(), process.env), "web", "scripts", name);
}

export async function GET() {
  const file = rateLimitsPath(careerOpsRoot());
  const plan = await readPlanUsage({ file, setup: setupInstruction(captureScriptPath(), file), nowMs: Date.now() });
  if (!tokenCache || Date.now() - tokenCache.at >= 60_000) {
    tokenCache = { at: Date.now(), data: await scanner.compute() };
  }
  return NextResponse.json({ plan, tokens: tokenCache.data });
}
