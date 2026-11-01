import { notFound } from "next/navigation";
import { readReport, findApplication, pdfReadyForReport, readStatusLog, trackerCanDelete } from "@/lib/career-ops";
import { readCompanyContacts } from "@/lib/report-contacts-server";
import { statusHistoryFor } from "@/lib/status-history.mjs";
import type { StatusHistoryResult } from "@/components/application-track";
import { resolveTailoredCover } from "@/lib/apply/cover";
import { ReportView } from "@/components/report-view";
import { pipelineQuery } from "@/lib/pipeline-navigation.mjs";
import { reportNumberFor } from "@/lib/apply-checklist.mjs";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = pipelineQuery(await searchParams);
  const app = findApplication(id);
  const report = readReport(id);
  if (!app && !report) notFound();
  // Resolved here rather than in the component so the link is only rendered when
  // THIS application's cover is actually on disk. `id` is passed as the
  // application number, never as a company: a report with no tracker row has no
  // identity to match on, and guessing one from the id would surface another
  // offer's cover.
  const coverReady = (await resolveTailoredCover(app?.company, id)) !== null;
  // Track context, both keyed on the tracker ROW: contacts by its company,
  // history by its `#` (status-log.tsv is keyed by tracker #, not report #).
  // A report with no row has neither, so neither is guessed.
  const contacts = app?.company ? await readCompanyContacts(app.company) : null;
  let statusHistory: StatusHistoryResult | null = null;
  if (app) {
    try {
      statusHistory = { ok: true, entries: statusHistoryFor(readStatusLog(), app.n) };
    } catch (e) {
      // An unreadable ledger is an error to show, not an empty history, and
      // must not take the whole report page down with it.
      statusHistory = { ok: false, error: `could not read data/status-log.tsv: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return (
    <ReportView
      id={id}
      app={app}
      report={report?.content ?? null}
      file={report?.file ?? null}
      canDelete={trackerCanDelete()}
      pdfReadyFromIndex={await pdfReadyForReport(id)}
      coverReady={coverReady}
      backHref={`/pipeline${query ? `?${query}` : ""}`}
      applyHref={`/pipeline/${encodeURIComponent(id)}/apply${query ? `?${query}` : ""}`}
      reportNum={reportNumberFor(id, app, report?.file ?? null)}
      contacts={contacts}
      statusHistory={statusHistory}
    />
  );
}
