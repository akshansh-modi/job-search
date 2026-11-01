# Sync analysis: `main` → `feature-ui`

- **Branch:** `claude/feature-ui-main-sync-qvdy5h` (the name this session is allowed to push), cut from `origin/main` at `6210e44`.
- **Merging in:** `origin/feature-ui` at `646e0a8`.
- **Merge base:** `2622650`.
- **Size:** `main` is 99 commits ahead of the merge base, and `feature-ui` is 24 commits ahead.

Commits are cited by hash and upstream PR number only.

---

## 1. What main brought in (99 commits)

### Web UI (`web/`, 27 commits)

**The commit that matters most: c6fec47 (#4430), run core scripts and read system files from the checkout, not the data root.**
- `careerOpsRoot()` now means the data root only.
- Scripts, system modes, templates, `lib/` and example configs resolve through `resolveCodeRoot(process.cwd(), process.env)` (`web/src/lib/core/code-root.mjs`, which honours `CAREER_OPS_CODE_ROOT`).
- `pdf-render.mjs`: `renderAndMarkPdf({ root })` became `{ coreRoot }`.
- `buildPrompt()` takes `codeRoot` and gives the worker absolute checkout paths for `modes/*.md`, templates and `verify-portals.mjs`.
- `web/tests/lib/core-checkout-root.test.mjs` source-scans for system paths joined onto the data root.

**Pipeline and report**
- Saved pipeline views, with a score floor (34bff2e #6103).
- Back links keep your place in the list (dc2e2b7 #6072, via the new `BackLink`).
- Search is kept in the URL (3f409aa #6060, via `use-list-search` and `list-search-sync`).
- CV Studio opens the row's own report (1772d4b #6340).
- "PDF ready" is split into two props, `pdfFileReady` and `trackerMarkedPdf`.
  - The tracker's ✅ alone no longer counts as ready.
  - Generate is offered when the tracker marks a CV that has no file (ef9006f #6116).
- The app shell stays up when a report is unreadable or missing (5e2c28f #6075).
- Report headers saved with CRLF line endings are read (19f1826 #6052).
- The Machine Summary is read from the report's own last section (89cccea #6157).

**Inbox**
- Skip and save rows from the keyboard (917d60b #6101).
- A second posting with the same title shows in What's New (f421868 #6148).

**Follow-ups**
- The most-overdue follow-up is listed first within each urgency (c75b240 #6073).
- The table keeps its place while the cadence loads (91fb762 #6074).
- A cadence save from a stale tab is refused (7b517c5 #6053).
- The follow-up report link has an Open action (b74dbbf #6120).

**CV**
- Import a PDF or TeX CV from the editor (d0a1dfe #6238). This adds the `pdfjs-dist` dependency and `serverExternalPackages`.
- A CV with one job counts as ready (0ce892e #6118).

**Today, Config, Documents and analytics**
- Today leads with the queue once there is work (0a87359 #6114).
- A missing `portals.yml` is explained (ba97fbe #6109).
- Config choices that don't work yet are hidden (f76924d #6122).
- The empty Documents page is titled (148be0f #6121).
- Analytics announces why a rate shows a dash (d71716f #6239).
- The empty tracker message survives active filters (47f33a0 #6298).
- Light-mode status text meets WCAG AA contrast (8629c18 #6078).

**Performance**
- One browser is kept for dashboard PDF export (7915e6e #6177).
- Search stats no longer re-read the tracker for every row (f69babb #6066).

**Config**
- `agentRules: false` in `next.config.mjs` (6e795a7 #6150). `web/AGENTS.md` loses the generated Next block.

### Scripts and CLI hygiene
- Several scripts now reject unknown flags and read `--flag=value`:
  - `verify-pipeline` (3e60bda #6342)
  - `sync-batch-input` (c423da8 #6343)
  - `tracker-sync-check` and `discard-analytics` (58d6190 #6210)
  - `check-liveness` (6220f54 #6086)
  - `intake` (c57ac01 #6041)
  - `plugins` (3877747 #6097, f85d3e5 #6117)
- `set-status.mjs` rejects a comma list of tracker numbers (c551197 #6042). This is additive; the other flags are unchanged.
- `followup-cadence.mjs` resolves repo-root report links and sorts by pressure (d071bf6 #6124, c75b240 #6073).
- `doctor` reads plugins from the checkout (5584f44 #6098).
- PDF fixes:
  - honours `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (4d9bbd2 #6209);
  - resolves relative paths against the workspace (1b0567b #6082);
  - isolates shared painters by workspace (1c5fc5a #6164).
- `generate-latex` / `build-cv-latex` honour `page_format` (3462740 #6345). That change is in `build-cv-latex.mjs`; `generate-latex.mjs` is unchanged.
- The CV payload keeps its source on aliased output (5dfd45c #5527).
- `prepare-application` reads the candidate block (5faf024 #6083).
- `add-entry` serialises confirmed additions (9209b95 #5915).
- New `sponsor-check.mjs`, a UK sponsor-licence cross-check (97b6b33 #5790).
- `clean-markers --keep-script-joiners` (87bd659 #6267).
- Numeric report number inferred from the filepath, and a longer plugin-hook timeout (5dbfba0 #6152).
- `formatK` deduplicated (c9b2c42 #6268).
- **Privacy guard:** blocks protected PII in outbound LLM requests from API evaluators (`lib/privacy-guard.mjs`, `lib/llm-outbound.mjs`, `privacy-status.mjs`; f637363 #5571). There is also a contact-redaction filter (fc774c7 #2427). Neither touches the agent-CLI spawns the web uses.
- OpenRouter reliability (20c5bb0 #6027).
- Batch: an optional `--mode match` single pass (3d30cf1 #5404).

### Modes
- The Machine Summary is now the last report section, in `modes/oferta.md`, the batch prompt and 14 localized modes (89cccea #6157).
- The PDF design text is aligned with `cv-template` (1968a3d #6301).

### Scanner and providers
- New providers:
  - `providers/deel.mjs` (5e67cd5 #6189)
  - `providers/bulldogjob.mjs` (6f2d4cf #6253)
  - a new portal entry (5a3be9c #6247)
- Provider fixes:
  - iCIMS location labels (7a2abd5 #6130)
  - Jobvite shared-URL locations (39239c7 #6127)
  - SmartRecruiters `postedAt` (77d1114 #6303)
  - justjoin dates (60ae5e5 #6254)
  - IBM pagination cap and retry (bfe8b2c #6273)
  - Apple PIPE label (39287a5 #6196)
- `scan.mjs` US-state versus country-code location matching.
- Liveness treats the Built In "job was removed" banner as expired (c4b965e #6336).
- Skill gap:
  - Spanish headings (7aaa6f7 #5664)
  - "Basic/Minimum Qualifications" headings (05ae8c2 #6257)

### Tracker
- Duplicate openings are told apart by requisition ID (a309ccf #6242).
- A company query matches when only the legal suffix differs (924090a #6087).
- Contacts keep Unicode composition variants on one UID (38dedab #6155).
- `tracker-utils.mjs` now exports `userFileWriteTarget`.

### Dashboard (Go)
- Terminal-width fit (7d3f0cd).
- Control characters stripped (951b37c).
- Hired sorted first (19af0ef).
- `y` copies the CV path (1bbc30b).
- Go minimum documented (f7c7ea7).

### Plugins and distribution
- Thin plugins for the Claude, Cursor, OpenAI and Antigravity directories (31906c1, f1e562b, d6badfb, 681608b, 74e6a2a, 086d8c3).
- An Exa plugin (5bb688f).

### Tests and docs
- Tests:
  - test temp-directory leaks fixed (6f652f9);
  - apply-scope and data-root test isolation (2cc4a59, a330b80);
  - other test fixes (6d85154, b6e4fe9, 37edd7a, 6a3e6e3).
- Docs:
  - backup strategies (3ff1e42);
  - CV template location (b7212e2);
  - README customization (c7a2e3c);
  - waitlist link (0bd01b7);
  - an example CV (a068b71);
  - the How It Works diagram (6210e44);
  - other docs fixes (de4555a, fef0e2a).
- Community: hired-wall and signature housekeeping commits.

---

## 2. Conflicts and overlaps

There are five textual conflicts: `web/README.md`, `web/package-lock.json`, `web/src/app/api/run/route.ts`, `web/src/app/pipeline/[id]/page.tsx` and `web/src/components/followups/followups-view.tsx`. The rest merge cleanly.

| File | main changed | feature-ui changed | Collide? |
|---|---|---|---|
| `web/AGENTS.md` | Dropped the generated `nextjs-agent-rules` block and added a short "Next.js version" section | Rules list renamed; added the `chrome-fill` exception to rule 3 and rule 4, "Agents never write files" | No. They touch different hunks and auto-merge. |
| `web/README.md` | Added the CV Upload PDF / TeX note | Documented contacts and status history, Done today, LaTeX CV, Draft email, Fill in Chrome, Flows, online mode and the usage meter | Text conflict in adjacent bullets. Keep both. |
| `web/next.config.mjs` | `agentRules: false`, `serverExternalPackages: ["pdfjs-dist"]` | `ONLINE` switch: turbopack root plus `outputFileTracing*` for Vercel | No. They're in different keys and auto-merge. |
| `web/package.json` | `+pdfjs-dist` | `+mongodb` | No. Both are kept. |
| `web/package-lock.json` | Lock for `pdfjs-dist` | Lock for `mongodb` | Text conflict. Regenerate from main's lock plus `npm install`. |
| `web/src/app/api/run/route.ts` | `codeRoot` for the `needsScript` check, evaluation mode files, `resolveCvTemplate`, `buildPrompt({ codeRoot })` and the render and persist calls (`coreRoot`) | `/flows` CLI choice and model args; `latex-cv`, `email-draft`, `chrome-fill` and `triage` kinds; saved-JD note; interactive runs; tag-envelope persist | Yes, a real overlap: the `needsScript` line and the `buildPrompt` call site. Keep main's `codeRoot` plumbing and add our kinds on top. |
| `web/src/app/jobs/[id]/page.tsx` | `BackLink` + `pipelineQuery` | `<JobReply>` | No. Auto-merged. |
| `web/src/app/pipeline/[id]/page.tsx` | `pdfReadyForReport` replaced by `pdfPathStatusForReport` + `tailoredCvOnDisk`; passes `pdfFileReady` and `trackerMarkedPdf` | Contacts and status history for Track | Text conflict, import list only. Take the union and drop the now-unused `pdfReadyForReport`. |
| `web/src/components/report-view.tsx` | `BackLink`; split PDF-ready props; "marked without file" note; contrast fix | LaTeX / Email / Chrome-fill buttons, Open posting, Track section | No text conflict. Semantic change: `pdfReady` now means a file is on disk. Our ApplyButton and Open posting get the new meaning, which is the more honest one. |
| `followups/followups-view.tsx` | Search moved to `useListSearch` / `queryWithLiveSearch`; summary slot | One-click "Done today" (`quickLog`) | Text conflict in the import and hook region only. Keep both. |
| `inbox/inbox-triage.tsx` | Keyboard skip and save (key handler, focus state) | AI triage state, button and "Shortlist N PASS" | No. Auto-merged; needs reading by eye for duplicate names. |
| `inbox/triage-row.tsx` | Focus / keyboard props | `ai` prop + verdict badge | No. Auto-merged. |

---

## 3. What breaks without a textual conflict

These are verified against the source of both branches.

| Area | Finding | Status |
|---|---|---|
| `worker-capabilities.mjs`, `claude-invocation.mjs` (`KNOWN_KINDS`, `verifyClaudeArgs`), `spawn-cli.mjs`, `run-cli-support.mjs` | **Unchanged on main** (empty diff from the merge base). Our added kinds and `CHROME_FILL_TOOLS` fence can't collide. | Safe |
| `merge-tracker.mjs`, `keyword-match.mjs`, `generate-latex.mjs`, `reserve-report-num.mjs`, `followup-seed.mjs`, `mark-pdf-ready.mjs` | **Unchanged on main.** | Safe |
| `set-status.mjs` | Only gained the comma-list rejection. Our status-history reader only reads `status-log.tsv`. | Safe |
| `followup-cadence.mjs` | Sort order and report-link resolution changed. The table row format our `followup-log.mjs` writes and tests against is unchanged. | Safe (covered by our `followup-log.test.mjs`) |
| `career-ops.ts` exports | `pdfReadyForReport`, `readStatusLog`, `findReportFile`, `readInbox`, `readMemory` and `rootScript` all still exist. `rootScript` now resolves to the code root, which is what `report-contacts-server.ts` wants. | Safe |
| `renderAndMarkPdf({ root })` → `{ coreRoot }` | Only main's own call sites use it, and they're kept. | Safe if main's `route.ts` hunks are kept |
| **Code-root split vs `latex-cv`** | `persistLatexCv` runs `generate-latex.mjs` and `mark-pdf-ready.mjs` with `cwd: root`, the **data root**. On a split layout the scripts aren't there. The test doesn't catch it because the file doesn't call `rootScript(`. | **Breaks on split layout.** Fix: pass `coreRoot`. |
| **Code-root split vs `email-draft`** | `saveGmailDraft` runs `python3 save-draft.py` with the data root as cwd. The script lives in the checkout and reads `.env` next to itself. | **Breaks on split layout.** Fix: run it from the code root. |
| **Code-root split vs `triage` / `chrome-fill` prompts** | The triage prompt says "Read modes/triage.md", a relative path, while the worker's cwd is the data root. `chrome-fill` only names user-layer files (`cv.md`, `modes/_custom.md`, `modes/_profile.md`), which is fine. | **Triage breaks on split layout.** Fix: absolute checkout path. |
| `route.ts` `needsScript` | Main checks the file against the code root. Our `generate-latex.mjs`, `save-draft.py` and `modes/triage.md` all live in the checkout, so this is the correct root for them. | Safe once merged |
| Report format (89cccea) | The Machine Summary moved after the archived JD. None of our readers parse it: `chrome-fill` reads the `**URL:**` header line, `latex-cv` / `email-draft` read the H1 title, and `report-contacts` reads `contacts.tsv`. | Safe |
| `flows.mjs` | Lists the task kinds. Main added no new run kinds, since `KNOWN_KINDS` is unchanged. | Safe |
| `scheduled-jobs-runner` `orBase` fix | Main didn't touch `web/scripts/scheduled-jobs-runner.mjs`. | Safe |
| `local/jobspy_parser.py`, `save-draft.py`, usage meter (`claude-usage-statusline.mjs`, `claude-rate-limits.mjs`, `api/usage`) | Not touched by main. | Safe |
| Online / Vercel mode | `online.mjs` copies the checkout scripts into the data snapshot and assumes scripts are read from the data root. Main now reads them from `resolveCodeRoot()`, which is `cwd/..`. That should still be the traced checkout on Vercel (`outputFileTracingRoot` = repo root), but it can't be verified here. | **Unverified.** See the Decisions section. |
| Privacy guard (f637363, fc774c7) | Applies to the API evaluators (`gemini`, `openai`, `ollama`, `openrouter`), not to agent-CLI spawns. | No effect on web runs |

---

## 4. Workflow impact (the six web flows)

- **Find.**
  - Main gives better scanner coverage: new providers, fixed dates so the age filters work, and US/CA/IN location parsing.
  - Inbox gains keyboard skip/save. Our AI triage sits beside it.
  - The triage prompt must point at the checkout's `modes/triage.md` (fixed in the merge).
  - JobSpy and the scheduled-scan filters are unchanged.
- **Evaluate.**
  - The worker is now told the absolute path of the evaluation mode.
  - Reports end with the Machine Summary. The web's own readers were updated by main.
  - Our saved-JD fallback and `/flows` model choice still wrap the same `buildPrompt` call.
- **Track.**
  - Main's saved views, kept place, and "PDF ready means a file exists" apply.
  - Our contacts and status-history sections render under the report as before.
- **Prepare.**
  - PDF generation now runs its scripts from the checkout.
  - The CV editor can import a PDF or TeX file.
  - Our LaTeX CV and email draft run their scripts from the checkout (fixed in the merge).
  - "Generate" appears when the tracker claims a CV that has no file.
- **Apply.**
  - ApplyButton's `pdfReady` now means a file is on disk, so a tracker ✅ with no file won't let Apply attach a missing CV.
  - Fill in Chrome and Open posting are unchanged.
- **Follow up.**
  - The most-overdue follow-up is listed first, and search lives in the URL.
  - Stale-tab cadence saves are refused.
  - Our one-click "Done today" uses the same log write path.

---

## 5. Benefits worth adopting or wiring into the UI

1. **Code-root split.** Adopted. All our new script runs now go through it, which makes feature-ui work with a `.career-ops-data` / `CAREER_OPS_ROOT` data directory.
2. **Saved pipeline views.** Worth a "Triage PASS" or score-floor preset.
3. **CV import from PDF/TeX.** This pairs with our LaTeX CV flow. A follow-up could offer "use this .tex as the LaTeX base".
4. **`privacy-status.mjs` / privacy guard.** Could be surfaced on Config. API evaluators only.
5. **`sponsor-check.mjs`.** Could become a Track/Evaluate action for UK roles.
6. **Requisition-ID dedup.** Free win for JobSpy rows that carry a job ID.
7. **`check-liveness` Built In banner.** Improves Open posting / evaluate liveness.
8. **Batch `--mode match`.** A cheaper single-pass option the `/flows` page could expose.

---

## 6. Overrides

**Where we keep feature-ui over main**
- `route.ts` kind dispatch (`latex-cv`, `email-draft`, `chrome-fill`, `triage`), `/flows` CLI and model selection, interactive runs, and the saved-JD note. Main has no equivalent, so these sit on top of main's code.
- `web/AGENTS.md` rules 3 and 4. These document our `chrome-fill` exception and the tag-envelope rule. Main's change to the same file was elsewhere.
- `next.config.mjs` `ONLINE` block. Main has no hosted mode. It's kept alongside main's keys.

**Where we take main and drop ours**
- Every `careerOpsRoot()` → `codeRoot` change in `route.ts`, and the `pdfReadyForReport` → `pdfFileReady` / `trackerMarkedPdf` split. These are system-layer fixes, and our code adapts to them.
- `package-lock.json`: main's lock is the base, with `mongodb` re-added through `npm install` rather than a hand merge.
- Main's `useListSearch` search state in `followups-view.tsx`. Ours had no search changes; only `quickLog` is ported on top.

---

## 7. Do / don't

**Do**
- Resolve scripts, system modes and templates with `resolveCodeRoot()`. Keep `careerOpsRoot()` for user data only.
- Pass `codeRoot` to anything that tells an agent where a system file is.
- Rebase feature-ui work onto main regularly. 99 commits in a few days is the normal pace.
- Keep our new kinds listed in `worker-capabilities` / `claude-invocation`, and keep their tests.

**Don't**
- Join `.mjs`, `templates`, `lib` or system `modes/` paths onto `careerOpsRoot()`. `core-checkout-root.test.mjs` will fail.
- Treat the tracker's ✅ as "the file exists". Use `pdfFileReady`.
- Hand-merge `package-lock.json`.
- Push to `main` or `feature-ui` directly.

---

## Resolutions (merge of `origin/feature-ui`)

### Textual conflicts

| File | Resolution |
|---|---|
| `web/README.md` | Kept main's CV "Upload PDF / TeX" sentence, then our LaTeX CV / Draft email / Fill in Chrome / Flows bullets after it. |
| `web/package-lock.json` | Took main's lock as-is, then ran `npm install` in `web/` so npm folded in `mongodb` from `package.json`. Not hand-merged. `package.json` (auto-merged) has both `pdfjs-dist` and `mongodb`. |
| `web/src/app/api/run/route.ts` | Kept main's `resolveCvTemplate(codeRoot)` and our saved-JD note / kind ternary chain. Main's `codeRoot` argument to `buildPrompt(...)` survives at the end of the chain. All of main's other `codeRoot` / `coreRoot` hunks (the `needsScript` check, evaluation mode files, PDF render) auto-merged and were kept. Our `needsScript` entries (`generate-latex.mjs`, `save-draft.py`, `modes/triage.md`) are now checked against the code root, which is where they live. |
| `web/src/app/pipeline/[id]/page.tsx` | Union of the imports. `pdfReadyForReport` was dropped, replaced by main's `pdfPathStatusForReport` + `tailoredCvOnDisk`. Main's `pdfFileReady` / `trackerMarkedPdf` computation comes first, then our contacts and status-history block. Both prop sets are passed to `ReportView`. |
| `web/src/components/followups/followups-view.tsx` | Main's `useListSearch` / `list-search-sync` / `followupsSummarySlot` imports plus our `Check` icon and `followup-log.mjs` import. The body auto-merged: main's search plumbing plus our `quickLog` / "Done today". |

### Auto-merged, checked by eye
- **`web/next.config.mjs`:** main's `agentRules: false` and `serverExternalPackages` sit beside our `ONLINE` tracing block.
- **`web/AGENTS.md`:** main's short "Next.js version" section plus our rules 3 and 4.
- **`report-view.tsx`:**
  - `ExternalLink` is still imported.
  - Our buttons, Open posting and the Track section sit on main's `BackLink` and the split PDF props.
  - `pdfReady` now means "file on disk", main's meaning. We adopted it for ApplyButton.
- **`inbox-triage.tsx` / `triage-row.tsx`:** main's keyboard cursor and undo plus our AI-triage state and badge. No duplicate names; `tsc` is clean.
- **`jobs/[id]/page.tsx`:** main's `BackLink` plus our `<JobReply>`.

### Adaptations to main's APIs (merge-caused fixes)
1. **Code-root split (#4430) for our new kinds.**
   - `persistLatexCv` takes `coreRoot` and runs `generate-latex.mjs` / `mark-pdf-ready.mjs` from the checkout, with absolute paths.
   - `saveGmailDraft` takes `coreRoot` and runs `save-draft.py` from the checkout.
   - `buildTriagePrompt` takes `codeRoot` and names `modes/triage.md` by absolute checkout path. `modes/_brief.md` stays relative, because it's user layer.
   - The route and `/api/email-draft` pass `resolveCodeRoot(process.cwd(), process.env)`.
   - Single-root installs behave exactly as before.
   - Pinned by the new `web/tests/lib/feature-kinds-code-root.test.mjs` and a new case in `triage-batch.test.mjs`.
2. **WCAG AA status contrast (#6078).** Main's `status-tone-contrast.test.mjs` flagged our chips and status text. Following main's own fix pattern, `text-{emerald,amber}-700` became `-800` and `text-red-600` became `text-red-700 dark:text-red-400`. Files: `queue/page.tsx`, `application-track.tsx`, `flows-editor.tsx`, `followups-view.tsx`, `triage-row.tsx`, `latex-email-buttons.tsx`.

### Not changed
- No feature-ui feature was reverted.
- No main system-layer behaviour was reverted.

---

## Verification

These were run on the merged tree with root deps installed (`npm install --no-package-lock`, since the root has no lockfile).

| Check | `origin/main` | `origin/feature-ui` | merged |
|---|---|---|---|
| `web`: `npm ci` | ok | ok | ok |
| `web`: `npm test` | 2121 pass / 0 fail | 2015 pass / 0 fail | **2168 pass / 0 fail** |
| `web`: `npx tsc --noEmit` | ok | ok | ok |
| `web`: `npm run build` | ok | ok | ok |
| root `node test-all.mjs` | 1 fail | 3 fail | **3 fail**, the same 3 as feature-ui |

The before-merge web counts were 0 failures only once the root deps were installed. Without them, tests that import root modules fail on `js-yaml`.

**Root failures, none caused by the merge**
1. `archive-posting egress guard blocked a legitimate request`
   - Fails on main as well.
   - This sandbox's network proxy blocks the request.
   - Not fixed, per the brief.
2. `SYSTEM_PATHS coverage gap`
   - Fails on feature-ui already.
   - `INDIA.md`, `local/jobspy_parser.py` and `save-draft.py` aren't registered in `lib/update-manifest.mjs`.
   - Needs a layer decision; see the PR.
3. `tests/help-flag-handled.test.mjs`
   - Fails on feature-ui already.
   - `web/scripts/mongo-worker.mjs` ignores `--help`, so the flag falls through and the script runs instead.

A first root run while the merge was still uncommitted, with the baselines running at the same time, also failed `pipeline-lock`, the update-rollback suite and `verify-portals-help-flag`. A clean re-run passed all three, so they were artefacts of the dirty git state and the load.
