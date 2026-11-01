import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRequest,
  parseAllowedHosts,
  parseAllowedOrigins,
} from "@/lib/origin-guard.mjs";
import { isOnline, queueCommand } from "@/lib/online.mjs";

// Single choke point over everything the dashboard serves. Every request is
// gated on the same-origin + loopback guard before it can reach a route handler
// (which may spawn a child process or write the user's files) or a page (which
// renders the user's CV, pipeline and reports). See origin-guard.mjs for the
// two-layer rationale (F1 drive-by CSRF, F2 LAN reachability).
//
// Opt in to extra hosts (e.g. a trusted LAN box) with a comma/space separated
// CAREER_OPS_WEB_ALLOWED_HOSTS; unset means loopback only.
//
// Opt in to extra *origins* the same way with CAREER_OPS_ALLOWED_ORIGINS;
// unset means none, which is the default and leaves the guard as strict as it
// was. It is what a local companion client needs: a browser extension calls
// from a chrome-extension:// origin, which Fetch Metadata always reports as
// "cross-site", so every one of its requests is refused otherwise.
export async function proxy(req: NextRequest) {
  const decision = checkRequest({
    secFetchSite: req.headers.get("sec-fetch-site"),
    origin: req.headers.get("origin"),
    host: req.headers.get("host"),
    allowedHosts: parseAllowedHosts(process.env.CAREER_OPS_WEB_ALLOWED_HOSTS),
    allowedOrigins: parseAllowedOrigins(process.env.CAREER_OPS_ALLOWED_ORIGINS),
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.reason }, { status: decision.status });
  }
  if (isOnline()) return online(req);
  return NextResponse.next();
}

// Online setup (CAREER_OPS_MODE=online, see online.mjs): nothing runs here. Every
// /api mutation is queued in MongoDB for the worker on the user's Mac.
const ONLINE_NOOP = new Set(["/api/runs/save"]); // run logs are written by the Mac's own run
async function online(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  // The Mac runs Claude Code, so tell the UI that is the CLI to use.
  if (pathname === "/api/clis" && req.method === "GET") {
    return NextResponse.json({ clis: [{ id: "claude", name: "Claude Code", installed: true }], remembered: "claude" });
  }
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return NextResponse.next();
  if (ONLINE_NOOP.has(pathname)) return new NextResponse(null, { status: 204 });
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: "Uploads work on your Mac only (npm run ui)." }, { status: 501 });
  }
  const body = await req.json().catch(() => undefined);
  try {
    const id = await queueCommand({ method: req.method, path: pathname + search, body });
    if (pathname === "/api/run") {
      const lines = [
        { type: "text", text: `Queued for your Mac (#${id.slice(-6)}). It runs within 5 minutes; follow it on the Queue page.\n` },
        { type: "done" },
      ];
      return new NextResponse(lines.map((l) => JSON.stringify(l)).join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return NextResponse.json({ ok: true, queued: true, id }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Could not reach the queue database." }, { status: 503 });
  }
}

// Everything except build assets. Scoping this to /api left every page route
// ungated, which loopback does not cover: a page that re-resolves its own domain
// to 127.0.0.1 (DNS rebinding) fetches /pipeline same-origin from the user's own
// browser, and force-dynamic pages read the tracker off disk on each request.
// The Host header carries the attacker's domain there, so the guard refuses it —
// but only if it runs. Build assets stay out: they are the same for every user,
// carry nothing of theirs, and a caller who cannot read a page has no use for
// the chunk that renders it.
export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
