// Fork test: both report layouts this install holds must keep being read.
//   - older reports: `## Machine Summary` right after the header, before the JD archive
//   - newer reports (modes/oferta.md since the summary-last change): summary is the last section
// Every reader goes through machine-summary-section.mjs, so one fixture pair covers them.
// Run: node --test tests/lib/machine-summary-layouts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readMachineSummary } from "../../src/lib/machine-summary.mjs";
import { parseReportMeta } from "../../src/lib/report-persist.mjs";
import { latexCvPath } from "../../src/lib/latex-cv.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const core = (f) => import(pathToFileURL(path.join(ROOT, f)).href);

const HEADER = `# Evaluation: Northwind — Backend Engineer

**Date:** 2026-10-01
**Score:** 4.2/5
**URL:** https://jobs.example.com/1
**PDF:** output/northwind/backend-engineer/resume_candidate.pdf
`;
const SUMMARY = `## Machine Summary

\`\`\`yaml
company: Northwind
role: Backend Engineer
score: 4.2
final_decision: Apply
top_strengths: ["Java services"]
\`\`\`
`;
const BODY = `## A) Role Summary

Backend role in Bengaluru, India.

## Keywords extracted

- Java
- Kubernetes
`;
// The JD can carry its own heading; neither layout may read it.
const JD = `## Job Description (archived verbatim)

About the role.

## Machine Summary

\`\`\`yaml
company: Injected
role: Wrong
score: 1.0
final_decision: Skip
\`\`\`
`;

const OLD = `${HEADER}\n${SUMMARY}\n${BODY}\n${JD}`;
const NEW = `${HEADER}\n${BODY}\n${JD}\n${SUMMARY}`;

for (const [name, report] of [["summary near the top (older reports)", OLD], ["summary last (new reports)", NEW]]) {
  test(`web readers: ${name}`, () => {
    assert.equal(readMachineSummary(report)?.decision, "Apply");
    assert.deepEqual(parseReportMeta(report), { ok: true, company: "Northwind", role: "Backend Engineer", score: "4.2/5", via: null });
  });

  test(`core readers: ${name}`, async () => {
    const { parseMachineSummary } = await core("analyze-patterns.mjs");
    assert.equal(parseMachineSummary(report)?.company, "Northwind");
    const { extractKeywords } = await core("keyword-match.mjs");
    const keywords = extractKeywords(report);
    assert.ok(keywords.includes("Java") && keywords.includes("Kubernetes"), `keywords: ${JSON.stringify(keywords)}`);
  });

  test(`**PDF:** line still names the LaTeX CV: ${name}`, () => {
    assert.equal(
      latexCvPath({ root: "/data", reportContent: report, exists: () => true }),
      "output/northwind/backend-engineer/resume_candidate.pdf",
    );
  });
}
