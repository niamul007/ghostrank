// ──────────────────────────────────────────
// GhostRank — Run store
// ──────────────────────────────────────────

import { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import type { SaveRun } from "./runner"

/**
 * Returns a saveRun that inserts one ScanRun row. A row that already exists
 * for (scanId, questionId, runNumber) counts as saved.
 */
export function createPrismaSaveRun(): SaveRun {
  return async (row) => {
    try {
      const { sources, ...rest } = row
      await prisma.scanRun.create({
        data: {
          ...rest,
          sources: sources ? (sources as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return
      }
      throw error
    }
  }
}
