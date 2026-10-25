import { describe, it, expect, vi, beforeEach } from "vitest"
import { aiConfig } from "../src/config/ai.config"

const { constructed, create } = vi.hoisted(() => ({
  constructed: [] as Array<Record<string, unknown>>,
  create: vi.fn(),
}))

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    static APIConnectionError = class extends Error {}
    static APIConnectionTimeoutError = class extends Error {}
    messages = { create }
    constructor(options: Record<string, unknown>) {
      constructed.push(options)
    }
  }
  return { default: FakeAnthropic }
})

import { createClaudeProvider } from "../src/scanner/providers/claude"

describe("createClaudeProvider default client", () => {
  beforeEach(() => {
    constructed.length = 0
    create.mockReset()
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Try Acme Plumbing." }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
  })

  it("builds its own client lazily with maxRetries 0", async () => {
    const provider = createClaudeProvider()
    expect(constructed).toHaveLength(0)

    await provider.ask("q")
    await provider.ask("q")

    expect(constructed).toHaveLength(1)
    expect(constructed[0]).toEqual({
      apiKey: aiConfig.claude.apiKey,
      timeout: aiConfig.claude.timeoutMs,
      maxRetries: 0,
    })
  })
})
