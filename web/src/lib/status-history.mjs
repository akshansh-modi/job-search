// One application's status changes, from data/status-log.tsv.
//
// Pure .mjs so `node --test` covers it. The ledger is written only by the core's
// set-status.mjs (the web's /api/status delegates to it); this module only reads.
//
// The ledger is keyed by TRACKER # (the `#` column of applications.md), not by
// report number — the two diverge, which is why apply-checklist.mjs has
// reportNumberFor(). Callers pass the tracker row's `n`.
//
// Rows are shown as written, in file order, rather than replayed into a
// timeline: the ledger's edit rules (funnel-velocity.mjs replayObservations)
// make a `to: -` row retract the previous change and a `correction` row redate
// one. Showing them raw with a label keeps the history honest — a retraction is
// never displayed as if it were a state.

/**
 * @typedef {{num: number, date: string, from: string, to: string, source: string, note: string}} StatusLogRow
 * @typedef {{date: string, from: string|null, to: string|null, source: string, note: string,
 *            kind: "change"|"retraction"|"correction"}} StatusHistoryEntry
 */

/** `-` is the ledger's "unknown / none" sentinel (DATA_CONTRACT.md). */
function state(value) {
  const v = String(value ?? "").trim();
  return v && v !== "-" ? v : null;
}

/**
 * @param {StatusLogRow[]} rows parsed ledger (pipeline-sankey.mjs parseStatusLog)
 * @param {string|number} trackerNum the tracker row's `#`
 * @returns {StatusHistoryEntry[]}
 */
export function statusHistoryFor(rows, trackerNum) {
  const raw = String(trackerNum ?? "").trim();
  if (!/^\d+$/.test(raw)) return [];
  const num = Number.parseInt(raw, 10);
  return rows
    .filter((r) => r.num === num)
    .map((r) => {
      const to = state(r.to);
      const source = String(r.source ?? "").trim();
      return {
        date: String(r.date ?? "").trim(),
        from: state(r.from),
        to,
        source,
        note: String(r.note ?? "").trim(),
        kind: to === null ? "retraction" : source === "correction" ? "correction" : "change",
      };
    });
}
