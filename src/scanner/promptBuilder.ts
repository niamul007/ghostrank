// ──────────────────────────────────────────
// GhostRank — Prompt Builder
// ──────────────────────────────────────────
// Generates natural-sounding prompts that simulate how
// real customers search for businesses in AI platforms.
//
// Why multiple categories?
// A dentist might show up when someone asks "best dentist in Miami"
// but NOT when they ask "who should I see for teeth whitening in Miami?"
// Each category tests a different search behavior.

import type { BuiltPrompt, Platform, PromptCategory, ScanJobPayload } from "../types"

/**
 * Prompt templates organized by category.
 * {business} = niche (e.g. "dentist")
 * {location} = city/area (e.g. "Miami, FL")
 * {name}     = business name (e.g. "Smile Dental Clinic")
 *
 * Why these specific templates?
 * They mirror real queries people type into ChatGPT/Perplexity.
 * We tested common patterns: "best X in Y", "recommend a X",
 * "top rated X near Y", "compare X in Y".
 */
const PROMPT_TEMPLATES: Record<PromptCategory, string[]> = {
  direct: [
    "What is the best {business} in {location}?",
    "Top rated {business} in {location}",
    "Recommend a good {business} in {location}",
    "Best {business} near {location}",
  ],
  comparison: [
    "Compare the top {business} options in {location}",
    "What are the best {business} companies in {location} and how do they compare?",
    "List the top 5 {business} providers in {location} with pros and cons",
  ],
  discovery: [
    "I need a {business} in {location}, who should I go to?",
    "I'm looking for a reliable {business} in {location}, any suggestions?",
    "Can you help me find a trustworthy {business} in {location}?",
  ],
  specific: [
    "Is {name} a good {business} in {location}?",
    "What do people say about {name} in {location}?",
    "Have you heard of {name}? Are they a good {business}?",
  ],
}

/** All three platforms we scan against */
const PLATFORMS: Platform[] = ["chatgpt", "perplexity", "gemini"]

/**
 * Replaces template placeholders with actual business info.
 *
 * Example:
 * template: "Best {business} in {location}"
 * payload:  { niche: "dentist", location: "Miami, FL", businessName: "Smile Dental" }
 * result:   "Best dentist in Miami, FL"
 */
function fillTemplate(
  template: string,
  payload: ScanJobPayload
): string {
  return template
    .replace(/{business}/g, payload.niche)
    .replace(/{location}/g, payload.location)
    .replace(/{name}/g, payload.businessName)
}

/**
 * Picks a random subset of items from an array.
 * We don't send ALL templates — that would be expensive.
 * Instead we pick a diverse sample from each category.
 *
 * Why random?
 * If we always pick the same prompts, we test the same angles.
 * Randomizing gives better coverage over time (across monthly scans).
 */
function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Builds the full set of prompts for a scan.
 *
 * Strategy:
 * - Pick 2 prompts from "direct" (most important — this is how most people search)
 * - Pick 1 from "comparison"
 * - Pick 1 from "discovery"
 * - Pick 1 from "specific" (uses the actual business name)
 * - Send each prompt to all 3 platforms
 * - Total: 5 prompts × 3 platforms = 15 API calls per scan
 *
 * Why 15?
 * Enough data points to be statistically meaningful.
 * Not so many that API costs explode.
 * At ~$0.001 per gpt-4o-mini call, 15 calls ≈ $0.015 per scan.
 */
export function buildPrompts(payload: ScanJobPayload): BuiltPrompt[] {
  const prompts: BuiltPrompt[] = []

  /** How many prompts to pick from each category */
  const picks: Record<PromptCategory, number> = {
    direct: 2,
    comparison: 1,
    discovery: 1,
    specific: 1,
  }

  for (const [category, count] of Object.entries(picks)) {
    const templates = PROMPT_TEMPLATES[category as PromptCategory]
    const selected = pickRandom(templates, count)

    for (const template of selected) {
      const text = fillTemplate(template, payload)

      // Same prompt goes to all 3 platforms — so we can compare
      // how each AI responds to the exact same question
      for (const platform of PLATFORMS) {
        prompts.push({
          text,
          platform,
          category: category as PromptCategory,
        })
      }
    }
  }

  return prompts
}