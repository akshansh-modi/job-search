import { careerOpsRoot } from "@/lib/career-ops";
import { readTriage } from "@/lib/triage-batch.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** AI triage results (data/triage.json), keyed by posting URL. */
export async function GET() {
  try {
    return Response.json(readTriage(careerOpsRoot()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: `data/triage.json could not be read: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }
}
