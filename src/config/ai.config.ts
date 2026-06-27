export const aiConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: "gpt-4o-mini",
    timeoutMs: 30_000,
  },
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY ?? "",
    model: "sonar",
    timeoutMs: 30_000,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: "gemini-1.5-flash",
    timeoutMs: 30_000,
  },
} as const

export type AIPlatform = keyof typeof aiConfig
