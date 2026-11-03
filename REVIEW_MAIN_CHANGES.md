# Review: what `main` brings into `feature-ui`

- **Scope:** the 417 files in PR #3 whose content is identical to `origin/main`. Each was read as `git diff $(git merge-base origin/main origin/feature-ui) origin/main -- <file>`, with merge base `2622650`.
- **Order of reading:**
  1. root `*.mjs`;
  2. `lib/`, `modes/`, `batch/`, `templates/`, `config/`, `AGENTS.md` and `.agents/`;
  3. `web/src`;
  4. everything else.
- **Skimmed only:** tests, dashboard Go, and the plugin-directory folders.
- **Verdicts:**
  - `ok`: no invariant is touched.
  - `adapted`: our code was changed to fit.
  - `overridden`: our own layer replaces the upstream behaviour.
  - `proposal`: a change that would need an upstream edit or a decision from you.
- **Invariant numbers** follow the PR brief: 1 LaTeX-only CVs, 2 web app flows, 3 CLI on a plan with no API keys, 4 drafts only and nothing sent, 5 user layer untouched, 6 tracker CLIs and formats, 7 India-only targeting, 8 reports.

No upstream system file was edited in this review. Every change is in fork-owned web code (`web/src/lib/latex-cv.mjs`, `web/src/lib/triage-view.mjs`, `web/scripts/mongo-worker.mjs`, plus tests) or in web files this fork already modifies (`web/src/app/pipeline/[id]/page.tsx`, `web/src/components/report-view.tsx`, `web/src/components/inbox/inbox-triage.tsx`). No `// fork:` edits to system files were needed. One `// fork:` comment marks the LaTeX block inside the fork-modified `page.tsx`.

## Not `ok`, and the CLI changes you asked to see

| File or group | Verdict | Inv. | Why |
|---|---|---|---|
| `web/src/components/generate-pdf-button.tsx`, `web/src/lib/tailored-cv-ready.mjs`, the `pdfFileReady` / `trackerMarkedPdf` split in `web/src/app/pipeline/[id]/page.tsx` (#6116) | overridden | 1 | A tracker ✅ no longer counts as a CV. Once a LaTeX CV is indexed, the button's "ready" state still offers two controls, the regenerate icon and "Review and customize" (CV Studio), and both run `generate-pdf.mjs`. That script replaces the report's `cv` row in `pdf-index.tsv` (checked in `updatePDFManifest` / `applyManifestRow`). The report page now finds the LaTeX CV and shows "View LaTeX CV" in place of those controls. It looks for the index row first, then the report's `**PDF:**` line. It also registers an unindexed one in the index. See `latexCvPath` in `web/src/lib/latex-cv.mjs`. |
| Same page: the message "…no file in output/. Choose Generate tailored CV." | overridden | 1 | The message now says "Choose LaTeX CV to build one". It is also never shown when a LaTeX CV exists. |
| Machine Summary moves to the last section (#6157). Files: `modes/oferta.md`, `batch/batch-prompt.md`, the 14 localized evaluation modes, `lib/machine-summary-section.mjs` and its web copy, plus every reader: `analyze-patterns`, `upskill`, `salary-gap`, `verify-pipeline`, `evaluation-cache`, `debrief-sync`, `web/src/lib/machine-summary.mjs`, `report-persist.mjs` and `analytics-data.ts` | adapted | 8 | The shared helper takes a summary heading that sits before `## Job Description`, which covers our 22 older reports. Failing that, it takes the last heading. That covers new reports. The new `web/tests/lib/machine-summary-layouts.test.mjs` runs one report in each layout through the web readers, `parseMachineSummary` and `keyword-match.mjs` `extractKeywords`. Each fixture also carries an injected summary inside its JD. The test also checks that the `**PDF:**` line still resolves to the LaTeX CV. `## Keywords extracted` and `**PDF:**` are still in the `oferta.md` template. |
| Saved pipeline views: `web/src/lib/pipeline-views.mjs` and `web/src/components/pipeline-view.tsx` (#6103) | adapted + proposal | 2 | A saved view stores only tab, search, score floor and sort, and the INBOX tab hides the search box. So a view cannot carry a triage verdict. Added a "Triage PASS" toggle in our inbox (`?triage=PASS`, also MARGINAL or FAIL) that reads `data/triage.json`. It survives a reload and can be bookmarked. **Proposal:** to make it a real saved view, add a `triage` field to `normalizeView` / `viewUpdates` and `triage` to `FILTER_KEYS` in `pipeline-navigation.mjs`. Without that, a Back link from a report drops `?triage=`. |
| `lib/update-manifest.mjs` (new `SYSTEM_PATHS`) and `validate-system-paths-coverage.mjs` | adapted (your action) | 5 | The coverage guard lists five tracked fork files that are in no manifest: `INDIA.md`, `local/jobspy_parser.py`, `save-draft.py`, `SYNC_ANALYSIS.md` and `REVIEW_MAIN_CHANGES.md`. They stay out of `update-manifest.mjs`. Put all five in the gitignored `config/local-paths.txt`. The guard passes with that file (checked in a sandbox; the file is not committed). |
| `web/src/app/documents/page.tsx` empty state ("choose Generate tailored CV (PDF)") and the `TAILORED_CV_MISSING` text from `/api/cv-pdf` | proposal | 1 | Both appear only when no CV for the report or install is indexed or matched. Opening a report now registers its LaTeX CV. Changing the copy would need an upstream edit, so it is left alone. |
| `tracker-sync-check.mjs` | ok (flag) | 6 | Dropped `--porcelain`, which was never implemented, and now rejects unknown flags. No caller in `web/`, `web/scripts` or `local/`. Check that `modes/_custom.md` does not use it. |
| `check-liveness.mjs`, `verify-pipeline.mjs`, `sync-batch-input.mjs`, `discard-analytics.mjs`, `intake.mjs`, `plugins.mjs` | ok (flag) | 6 | Each now rejects an unknown flag (exit 1) and reads `--flag=value`. `check-liveness` also accepts `--throttle N`. None of our code calls them with other flags. |
| `set-status.mjs` | ok (flag) | 6 | `14,78` as a selector now exits with usage and prints one `--row` command per number. `<n> <State> [--note] [--on]` is unchanged. |
| `followup-cadence.mjs` | ok (flag) | 2, 6 | Its JSON is sorted by pressure within each urgency band. It also resolves both `reports/…` and `../reports/…` links. The row format is unchanged, as is `followup-seed.mjs`. |
| `batch/batch-runner.sh --mode match`, `batch/batch-prompt-match.md` (#5404) | ok (do not use) | 7, 1 | This opt-in mode never sees the profile, so it scores without the India-only rule. It also writes no CV. The default `--mode full` is unchanged. |

## The rest, reviewed and `ok`

### Root scripts

| File or group | Inv. | Why `ok` |
|---|---|---|
| `scan.mjs` (country-code slot vs. US state) | 7 | US-state matchers apply only when `always_allow` holds a US country token. Probed with an India-only filter (`always_allow` India; `allow` India and Indian cities; `block` US) before and after the change. The 8 strings were "Bengaluru, Karnataka, IN", "Pune, IN", "Remote - India", "Hyderabad, Telangana, India" and "Bangalore · Austin, TX", which passed both times, and "Remote", "Austin, TX, US" and "Toronto, ON, CA", which were rejected both times. No difference. |
| `liveness-core.mjs` | 2 | One more hard-expired banner pattern, anchored on "sorry" so that a sibling listing's badge cannot match. |
| `verify-pipeline.mjs` | 6, 8 | Two changes. Different req IDs in notes stop a false duplicate warning. The summary-section reader is covered by the Machine Summary row above. |
| `tracker.mjs`, `tracker-utils.mjs` | 6 | The `query --company` match now ignores a legal suffix (Inc., Ltd). `userFileWriteTarget` is now exported. Neither changes a file format. |
| `contacts.mjs` | 6 | The vCard UID slug is now built from the normalized name. `data/contacts.tsv` is untouched (9 columns). A name with decomposed Unicode gets a new UID once. |
| `add-entry.mjs` | 5 | Takes a lock around the `cv.md` / `article-digest.md` write. Writes still need the user's confirmation. |
| `generate-pdf.mjs`, `lib/pdf-server.mjs`, `web/server.mjs` | 1 | HTML path only. When `--report` is missing, it infers the report number from the `cv-…-NNN-…` name. It also honours `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The web server starts a detached painter at launch. That painter starts Chromium only on the first render and exits after 30 idle minutes, so a LaTeX-only install pays one idle Node process. |
| `build-cv-latex.mjs`, `templates/cv-template.tex`, `lib/cv-payload-schema.mjs` | 1 | Paper size for the payload-to-LaTeX path. Our LaTeX CV is built from your own `resume.tex` by `generate-latex.mjs`, which is unchanged. |
| `build-cv-html.mjs` | 1 | Refuses to write output over its input. HTML path only. |
| API evaluators and privacy guard (`lib/privacy-guard.mjs`, `lib/llm-outbound.mjs`, `lib/pii-interceptor.mjs`, `utils/privacy-filter.mjs`, `privacy-status.mjs`, the `*-eval.mjs` / runner scripts, `batch-evaluate-gemini.mjs`, `scan-hn.mjs`, `config/privacy.example.yml`, `.env.example`) | 3 | Imported only by the API evaluators. Nothing in `web/` imports them, and `claude -p` / `agy -p` spawns never pass through them. |
| `jd-skill-gap.mjs`, `lib/cv-markdown.mjs` | none | Qualified requirement headings and Spanish headings. Additive. |
| `clean-markers.mjs` | none | Opt-in `--keep-script-joiners`. |
| `invite-match.mjs` | 6 | Reads argv only when it is the main module. This fixes `check-liveness --file`. |
| `evaluation-cache.mjs`, `debrief-sync.mjs`, `analyze-patterns.mjs`, `upskill.mjs`, `salary-gap.mjs` | 8 | Same summary-section reader; see above. |
| `doctor.mjs` | none | Reads plugins from the checkout, and plugin keys from the data root's `.env`. |
| `prepare-application.mjs` | 4 | Reads identity from the `candidate` block. It still only drafts. |
| `sponsor-check.mjs` (new) | 7 | A UK-only advisory cross-check. Not wired into the scanner. |
| `build-dashboard.mjs`, `weekly-digest.mjs`, `verify-cv-facts.mjs`, `test-all.mjs`, `package.json` | none | Messages, one regex exception, new self-test entries and one npm script. |

### `lib/`, `modes/`, `batch/`, `templates/`, `config/`, `AGENTS.md`, `.agents/`

| File or group | Inv. | Why `ok` |
|---|---|---|
| `modes/pdf.md` | 1 | Exit-narrative source, font text and keyword examples for the HTML CV. LaTeX tailoring follows `modes/_custom.md`. |
| `lib/update-manifest.mjs` | 5 | New system paths only. See the coverage row above. |
| `batch/README.md`, `batch/batch-prompt.md`, `batch/aggregate-tokens.mjs` | 8 | Machine Summary last. `formatK` is shared. |
| `templates/portals.example.yml` | 7 | Comments for new providers, plus two template company entries. Your `portals.yml` is not touched. |
| `config/profile.example.yml`, `config/plugins.example.yml` | 5 | Example files only. |
| `AGENTS.md`, `.agents/skills/career-ops/SKILL.md` | none | One new script row and a CV-template path. The router tells subagents about `PROJECT_ROOT` / `DATA_ROOT`. |

### `web/src`

| File or group | Inv. | Why `ok` |
|---|---|---|
| Code-root split (#4430): every `api/*/route.ts` `cwd`, `core-cli.ts`, `core/*.ts`, `pdf-render.mjs`, `report-persist.mjs`, `run-prompts.mjs`, `career-ops.ts` `readLanguageConfig` | 2 | Scripts and system modes resolve from the checkout, and user files from the data root. Our kinds were moved to `coreRoot` in the sync commit, and `feature-kinds-code-root.test.mjs` pins that. |
| `career-ops.ts` (`requestReportReader`, `readLinkedReport`, `linkedReportPaths`), `core/tracker-files.mjs`, `posting-url.mjs` | 6 | Report links are resolved the way the core resolves them. Unchanged for our `data/applications.md` with a URL column. |
| What's New: `whats-new-suppression.mjs`, `api/whats-new/route.ts`, `core/url-key.mjs`, `core/aggregator-id.ts`, `core/report-url-token.mjs` | 2 | A second requisition with the same title stays visible when the posting URLs prove two openings. |
| CV import: `api/cv/ingest/route.ts`, `cv/*`, `cv-editor.tsx`, `cv-ingest.tsx`, `pdfjs-dist` | 3, 5 | PDF and TeX text is extracted locally, then converted by your CLI. A save still needs a click. |
| Inbox keys and bulk skip: `inbox-keys.mjs`, `inbox-skip-client.mjs`, `inbox-score-target.mjs` | 2 | Already merged into our `inbox-triage.tsx`. The triage chips and "Shortlist N PASS" are kept. |
| Follow-ups: `api/followups/cadence/route.ts`, `cadence-settings.tsx`, `followups-summary-slot.mjs`, `followups.ts`, `home/follow-up-card.tsx` | 2 | Stale-tab guard and layout. "Done today" and the follow-up log are ours and unchanged. |
| Today and onboarding: `app/page.tsx`, `home/*`, `onboarding-*`, `setup-banner.mjs` | 2 | The queue leads once there is work. |
| Navigation: `back-link.tsx`, `history-back.mjs`, `list-search-sync.mjs`, `use-list-search.ts`, `pipeline/compare`, `pipeline/[id]/error.tsx` and `not-found.tsx` | 2 | List state survives Back. |
| Report rendering: `report-header.mjs`, `report-sections.mjs`, `report-envelope.mjs` | 8 | Reads CRLF reports. The envelope asks for the summary last. |
| `config-form.tsx` | 3 | Hides the unfinished "paste a key" and "no setup" modes. CLI mode stays. |
| `portals/page.tsx`, `portals-view.tsx`, `portals-setup.mjs`, `api/portals*`, `api/profile/route.ts` | 2 | Explains a missing `portals.yml`, and reads templates from the checkout. |
| `cv-studio/*` | 1 | HTML studio. Its keying is fixed upstream. It is no longer linked from a report that has a LaTeX CV. |
| `apply-view.tsx`, `apply-checklist.tsx`, `cover-draft-button.tsx`, `generate-pdf-button.tsx` (query-preserving links) | 1, 4 | Links and contrast only. The apply flow still stops before Submit. |
| Contrast-only edits (`*-700`→`-800`, `red-600`→`red-700`): badge, chips, analytics, explore, scheduled-scans, status-select, prep-pack, worker-card and others | none | WCAG AA. |
| `analytics-data.ts`, `analytics-view.tsx`, `tracker-empty.mjs`, `documents/page.tsx` heading | 2 | Analytics no longer reads a JD's `archetype:` line as the report's own. The other files are copy changes. |

### Everything else

| File or group | Inv. | Why `ok` |
|---|---|---|
| `providers/` (2 new board providers; fixes to 6: location labels, shared-URL locations, a page cap with retry, dates, a pipeline label) | 7 | Boards that showed a blank location now get one, so location filters see more postings. Multi-location rows are joined with ` · `, which the India `allow` list still matches. |
| `tests/` (75 files) | none | Skimmed. They cover the changes above, and the whole suite runs in `test-all`. |
| `dashboard/` (Go) | 1 | Width fit, control characters stripped, Hired sorted first, and `y` copies the CV path. CVs are read from `pdf-index.tsv`, so a registered LaTeX CV is found. |
| Plugin-directory packaging folders, `plugins-registry/`, the marketplace manifest | none | Distribution only. |
| `docs/`, READMEs, `HIRED.md`, `SIGNATURES.md`, `examples/`, `release-please-config.json`, `.github/` | none | Docs and CI. The `no-user-data` workflow adds one allowlisted batch prompt. |
| `.gitignore` | 5 | Adds the privacy config and token map. |

## Fork fixes made in this review

| Commit | What |
|---|---|
| `web: keep a report's LaTeX CV from being replaced by the HTML CV path` | `latexCvPath` plus registration on the report page; "View LaTeX CV" replaces the HTML CV controls. |
| `web: mongo-worker answers --help and refuses unknown flags` | `tests/help-flag-handled.test.mjs` passes. |
| `web: test that both Machine Summary layouts are still read` | Invariant 8 pinned. |
| `web: "Triage PASS" inbox view from data/triage.json` | `?triage=PASS` view. |
