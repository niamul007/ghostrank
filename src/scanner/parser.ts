import { AIResponse, ParsedScanResult } from "../types"

export function parseResponse(_response: AIResponse): ParsedScanResult {
  // TODO: extract mention flag, ranked position, and sentiment from raw AI text
  throw new Error("Not implemented")
}

export function parseAll(responses: AIResponse[]): ParsedScanResult[] {
  // TODO: map parseResponse over every response
  return responses.map(parseResponse)
}
