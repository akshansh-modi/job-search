"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { FileCode2, Loader2, Mail, Send, TriangleAlert } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

const pill =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand-text max-sm:min-h-[44px]";
const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand/50 focus:outline-none";

function useLatestJob(kind: string, n: string) {
  const { jobs } = useJobs();
  return useMemo(() => jobs.filter((j) => j.kind === kind && j.input === n).sort((a, b) => b.startedAt - a.startedAt)[0], [jobs, kind, n]);
}

function Failure({ jobId, what }: { jobId: string; what: string }) {
  return (
    <Link href={`/jobs/${jobId}`} role="alert" className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline dark:text-red-400">
      <TriangleAlert className="size-3.5" /> {what} failed — open the run log
    </Link>
  );
}

// Your own one-page LaTeX resume (modes/_custom.md rules), fact-gated and compiled locally.
export function LatexCvButton({ n, company }: { n: string; company: string }) {
  const { startJob } = useJobs();
  const job = useLatestJob("latex-cv", n);
  if (job?.status === "running")
    return (
      <Link href={`/jobs/${job.id}`} className={`${pill} border-brand/40 bg-brand-soft text-brand-text`}>
        <Loader2 className="size-3.5 motion-safe:animate-spin" /> Building LaTeX CV…
      </Link>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        className={pill}
        title="Tailor your own resume.tex for this role, fact-check it and compile a one-page PDF"
        onClick={() => startJob({ title: `LaTeX CV · ${company}`, subtitle: "one-page, fact-checked", kind: "latex-cv", input: n, page: `/pipeline/${n}` })}
      >
        <FileCode2 className="size-3.5" /> {job?.status === "done" ? "Rebuild LaTeX CV" : "LaTeX CV"}
      </button>
      {job?.status === "done" && (
        <Link href={`/jobs/${job.id}`} className="text-xs text-emerald-700 hover:underline dark:text-emerald-400">done — see log</Link>
      )}
      {job?.status === "error" && <Failure jobId={job.id} what="LaTeX CV" />}
    </span>
  );
}

type Draft = { to: string; subject: string; body: string; attachment: string | null };

// Draft an HR or referral email, show it, and only save to Gmail Drafts on a click. Never sends.
export function EmailDraftButton({ n, company }: { n: string; company: string }) {
  const { startJob } = useJobs();
  const job = useLatestJob("email-draft", n);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ ok: boolean; link?: string | null; error?: string } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/email-draft?n=${encodeURIComponent(n)}`)
      .then((r) => r.json())
      .then((d) => setDraft(d.draft))
      .catch(() => setDraft(null));
  }, [n]);
  useEffect(load, [load, job?.status]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const brief = Object.fromEntries(["to", "type", "name", "why", "notes"].map((k) => [k, String(data.get(k) ?? "")]));
    setSaved(null);
    startJob({ title: `Email · ${company}`, subtitle: brief.type === "referral" ? "referral request" : "to HR", kind: "email-draft", input: n, page: `/pipeline/${n}`, brief });
    setOpen(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/email-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n }) });
      setSaved(await r.json());
    } catch {
      setSaved({ ok: false, error: "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {job?.status === "running" ? (
        <Link href={`/jobs/${job.id}`} className={`${pill} border-brand/40 bg-brand-soft text-brand-text`}>
          <Loader2 className="size-3.5 motion-safe:animate-spin" /> Drafting email…
        </Link>
      ) : (
        <button className={pill} aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Draft an HR or referral email with your house rules">
          <Mail className="size-3.5" /> {draft ? "Redraft email" : "Draft email"}
        </button>
      )}
      {job?.status === "error" && <Failure jobId={job.id} what="Email draft" />}

      {open && (
        <form onSubmit={submit} aria-label="Email details" className="basis-full rounded-2xl border border-border bg-surface/50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-foreground">
              To (email)
              <input name="to" type="email" required defaultValue={draft?.to ?? ""} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Recipient name
              <input name="name" maxLength={80} className={fieldClass} placeholder="optional" />
            </label>
          </div>
          <label className="mt-3 block text-sm font-medium text-foreground">
            Type
            <select name="type" defaultValue="hr" className={fieldClass}>
              <option value="hr">HR / recruiter (forward line + phone)</option>
              <option value="referral">Referral ask to an engineer / alum</option>
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium text-foreground">
            Why this company?
            <span className="block text-xs font-normal text-muted">One honest line. Leave empty and the draft will propose one from the report for you to confirm.</span>
            <textarea name="why" rows={2} maxLength={400} className={fieldClass} />
          </label>
          <label className="mt-3 block text-sm font-medium text-foreground">
            Notes
            <span className="block text-xs font-normal text-muted">e.g. "already applied on LinkedIn", "happy to relocate to Bangalore"</span>
            <textarea name="notes" rows={2} maxLength={600} className={fieldClass} />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground shadow-sm hover:bg-brand-200 max-sm:min-h-[44px]">
              <Mail className="size-3.5" /> Draft it
            </button>
            <CostBadge kind="spend" size="xs" />
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-brand-text max-sm:min-h-[44px]">Cancel</button>
          </div>
        </form>
      )}

      {draft && job?.status !== "running" && (
        <div className="basis-full rounded-2xl border border-border bg-surface/50 p-4 text-sm">
          <p className="text-xs text-muted">To: {draft.to}</p>
          <p className="text-xs text-muted">Subject: {draft.subject}</p>
          <p className="text-xs text-muted">Attachment: {draft.attachment ?? "none — build the LaTeX CV first"}</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-foreground">{draft.body}</pre>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground shadow-sm hover:bg-brand-200 disabled:opacity-60 max-sm:min-h-[44px]">
              {saving ? <Loader2 className="size-3.5 motion-safe:animate-spin" /> : <Send className="size-3.5" />} Save to Gmail Drafts
            </button>
            <span className="text-xs text-muted">Saves a draft only. Nothing is sent.</span>
          </div>
          {saved?.ok && (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
              Saved.{" "}
              {saved.link && <a href={saved.link} target="_blank" rel="noreferrer" className="underline">Open in Gmail</a>}
            </p>
          )}
          {saved && !saved.ok && <p className="mt-2 text-xs text-red-700 dark:text-red-400">{saved.error}</p>}
        </div>
      )}
    </>
  );
}

// After a "Fill in Chrome" run stops short (a question it could not answer from your
// files, a login wall…), answer here and run it again; the answers go to the next run.
export function ChromeFillContinue({ n, company }: { n: string; company: string }) {
  const { startJob } = useJobs();
  const job = useLatestJob("chrome-fill", n);
  const [answers, setAnswers] = useState("");
  if (!job || job.status === "running") return null;
  const finishedShort = job.status === "error" || (job.result?.score != null && job.result.score < 5);
  if (!finishedShort) return null;
  const go = () => {
    startJob({ title: `Fill in Chrome · ${company}`, subtitle: "continuing, you review and submit", kind: "chrome-fill", input: n, page: `/pipeline/${n}`, brief: { answers } });
  };
  return (
    <div className="basis-full rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <p className="font-medium text-foreground">
        Fill in Chrome stopped: {job.result?.summary ?? "see the run log"}{" "}
        <Link href={`/jobs/${job.id}`} className="text-xs font-normal text-brand-text hover:underline">run log</Link>
      </p>
      <label className="mt-2 block text-xs text-muted">
        Answer what it asked (one per line), e.g. “How did you hear: Job Board”, “Postal code: 122001”, “Tick the terms checkbox”.
        <textarea value={answers} onChange={(e) => setAnswers(e.target.value)} rows={3} maxLength={2000} className={fieldClass} />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={go} disabled={!answers.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground shadow-sm hover:bg-brand-200 disabled:opacity-60 max-sm:min-h-[44px]">
          <Send className="size-3.5" /> Continue in Chrome
        </button>
        <CostBadge kind="spend" size="xs" />
        <span className="text-xs text-muted">Answers you&apos;ll reuse on every form belong in modes/_custom.md.</span>
      </div>
    </div>
  );
}
