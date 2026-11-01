// Run:  node --test tests/lib/flows.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { choiceFor, cleanChoice, FLOWS, modelArgs, writeFlowSettings } from "../../src/lib/flows.mjs";
import { KNOWN_KINDS } from "../../src/lib/worker-capabilities.mjs";

test("every flow task is a real worker kind", () => {
  for (const f of FLOWS) for (const t of f.tasks) assert.ok(KNOWN_KINDS.includes(t.kind), t.kind);
});

test("defaults apply with no config; saved choices win; junk falls back", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "flows-"));
  try {
    assert.deepEqual(choiceFor(root, "evaluate"), { cli: "default", model: "sonnet", effort: "high" });
    writeFlowSettings(root, { evaluate: { cli: "claude", model: "haiku", effort: "low" }, research: { cli: "antigravity", model: "gemini-3.8-flash-high" }, bogus: { cli: "x" } });
    assert.deepEqual(choiceFor(root, "evaluate"), { cli: "claude", model: "haiku", effort: "low" });
    assert.deepEqual(choiceFor(root, "research"), { cli: "antigravity", model: "gemini-3.8-flash-high", effort: "medium" });
    assert.ok(!fs.readFileSync(path.join(root, "config", "flows.yml"), "utf8").includes("bogus"));
    assert.deepEqual(cleanChoice("evaluate", { cli: "claude; rm -rf", model: "gpt-9", effort: "huge" }), { cli: "default", model: "sonnet", effort: "high" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("chrome-fill stays on Claude whatever is saved", () => {
  assert.equal(cleanChoice("chrome-fill", { cli: "antigravity" }).cli, "claude");
});

test("model flags only for CLIs that take them, and only known models", () => {
  assert.deepEqual(modelArgs("claude", { model: "opus", effort: "high" }), ["--model", "opus", "--effort", "high"]);
  assert.deepEqual(modelArgs("antigravity", { model: "sonnet", effort: "low" }), ["--effort", "low"]);
  assert.deepEqual(modelArgs("codex", { model: "opus", effort: "high" }), []);
});
