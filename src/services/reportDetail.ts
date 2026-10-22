// ──────────────────────────────────────────
// GhostRank — Report Detail Helpers
// ──────────────────────────────────────────
// Per-prompt detail for reports, computed from saved ScanResult rows
// only (no AI calls). Kept free of database imports so it is easy to test.

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

/** Trims the response and cuts it to ANSWER_EXCERPT_MAX characters, "..." included, at a word boundary. */
export function makeExcerpt(response: string): string {
  const text = response.trim()
  if (text.length <= ANSWER_EXCERPT_MAX) return text
  const limit = ANSWER_EXCERPT_MAX - 3
  let cut = text.slice(0, limit)
  // If the cut lands inside a word, back up to the last whitespace before it.
  if (!/\s/.test(text[limit])) {
    const lastSpace = cut.search(/\s\S*$/)
    if (lastSpace > 0) cut = cut.slice(0, lastSpace)
  }
  return cut.trimEnd() + "..."
}

/** Last words that mark a topic heading rather than a business name. */
const GENERIC_LAST_WORDS = new Set([
  "disease", "diseases", "medicine", "care", "services", "service",
  "treatment", "treatments", "specialties", "specialty", "conditions",
  "disorders", "options", "tips", "benefits",
])

/** Words that open a heading like "Top options" or "Best Hospitals" rather than a name. */
const HEADING_FIRST_WORDS = new Set([
  "top", "best", "popular", "leading", "recommended", "other", "here",
  "some", "these", "following", "common",
])

const NAME_SEPARATOR = / — | – | - |:|\(/

/**
 * Other business names found in the saved response. Only line-leading names
 * are kept (list items, or paragraphs that start with a name followed by a
 * dash, colon or bracket).
 */
export function findCompetitors(response: string, businessName: string): string[] {
  const own = businessName.trim().toLowerCase()
  const seen = new Set<string>()
  const results: string[] = []

  for (const rawLine of response.split(/\r?\n/)) {
    if (results.length >= MAX_COMPETITORS) break

    let line = rawLine.trim()
    let prev: string
    do {
      prev = line
      line = line.replace(/^(?:\d+[.)]|[-*#]+)\s*/, "")
    } while (line !== prev)
    line = line.replace(/[*_]/g, "")

    // A line that itself ends with ":" is a heading ("Best Hospitals:"), not a name.
    if (line.trimEnd().endsWith(":")) continue

    const sep = line.search(NAME_SEPARATOR)
    const name = (sep === -1 ? line : line.slice(0, sep)).trim()

    const words = name.split(/\s+/)
    // Heading rule: exactly 2 words starting with a heading word ("Top options")
    // is dropped; 3+ words ("Popular Diagnostic Centre") is treated as a real name.
    if (words.length === 2 && HEADING_FIRST_WORDS.has(words[0].toLowerCase())) continue
    if (words.length < 2 || words.length > 6) continue
    if (name.length > 60) continue
    if (!/^[A-Z0-9]/.test(name)) continue
    if (name.endsWith(".")) continue
    // Removes sentence fragments ("For very advanced treatment, such"): a comma, or a
    // last word that isn't capitalised. Connectors (of, and, de, la, &) are fine
    // mid-name but never as the last word, so only the last word is checked.
    if (name.includes(",") || !/^[A-Z0-9]/.test(words[words.length - 1])) continue

    const key = name.toLowerCase()
    // The client itself: exact match, or the full name followed by a space.
    if (own && (key === own || key.startsWith(own + " "))) continue
    if (GENERIC_LAST_WORDS.has(words[words.length - 1].toLowerCase())) continue
    if (seen.has(key)) continue

    seen.add(key)
    results.push(name)
  }

  return results
}

// ──────────────────────────────────────────
// Aggregates for the report overview (also computed from saved results only)
// ──────────────────────────────────────────

export interface ScoreBreakdown {
  mentionRate: { earned: number; max: number }
  position: { earned: number; max: number }
  coverage: { earned: number; max: number }
  sentiment: { earned: number; max: number }
}

/**
 * Rounds the four unrounded score parts to whole points that add up to
 * exactly Math.round(sum of parts) — the same rounding computeScore uses
 * for the overall score. Largest-remainder rounding: every part is floored,
 * then the leftover points go to the parts with the biggest fractions.
 */
export function buildScoreBreakdown(
  parts: { mentionRate: number; positionQuality: number; platformCoverage: number; sentimentBonus: number },
  weights: { mentionRate: number; positionQuality: number; platformCoverage: number; sentimentBonus: number }
): ScoreBreakdown {
  const raw = [parts.mentionRate, parts.positionQuality, parts.platformCoverage, parts.sentimentBonus]
  const target = Math.round(raw.reduce((a, b) => a + b, 0))
  const earned = raw.map(Math.floor)
  let leftover = target - earned.reduce((a, b) => a + b, 0)
  const byFraction = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of byFraction) {
    if (leftover <= 0) break
    earned[i] += 1
    leftover -= 1
  }
  return {
    mentionRate: { earned: earned[0], max: weights.mentionRate },
    position: { earned: earned[1], max: weights.positionQuality },
    coverage: { earned: earned[2], max: weights.platformCoverage },
    sentiment: { earned: earned[3], max: weights.sentimentBonus },
  }
}

export type PromptTypeStats = Record<FixCategory, { total: number; mentioned: number }>

/** Prompts sent and prompts that mentioned the business, per prompt type. Unknown categories are ignored. */
export function countByPromptType(results: { category: string; mentioned: boolean }[]): PromptTypeStats {
  const stats = {} as PromptTypeStats
  for (const c of CATEGORIES) stats[c] = { total: 0, mentioned: 0 }
  for (const r of results) {
    const bucket = (stats as Record<string, { total: number; mentioned: number } | undefined>)[r.category]
    if (!bucket) continue
    bucket.total += 1
    if (r.mentioned) bucket.mentioned += 1
  }
  return stats
}

/** Max competitors in the report summary. */
export const TOP_COMPETITORS = 5

const LEGAL_SUFFIX = /(?:[\s,]*\(pvt\.?\)\s*ltd\.?|[\s,]+(?:ltd|limited|inc|co|pvt)\.?)$/i

/** Merge key: lower-cased, trailing legal suffixes removed. */
function competitorKey(name: string): string {
  let key = name.trim()
  for (;;) {
    const next = key.replace(LEGAL_SUFFIX, "").trim()
    if (next === key || next === "") break
    key = next
  }
  return key.toLowerCase()
}

/**
 * Most frequent competitor names across all results (each result's list is
 * already cleaned by findCompetitors). Names that differ only by case or a
 * trailing legal suffix (Ltd, Limited, Inc, Co, Pvt) are merged, and counted
 * once per result. The shown name is the most frequent variant (shortest on
 * a tie); ties in count sort alphabetically so the output is stable.
 */
export function topCompetitors(
  lists: string[][]
): { name: string; mentions: number }[] {
  const groups = new Map<string, { mentions: number; variants: Map<string, number> }>()
  for (const list of lists) {
    const seen = new Set<string>()
    for (const name of list) {
      const key = competitorKey(name)
      if (seen.has(key)) continue
      seen.add(key)
      let group = groups.get(key)
      if (!group) groups.set(key, (group = { mentions: 0, variants: new Map() }))
      group.mentions += 1
      group.variants.set(name, (group.variants.get(name) ?? 0) + 1)
    }
  }
  return [...groups.values()]
    .map((g) => {
      const [name] = [...g.variants.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0])
      )[0]
      return { name, mentions: g.mentions }
    })
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name))
    .slice(0, TOP_COMPETITORS)
}

/** Max items in topFixes. */
export const TOP_FIXES = 3

/**
 * Picks the recommendations that close the biggest gap: ranked by how many
 * prompts missed the business that the recommendation addresses (most
 * first); ties keep the original recommendation order. Recommendations that
 * address no missed prompts are left out.
 */
export function rankTopFixes(
  items: { recommendation: string; missedPrompts: number }[]
): { recommendation: string; missedPrompts: number }[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.missedPrompts > 0)
    .sort((a, b) => b.item.missedPrompts - a.item.missedPrompts || a.index - b.index)
    .slice(0, TOP_FIXES)
    .map(({ item }) => item)
}
