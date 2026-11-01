// The usage meter used to divide raw transcript tokens by a hardcoded budget,
// which matched nothing the account's plan reports. It now shows the plan's
// own 5h / 7d percentages, captured from Claude Code's status-line JSON, or
// says plainly that they are unavailable.
//
// Fixtures are synthetic: no real paths, session ids or account data.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  captureFromStatusLine,
  interpretCapture,
  rateLimitsPath,
  readPlanUsage,
  setupInstruction,
  statusLineText,
  writeCapture,
} from "../../src/lib/claude-rate-limits.mjs";

const NOW = Date.parse("2026-10-18T12:00:00Z");
const HOUR = 3600 * 1000;
const sec = (ms) => Math.floor(ms / 1000);

// The shape documented at code.claude.com/docs/en/statusline, trimmed.
const statusInput = (rateLimits) => ({
  hook_event_name: "Status",
  session_id: "00000000-0000-0000-0000-000000000000",
  transcript_path: "/example/transcript.jsonl",
  cwd: "/example/project",
  model: { id: "example-model", display_name: "Example" },
  ...(rateLimits === undefined ? {} : { rate_limits: rateLimits }),
});
const windows = {
  five_hour: { used_percentage: 18.4, resets_at: sec(NOW + 2 * HOUR) },
  seven_day: { used_percentage: 68, resets_at: sec(NOW + 3 * 24 * HOUR) },
};

function tmp() {
  return mkdtempSync(join(tmpdir(), "co-rate-limits-"));
}

test("captures only the rate-limit numbers, never cwd or session data", () => {
  const rec = captureFromStatusLine(statusInput({ ...windows, spend_limit: { used_percentage: 1, resets_at: 1 } }), NOW);
  assert.deepEqual(rec, {
    capturedAt: "2026-10-18T12:00:00.000Z",
    five_hour: windows.five_hour,
    seven_day: windows.seven_day,
  });
});

test("no rate_limits (API key, or before the first reply) captures nothing", () => {
  assert.equal(captureFromStatusLine(statusInput(undefined), NOW), null);
  assert.equal(captureFromStatusLine(statusInput({}), NOW), null);
  assert.equal(captureFromStatusLine(null, NOW), null);
});

test("each window may be absent or malformed on its own", () => {
  const rec = captureFromStatusLine(
    statusInput({ five_hour: { used_percentage: "18", resets_at: 1 }, seven_day: windows.seven_day }),
    NOW,
  );
  assert.equal(rec.five_hour, undefined);
  assert.deepEqual(rec.seven_day, windows.seven_day);
});

test("status line text rounds for display only", () => {
  assert.equal(statusLineText(captureFromStatusLine(statusInput(windows), NOW)), "5h 18% · 7d 68%");
  assert.equal(statusLineText(null), "");
});

test("a fresh capture reads back as the real percentage and reset time", () => {
  const rec = captureFromStatusLine(statusInput(windows), NOW);
  const r = interpretCapture(rec, NOW + 10 * 60 * 1000);
  assert.equal(r.state, "ok");
  assert.deepEqual(
    r.windows.map((w) => [w.label, w.usedPercent, w.resetsAt, w.stale]),
    [
      ["5h", 18.4, new Date(sec(NOW + 2 * HOUR) * 1000).toISOString(), false],
      ["7d", 68, new Date(sec(NOW + 3 * 24 * HOUR) * 1000).toISOString(), false],
    ],
  );
});

test("resets_at is epoch seconds: a window past its reset is stale, not current", () => {
  const rec = captureFromStatusLine(statusInput(windows), NOW);
  const r = interpretCapture(rec, NOW + 2 * HOUR + 1000);
  const [five, seven] = r.windows;
  assert.deepEqual([five.stale, five.staleReason], [true, "reset"]);
  assert.equal(seven.stale, false);
});

test("a capture older than the window's length is stale even before the reset time", () => {
  // A reset far ahead (malformed or long window) must not keep an old value "current".
  const rec = {
    capturedAt: new Date(NOW).toISOString(),
    five_hour: { used_percentage: 10, resets_at: sec(NOW + 24 * HOUR) },
    seven_day: { used_percentage: 20, resets_at: sec(NOW + 20 * 24 * HOUR) },
  };
  const r = interpretCapture(rec, NOW + 6 * HOUR);
  assert.deepEqual(r.windows.map((w) => [w.label, w.stale, w.staleReason]), [
    ["5h", true, "old"],
    ["7d", false, null],
  ]);
});

test("missing file is 'not set up' with the one-line setup instruction", async () => {
  const dir = tmp();
  try {
    const file = rateLimitsPath(dir);
    const setup = setupInstruction("/opt/career-ops/web/scripts/claude-usage-statusline.mjs", file);
    const r = await readPlanUsage({ file, setup, nowMs: NOW });
    assert.equal(r.state, "not-set-up");
    assert.equal(r.setup, setup);
    assert.match(setup, /^Add to ~\/\.claude\/settings\.json: "statusLine": /);
    assert.ok(setup.includes("--out"), "the setup line pins the file the web app reads");
    assert.ok(!setup.includes("\n"));
    // The instruction is valid JSON once wrapped in braces.
    const cfg = JSON.parse(`{${setup.replace(/^Add to [^:]+: /, "")}}`);
    assert.equal(cfg.statusLine.type, "command");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a malformed capture is an error, not 'not set up'", async () => {
  const dir = tmp();
  try {
    const file = join(dir, "c.json");
    writeFileSync(file, "{not json");
    assert.equal((await readPlanUsage({ file, setup: "x", nowMs: NOW })).state, "error");
    writeFileSync(file, JSON.stringify({ capturedAt: "2026-10-18T12:00:00Z" }));
    assert.equal((await readPlanUsage({ file, setup: "x", nowMs: NOW })).state, "error");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeCapture round-trips through readPlanUsage and leaves no temp file", async () => {
  const dir = tmp();
  try {
    const file = rateLimitsPath(dir);
    await writeCapture(file, captureFromStatusLine(statusInput(windows), NOW));
    const r = await readPlanUsage({ file, setup: "x", nowMs: NOW });
    assert.equal(r.state, "ok");
    assert.deepEqual(r.windows.map((w) => w.usedPercent), [18.4, 68]);
    assert.deepEqual(readdirSync(join(dir, ".career-ops-web")), ["claude-rate-limits.json"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const SCRIPT = fileURLToPath(new URL("../../scripts/claude-usage-statusline.mjs", import.meta.url));
const runScript = (args, stdin) => spawnSync(process.execPath, [SCRIPT, ...args], { input: stdin, encoding: "utf8" });

test("the status-line script writes the capture to --out and prints the short line", () => {
  const dir = tmp();
  try {
    const out = join(dir, "nested", "rl.json");
    const r = runScript(["--out", out], JSON.stringify(statusInput(windows)));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^5h 18% · 7d 68%/);
    const saved = JSON.parse(readFileSync(out, "utf8"));
    assert.deepEqual(Object.keys(saved).sort(), ["capturedAt", "five_hour", "seven_day"]);

    // --quiet prints nothing; input without rate_limits keeps the last capture.
    const q = runScript(["--quiet", "--out", out], JSON.stringify(statusInput(undefined)));
    assert.equal(q.status, 0);
    assert.equal(q.stdout, "");
    assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), saved);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the status-line script never fails the status line on bad input", () => {
  const dir = tmp();
  try {
    const out = join(dir, "rl.json");
    const r = runScript(["--out", out], "not json");
    assert.equal(r.status, 0);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
