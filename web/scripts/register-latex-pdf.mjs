#!/usr/bin/env node
// Add a LaTeX CV to data/pdf-index.tsv so the web app sees it as the report's CV.
//   node web/scripts/register-latex-pdf.mjs <report#> <path/to/resume.pdf>
//   node web/scripts/register-latex-pdf.mjs --backfill   (every report whose **PDF:** line names an existing file)
// Run from the career-ops checkout (the data root defaults to it, as for every script).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerLatexPdf } from "../src/lib/latex-cv.mjs";

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { getCareerOpsRoot } = await import(path.join(coreRoot, "path-resolver.mjs"));
const root = getCareerOpsRoot();
const args = process.argv.slice(2);

if (args[0] === "--help" || args.length === 0) {
  console.log("usage: register-latex-pdf.mjs <report#> <pdf> | --backfill");
  process.exit(args.length ? 0 : 1);
}

const jobs = [];
if (args[0] === "--backfill") {
  for (const f of fs.readdirSync(path.join(root, "reports"))) {
    const m = f.match(/^(\d+)-.*\.md$/);
    if (!m) continue;
    const line = fs.readFileSync(path.join(root, "reports", f), "utf8").match(/^\*\*PDF:\*\*\s*(\S+\.pdf)\s*$/m);
    if (line && line[1].startsWith("output/") && fs.existsSync(path.join(root, line[1]))) jobs.push([m[1], path.join(root, line[1])]);
  }
} else {
  if (!/^\d+$/.test(args[0]) || !args[1]) { console.error("usage: register-latex-pdf.mjs <report#> <pdf>"); process.exit(1); }
  if (!fs.existsSync(args[1])) { console.error(`no such file: ${args[1]}`); process.exit(2); }
  jobs.push([args[0], args[1]]);
}

for (const [n, pdf] of jobs) console.log(`#${n}  ${await registerLatexPdf({ root, coreRoot, reportNum: n, pdf })}`);
if (!jobs.length) console.log("nothing to register");
