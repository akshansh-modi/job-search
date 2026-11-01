// Run:  node --test tests/lib/mongo-worker.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { isReplayable, SYNC_DIRS, SYNC_FILES } from "../../scripts/mongo-worker.mjs";

test("only /api mutations are replayed", () => {
  assert.equal(isReplayable({ method: "POST", path: "/api/run" }), true);
  assert.equal(isReplayable({ method: "POST", path: "/api/status?n=8" }), true);
  assert.equal(isReplayable({ method: "GET", path: "/api/run" }), false);
  assert.equal(isReplayable({ method: "POST", path: "/pipeline" }), false);
  assert.equal(isReplayable({ method: "POST", path: "/api/../etc" }), false);
  assert.equal(isReplayable({ method: "POST", path: "http://evil.com/api/run" }), false);
  assert.equal(isReplayable({ method: "POST", path: "/api/run\nHost: x" }), false);
  assert.equal(isReplayable(null), false);
});

test("secrets are never in the sync set", () => {
  const all = [...SYNC_DIRS, ...SYNC_FILES];
  assert.ok(!all.some((p) => /\.env|web\//.test(p)));
});

test("--help and unknown flags are decided before any connection", async () => {
  const { parseWorkerArgs } = await import("../../scripts/mongo-worker.mjs");
  assert.deepEqual(parseWorkerArgs(["--help"]), { help: true, syncOnly: false, unknown: [] });
  assert.equal(parseWorkerArgs(["-h"]).help, true);
  assert.deepEqual(parseWorkerArgs(["--sync-only"]), { help: false, syncOnly: true, unknown: [] });
  assert.deepEqual(parseWorkerArgs(["--sync-onyl"]).unknown, ["--sync-onyl"]);
});
