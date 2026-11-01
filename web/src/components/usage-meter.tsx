"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { cn } from "@/lib/cn";

// The bars are the account's REAL plan usage, captured from Claude Code's
// status line (lib/claude-rate-limits.mjs). When that capture is not set up the
// meter says so; it never computes a percentage from token counts, because plan
// limits are not raw tokens. Token totals are shown underneath as activity only.

type PlanWindow = {
  key: string;
  label: string;
  usedPercent: number;
  resetsAt: string;
  stale: boolean;
  staleReason: "reset" | "old" | null;
};
type Plan =
  | { state: "ok"; capturedAt: string; windows: PlanWindow[]; file: string }
  | { state: "not-set-up"; setup: string; file: string }
  | { state: "error"; message: string; file?: string };
type Usage = {
  plan?: Plan;
  tokens?: { window5h: { tokens: number }; window7d: { tokens: number } };
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}
function tone(pct: number): string {
  if (pct >= 85) return "bg-red-400";
  if (pct >= 60) return "bg-amber-400";
  return "bg-emerald-400";
}
function when(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? time : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}

function PlanRows({ plan }: { plan: Plan | undefined }) {
  if (!plan) return null;
  if (plan.state === "not-set-up") {
    return (
      <p className="text-[10px] leading-snug text-faint" title={plan.setup}>
        Plan usage not set up. <span className="select-all break-all font-mono text-[9px]">{plan.setup}</span>
      </p>
    );
  }
  if (plan.state === "error") {
    return <p className="text-[10px] leading-snug text-red-400">Plan usage unavailable: {plan.message}</p>;
  }
  return (
    <>
      {plan.windows.map((w) => {
        const pct = Math.min(100, Math.max(0, Math.round(w.usedPercent)));
        const note = w.stale
          ? w.staleReason === "reset"
            ? `reset ${when(w.resetsAt)} · stale`
            : `stale · resets ${when(w.resetsAt)}`
          : `resets ${when(w.resetsAt)}`;
        return (
          <div
            key={w.key}
            title={`${w.label} plan limit: ${w.usedPercent}% used as of ${new Date(plan.capturedAt).toLocaleString()}${
              w.stale ? " (stale — updates on the next Claude Code reply)" : ""
            }`}
          >
            <div className="flex items-center justify-between text-[10px] text-faint">
              <span>{w.label}</span>
              <span className="tabular-nums">{w.stale ? "—" : `${pct}%`}</span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface-hover">
              <div
                className={cn("h-full rounded-full transition-all", w.stale ? "bg-faint/40" : tone(pct))}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <div className="mt-0.5 text-[9px] text-faint">{note}</div>
          </div>
        );
      })}
    </>
  );
}

export function UsageMeter() {
  const [data, setData] = useState<Usage | null>(null);
  const [cli, setCli] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cfg = localStorage.getItem("career-ops:config");
      setCli(cfg ? JSON.parse(cfg).cliId || null : null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/usage")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Both sources are Claude Code's; only meaningful when Claude is the CLI.
  if (cli && cli !== "claude") return null;
  if (!data) return null;

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
        <Gauge className="size-3" /> Plan usage
      </div>
      <div className="space-y-2 px-1">
        <PlanRows plan={data.plan} />
        {data.tokens && (
          <div
            className="text-[9px] text-faint tabular-nums"
            title="Raw tokens from Claude Code transcripts, cache reads included. An activity signal, not plan usage."
          >
            Activity: {fmt(data.tokens.window5h?.tokens ?? 0)} / {fmt(data.tokens.window7d?.tokens ?? 0)} tokens (5h / 7d, not plan %)
          </div>
        )}
      </div>
    </div>
  );
}
