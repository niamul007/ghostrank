import { AIResponse, Platform } from "../types"
import { BuiltPrompt } from "./promptBuilder"

export async function queryPlatform(
  _platform: Platform,
  _prompt: BuiltPrompt
): Promise<AIResponse> {
  // TODO: route to OpenAI / Perplexity / Gemini SDK based on platform
  throw new Error("Not implemented")
}

export async function queryAllPlatforms(
  _prompts: BuiltPrompt[]
): Promise<AIResponse[]> {
  // TODO: fan out across all three platforms concurrently with Promise.allSettled
  throw new Error("Not implemented")
}
