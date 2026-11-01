/**
 * tag-envelope.mjs — `<<tag>> … <</tag>>` output channel for worker kinds whose
 * agent holds no write tool (latex-cv, email-draft). Same contract as
 * report-envelope.mjs, with the tag as a parameter: markers count only on a line
 * of their own, exactly one opener and one closer, anything else is refused.
 */

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Prompt text describing the envelope. Markers are written mid-line (see report-envelope.mjs). */
export function tagEnvelopeInstruction(tag, what) {
  return `Do NOT save or edit any file; the platform persists your output. OUTPUT ${what} inline, between two marker lines: a line containing only \`<<${tag}>>\`, then the complete content, then a line containing only \`<</${tag}>>\`. Each marker appears exactly once. Emit the WHOLE content, never abbreviated.`;
}

/**
 * @param {string} text - everything the agent emitted
 * @param {string} tag
 * @returns {{ok: true, body: string} | {ok: false, error: string}}
 */
export function parseTagEnvelope(text, tag) {
  if (typeof text !== "string") return { ok: false, error: `No agent output to read a <<${tag}>> envelope from.` };
  const normalized = text.replace(/\r\n/g, "\n");
  const openers = [...normalized.matchAll(new RegExp(`^<<${esc(tag)}>>[ \\t]*$`, "gm"))];
  if (openers.length !== 1) {
    return { ok: false, error: openers.length ? `Found ${openers.length} <<${tag}>> envelopes; refusing to guess.` : `The agent emitted no <<${tag}>> envelope.` };
  }
  const after = normalized.slice(openers[0].index + openers[0][0].length);
  const closers = [...after.matchAll(new RegExp(`^<<\\/${esc(tag)}>>[ \\t]*$`, "gm"))];
  if (closers.length !== 1) {
    return { ok: false, error: closers.length ? `Found ${closers.length} <<${tag}>> closers; refusing to guess.` : `The <<${tag}>> envelope was never closed — output is incomplete.` };
  }
  const body = after.slice(0, closers[0].index).replace(/^\n/, "").replace(/\n$/, "");
  if (!body.trim()) return { ok: false, error: `The <<${tag}>> envelope was empty.` };
  return { ok: true, body };
}

/**
 * Streaming filter: keeps every byte for parsing, hides the envelope body from the
 * run log. ponytail: holds back whole lines while inside the body instead of the
 * byte-level marker lookahead report-envelope.mjs does; fine for line-oriented output.
 */
export function createTagEnvelopeFilter(tag) {
  const open = `<<${tag}>>`;
  const close = `<</${tag}>>`;
  let raw = "";
  let pending = "";
  let inBody = false;
  return {
    push(chunk) {
      const text = String(chunk ?? "");
      raw += text;
      pending += text.replace(/\r\n/g, "\n");
      let display = "";
      let nl;
      while ((nl = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, nl + 1);
        pending = pending.slice(nl + 1);
        const bare = line.trim();
        if (!inBody && bare === open) inBody = true;
        else if (inBody && bare === close) inBody = false;
        else if (!inBody) display += line;
      }
      return display;
    },
    flush() {
      const held = inBody ? "" : pending;
      pending = "";
      return held;
    },
    result() {
      return parseTagEnvelope(raw, tag);
    },
    /** Everything the agent emitted, envelope included. */
    raw() {
      return raw;
    },
  };
}
