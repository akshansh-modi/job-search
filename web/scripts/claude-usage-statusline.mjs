#!/usr/bin/env node
// Claude Code status-line command that captures the account's real plan usage
// for the web app's sidebar meter. Opt-in: see web/README.md, "Plan usage meter".
//
// Claude Code pipes its status-line JSON to this script on stdin. When it
// carries `rate_limits` (claude.ai Pro/Max/Ultra, after the session's first
// reply), the 5h/7d used percentages and reset times are written to
//   --out <file>   (the path the web app shows in its setup line), or by default
//   {data root}/.career-ops-web/claude-rate-limits.json
// Nothing else from the input is stored.
//
// It prints a short status line ("5h 18% · 7d 68%"). With --quiet it prints
// nothing, for chaining from a status-line script you already have:
//   input=$(cat); printf '%s' "$input" | node .../claude-usage-statusline.mjs --quiet --out ...
//
// It never fails the status line: any error is swallowed and exit is 0.

import { getCareerOpsRoot } from "../../path-resolver.mjs";
import { captureFromStatusLine, rateLimitsPath, statusLineText, writeCapture } from "../src/lib/claude-rate-limits.mjs";

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes("--quiet");
  let record = null;
  try {
    record = captureFromStatusLine(JSON.parse(await readStdin()), Date.now());
    if (record) {
      const out = argValue(args, "--out") || rateLimitsPath(getCareerOpsRoot());
      await writeCapture(out, record);
    }
  } catch {
    // A status line must not error; the web app reports a missing capture.
  }
  if (!quiet) process.stdout.write(statusLineText(record) + "\n");
}

await main();
