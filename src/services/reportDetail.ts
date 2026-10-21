// ──────────────────────────────────────────
// GhostRank — Report Detail Helpers
// ──────────────────────────────────────────
// Per-prompt detail for reports, computed from saved ScanResult rows
// only (no AI calls). Kept free of database imports so it is easy to test.

import { extractAlternatives } from "../scanner/detector"

export type ResultIssue = "not_mentioned" | "low_position" | "negative" | "ok"

/** Mentioned at this position or lower (4, 5, ...) counts as "low_position". */
export const LOW_POSITION_THRESHOLD = 4

/** Max characters of the saved response included in a report. */
export const ANSWER_EXCERPT_MAX = 600

/** Max competitor names listed per prompt. */
export const MAX_COMPETITORS = 5

/**
 * Fix suggestions — edit the wording here.
 * General guidance only; none of these promise a result.
 */
const FIX_SUGGESTIONS = {
  not_mentioned: {
    direct:
      "AI doesn't recognise the business by name. Make sure the name, address and phone are identical across the website, Google Business Profile and directories, and add a clear 'About' page describing what the business does and where.",
    comparison:
      "The business isn't part of the comparison. Consider publishing pages that compare it with alternatives and list its strengths, and get it listed on review and comparison sites that AI tools tend to cite.",
    discovery:
      "The business isn't surfaced for general searches. Consider building out local directory listings and content that answers the questions customers ask when looking for this kind of service.",
    specific:
      "The business isn't linked to this specific need. Consider adding a dedicated page for this service or topic, with clear details, and mention it in other places the business is listed.",
  },
  low_position: {
    direct:
      "The business is named but appears late. Strengthen the main website and profile pages with a clear description, and keep listings consistent so it is easier to present first.",
    comparison:
      "The business is mentioned but ranks below others. Consider highlighting what sets it apart on its site and gathering more reviews on third-party platforms.",
    discovery:
      "The business appears but not near the top. Consider more local listings, authoritative mentions and helpful content to build its authority for general searches.",
    specific:
      "The business appears but not prominently for this need. Consider expanding the dedicated page for this service with more detail, examples and customer feedback.",
  },
  negative:
    "The business is mentioned in a negative light. Review the customer feedback behind this, respond to reviews professionally, and work on improving the experience and reputation people read about online.",
} as const

const CATEGORIES = ["direct", "comparison", "discovery", "specific"] as const
type FixCategory = (typeof CATEGORIES)[number]

/** Unknown categories fall back to "discovery" wording. */
function toFixCategory(category: string): FixCategory {
  return (CATEGORIES as readonly string[]).includes(category)
    ? (category as FixCategory)
    : "discovery"
}

/**
 * Classifies one result. Order matters: a mention with negative sentiment
 * is "negative" even when it is also at a low position.
 */
export function classifyIssue(r: {
  mentioned: boolean
  position: number | null
  sentiment: string | null
}): ResultIssue {
  if (!r.mentioned) return "not_mentioned"
  if (r.sentiment === "negative") return "negative"
  if (r.position !== null && r.position >= LOW_POSITION_THRESHOLD) return "low_position"
  return "ok"
}

/** Picks the suggestion for (category, issue); null when nothing needs fixing. */
export function getFix(category: string, issue: ResultIssue): string | null {
  if (issue === "ok") return null
  if (issue === "negative") return FIX_SUGGESTIONS.negative
  return FIX_SUGGESTIONS[issue][toFixCategory(category)]
}

/** Trims the response and cuts it to ANSWER_EXCERPT_MAX characters, "..." included. */
export function makeExcerpt(response: string): string {
  const text = response.trim()
  if (text.length <= ANSWER_EXCERPT_MAX) return text
  return text.slice(0, ANSWER_EXCERPT_MAX - 3).trimEnd() + "..."
}

/** Other business names found in the saved response (best-effort heuristic). */
export function findCompetitors(response: string, businessName: string): string[] {
  return extractAlternatives(response, businessName, MAX_COMPETITORS)
}
