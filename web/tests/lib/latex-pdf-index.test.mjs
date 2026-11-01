import test from "node:test";
import assert from "node:assert/strict";
import { upsertPdfIndexRow } from "../../src/lib/latex-cv.mjs";
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
