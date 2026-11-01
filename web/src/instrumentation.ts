// Online setup only: build the /tmp copy of the user's files from MongoDB before
// the first request, so every page reads a populated CAREER_OPS_ROOT. Local mode
// returns immediately and never loads the MongoDB driver.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.CAREER_OPS_MODE !== "online") return;
  const { ensureSnapshot } = await import("@/lib/online.mjs");
  await ensureSnapshot();
}
