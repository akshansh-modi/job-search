// Run: node --test tests/lib/triage-view.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { inTriageView, triageViewFrom, triageViewQuery } from "../../src/lib/triage-view.mjs";

test("only the three verdict views are read from the URL", () => {
  assert.equal(triageViewFrom("PASS"), "PASS");
  assert.equal(triageViewFrom("pass"), "PASS");
  assert.equal(triageViewFrom("MARGINAL"), "MARGINAL");
  assert.equal(triageViewFrom("FAIL"), "FAIL");
  assert.equal(triageViewFrom("SKIP"), null);
  assert.equal(triageViewFrom(""), null);
  assert.equal(triageViewFrom(null), null);
});

test("a view keeps only rows with that verdict; no view keeps all", () => {
  assert.equal(inTriageView("PASS", "PASS"), true);
  assert.equal(inTriageView("FAIL", "PASS"), false);
  assert.equal(inTriageView(undefined, "PASS"), false, "an untriaged row is not a PASS");
  assert.equal(inTriageView(undefined, null), true);
});

test("setting or clearing the view keeps the other params", () => {
  assert.equal(triageViewQuery("tab=ALL&q=java", "PASS"), "tab=ALL&q=java&triage=PASS");
  assert.equal(triageViewQuery("triage=PASS&q=java", null), "q=java");
  assert.equal(triageViewQuery("", null), "");
});
