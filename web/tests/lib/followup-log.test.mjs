import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildFollowupAppend, followupCell, loggedOn, FOLLOWUP_TABLE_HEADER } from "../../src/lib/followup-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { parseFollowups } = await import(pathToFileURL(join(ROOT, "followup-cadence.mjs")).href);

const ROW = { appNum: 7, date: "2026-11-01", company: "Acme", role: "Engineer", channel: "Other", contact: "", notes: "" };

test("first row into a new file gets the header, and the core parser reads it back", () => {
  const { text, num } = buildFollowupAppend("", ROW);
  assert.equal(num, 1);
  assert.ok(text.startsWith(FOLLOWUP_TABLE_HEADER));
  assert.deepEqual(parseFollowups(`# Follow-ups\n\n${text}`), [
    { num: 1, appNum: 7, date: "2026-11-01", company: "Acme", role: "Engineer", channel: "Other", contact: "", notes: "" },
  ]);
});

test("appends after a CLI-created '#' header without a second header, num = max + 1", () => {
  const existing = [
    "# Follow-ups",
    "",
    "| # | appNum | date | company | role | channel | contact | notes |",
    "|---|---|---|---|---|---|---|---|",
    "| 4 | 2 | 2026-10-01 | Initech | Analyst | Email | jo@initech.example | first nudge |",
    "- next #2 2026-10-15 (set 2026-10-01)",
  ].join("\n"); // no trailing newline, as some CLI writers leave it
  const { text, num } = buildFollowupAppend(existing, ROW);
  assert.equal(num, 5);
  assert.ok(text.startsWith("\n"), "guards the missing trailing newline");
  assert.ok(!text.includes("|---|"), "no second header block");
  const parsed = parseFollowups(existing + text);
  assert.deepEqual(parsed.map((e) => [e.num, e.appNum, e.date, e.channel]), [
    [4, 2, "2026-10-01", "Email"],
    [5, 7, "2026-11-01", "Other"],
  ]);
});

test("cells stay single-line and pipe-free", () => {
  assert.equal(followupCell("a | b\nc"), "a / b c");
  assert.equal(followupCell("abcdef", 3), "abc");
  assert.equal(followupCell(undefined), "");
});

test("loggedOn: true only when a follow-up already carries that date", () => {
  const entry = { followups: [{ date: "2026-10-30" }, { date: "2026-11-01" }] };
  assert.equal(loggedOn(entry, "2026-11-01"), true);
  assert.equal(loggedOn(entry, "2026-10-31"), false);
  assert.equal(loggedOn({}, "2026-11-01"), false);
});
