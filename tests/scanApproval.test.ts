import { describe, it, expect, vi, beforeEach } from "vitest"

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock("../src/lib/prisma", () => ({ prisma: { agency: { findUnique } } }))

import { requireScanApproval } from "../src/middleware/requireScanApproval"
import { AppError } from "../src/utils/AppError"

const run = async () => {
  const next = vi.fn()
  await requireScanApproval({ user: { agencyId: "a1", role: "AGENCY" } } as any, {} as any, next)
  return next
}

describe("requireScanApproval", () => {
  beforeEach(() => findUnique.mockReset())

  it("returns 403 for an unapproved agency", async () => {
    findUnique.mockResolvedValue({ scanApproved: false })
    const next = await run()
    const err = next.mock.calls[0][0] as AppError
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe("Scanning is not enabled for this account yet.")
  })

  it("returns 403 when the agency no longer exists", async () => {
    findUnique.mockResolvedValue(null)
    const next = await run()
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403)
  })

  it("passes an approved agency through", async () => {
    findUnique.mockResolvedValue({ scanApproved: true })
    const next = await run()
    expect(next).toHaveBeenCalledWith()
  })
})
