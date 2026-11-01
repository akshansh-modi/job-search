// The account's real Claude plan usage, as Claude Code itself reports it.
//
// Claude Code passes a JSON object to the user's status-line command on stdin.
// For claude.ai Pro, Max and Ultra subscribers that object carries
// `rate_limits.five_hour` and `rate_limits.seven_day`, each with
// `used_percentage` (0-100) and `resets_at` (Unix epoch SECONDS) — the same
// numbers claude.ai Settings > Usage shows. Documented at
// https://code.claude.com/docs/en/statusline#rate-limit-usage
//
// There is no other supported local source: the transcripts under
// ~/.claude/projects hold raw token counts, and plan limits are not raw tokens
// (cache reads are discounted, models are weighted, windows reset at fixed
// times). So the web meter shows these captured percentages or says plainly
// that they are unavailable; it never derives a percentage from tokens.
//
// scripts/claude-usage-statusline.mjs is the capture: a status-line command the
// user opts into, which writes the whitelisted fields below to a file. The
// /api/usage route reads that file back through readPlanUsage().
//
// Plain .mjs so node --test imports it directly (web/AGENTS.md, "Testing").

import fsPromises from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const HOUR = 3600 * 1000;

export const WINDOWS = /** @type {const} */ ([
  { key: "five_hour", label: "5h", lengthMs: 5 * HOUR },
  { key: "seven_day", label: "7d", lengthMs: 7 * 24 * HOUR },
]);

/** Where the capture lives, under the data root (gitignored `.career-ops-web/`). */
export function rateLimitsPath(dataRoot) {
  return path.join(dataRoot, ".career-ops-web", "claude-rate-limits.json");
}

/**
 * The one-line setup instruction shown when nothing has been captured yet.
 * `--out` pins the file the web app reads, so Claude Code and the web server
 * agree on it even when their environments resolve different data roots.
 */
export function setupInstruction(scriptPath, outPath) {
  const command = `node ${JSON.stringify(scriptPath)} --out ${JSON.stringify(outPath)}`;
  return `Add to ~/.claude/settings.json: "statusLine": {"type": "command", "command": ${JSON.stringify(command)}}`;
}

function finite(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function pickWindow(w) {
  if (!w || typeof w !== "object") return null;
  if (!finite(w.used_percentage) || !finite(w.resets_at) || w.used_percentage < 0 || w.resets_at <= 0) return null;
  return { used_percentage: w.used_percentage, resets_at: w.resets_at };
}

/**
 * Turn Claude Code's status-line input into the record we store. Only the
 * rate-limit numbers are kept: the input also carries cwd, transcript path and
 * session id, none of which belongs on disk here.
 *
 * Returns null when the input has no usable window — an API-key session, or a
 * subscriber session before its first API response. The caller then leaves
 * the last good capture in place.
 *
 * @param {unknown} input parsed status-line JSON
 * @param {number} nowMs
 */
export function captureFromStatusLine(input, nowMs) {
  const rl = input && typeof input === "object" ? /** @type {any} */ (input).rate_limits : null;
  if (!rl || typeof rl !== "object") return null;
  /** @type {Record<string, unknown>} */
  const record = { capturedAt: new Date(nowMs).toISOString() };
  let any = false;
  for (const { key } of WINDOWS) {
    const w = pickWindow(rl[key]);
    if (w) {
      record[key] = w;
      any = true;
    }
  }
  return any ? record : null;
}

/** Atomic write: unique temp file in the same directory, then rename. */
export async function writeCapture(file, record, fs = fsPromises) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await fs.writeFile(tmp, JSON.stringify(record, null, 2) + "\n", "utf8");
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

/** The short line the capture prints as the status line itself. */
export function statusLineText(record) {
  if (!record) return "";
  return WINDOWS.filter(({ key }) => record[key])
    .map(({ key, label }) => `${label} ${Math.round(record[key].used_percentage)}%`)
    .join(" · ");
}

/**
 * Interpret a stored capture at `nowMs`.
 *
 * A window is stale when its `resets_at` has passed (the percentage describes
 * a finished window; Claude Code drops such a window itself), or when the
 * capture is older than the window's own length. A stale window still reports
 * its old value so the UI can show it greyed out, never as current.
 *
 * @param {unknown} raw parsed file contents
 * @param {number} nowMs
 */
export function interpretCapture(raw, nowMs) {
  const capturedMs = raw && typeof raw === "object" ? Date.parse(/** @type {any} */ (raw).capturedAt) : NaN;
  if (Number.isNaN(capturedMs)) return { state: "error", message: "The usage capture has no valid capturedAt." };
  const windows = [];
  for (const { key, label, lengthMs } of WINDOWS) {
    const w = pickWindow(/** @type {any} */ (raw)[key]);
    if (!w) continue;
    const resetsAtMs = w.resets_at * 1000;
    let staleReason = null;
    if (nowMs >= resetsAtMs) staleReason = "reset";
    else if (nowMs - capturedMs > lengthMs) staleReason = "old";
    windows.push({
      key,
      label,
      usedPercent: w.used_percentage,
      resetsAt: new Date(resetsAtMs).toISOString(),
      stale: staleReason !== null,
      staleReason,
    });
  }
  if (windows.length === 0) return { state: "error", message: "The usage capture holds no rate-limit window." };
  return { state: "ok", capturedAt: new Date(capturedMs).toISOString(), windows };
}

/**
 * Read and interpret the capture. A missing file is "not-set-up" with the
 * setup instruction; an unreadable or malformed one is an error the user can
 * act on, never silently "not set up" (web/AGENTS.md).
 *
 * @param {object} o
 * @param {string} o.file
 * @param {string} o.setup one-line setup instruction
 * @param {number} o.nowMs
 * @param {typeof fsPromises} [o.fs]
 */
export async function readPlanUsage({ file, setup, nowMs, fs = fsPromises }) {
  let text;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (err) {
    if (/** @type {any} */ (err)?.code === "ENOENT") return { state: "not-set-up", file, setup };
    return { state: "error", file, message: `Could not read ${file}: ${/** @type {any} */ (err)?.message ?? err}` };
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { state: "error", file, message: `${file} is not valid JSON. Delete it; the next Claude Code reply rewrites it.` };
  }
  return { ...interpretCapture(raw, nowMs), file };
}
