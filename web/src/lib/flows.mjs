/**
 * flows.mjs — which AI tool, model and effort runs each task (/flows page).
 *
 * The user's choices live in config/flows.yml (user layer, never auto-updated):
 *
 *   tasks:
 *     evaluate: { cli: claude, model: sonnet, effort: high }
 *     research: { cli: antigravity, model: gemini-3.8-flash-high }
 *
 * A task missing from the file uses its DEFAULT below. `cli: default` means the
 * CLI the app picked for the run (the old behaviour). Model and effort flags are
 * passed only to CLIs known to take them (claude, antigravity); others ignore them.
 */
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

/** CLIs that accept `--model` and `--effort`, with the models offered in the picker. */
export const MODEL_CLIS = {
  claude: ["haiku", "sonnet", "opus"],
  antigravity: ["gemini-3.8-flash-high", "gemini-3.8-flash-medium", "gemini-3.8-flash-low", "claude-sonnet-4-6", "claude-opus-4-6-thinking"],
};

/**
 * Every task the app runs, grouped by flow. `lockCli` pins a task whose tooling
 * exists on one CLI only; `warn` is shown when the user moves it off Claude.
 * @type {{id: string, name: string, tasks: {kind: string, name: string, does: string, default: {cli: string, model?: string, effort?: string}, lockCli?: string, lockReason?: string, warn?: string}[]}[]}
 */
export const FLOWS = [
  {
    id: "find",
    name: "Find jobs",
    tasks: [
      { kind: "fix-portal", name: "Fix a broken portal", does: "Finds the new careers URL for a company whose board stopped answering.", default: { cli: "default", model: "sonnet", effort: "medium" } },
    ],
  },
  {
    id: "evaluate",
    name: "Evaluate",
    tasks: [
      { kind: "evaluate", name: "Full evaluation", does: "Scores the role A-G against your CV and writes the report.", default: { cli: "default", model: "sonnet", effort: "high" } },
    ],
  },
  {
    id: "research",
    name: "Research",
    tasks: [
      { kind: "research", name: "Company research", does: "Reads about the company: product, engineering, recent news.", default: { cli: "default", model: "sonnet", effort: "medium" } },
    ],
  },
  {
    id: "prepare",
    name: "Prepare",
    tasks: [
      { kind: "pdf", name: "Tailored CV (HTML/PDF)", does: "Rewrites your CV for the role from cv.md, never inventing.", default: { cli: "default", model: "opus", effort: "high" }, warn: "A person reads this. Non-Claude models are less tested against the no-invention rule." },
      { kind: "latex-cv", name: "LaTeX CV", does: "Tailors your own resume.tex, fact-checked and kept to one page.", default: { cli: "default", model: "opus", effort: "high" }, warn: "A person reads this. Non-Claude models are less tested against the no-invention rule." },
      { kind: "cover", name: "Cover letter", does: "Writes a cover letter from the report and your CV.", default: { cli: "default", model: "opus", effort: "high" }, warn: "A person reads this. Non-Claude models are less tested against the no-invention rule." },
      { kind: "email-draft", name: "Application email", does: "Drafts an HR or referral email; you save it to Gmail Drafts.", default: { cli: "default", model: "opus", effort: "high" }, warn: "A person reads this. Non-Claude models are less tested against the no-invention rule." },
    ],
  },
  {
    id: "apply",
    name: "Apply",
    tasks: [
      { kind: "chrome-fill", name: "Fill in Chrome", does: "Fills the form in your logged-in Chrome and asks you when stuck. Never submits.", default: { cli: "claude", model: "sonnet", effort: "medium" }, lockCli: "claude", lockReason: "Uses the Claude in Chrome extension, which only Claude can drive." },
    ],
  },
];

const TASKS = new Map(FLOWS.flatMap((f) => f.tasks.map((t) => [t.kind, t])));
export const taskFor = (kind) => TASKS.get(kind) ?? null;

export const flowsPath = (root) => path.join(root, "config", "flows.yml");

/** The user's saved choices. A missing file is no choices; a broken one throws. */
export function readFlowSettings(root) {
  let text;
  try {
    text = fs.readFileSync(flowsPath(root), "utf8");
  } catch (e) {
    if (/** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") return {};
    throw e;
  }
  const doc = /** @type {any} */ (yaml.load(text));
  return doc && typeof doc.tasks === "object" && doc.tasks ? doc.tasks : {};
}

/**
 * Validate one task's choice. Unknown values are dropped so they fall back to the default.
 * @returns {{cli: string, model?: string, effort?: string}}
 */
export function cleanChoice(kind, raw) {
  const task = taskFor(kind);
  const base = task?.default ?? { cli: "default" };
  const r = raw && typeof raw === "object" ? raw : {};
  const cli = task?.lockCli ?? (typeof r.cli === "string" && /^[a-z][a-z0-9-]{0,30}$/.test(r.cli) ? r.cli : base.cli);
  const models = MODEL_CLIS[cli === "default" ? "claude" : cli];
  const model = models && typeof r.model === "string" && models.includes(r.model) ? r.model : models?.includes(base.model ?? "") ? base.model : undefined;
  const effort = EFFORTS.includes(r.effort) ? r.effort : base.effort;
  return { cli, ...(model ? { model } : {}), ...(effort && models ? { effort } : {}) };
}

/** Resolved choice for a kind: the saved one, else the default. */
export function choiceFor(root, kind) {
  return cleanChoice(kind, readFlowSettings(root)[kind]);
}

/** Save all tasks' choices (only known kinds, each cleaned). */
export function writeFlowSettings(root, tasks) {
  const out = {};
  for (const [kind, raw] of Object.entries(tasks ?? {})) if (taskFor(kind)) out[kind] = cleanChoice(kind, raw);
  fs.mkdirSync(path.dirname(flowsPath(root)), { recursive: true });
  const header = "# Which AI tool, model and effort runs each task. Edited from /flows in the web app.\n";
  fs.writeFileSync(flowsPath(root), header + yaml.dump({ tasks: out }, { lineWidth: 120 }));
  return out;
}

/**
 * `--model` / `--effort` for the CLI that actually runs. `default` model choices
 * were made for Claude, so they apply when the app's CLI is Claude.
 * @param {string} cliId the running CLI
 * @param {{model?: string, effort?: string}} choice
 */
export function modelArgs(cliId, choice) {
  const models = MODEL_CLIS[cliId];
  if (!models) return [];
  return [
    ...(choice.model && models.includes(choice.model) ? ["--model", choice.model] : []),
    ...(choice.effort ? ["--effort", choice.effort] : []),
  ];
}
