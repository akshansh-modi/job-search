"use client";

import { useState } from "react";
import { Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { useJobs, type Job } from "@/components/jobs/job-store";

// Interactive runs (Fill in Chrome): the agent paused on a question. Answer it and
// the same session continues in the same Chrome tab; "Stop here" ends the run.
export function JobReply({ job }: { job: Job }) {
  const { answerJob } = useJobs();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  if (job.status !== "running" || !job.question || !job.runId) return null;
  const runId = job.runId;

  const send = async (reply: { text?: string; stop?: boolean }) => {
    setSending(true);
    setError("");
    const err = await answerJob(job.id, runId, reply);
    setSending(false);
    if (err) setError(err);
    else setText("");
  };

  return (
    <div className="mt-6 rounded-2xl border border-brand/40 bg-brand-soft p-4">
      <p className="flex items-start gap-2 text-sm font-medium text-foreground">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-brand-text" /> {job.question}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) send({ text });
        }}
        rows={2}
        maxLength={4000}
        autoFocus
        placeholder="Your answer (⌘↵ to send)"
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand/50 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => send({ text })}
          disabled={sending || !text.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground shadow-sm hover:bg-brand-200 disabled:opacity-60 max-sm:min-h-[44px]"
        >
          {sending ? <Loader2 className="size-3.5 motion-safe:animate-spin" /> : <Send className="size-3.5" />} Answer and continue
        </button>
        <button onClick={() => send({ stop: true })} disabled={sending} className="text-xs text-muted hover:text-brand-text max-sm:min-h-[44px]">
          Stop here
        </button>
        <span className="text-xs text-muted">Waits up to 20 minutes. It never submits the application.</span>
      </div>
      {error && <p className="mt-2 text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
