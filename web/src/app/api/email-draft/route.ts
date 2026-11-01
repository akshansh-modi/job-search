import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, findReportFile } from "@/lib/career-ops";
import { resolveCodeRoot } from "@/lib/core/code-root.mjs";
import { findAttachment, resolveEmailPaths, saveGmailDraft } from "@/lib/email-draft.mjs";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pathsFor(n: string | null) {
  if (!n) return null;
  const report = findReportFile(n);
  if (!report) return null;
  const r = resolveEmailPaths(careerOpsRoot(), report);
  return r.ok ? r.paths : null;
}

/** The drafted email for application #n, for review before saving. */
export async function GET(req: Request) {
  const paths = pathsFor(new URL(req.url).searchParams.get("n"));
  if (!paths || !fs.existsSync(paths.txt) || !fs.existsSync(paths.meta)) return Response.json({ draft: null });
  const meta = JSON.parse(fs.readFileSync(paths.meta, "utf8"));
  const attach = findAttachment(paths.dir);
  return Response.json({
    draft: { to: meta.to, subject: meta.subject, body: fs.readFileSync(paths.txt, "utf8"), attachment: attach ? path.basename(attach) : null },
  });
}

/** Save the reviewed email into Gmail Drafts with the CV attached. Never sends. */
export async function POST(req: Request) {
  const body = await readJsonObject<{ n?: string }>(req);
  const paths = pathsFor(body?.n ?? null);
  if (!paths) return Response.json({ error: "No report for that application." }, { status: 400 });
  const r = await saveGmailDraft({ coreRoot: resolveCodeRoot(process.cwd(), process.env), paths });
  return Response.json(r, { status: r.ok ? 200 : 500 });
}
