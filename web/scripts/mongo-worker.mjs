#!/usr/bin/env node
/**
 * mongo-worker.mjs — the Mac side of the online setup. One pass per run; launchd
 * runs it every 5 minutes (install-mongo-worker.sh). launchd never starts a job
 * while the previous run is still going, so passes do not overlap.
 *
 * 1. Make sure the local web app answers (reuse one on :3000, else start our own).
 * 2. Claim queued `commands` (written by the online app) one at a time and replay
 *    each against the local app's own /api route, so every prompt, tool fence and
 *    persistence rule is the one the local UI uses. Store the result on the doc.
 * 3. Copy changed user files into `files` and bump `meta.snapshot`, so the online
 *    app can show them. Files stay the source of truth; Mongo is a mirror + queue.
 *
 * Needs MONGODB_URI in web/.env.local. Never prints it.
 *   node web/scripts/mongo-worker.mjs            # one pass
 *   node web/scripts/mongo-worker.mjs --sync-only
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Binary, MongoClient } from "mongodb";
import { isMainModule } from "../../lib/is-main-module.mjs";
import { listTree } from "../../lib/walk-tree.mjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.env.CAREER_OPS_ROOT ? path.resolve(process.env.CAREER_OPS_ROOT) : path.dirname(WEB);
const OWN_PORT = 3917;
const STALE_MS = 30 * 60_000; // a claim older than this belongs to a crashed run
const MAX_FILE = 8 * 1024 * 1024; // Mongo's doc limit is 16 MB
const MAX_PER_PASS = 10;

// User files mirrored online. Never .env, never web/.env.local.
export const SYNC_DIRS = ["data", "reports", "jds", "output", "interview-prep"];
export const SYNC_FILES = ["cv.md", "article-digest.md", "config/profile.yml", "portals.yml", "modes/_profile.md", "modes/_custom.md", "modes/_brief.md"];
const SKIP = /(^|\/)(\.env[^/]*|\.DS_Store|.*\.(aux|log|out|lock|tmp|bak))$/;
const TEXT = /\.(md|ya?ml|tsv|csv|json|txt|tex|log|html)$/i;

/** Only API mutations, only inside /api/, no traversal. The online app is the only writer. */
export function isReplayable(cmd) {
  return Boolean(
    cmd && typeof cmd.path === "string" && /^\/api\/[A-Za-z0-9/_.\-?=&%]*$/.test(cmd.path) && !cmd.path.includes("..") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(cmd.method)
  );
}

function listFiles() {
  const out = [];
  for (const dir of SYNC_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of listTree(abs)) {
      const r = path.relative(ROOT, file).split(path.sep).join("/");
      if (!SKIP.test(r)) out.push(r);
    }
  }
  for (const f of SYNC_FILES) if (fs.existsSync(path.join(ROOT, f))) out.push(f);
  return out;
}

async function sync(db) {
  const files = db.collection("files");
  const known = new Map((await files.find({}, { projection: { sha256: 1 } }).toArray()).map((d) => [d._id, d.sha256]));
  let changed = 0;
  const seen = new Set();
  for (const rel of listFiles()) {
    const abs = path.join(ROOT, rel);
    const stat = fs.statSync(abs);
    if (stat.size > MAX_FILE) continue;
    seen.add(rel);
    const buf = fs.readFileSync(abs);
    const sha256 = createHash("sha256").update(buf).digest("hex");
    if (known.get(rel) === sha256) continue;
    const content = TEXT.test(rel) ? buf.toString("utf8") : new Binary(buf);
    await files.replaceOne({ _id: rel }, { _id: rel, sha256, content, size: stat.size, mtime: stat.mtime }, { upsert: true });
    changed++;
  }
  const gone = [...known.keys()].filter((p) => !seen.has(p));
  if (gone.length) await files.deleteMany({ _id: { $in: gone } });
  if (changed || gone.length) {
    await db.collection("meta").updateOne({ _id: "snapshot" }, { $inc: { version: 1 }, $set: { syncedAt: new Date(), host: os.hostname() } }, { upsert: true });
  }
  return { changed, removed: gone.length };
}

async function up(base) {
  try {
    return (await fetch(`${base}/api/version`, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}

/** Reuse a running app on :3000, else start one on OWN_PORT for this pass. */
async function ensureServer() {
  if (await up("http://127.0.0.1:3000")) return { base: "http://127.0.0.1:3000", stop: () => {} };
  const base = `http://127.0.0.1:${OWN_PORT}`;
  if (await up(base)) return { base, stop: () => {} };
  if (!fs.existsSync(path.join(WEB, ".next"))) throw new Error("web app is not built — run `npm run build` in web/");
  const child = spawn(process.execPath, ["server.mjs", "start", "-p", String(OWN_PORT)], { cwd: WEB, stdio: "ignore", windowsHide: true });
  for (let i = 0; i < 60; i++) {
    if (await up(base)) return { base, stop: () => child.kill("SIGTERM") };
    await new Promise((r) => setTimeout(r, 1000));
  }
  child.kill("SIGTERM");
  throw new Error("local web app did not start");
}

/** Replay one command; collapse an NDJSON run stream into status + events. */
export async function replay(base, cmd) {
  const res = await fetch(`${base}${cmd.path}`, {
    method: cmd.method,
    headers: { "Content-Type": "application/json" },
    body: cmd.body === undefined ? undefined : JSON.stringify(cmd.body),
  });
  const text = await res.text();
  // Some routes answer errors as JSON without a JSON content type: keep the body.
  if (!res.ok) {
    let json = null;
    try { json = JSON.parse(text); } catch { /* plain text */ }
    return { status: "error", httpStatus: res.status, result: json ?? { error: text.slice(0, 2000) } };
  }
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    let json = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return { status: res.ok ? "done" : "error", httpStatus: res.status, result: json ?? text.slice(0, 20_000) };
  }
  const events = text.split("\n").filter(Boolean).flatMap((l) => {
    try { const e = JSON.parse(l); return e.type === "keepalive" ? [] : [e]; } catch { return [{ type: "text", text: l }]; }
  });
  const last = [...events].reverse().find((e) => e.type === "done" || e.type === "error");
  const ok = res.ok && last?.type === "done";
  return {
    status: ok ? "done" : "error",
    httpStatus: res.status,
    result: {
      output: events.filter((e) => e.type === "text").map((e) => e.text).join("").slice(-20_000),
      final: last ?? null,
      steps: events.filter((e) => e.type === "status" || e.type === "tool").slice(-100),
    },
  };
}

async function drain(db, base) {
  const commands = db.collection("commands");
  let n = 0;
  while (n < MAX_PER_PASS) {
    const now = new Date();
    const cmd = await commands.findOneAndUpdate(
      { $or: [{ status: "queued" }, { status: "running", claimedAt: { $lt: new Date(now.getTime() - STALE_MS) } }] },
      { $set: { status: "running", claimedAt: now, worker: os.hostname() }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    );
    if (!cmd) break;
    n++;
    let outcome;
    if (!isReplayable(cmd)) outcome = { status: "error", result: { error: "refused: not an /api mutation" } };
    else if ((cmd.attempts ?? 1) > 3) outcome = { status: "error", result: { error: "gave up after 3 attempts" } };
    else {
      try {
        outcome = await replay(base, cmd);
      } catch (e) {
        outcome = { status: "error", result: { error: e instanceof Error ? e.message : String(e) } };
      }
    }
    await commands.updateOne({ _id: cmd._id }, { $set: { ...outcome, finishedAt: new Date() } });
    console.log(`${new Date().toISOString()} ${cmd.method} ${cmd.path} → ${outcome.status}`);
  }
  return n;
}

async function main() {
  try { process.loadEnvFile(path.join(WEB, ".env.local")); } catch { /* env may come from the shell */ }
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set in web/.env.local");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
  await client.connect();
  try {
    const db = client.db();
    await db.collection("meta").updateOne({ _id: "worker" }, { $set: { lastSeenAt: new Date(), host: os.hostname() } }, { upsert: true });
    if (!process.argv.includes("--sync-only") && (await db.collection("commands").countDocuments({ status: { $in: ["queued", "running"] } }))) {
      const server = await ensureServer();
      try {
        const ran = await drain(db, server.base);
        if (ran) console.log(`${new Date().toISOString()} ran ${ran} command(s)`);
      } finally {
        server.stop();
      }
    }
    const s = await sync(db);
    if (s.changed || s.removed) console.log(`${new Date().toISOString()} synced: ${s.changed} changed, ${s.removed} removed`);
  } finally {
    await client.close();
  }
}

const USAGE = `Usage: node web/scripts/mongo-worker.mjs [--sync-only]

One pass of the online worker: replay queued commands against the local web
app, then mirror changed user files to MongoDB. Needs MONGODB_URI in
web/.env.local.

  --sync-only   Mirror files only; do not run queued commands.
  --help, -h    Show this help and exit without connecting.`;

/** Unknown flags are refused, so a typo never runs a pass that was not asked for. */
export function parseWorkerArgs(argv) {
  const help = argv.includes("--help") || argv.includes("-h");
  const unknown = argv.filter((a) => !["--sync-only", "--help", "-h"].includes(a));
  return { help, syncOnly: argv.includes("--sync-only"), unknown };
}

if (isMainModule(import.meta.url)) {
  // Before the env file or any connection: --help must not run a pass.
  const args = parseWorkerArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (args.unknown.length) {
    console.error(`Unknown option: ${args.unknown[0]}\n\n${USAGE}`);
    process.exit(1);
  }
  main().catch((e) => {
    // A driver error can echo the URI; never let it reach the log.
    console.error(`${new Date().toISOString()} worker failed: ${String(e?.message ?? e).replace(/mongodb(\+srv)?:\/\/[^\s]*/g, "mongodb://***")}`);
    process.exit(1);
  });
}
