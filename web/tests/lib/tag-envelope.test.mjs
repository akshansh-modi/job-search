// Run:  node --test tests/lib/tag-envelope.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTagEnvelopeFilter, parseTagEnvelope } from "../../src/lib/tag-envelope.mjs";
import { parseReportTitle } from "../../src/lib/latex-cv.mjs";
import { parseEmailBrief, persistEmail } from "../../src/lib/email-draft.mjs";

test("filter hides the body from the log and parses it, across odd chunk boundaries", () => {
  const out = "Working on it.\n<<cv-tex>>\n\\documentclass{article}\nbody\n<</cv-tex>>\nVERDICT: 5/5 — done\n";
  const f = createTagEnvelopeFilter("cv-tex");
  let log = "";
  for (let i = 0; i < out.length; i += 7) log += f.push(out.slice(i, i + 7));
  log += f.flush();
  assert.equal(log, "Working on it.\nVERDICT: 5/5 — done\n");
  assert.deepEqual(f.result(), { ok: true, body: "\\documentclass{article}\nbody" });
});

test("refuses missing, duplicated or unclosed envelopes; mid-line markers do not count", () => {
  assert.equal(parseTagEnvelope("no envelope", "email").ok, false);
  assert.equal(parseTagEnvelope("<<email>>\na\n<</email>>\n<<email>>\nb\n<</email>>", "email").ok, false);
  assert.equal(parseTagEnvelope("<<email>>\na", "email").ok, false);
  assert.equal(parseTagEnvelope("use `<<email>>` then\n<<email>>\nx\n<</email>>", "email").ok, true);
});

test("report title → company and role", () => {
  assert.deepEqual(parseReportTitle("# Evaluation: Pallav Technologies — Backend Engineer (Java)\n"), { company: "Pallav Technologies", role: "Backend Engineer (Java)" });
});

test("email brief validation and Subject/body split", () => {
  assert.equal(parseEmailBrief({ to: "not-an-email" }).ok, false);
  assert.equal(parseEmailBrief({ to: "hr@acme.com", type: "evil" }).brief.type, "hr");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "email-"));
  const paths = { dir, txt: path.join(dir, "email.txt"), meta: path.join(dir, "email.json") };
  assert.equal(persistEmail({ paths, text: "no subject line", to: "a@b.co" }).ok, false);
  const r = persistEmail({ paths, text: "Subject: Hello\n\nHi Sam,\nBody.\n", to: "a@b.co" });
  assert.equal(r.subject, "Hello");
  assert.equal(fs.readFileSync(paths.txt, "utf8"), "Hi Sam,\nBody.\n");
  assert.deepEqual(JSON.parse(fs.readFileSync(paths.meta, "utf8")), { to: "a@b.co", subject: "Hello" });
  // Subject written just above the envelope (seen from a real Claude run).
  const r2 = persistEmail({ paths, text: "Hi,\nBody.", to: "a@b.co", outside: "\nSubject: Above\n\n<<email>>\nHi,\nBody.\n<</email>>\n" });
  assert.equal(r2.subject, "Above");
  assert.equal(fs.readFileSync(paths.txt, "utf8"), "Hi,\nBody.\n");
});
