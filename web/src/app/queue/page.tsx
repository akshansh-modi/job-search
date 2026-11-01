import Link from "next/link";
import { listCommands, isOnline } from "@/lib/online.mjs";

export const dynamic = "force-dynamic";

type Cmd = Awaited<ReturnType<typeof listCommands>>["commands"][number];

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

const badge: Record<string, string> = {
  queued: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400",
  running: "border-brand/40 bg-brand-soft text-brand-text",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400",
  error: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
};

function label(c: Cmd) {
  if (c.path === "/api/run") return `${c.kind ?? "run"}${c.input ? ` · #${c.input}` : ""}`;
  return `${c.method} ${c.path}`;
}

function resultText(c: Cmd) {
  const r = c.result as { output?: string; final?: { msg?: string }; error?: string } | null;
  if (!r) return "";
  if (r.final?.msg) return r.final.msg;
  if (r.error) return r.error;
  if (r.output) return r.output.trim().slice(-1500);
  return JSON.stringify(r).slice(0, 600);
}

export default async function QueuePage() {
  if (!process.env.MONGODB_URI) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl tracking-tight text-landing">Queue</h1>
        <p className="mt-2 text-sm text-muted">
          The queue belongs to the online setup: actions taken on the hosted app wait here until the worker on your Mac runs them.
          Set <span className="font-mono">MONGODB_URI</span> in <span className="font-mono">web/.env.local</span> and install the worker with{" "}
          <span className="font-mono">sh web/scripts/install-mongo-worker.sh</span>.
        </p>
      </div>
    );
  }
  let data: Awaited<ReturnType<typeof listCommands>>;
  try {
    data = await listCommands(50);
  } catch {
    return <p className="mx-auto max-w-2xl px-6 py-10 text-sm text-red-700 dark:text-red-400">Could not reach MongoDB.</p>;
  }
  const lastSeen = data.workerLastSeen ? Date.now() - Date.parse(data.workerLastSeen) : null;
  const workerOk = lastSeen !== null && lastSeen < 11 * 60_000;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl tracking-tight text-landing">Queue</h1>
      <p className="mt-2 text-sm text-muted">
        {isOnline() ? "Actions you take here run on your Mac within 5 minutes." : "Commands queued from the online app."}{" "}
        <span className={workerOk ? "text-emerald-800 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
          Mac worker last seen: {when(data.workerLastSeen)}
          {!workerOk && " — is your Mac awake and the worker installed?"}
        </span>
      </p>
      {data.commands.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nothing queued yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {data.commands.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-surface/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge[c.status] ?? ""}`}>{c.status}</span>
                <span className="text-sm font-medium text-foreground">{label(c)}</span>
                {c.input && /^\d+$/.test(String(c.input)) && (
                  <Link href={`/pipeline/${c.input}`} className="text-xs text-brand-text hover:underline">open #{c.input}</Link>
                )}
                <span className="ml-auto text-xs text-faint">
                  {when(c.createdAt)}
                  {c.finishedAt && ` → ${when(c.finishedAt)}`}
                </span>
              </div>
              {resultText(c) && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs text-muted">{resultText(c)}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
