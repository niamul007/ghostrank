import { describe, it, expect, vi } from "vitest"
import type Anthropic from "@anthropic-ai/sdk"
import { withRetry } from "../src/scanner/providers/retry"
import { createClaudeProvider } from "../src/scanner/providers/claude"
import { ProviderError } from "../src/scanner/providers/types"

const noSleep = () => Promise.resolve()

function httpError(status: number): Error {
  return Object.assign(new Error("raw provider text"), { status })
}

const okResponse = {
  stop_reason: "end_turn",
  content: [{ type: "text", text: "Try Acme Plumbing." }],
  usage: { input_tokens: 10, output_tokens: 5 },
}

const blankResponse = {
  stop_reason: "end_turn",
  content: [{ type: "thinking" }],
  usage: { input_tokens: 10, output_tokens: 5 },
}

/** Fake Anthropic client: each create() call consumes the next step. */
function fakeClient(steps: Array<unknown | Error>) {
  const create = vi.fn(async () => {
    const step = steps.shift()
    if (step instanceof Error) throw step
    return step
  })
  return { client: { messages: { create } } as unknown as Anthropic, create }
}

describe("withRetry", () => {
  it("retries on 429 then succeeds, with growing waits", async () => {
    const { client, create } = fakeClient([httpError(429), httpError(503), okResponse])
    const provider = createClaudeProvider({ client, sleep: noSleep })
    const sleep = vi.fn(noSleep)

    const answer = await withRetry(() => provider.ask("q"), sleep)

    expect(answer.text).toBe("Try Acme Plumbing.")
    expect(create).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 3000])
  })

  it("gives up after 2 retries", async () => {
    const { client, create } = fakeClient([
      httpError(429),
      httpError(429),
      httpError(429),
      okResponse,
    ])
    const provider = createClaudeProvider({ client, sleep: noSleep })

    await expect(withRetry(() => provider.ask("q"), noSleep)).rejects.toMatchObject({
      name: "ProviderError",
      retryable: true,
    })
    expect(create).toHaveBeenCalledTimes(3)
  })

  it("does not retry a 400", async () => {
    const { client, create } = fakeClient([httpError(400), okResponse])
    const provider = createClaudeProvider({ client, sleep: noSleep })
    const sleep = vi.fn(noSleep)

    const error = await withRetry(() => provider.ask("q"), sleep).catch((e) => e)

    expect(error).toBeInstanceOf(ProviderError)
    expect(error.retryable).toBe(false)
    expect(error.message).not.toContain("raw provider text")
    expect(create).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})

describe("createClaudeProvider", () => {
  it("reports name, model, text, tokens and duration", async () => {
    const { client } = fakeClient([okResponse])
    const provider = createClaudeProvider({ client, sleep: noSleep })

    const answer = await provider.ask("q")

    expect(provider.name).toBe("claude")
    expect(provider.model).toBeTruthy()
    expect(answer).toMatchObject({ text: "Try Acme Plumbing.", inputTokens: 10, outputTokens: 5 })
    expect(answer.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("retries a blank answer once, then succeeds", async () => {
    const { client, create } = fakeClient([blankResponse, okResponse])
    const sleep = vi.fn(noSleep)
    const provider = createClaudeProvider({ client, sleep })

    const answer = await provider.ask("q")

    expect(answer.text).toBe("Try Acme Plumbing.")
    expect(create).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(1000)
  })

  it("fails with a non-retryable error when the answer stays blank", async () => {
    const { client, create } = fakeClient([blankResponse, blankResponse, okResponse])
    const provider = createClaudeProvider({ client, sleep: noSleep })

    await expect(provider.ask("q")).rejects.toMatchObject({
      name: "ProviderError",
      retryable: false,
    })
    expect(create).toHaveBeenCalledTimes(2)
  })
})
