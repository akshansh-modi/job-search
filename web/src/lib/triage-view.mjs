/**
 * triage-view.mjs — the inbox's "Triage PASS" view (fork).
 *
 * A URL-backed filter over data/triage.json verdicts (`/pipeline?triage=PASS`),
 * so the view survives a reload and can be bookmarked. Main's saved views
 * (pipeline-views.mjs) store only tab, search, score floor and sort, so they
 * cannot carry a verdict without an upstream edit; this sits beside them.
 */

export const TRIAGE_VIEW_PARAM = "triage";
export const TRIAGE_VIEWS = /** @type {const} */ (["PASS", "MARGINAL", "FAIL"]);

/**
 * @param {string | null | undefined} raw
 * @returns {"PASS" | "MARGINAL" | "FAIL" | null}
 */
export function triageViewFrom(raw) {
  const value = String(raw ?? "").trim().toUpperCase();
  return /** @type {any} */ (TRIAGE_VIEWS.find((v) => v === value) ?? null);
}

/**
 * Does a row with this AI verdict belong in the view? No view keeps every row.
 * @param {string | null | undefined} verdict
 * @param {string | null} view
 */
export function inTriageView(verdict, view) {
  return view == null || verdict === view;
}

/**
 * The current query with the view set (or removed for null). Other params stay.
 * @param {string} current - `searchParams.toString()`
 * @param {string | null} view
 * @returns {string}
 */
export function triageViewQuery(current, view) {
  const sp = new URLSearchParams(current);
  if (view) sp.set(TRIAGE_VIEW_PARAM, view);
  else sp.delete(TRIAGE_VIEW_PARAM);
  return sp.toString();
}
