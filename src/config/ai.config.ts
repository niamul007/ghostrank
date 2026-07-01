// ──────────────────────────────────────────
// GhostRank — AI Platform Configuration
// ──────────────────────────────────────────
// Centralized config for all AI API connections.
// API keys come from .env — never hardcode them.

import type { Platform } from "../types/index.ts";

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
    model: "gemini-1.5-flash", // ← change this line
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    timeoutMs: 30_000,
  },
};

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
