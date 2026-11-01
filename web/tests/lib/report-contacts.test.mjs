import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contactsForCompany, contactChannel, contactView } from "../../src/lib/report-contacts.mjs";

// The core's own parser and company key: the web must match exactly what
// contact-lookup.mjs matches (normalizeCompany === normalizeTextKey).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { parseContacts } = await import(pathToFileURL(join(ROOT, "contacts.mjs")).href);
const { normalizeTextKey } = await import(pathToFileURL(join(ROOT, "tracker-parse.mjs")).href);

// Fictional fixture only — never real names from anyone's search.
const FIXTURE = [
  "# name\tcompany\ttype\ttitle\tphone\temail\tlinkedin\ttracker\tnotes",
  "Jane Doe\tAcme Inc.\tinterviewer\tEng Manager\t\tjane@acme.example\t\t012\tinterviewed me, March",
  "Jo Example\tInitech\tpeer\t\t\t\t\t-\tintro via meetup",
  "Old Recruiter\tAcme Inc.\trecruiter\tTalent Partner\t+1 (555) 010-0000\t\t\t007\tolder line",
  "Jane Doe\tACME, Inc\tinterviewer\tDirector\t\tjane@acme.example\t\t012\tpromoted; follow up in May",
].join("\n");

const { contacts } = parseContacts(FIXTURE);

test("matches with the core company key, most recent first, one row per person", () => {
  const got = contactsForCompany(contacts, "acme inc", normalizeTextKey);
  assert.deepEqual(
    got.map((c) => [c.name, c.title, c.notes]),
    [
      ["Jane Doe", "Director", "promoted; follow up in May"], // later line wins
      ["Old Recruiter", "Talent Partner", "older line"],
    ],
  );
});

test("never leaks another company, and an empty or placeholder company matches nothing", () => {
  assert.deepEqual(contactsForCompany(contacts, "Initech", normalizeTextKey).map((c) => c.name), ["Jo Example"]);
  assert.deepEqual(contactsForCompany(contacts, "Globex", normalizeTextKey), []);
  assert.deepEqual(contactsForCompany(contacts, "", normalizeTextKey), []);
  assert.deepEqual(contactsForCompany(contacts, "?", normalizeTextKey), []);
});

test("parity: same company set as contact-lookup.mjs findContactsByCompany", async () => {
  // contact-lookup pulls tracker-utils (js-yaml); CI installs the core deps.
  const { findContactsByCompany } = await import(pathToFileURL(join(ROOT, "contact-lookup.mjs")).href);
  for (const q of ["Acme Inc.", "ACME, Inc", "Initech", "Globex", "", "?"]) {
    const core = findContactsByCompany(contacts, q);
    const web = contactsForCompany(contacts, q, normalizeTextKey);
    // Web collapses duplicate people (last line wins); the core keeps every line.
    const firstPerName = core.filter((c, i) => core.findIndex((d) => d.name === c.name) === i);
    assert.deepEqual(web, firstPerName, `query ${JSON.stringify(q)}`);
  }
});

test("channel: email, then LinkedIn, then phone; unsafe values never become links", () => {
  assert.deepEqual(contactChannel({ name: "a", company: "b", email: "a@b.example", linkedin: "https://x" }), {
    kind: "email",
    value: "a@b.example",
    href: "mailto:a@b.example",
  });
  assert.deepEqual(contactChannel({ name: "a", company: "b", linkedin: "https://www.linkedin.com/in/x" }).href, "https://www.linkedin.com/in/x");
  assert.equal(contactChannel({ name: "a", company: "b", linkedin: "javascript:alert(1)" }).href, null);
  assert.deepEqual(contactChannel({ name: "a", company: "b", phone: "+1 (555) 010-0000" }), {
    kind: "phone",
    value: "+1 (555) 010-0000",
    href: "tel:+15550100000",
  });
  assert.equal(contactChannel({ name: "a", company: "b" }), null);
});

test("view: role is the title, type kept apart, last note is the notes column", () => {
  const [jane] = contactsForCompany(contacts, "Acme Inc.", normalizeTextKey);
  assert.deepEqual(contactView(jane), {
    name: "Jane Doe",
    role: "Director",
    type: "interviewer",
    channel: { kind: "email", value: "jane@acme.example", href: "mailto:jane@acme.example" },
    note: "promoted; follow up in May",
    tracker: "012",
  });
});
