import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { statusHistoryFor } from "../../src/lib/status-history.mjs";
import { parseStatusLog } from "../../src/lib/pipeline-sankey.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// {tracker#}\t{date}\t{from}\t{to}\t{source}\t{note} — the set-status.mjs ledger.
const LEDGER = [
  "3\t2026-09-01\tEvaluated\tApplied\tset-status\t",
  "4\t2026-09-02\tEvaluated\tApplied\tweb\tother row",
  "3\t2026-09-10\tApplied\tInterview\tset-status\trecruiter screen",
  "3\t2026-09-11\t-\t-\tset-status\tundo Applied → Interview", // set-status.mjs --undo
  "3\t2026-09-12\t-\tApplied\tcorrection\tfixed date",
  "30\t2026-09-12\tEvaluated\tApplied\tset-status\t",
].join("\n");

test("only this tracker #, in file order, retractions and corrections labelled", () => {
  const got = statusHistoryFor(parseStatusLog(LEDGER), "3");
  assert.deepEqual(got, [
    { date: "2026-09-01", from: "Evaluated", to: "Applied", source: "set-status", note: "", kind: "change" },
    { date: "2026-09-10", from: "Applied", to: "Interview", source: "set-status", note: "recruiter screen", kind: "change" },
    { date: "2026-09-11", from: null, to: null, source: "set-status", note: "undo Applied → Interview", kind: "retraction" },
    { date: "2026-09-12", from: null, to: "Applied", source: "correction", note: "fixed date", kind: "correction" },
  ]);
});

test("padded tracker # matches; non-numeric or missing ids give nothing", () => {
  const rows = parseStatusLog(LEDGER);
  assert.equal(statusHistoryFor(rows, "003").length, 4);
  assert.deepEqual(statusHistoryFor(rows, "3a"), []);
  assert.deepEqual(statusHistoryFor(rows, ""), []);
  assert.deepEqual(statusHistoryFor(rows, undefined), []);
  assert.deepEqual(statusHistoryFor(parseStatusLog(""), "3"), []);
});

test("parity: every row the core's parseStatusLog keeps for #3 is shown", async () => {
  const { parseStatusLog: coreParse } = await import(pathToFileURL(join(ROOT, "funnel-velocity.mjs")).href);
  const { loadCanonicalStates } = await import(pathToFileURL(join(ROOT, "tracker-utils.mjs")).href);
  const states = loadCanonicalStates(join(ROOT, "templates", "states.yml"));
  const parsed = coreParse(LEDGER, states);
  assert.deepEqual(parsed.unparseable, [], "fixture is a valid ledger for the core");
  const core = parsed.observations.filter((o) => o.num === 3);
  const web = statusHistoryFor(parseStatusLog(LEDGER), 3);
  assert.deepEqual(
    web.map((e) => [e.date, e.source, e.note]),
    core.map((o) => [o.date, o.source, o.note]),
  );
});
