/**
 * interactive-runs.mjs — live interactive runs (chrome-fill): the agent ends a turn
 * with an `ASK:` line, the run waits, and the user's reply (POST /api/run/reply) is
 * written to the same Claude session over stdin.
 *
 * Kept on globalThis: Next may bundle /api/run and /api/run/reply separately, and
 * both must see the same map inside the one local server process.
 */
import { randomUUID } from "node:crypto";

export const REPLY_TIMEOUT_MS = 20 * 60_000;
export const MAX_ASKS = 15;

/** @type {Map<string, {child: import("node:child_process").ChildProcess, waiting: boolean, timer?: ReturnType<typeof setTimeout>, asks: number}>} */
const runs = (/** @type {any} */ (globalThis).__careerOpsInteractiveRuns ??= new Map());

/** One stream-json user message line. */
export const userMessage = (text) => JSON.stringify({ type: "user", message: { role: "user", content: String(text) } }) + "\n";

/** The question in a finished turn's text, if the agent asked one (last `ASK:` line). */
export function askedQuestion(turnText) {
  const all = [...String(turnText).matchAll(/^ASK:[ \t]*(.+)$/gm)];
  return all.length ? all[all.length - 1][1].trim().slice(0, 500) : null;
}

export function registerRun(child) {
  const id = randomUUID();
  runs.set(id, { child, waiting: false, asks: 0 });
  return id;
}

/** Close stdin so the CLI finishes; the route's close handler reports the outcome. */
export function endRun(id) {
  const run = runs.get(id);
  if (!run) return;
  if (run.timer) clearTimeout(run.timer);
  run.waiting = false;
  try { run.child.stdin?.end(); } catch { /* already closed */ }
}

/**
 * Mark the run as waiting for the user. Returns false when the run has asked too
 * often (the caller ends it instead).
 */
export function waitForReply(id) {
  const run = runs.get(id);
  if (!run) return false;
  run.asks += 1;
  if (run.asks > MAX_ASKS) return false;
  run.waiting = true;
  run.timer = setTimeout(() => endRun(id), REPLY_TIMEOUT_MS);
  return true;
}

/** @returns {"ok" | "unknown" | "not-waiting"} */
export function replyToRun(id, text) {
  const run = runs.get(id);
  if (!run) return "unknown";
  if (!run.waiting) return "not-waiting";
  if (run.timer) clearTimeout(run.timer);
  run.waiting = false;
  run.child.stdin?.write(userMessage(text));
  return "ok";
}

export function forgetRun(id) {
  const run = runs.get(id);
  if (run?.timer) clearTimeout(run.timer);
  runs.delete(id);
}
