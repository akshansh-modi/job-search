import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";
import { normalizeTextKey as fallbackKey } from "@/lib/core/normalize-text-key.mjs";
import { contactsForCompany, contactView } from "@/lib/report-contacts.mjs";
import type { ContactView } from "@/lib/report-contacts.mjs";

export type { ContactView };

export type CompanyContacts = { ok: true; contacts: ContactView[] } | { ok: false; error: string };

type CoreContactsModule = {
  parseContacts: (content: string) => { contacts: Parameters<typeof contactsForCompany>[0] };
};
type CoreKeyModule = { normalizeTextKey?: (value: unknown) => string };

// Saved contacts at one company, read-only, for the report page.
//
// The file is the user's data/contacts.tsv under the DATA root; the parser and
// the company key are the CORE's own (contacts.mjs parseContacts, tracker-parse.mjs
// normalizeTextKey — what contact-lookup.mjs matches with, via normalizeCompany),
// loaded from the CODE root, which is where the .mjs files live even when
// CAREER_OPS_ROOT points the data somewhere else.
//
// A missing file is "no saved contacts yet". Any other read or load failure is
// returned as an error the page can show, never as an empty list
// (web/AGENTS.md: a missing file is not a malformed file).
export async function readCompanyContacts(company: string): Promise<CompanyContacts> {
  let content: string;
  try {
    content = fs.readFileSync(path.join(careerOpsRoot(), "data", "contacts.tsv"), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return { ok: true, contacts: [] };
    return { ok: false, error: `could not read data/contacts.tsv: ${(e as Error)?.message ?? e}` };
  }

  let parseContacts: CoreContactsModule["parseContacts"];
  try {
    const mod = (await import(/* webpackIgnore: true */ pathToFileURL(rootScript("contacts")).href)) as CoreContactsModule;
    if (typeof mod.parseContacts !== "function") throw new Error("contacts.mjs has no parseContacts export");
    parseContacts = mod.parseContacts;
  } catch (e) {
    return { ok: false, error: `could not load the core contacts parser: ${(e as Error)?.message ?? e}` };
  }

  // Same key as the core; the parity-tested mirror only if the core module
  // cannot be loaded (it is zero-dependency, so that is an old checkout).
  let keyFn: (value: unknown) => string = fallbackKey;
  try {
    const mod = (await import(/* webpackIgnore: true */ pathToFileURL(rootScript("tracker-parse")).href)) as CoreKeyModule;
    if (typeof mod.normalizeTextKey === "function") keyFn = mod.normalizeTextKey;
  } catch {
    /* fallback key stays */
  }

  return { ok: true, contacts: contactsForCompany(parseContacts(content).contacts, company, keyFn).map(contactView) };
}
