import { History, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CompanyContacts } from "@/lib/report-contacts-server";
import type { StatusHistoryEntry } from "@/lib/status-history.mjs";

export type StatusHistoryResult = { ok: true; entries: StatusHistoryEntry[] } | { ok: false; error: string };

// Track context for one application on its report page, both read-only and both
// resolved on the server by the page:
//   - saved contacts at this company (data/contacts.tsv, matched like
//     contact-lookup.mjs), so a warm lead is visible before any outreach;
//   - this row's status changes (data/status-log.tsv, written by set-status.mjs).
// A read failure is shown as such, never as "nothing here".

const CHANNEL_LABEL = { email: "Email", linkedin: "LinkedIn", phone: "Phone" } as const;

export function SavedContacts({ company, result }: { company: string; result: CompanyContacts }) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface/40 px-5 py-4" aria-labelledby="saved-contacts-heading">
      <h2 id="saved-contacts-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Users className="size-4 text-faint" /> Saved contacts at {company}
      </h2>
      {!result.ok ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">{result.error}</p>
      ) : result.contacts.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No saved contact at this company in <code className="text-foreground">data/contacts.tsv</code>.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {result.contacts.map((c) => (
            <li key={c.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
              <span className="font-medium text-foreground">{c.name}</span>
              {c.role && <span className="text-muted">{c.role}</span>}
              {c.type && <Badge tone="muted">{c.type}</Badge>}
              {c.channel &&
                (c.channel.href ? (
                  <a
                    href={c.channel.href}
                    target={c.channel.kind === "linkedin" ? "_blank" : undefined}
                    rel={c.channel.kind === "linkedin" ? "noreferrer" : undefined}
                    className="text-brand-text hover:underline"
                  >
                    {CHANNEL_LABEL[c.channel.kind]}: {c.channel.value}
                  </a>
                ) : (
                  <span className="text-muted">
                    {CHANNEL_LABEL[c.channel.kind]}: {c.channel.value}
                  </span>
                ))}
              {c.note && <span className="basis-full text-xs text-faint">Last note: {c.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StatusHistory({ trackerNum, result }: { trackerNum: string; result: StatusHistoryResult }) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface/40 px-5 py-4" aria-labelledby="status-history-heading">
      <h2 id="status-history-heading" className="flex items-center gap-2 text-sm font-semibold">
        <History className="size-4 text-faint" /> Status history
        <span className="font-mono text-xs font-normal text-faint">tracker #{trackerNum}</span>
      </h2>
      {!result.ok ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">{result.error}</p>
      ) : result.entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No status change recorded in <code className="text-foreground">data/status-log.tsv</code> for this row yet.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5 text-sm">
          {result.entries.map((e, i) => (
            <li key={`${e.date}-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="tabular-nums text-muted">{e.date}</span>
              {e.kind === "retraction" ? (
                // set-status.mjs --undo writes `- → -`; what it undid is in the note.
                <span className="text-muted">Undid the previous change</span>
              ) : (
                <span>
                  <span className="text-muted">{e.from ?? "—"}</span> → <span className="font-medium text-foreground">{e.to}</span>
                </span>
              )}
              {e.kind === "correction" && <Badge tone="info">date corrected</Badge>}
              {e.source && e.source !== "set-status" && e.source !== "correction" && <Badge tone="muted">{e.source}</Badge>}
              {e.note && <span className="text-xs text-faint">{e.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
