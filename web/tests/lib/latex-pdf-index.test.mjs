import test from "node:test";
import assert from "node:assert/strict";
import { latexCvPath, upsertPdfIndexRow } from "../../src/lib/latex-cv.mjs";
import { pdfIndexEntryForReport } from "../../src/lib/apply/cv-selection.mjs";

const HEAD = "# report\tpdf\thtml\tformat\tdate\tkind - written by generate-pdf.mjs, do not edit\n";

test("a LaTeX CV replaces the report's old CV row and keeps its cover and other reports", () => {
  const before = HEAD + "001\toutput/cv-old.pdf\toutput/cv-old.html\ta4\t2026-10-29\tcv\n001\toutput/cover.pdf\t\ta4\t2026-10-29\tcover\n002\toutput/cv-two.pdf\t\ta4\t2026-10-29\tcv\n";
  const after = upsertPdfIndexRow(before, "1", "output/acme/sde/resume_akshansh_modi.pdf", "2026-11-02");
  assert.deepEqual(pdfIndexEntryForReport(after, 1), { found: true, path: "output/acme/sde/resume_akshansh_modi.pdf" });
  assert.deepEqual(pdfIndexEntryForReport(after, 1, "cover"), { found: true, path: "output/cover.pdf" });
  assert.deepEqual(pdfIndexEntryForReport(after, 2), { found: true, path: "output/cv-two.pdf" });
  assert.equal(after.split("\n").filter((l) => l.startsWith("001\t") && l.endsWith("\tcv")).length, 1);
});

test("an empty index gets a header and one row", () => {
  const out = upsertPdfIndexRow("", "17", "output/paypal/x/resume_akshansh_modi.pdf", "2026-11-02");
  assert.ok(out.startsWith("# report\t"));
  assert.deepEqual(pdfIndexEntryForReport(out, 17), { found: true, path: "output/paypal/x/resume_akshansh_modi.pdf" });
});

test("latexCvPath: the index row decides when there is one", () => {
  const root = "/data";
  const has = (p) => p === "/data/output/acme/sde/resume_a.pdf";
  const report = "**PDF:** output/acme/sde/resume_a.pdf\n";
  assert.equal(latexCvPath({ root, indexedPath: "/data/output/acme/sde/resume_a.pdf", exists: has }), "output/acme/sde/resume_a.pdf");
  assert.equal(latexCvPath({ root, indexedPath: "output/acme/sde/resume_a.pdf", exists: has }), "output/acme/sde/resume_a.pdf");
  // An HTML CV in the index is the user's choice for this report, whatever the report line says.
  assert.equal(latexCvPath({ root, indexedPath: "/data/output/cv-a-001-acme.pdf", reportContent: report, exists: () => true }), null);
});

test("latexCvPath: with no index row, the report's **PDF:** line decides", () => {
  const root = "/data";
  const has = (p) => p === "/data/output/acme/sde/resume_a.pdf";
  assert.equal(latexCvPath({ root, reportContent: "# Evaluation\n**PDF:** output/acme/sde/resume_a.pdf\n", exists: has }), "output/acme/sde/resume_a.pdf");
  assert.equal(latexCvPath({ root, reportContent: "**PDF:** output/acme/sde/resume_a.pdf\n", exists: () => false }), null, "missing file");
  assert.equal(latexCvPath({ root, reportContent: "**PDF:** output/cv-a-001-acme.pdf\n", exists: () => true }), null, "HTML CV");
  assert.equal(latexCvPath({ root, reportContent: "**PDF:** output/../../etc/resume_x.pdf\n", exists: () => true }), null, "escapes output/");
  assert.equal(latexCvPath({ root, reportContent: "**PDF:** ❌\n", exists: () => true }), null);
  assert.equal(latexCvPath({ root, reportContent: null }), null);
});
