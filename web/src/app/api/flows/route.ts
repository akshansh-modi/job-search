import { careerOpsRoot } from "@/lib/career-ops";
import { detectClis } from "@/lib/clis";
import { choiceFor, EFFORTS, FLOWS, MODEL_CLIS, writeFlowSettings } from "@/lib/flows.mjs";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Flows, each task's current choice, and what the pickers may offer. */
export async function GET() {
  try {
    const root = careerOpsRoot();
    const choices = Object.fromEntries(FLOWS.flatMap((f) => f.tasks.map((t) => [t.kind, choiceFor(root, t.kind)])));
    const clis = detectClis().filter((c) => c.installed).map((c) => ({ id: c.id, name: c.name }));
    return Response.json({ flows: FLOWS, choices, clis, models: MODEL_CLIS, efforts: EFFORTS });
  } catch (e) {
    return Response.json({ error: `config/flows.yml could not be read: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }
}

/** Save every task's choice: {tasks: {kind: {cli, model, effort}}}. */
export async function PUT(req: Request) {
  const body = await readJsonObject<{ tasks?: Record<string, unknown> }>(req);
  if (!body?.tasks || typeof body.tasks !== "object") return Response.json({ error: "tasks required" }, { status: 400 });
  return Response.json({ ok: true, choices: writeFlowSettings(careerOpsRoot(), body.tasks) });
}
