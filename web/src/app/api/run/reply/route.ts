import { endRun, replyToRun } from "@/lib/interactive-runs.mjs";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Answer an interactive run's question ({runId, text}), or end it ({runId, stop: true}). */
export async function POST(req: Request) {
  const body = await readJsonObject<{ runId?: string; text?: string; stop?: boolean }>(req);
  const runId = typeof body?.runId === "string" ? body.runId : "";
  if (!runId) return Response.json({ error: "runId required" }, { status: 400 });
  if (body?.stop) {
    endRun(runId);
    return Response.json({ ok: true });
  }
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!text) return Response.json({ error: "text required" }, { status: 400 });
  const r = replyToRun(runId, text);
  if (r === "unknown") return Response.json({ error: "That run has finished." }, { status: 404 });
  if (r === "not-waiting") return Response.json({ error: "The run is not waiting for an answer right now." }, { status: 409 });
  return Response.json({ ok: true });
}
