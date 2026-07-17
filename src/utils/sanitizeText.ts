// ──────────────────────────────────────────
// GhostRank — Text Sanitization
// ──────────────────────────────────────────
// Strips markdown formatting and emoji artifacts from AI response text
// before it's stored or returned. AI_SYSTEM_PROMPT (see ../config/ai.config)
// already instructs every provider not to use markdown or emoji at all,
// but models don't always comply, and responses stored before that
// instruction existed still have it — this is a defensive cleanup pass,
// not a substitute for good prompting.

// Headers/list markers only make sense at the start of a line, so they're
// stripped before the emphasis markers below — otherwise a line like
// "- **Name**" could have its bullet dash swallowed by the bold regex.
const HEADER_RE = /^[ \t]*#{1,6}[ \t]+/gm
const NUMBERED_LIST_RE = /^[ \t]*\d+\.[ \t]+/gm
const BULLET_RE = /^[ \t]*[-*+][ \t]+/gm

// Real markdown emphasis requires no whitespace touching the inner text
// (so "3 * 4" or "well * done" are left alone) — \S at both edges of the
// captured group enforces that. Bold runs before italic so "**bold**"
// (two literal asterisks) is consumed first; a lone "*italic*" never
// contains "**" so the bold pass can't accidentally eat it.
const BOLD_RE = /\*\*(\S(?:[\s\S]*?\S)?)\*\*/g
const BOLD_UNDERSCORE_RE = /__(\S(?:[\s\S]*?\S)?)__/g
const ITALIC_RE = /\*(\S(?:[\s\S]*?\S)?)\*/g

// Common emoji/pictograph blocks, plus the variation-selector (U+FE0F)
// that often trails one (e.g. the two code points behind "⚠️").
const EMOJI_RE =
  /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/gu

/**
 * Strips markdown formatting (bold/italic, headers, bullets/numbered
 * lists), emoji, and irregular whitespace from AI response text.
 *
 * - `**bold**` / `__bold__` -> `bold`
 * - `*italic*` -> `italic`
 * - `# Header`, `## Header`, ... -> `Header`
 * - `- item`, `* item`, `+ item`, `1. item` (at line start) -> `item`
 * - emoji -> removed
 * - repeated blank lines -> a single blank line
 * - leading/trailing whitespace -> trimmed
 */
export function sanitizeText(input: string): string {
  if (!input) return input

  let text = input

  text = text.replace(HEADER_RE, "")
  text = text.replace(NUMBERED_LIST_RE, "")
  text = text.replace(BULLET_RE, "")

  text = text.replace(BOLD_RE, "$1")
  text = text.replace(BOLD_UNDERSCORE_RE, "$1")
  text = text.replace(ITALIC_RE, "$1")

  text = text.replace(EMOJI_RE, "")

  // Marker/emoji removal can leave doubled spaces, a leading space on a
  // line (emoji was first thing on the line), or trailing
  // spaces-before-newlines behind (e.g. "Section  Name", " Note:", "done \n").
  text = text.replace(/[ \t]{2,}/g, " ")
  text = text.replace(/^[ \t]+/gm, "")
  text = text.replace(/[ \t]+\n/g, "\n")

  // Multiple blank lines collapse to one.
  text = text.replace(/\n{3,}/g, "\n\n")

  return text.trim()
}
