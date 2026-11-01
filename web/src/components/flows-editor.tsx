"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, TriangleAlert } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";

type Choice = { cli: string; model?: string; effort?: string };
type Task = { kind: string; name: string; does: string; default: Choice; lockCli?: string; lockReason?: string; warn?: string };
type Data = { flows: { id: string; name: string; tasks: Task[] }[]; choices: Record<string, Choice>; clis: { id: string; name: string }[]; models: Record<string, string[]>; efforts: string[] };

const field =
  "rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-brand/50 focus:outline-none disabled:opacity-60 max-sm:min-h-[44px]";

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function FlowsEditor() {
  const { jobs } = useJobs();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/flows")
      .then(async (r) => ((await r.json()) as Data & { error?: string }))
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Could not reach the server."));
  }, []);

  // Per kind: runs, failures and median cost, from this browser's recent jobs.
  const stats = useMemo(() => {
    const out: Record<string, { runs: number; failed: number; usd: number | null }> = {};
    for (const j of jobs) {
      if (j.status === "running" || !j.kind) continue;
      const s = (out[j.kind] ??= { runs: 0, failed: 0, usd: null });
      s.runs += 1;
      if (j.status === "error") s.failed += 1;
    }
    for (const kind of Object.keys(out)) {
      out[kind].usd = median(jobs.filter((j) => j.kind === kind && j.status === "done" && typeof j.cost?.usd === "number").map((j) => j.cost!.usd as number));
    }
    return out;
  }, [jobs]);

  if (error) return <p role="alert" className="mt-6 text-sm text-red-700 dark:text-red-400">{error}</p>;
  if (!data) return <p className="mt-6 text-sm text-muted">Loading…</p>;

  const update = async (kind: string, patch: Partial<Choice>) => {
    const next = { ...data.choices, [kind]: { ...data.choices[kind], ...patch } };
    setData({ ...data, choices: next });
    setSaved(null);
    try {
      const r = await fetch("/api/flows", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks: next }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Save failed");
      setData((cur) => (cur ? { ...cur, choices: d.choices } : cur));
      setSaved(kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <div className="mt-6 space-y-8">
      {data.flows.map((flow) => (
        <section key={flow.id} aria-labelledby={`flow-${flow.id}`}>
          <h2 id={`flow-${flow.id}`} className="text-sm font-semibold uppercase tracking-wide text-muted">{flow.name}</h2>
          <div className="mt-3 space-y-3">
            {flow.tasks.map((t) => {
              const c = data.choices[t.kind] ?? t.default;
              const models = data.models[c.cli === "default" ? "claude" : c.cli];
              const s = stats[t.kind];
              const offClaude = c.cli !== "default" && c.cli !== "claude";
              return (
                <div key={t.kind} className="rounded-2xl border border-border bg-surface/50 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted">
                      {s ? `${s.runs} run${s.runs === 1 ? "" : "s"} · ${s.failed} failed${s.usd != null ? ` · ~$${s.usd.toFixed(2)} each` : ""}` : "no runs yet"}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted">{t.does}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="text-xs text-muted">
                      <span className="sr-only">AI tool for {t.name}</span>
                      <select className={field} value={c.cli} disabled={!!t.lockCli} onChange={(e) => update(t.kind, { cli: e.target.value, model: undefined })}>
                        {!t.lockCli && <option value="default">App default</option>}
                        {data.clis.map((cli) => <option key={cli.id} value={cli.id}>{cli.name}</option>)}
                        {t.lockCli && !data.clis.some((x) => x.id === t.lockCli) && <option value={t.lockCli}>{t.lockCli}</option>}
                      </select>
                    </label>
                    {models && (
                      <>
                        <label className="text-xs text-muted">
                          <span className="sr-only">Model for {t.name}</span>
                          <select className={field} value={c.model ?? ""} onChange={(e) => update(t.kind, { model: e.target.value || undefined })}>
                            {!c.model && <option value="">CLI&apos;s default model</option>}
                            {models.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-muted">
                          <span className="sr-only">Effort for {t.name}</span>
                          <select className={field} value={c.effort ?? ""} onChange={(e) => update(t.kind, { effort: e.target.value || undefined })}>
                            {!c.effort && <option value="">default effort</option>}
                            {data.efforts.map((x) => <option key={x} value={x}>{x}</option>)}
                          </select>
                        </label>
                      </>
                    )}
                    {!models && <span className="text-xs text-muted">This CLI uses its own model settings.</span>}
                    <button type="button" className="text-xs text-muted hover:text-brand-text max-sm:min-h-[44px]" onClick={() => update(t.kind, t.default)}>
                      Reset
                    </button>
                    {saved === t.kind && <span className="text-xs text-emerald-700 dark:text-emerald-400">Saved</span>}
                  </div>
                  {t.lockCli && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted"><Lock className="size-3" /> {t.lockReason}</p>
                  )}
                  {offClaude && t.warn && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><TriangleAlert className="size-3" /> {t.warn}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
