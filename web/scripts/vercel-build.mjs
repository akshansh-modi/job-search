// Vercel build only (web/vercel.json buildCommand). Hobby caps functions at 300s, and
// three routes declare longer limits for local runs. Online mode queues those routes
// to the Mac worker, so on Vercel they never need more than 300s. The committed code
// and local builds keep their real limits.
import fs from "node:fs";

for (const f of ["src/app/api/run/route.ts", "src/app/api/explore/ai/route.ts", "src/app/api/apply/prefill/route.ts"]) {
  const src = fs.readFileSync(f, "utf8");
  const out = src.replace(/export const maxDuration = \d+/, "export const maxDuration = 300");
  if (out === src) throw new Error(`${f}: no maxDuration to cap — update scripts/vercel-build.mjs`);
  fs.writeFileSync(f, out);
}
