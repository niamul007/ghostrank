// ──────────────────────────────────────────
// GhostRank — AI Platform Configuration
// ──────────────────────────────────────────
// Centralized config for all AI API connections.
// API keys come from .env — never hardcode them.

import type { Platform } from "../types/index.ts";

/**
 * Shared system prompt for every AI provider call (Claude for now;
 * ChatGPT/Perplexity/Gemini are paused but wired to the same constant so
 * re-enabling them later needs no prompt rework — see aiQuerier.ts).
 *
 * Deliberately NOT a rigid self-report template. An earlier version of
 * this prompt forced MENTIONED: yes/no / CONFIDENCE: high-medium-low
 * fields and asked the AI to grade its own answer — that made it stop
 * reasoning naturally (it filled boxes instead of actually thinking about
 * the business) and made a typo'd or indirectly-referenced business name
 * produce an unreliable self-report. Detection now happens in code
 * against this free-form text instead — see src/scanner/detector.ts's
 * fuzzy matching. This prompt's only job is: answer like a real local
 * guide would, and skip markdown syntax. See sanitizeText() in
 * src/utils/sanitizeText.ts for the defensive cleanup pass that runs on
 * the output in case a model doesn't fully comply on the markdown part.
 */
export const AI_SYSTEM_PROMPT = `You are being asked a question the way a real customer would ask it when researching local businesses. Answer naturally and specifically, based on your own knowledge — name real businesses when you're aware of relevant ones, and briefly explain why you'd suggest them. If you don't know of a good option or aren't confident, say so plainly rather than refusing to engage or padding your answer with disclaimers and suggestions to "check Google Maps."

Write in plain, clean prose: full sentences, no markdown formatting — no asterisks, no bold text, no headers, no bullet points. If you're comparing a few businesses, it's fine to walk through them in plain numbered sentences (e.g. "1. Business Name — reason"), just don't use markdown syntax to format it.`;

/**
 * Config shape for each AI platform.
 * Every platform needs: an API key, a model name,
 * the API endpoint, and a timeout.
 */
interface PlatformConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
}

/**
 * Master config object — one entry per platform.
 *
 * Why these specific models?
 * - gpt-4o-mini: cheapest OpenAI model that's still smart enough to give
 *   realistic recommendations. We're not asking complex questions,
 *   just "who do you recommend?" — no need for gpt-4o.
 * - sonar: Perplexity's search-grounded model. It searches the web
 *   before answering, which is exactly how real users use Perplexity.
 * - gemini-2.0-flash: Google's fast, cheap model. Same logic as gpt-4o-mini.
 *
 * Why 30 second timeout?
 * AI APIs can be slow under load. 30s is generous enough to avoid
 * false failures but short enough to not hang forever.
 *
 * ChatGPT / Perplexity / Gemini calls are paused for now (see aiQuerier.ts) —
 * we're testing against Claude only until we have keys for the others.
 * Their config entries stay here so the Record<Platform, ...> type still
 * checks out and so re-enabling them later is a one-line uncomment.
 */
export const aiConfig: Record<Platform, PlatformConfig> = {
  chatgpt: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    timeoutMs: 30_000,
  },
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY ?? "",
    model: "sonar",
    baseUrl: "https://api.perplexity.ai",
    timeoutMs: 30_000,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: "gemini-2.0-flash-lite", // ← change this line
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    timeoutMs: 30_000,
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: "claude-opus-4-8",
    baseUrl: "https://api.anthropic.com",
    timeoutMs: 30_000,
  },
}

/**
 * Checks that all required API keys are set in the environment.
 * Call this once at server startup — fail fast instead of
 * crashing mid-scan with a confusing auth error.
 *
 * Why not throw?
 * Some developers might want to work on other parts of the app
 * (auth, clients CRUD) without all API keys set up yet.
 * We warn instead of crash so development isn't blocked.
 */
export function validateAIConfig(): { valid: boolean; missing: Platform[] } {
  const missing: Platform[] = [];

  for (const [platform, config] of Object.entries(aiConfig)) {
    if (!config.apiKey) {
      missing.push(platform as Platform);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing API keys for: ${missing.join(", ")}. Scans for these platforms will fail.`,
    );
  }

  return { valid: missing.length === 0, missing };
}
