/**
 * online.mjs — the hosted (Vercel) side of the online setup.
 *
 * CAREER_OPS_MODE=online turns it on. The app then:
 * - READS a copy of the user's files rebuilt from MongoDB's `files` collection into
 *   /tmp (ensureSnapshot), and points CAREER_OPS_ROOT at it, so every existing page
 *   renders unchanged from "files".
 * - QUEUES every /api mutation as a `commands` doc (proxy.ts → queueCommand); the
 *   worker on the user's Mac (web/scripts/mongo-worker.mjs) runs it locally.
 *
 * Claude never runs here. Local mode (the default) never imports the driver.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const isOnline = () => process.env.CAREER_OPS_MODE === "online";

/** @type {Promise<import("mongodb").Db> | null} */
let dbPromise = null;
export function getDb() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  dbPromise ??= import("mongodb").then(async ({ MongoClient }) => {
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
    await client.connect();
    return client.db();
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

const CHECK_EVERY_MS = 20_000;
let current = { version: -1, checkedAt: 0, dir: "" };
let previousDir = "";
/** @type {Promise<void> | null} */
let inFlight = null;

/** Rebuild the /tmp copy when the worker pushed a newer snapshot. Throttled; safe to call per request. */
export function ensureSnapshot() {
  if (!isOnline()) return Promise.resolve();
  if (Date.now() - current.checkedAt < CHECK_EVERY_MS && current.dir) return Promise.resolve();
  inFlight ??= (async () => {
    try {
      const db = await getDb();
      const meta = await db.collection("meta").findOne({ _id: /** @type {any} */ ("snapshot") });
      const version = meta?.version ?? 0;
      current.checkedAt = Date.now();
      if (version === current.version && current.dir && fs.existsSync(current.dir)) return;
      const dir = path.join(os.tmpdir(), `career-ops-${version}-${process.pid}`);
      fs.rmSync(dir, { recursive: true, force: true });
      for await (const doc of db.collection("files").find({})) {
        const rel = String(doc._id);
        // Paths come from our own worker, but never let one escape the snapshot dir.
        const abs = path.resolve(dir, rel);
        if (!abs.startsWith(dir + path.sep)) continue;
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        const c = doc.content;
        fs.writeFileSync(abs, typeof c === "string" ? c : Buffer.from(c?.buffer ?? c?.value?.() ?? []));
      }
      linkCode(dir);
      // A page may still be reading the previous copy (layout and page render in
      // parallel), so keep it and delete only the one before.
      if (previousDir && previousDir !== dir) fs.rmSync(previousDir, { recursive: true, force: true });
      previousDir = current.dir;
      current = { version, checkedAt: Date.now(), dir };
      process.env.CAREER_OPS_ROOT = dir;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Some helpers import career-ops scripts from the data root (tracker-utils.mjs,
 * tracker-parse.mjs, …). The snapshot holds data only, so copy the scripts in and
 * point node_modules at installed packages so their imports (js-yaml) resolve.
 * On Vercel these files ship via outputFileTracingIncludes in next.config.mjs.
 * @param {string} dir
 */
function linkCode(dir) {
  const web = process.cwd();
  const codeRoot = path.resolve(web, "..");
  if (!fs.existsSync(codeRoot)) return;
  for (const name of fs.readdirSync(codeRoot)) {
    if (!/\.(mjs|json)$/.test(name) && !["lib", "providers", "templates"].includes(name)) continue;
    const dst = path.join(dir, name);
    if (!fs.existsSync(dst)) fs.cpSync(path.join(codeRoot, name), dst, { recursive: true });
  }
  const nm = [path.join(codeRoot, "node_modules"), path.join(web, "node_modules")].find((p) => fs.existsSync(p));
  if (nm && !fs.existsSync(path.join(dir, "node_modules"))) fs.symlinkSync(nm, path.join(dir, "node_modules"), "dir");
}

/** Queue a mutation for the Mac worker. */
export async function queueCommand({ method, path: p, body }) {
  const db = await getDb();
  const r = await db.collection("commands").insertOne({ method, path: p, body, status: "queued", createdAt: new Date() });
  return String(r.insertedId);
}

/** Latest commands for the Queue page. */
export async function listCommands(limit = 50) {
  const db = await getDb();
  const docs = await db.collection("commands").find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  const worker = await db.collection("meta").findOne({ _id: /** @type {any} */ ("worker") });
  return {
    workerLastSeen: worker?.lastSeenAt ? new Date(worker.lastSeenAt).toISOString() : null,
    commands: docs.map((d) => ({
      id: String(d._id),
      method: d.method,
      path: d.path,
      kind: d.body?.kind ?? null,
      input: d.body?.input ?? null,
      status: d.status,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      finishedAt: d.finishedAt ? new Date(d.finishedAt).toISOString() : null,
      result: d.result ?? null,
    })),
  };
}
