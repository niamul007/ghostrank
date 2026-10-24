import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const create = vi.hoisted(() => vi.fn())

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create }
  },
}))

import { queryAllPlatforms, CLAUDE_MAX_TOKENS } from "../src/scanner/aiQuerier"
import type { BuiltPrompt } from "../src/types"

const prompt: BuiltPrompt = {
  platform: "claude",
  text: "Best Sweet Shop near Bangladesh",
} as BuiltPrompt

const usage = { input_tokens: 10, output_tokens: 20 }
const good = {
  stop_reason: "end_turn",
  content: [{ type: "text", text: "1. Mithai — sweets" }],
  usage,
}
const thinkingOnly = {
  stop_reason: "max_tokens",
  content: [{ type: "thinking", thinking: "hmm" }],
  usage,
}

async function run() {
  const promise = queryAllPlatforms([prompt])
  await vi.runAllTimersAsync()
  return promise
}

describe("queryAllPlatforms (Claude)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    create.mockReset()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("sends effort low, max_tokens 1500 and no thinking field", async () => {
    create.mockResolvedValue(good)
    await run()
    const req = create.mock.calls[0][0]
    expect(req.output_config).toEqual({ effort: "low" })
    expect(req.max_tokens).toBe(1500)
    expect(CLAUDE_MAX_TOKENS).toBe(1500)
    expect("thinking" in req).toBe(false)
  })

  it("saves the answer when the retry succeeds after a thinking-only reply", async () => {
    create.mockResolvedValueOnce(thinkingOnly).mockResolvedValueOnce(good)
    const result = await run()
    expect(create).toHaveBeenCalledTimes(2)
    expect(result.failures).toEqual([])
    expect(result.responses).toHaveLength(1)
    expect(result.responses[0].rawText).toBe("1. Mithai — sweets")
  })

  it("records a failure and saves no answer when both attempts are thinking-only", async () => {
    create.mockResolvedValue(thinkingOnly)
    const result = await run()
    expect(create).toHaveBeenCalledTimes(2)
    expect(result.responses).toEqual([])
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].error).toContain("EmptyAnswerError")
    expect(result.failures[0].error).toContain("stop_reason=max_tokens")
    expect(result.failures[0].error).toContain("blocks=[thinking]")
  })

  it("treats whitespace-only text as a failure", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "  \n " }],
      usage,
    })
    const result = await run()
    expect(create).toHaveBeenCalledTimes(2)
    expect(result.responses).toEqual([])
    expect(result.failures).toHaveLength(1)
  })

  it("does not retry on HTTP errors", async () => {
    create.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }))
    const result = await run()
    expect(create).toHaveBeenCalledTimes(1)
    expect(result.failures[0].error).toBe("Error (HTTP 500)")
  })
})
