// Run:  node --test tests/lib/feature-kinds-code-root.test.mjs
//
// latex-cv and email-draft run core scripts (generate-latex.mjs, mark-pdf-ready.mjs,
// save-draft.py). Those live in the code checkout, which is not the data root on a
// split-layout install (#4430). core-checkout-root.test.mjs only checks files that
// call rootScript(), so these two are pinned here by source.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src");
const read = (rel) => readFileSync(join(SRC, rel), "utf8");

test("latex-cv runs generate-latex and mark-pdf-ready from the code checkout", () => {
  const src = read("lib/latex-cv.mjs");
  assert.match(src, /path\.join\(coreRoot, "generate-latex\.mjs"\)[^\n]*cwd: coreRoot/);
  assert.match(src, /path\.join\(coreRoot, "mark-pdf-ready\.mjs"\)[^\n]*cwd: coreRoot/);
  assert.doesNotMatch(src, /\["(generate-latex|mark-pdf-ready)\.mjs"/);
});

test("email-draft runs save-draft.py from the code checkout", () => {
  const src = read("lib/email-draft.mjs");
  assert.match(src, /path\.join\(coreRoot, "save-draft\.py"\)/);
  assert.match(src, /cwd: coreRoot/);
  assert.match(read("app/api/email-draft/route.ts"), /saveGmailDraft\(\{ coreRoot: resolveCodeRoot\(process\.cwd\(\), process\.env\)/);
});

test("the run route passes the code root to latex-cv and triage", () => {
  const src = read("app/api/run/route.ts");
  assert.match(src, /persistLatexCv\(\{ root: careerOpsRoot\(\), coreRoot: codeRoot,/);
  assert.match(src, /buildTriagePrompt\(\{[^}]*codeRoot \}\)/);
});
