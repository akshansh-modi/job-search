// Saved contacts for one company, shaped for the report page.
//
// Pure .mjs so `node --test` covers it. The server side (report-contacts-server.ts)
// reads data/contacts.tsv, parses it with the core's own parseContacts()
// (contacts.mjs) and hands the rows here together with the core's company key.
//
// MATCHING mirrors contact-lookup.mjs `findContactsByCompany` exactly: the
// company key is normalizeCompany() from tracker-utils.mjs, which is the core's
// normalizeTextKey(). It is exact-key, never fuzzy: a fuzzy match would surface a
// contact at a similarly named, unrelated company as a warm lead. The key
// function is injected so this module stays dependency-free; the parity test in
// tests/lib/report-contacts.test.mjs runs both against the same fixture.

/**
 * @typedef {{name: string, company: string, type?: string, title?: string, phone?: string,
 *            email?: string, linkedin?: string, tracker?: string|null, notes?: string}} CoreContact
 * @typedef {{kind: "email"|"linkedin"|"phone", value: string, href: string|null}} ContactChannel
 * @typedef {{name: string, role: string, type: string, channel: ContactChannel|null, note: string,
 *            tracker: string|null}} ContactView
 */

/**
 * Contacts at `company`, most recently listed first (contact-lookup.mjs order).
 *
 * contacts.tsv is an update-in-place store: when two lines share a name at the
 * same company, the later line is the current one (contacts.mjs exports only
 * the last line to vCard for the same reason). The page shows one row per
 * person, so after reversing we keep the first occurrence of each name.
 *
 * @param {CoreContact[]} contacts parseContacts(...).contacts
 * @param {string} company the tracker row's company
 * @param {(value: unknown) => string} keyFn the core's normalizeCompany / normalizeTextKey
 * @returns {CoreContact[]}
 */
export function contactsForCompany(contacts, company, keyFn) {
  const key = keyFn(company);
  if (!key) return [];
  const seen = new Set();
  const out = [];
  for (const c of [...contacts].reverse()) {
    if (keyFn(c.company) !== key) continue;
    const person = keyFn(c.name);
    if (seen.has(person)) continue;
    seen.add(person);
    out.push(c);
  }
  return out;
}

/**
 * The one channel to show: email, then LinkedIn, then phone. Only a real
 * http(s) LinkedIn URL becomes a link; anything else is shown as text, so a
 * hand-typed `javascript:` value in the TSV never reaches an href.
 *
 * @param {CoreContact} c
 * @returns {ContactChannel|null}
 */
export function contactChannel(c) {
  const email = (c.email ?? "").trim();
  if (email) return { kind: "email", value: email, href: /^[^\s@]+@[^\s@]+$/.test(email) ? `mailto:${email}` : null };
  const linkedin = (c.linkedin ?? "").trim();
  if (linkedin) return { kind: "linkedin", value: linkedin, href: /^https?:\/\//i.test(linkedin) ? linkedin : null };
  const phone = (c.phone ?? "").trim();
  if (phone) {
    const dial = phone.replace(/[^\d+]/g, "");
    return { kind: "phone", value: phone, href: dial ? `tel:${dial}` : null };
  }
  return null;
}

/**
 * @param {CoreContact} c
 * @returns {ContactView}
 */
export function contactView(c) {
  return {
    name: c.name,
    role: (c.title ?? "").trim(),
    type: (c.type ?? "").trim(),
    channel: contactChannel(c),
    note: (c.notes ?? "").trim(),
    tracker: c.tracker ?? null,
  };
}
