import { ScanJobPayload } from "../types"

export interface BuiltPrompt {
  text: string
  category: string
}

export function buildPrompts(_payload: ScanJobPayload): BuiltPrompt[] {
  // TODO: generate diverse prompts targeting businessName / niche / location
  return []
}
