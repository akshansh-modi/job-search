// The data/follow-ups.md "sent" row — the one format the core reads.
//
// Pure .mjs so `node --test` covers it; /api/followups/log owns the file I/O and
// the locks (withFollowupsWrite). A TABLE row in follow-ups.md means "a
// follow-up was SENT" (followup-seed.mjs writes pins, never rows), and the core's
// followup-cadence.mjs `parseFollowups` reads it as:
//   | num | appNum | date | company | role | channel | contact | notes |
// tests/lib/followup-log.test.mjs feeds this module's output to that parser.

export const FOLLOWUP_TABLE_HEADER =
  "| num | appNum | date | company | role | channel | contact | notes |\n|---|---|---|---|---|---|---|---|\n";

/** Table cells must stay single-line and pipe-free. `max` optional — notes are
 *  deliberately uncapped (user decision), identity fields keep a sanity cap.
 * @param {unknown} v
 * @param {number} [max]
 */
export function followupCell(v, max) {
  const s = String(v ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\|/g, "/")
    .trim();
  return max ? s.slice(0, max) : s;
}

/**
 * Text to APPEND to the existing file for one new row, and the row's num.
 * num = max existing table num + 1 (legacy bullets carry none).
 *
 * @param {string} existing current file content ("" when the file is new)
 * @param {{appNum: number, date: string, company: string, role?: string, channel: string,
 *          contact?: string, notes?: string}} row already validated by the route
 * @returns {{text: string, num: number}}
 */
export function buildFollowupAppend(existing, row) {
  let maxNum = 0;
  let hasHeader = false;
  for (const line of existing.split("\n")) {
    if (!line.startsWith("|")) continue;
    const first = line.split("|")[1]?.trim() ?? "";
    // Both header spellings exist in the wild: "num" (this writer) and
    // "#" (files created per modes/followup.md) — recognize either, or a
    // second header block gets appended into CLI-created files.
    if (/^(num|#)$/i.test(first)) hasHeader = true;
    const n = Number.parseInt(first, 10);
    if (Number.isInteger(n) && n > maxNum) maxNum = n;
  }
  const num = maxNum + 1;

  let text = "";
  // CLI-created files may lack a trailing newline — guard regardless of
  // whether we're also inserting the header, or the row glues to the last line.
  if (existing && !existing.endsWith("\n")) text += "\n";
  if (!hasHeader) text += FOLLOWUP_TABLE_HEADER;
  text += `| ${num} | ${row.appNum} | ${row.date} | ${row.company} | ${row.role ?? ""} | ${row.channel} | ${row.contact ?? ""} | ${row.notes ?? ""} |\n`;
  return { text, num };
}

/**
 * True when the cadence entry already has a follow-up logged on `date` — the
 * one-click "Followed up today" button shows "Logged today" instead of minting
 * a second row for the same day.
 *
 * @param {{followups?: Array<{date?: string}>}} entry a CadenceEntry
 * @param {string} date YYYY-MM-DD (the user's local day)
 */
export function loggedOn(entry, date) {
  return (entry.followups ?? []).some((f) => String(f.date ?? "").trim() === date);
}

/** The channel the one-click log records. The dialog stays the way to pick one. */
export const QUICK_LOG_CHANNEL = "Other";
