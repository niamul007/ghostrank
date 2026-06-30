// ──────────────────────────────────────────
// GhostRank — Scan Service
// ──────────────────────────────────────────
// The orchestrator. This is where all the scanner pieces
// come together into one complete scan flow.
//
// Think of it like a factory assembly line:
// 1. Create a scan record (PENDING)
// 2. Build prompts
// 3. Query AI platforms
// 4. Parse responses
// 5. Score results
// 6. Save everything to database
// 7. Mark scan as COMPLETED (or FAILED)
//
// The controller calls these functions.
// These functions call the scanner modules.
// Clean separation of concerns.

import { prisma } from "../lib/prisma"
import { ScanStatus } from "@prisma/client"
import { buildPrompts } from "../scanner/promptBuilder"
import { queryAllPlatforms } from "../scanner/aiQuerier"
import { parseAll } from "../scanner/parser"
import { computeScore } from "../scorer"
import type { ScanJobPayload } from "../types"

/**
 * Creates a new scan record in the database.
 *
 * Called when an agency clicks "Run Scan" on a client.
 * The scan starts as PENDING — it hasn't done anything yet.
 * Returns the scan ID so we can track it.
 *
 * Why create the record first before scanning?
 * So the agency can immediately see "scan in progress"
 * in their dashboard. The actual scanning happens after.
 */
export async function createScan(clientId: string) {
  // First verify the client exists
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  })

  if (!client) {
    throw new Error(`Client not found: ${clientId}`)
  }

  // Create the scan record with PENDING status
  const scan = await prisma.scan.create({
    data: {
      clientId,
      status: ScanStatus.PENDING,
    },
  })

  return scan
}

/**
 * THE MAIN FUNCTION — runs the entire scan pipeline.
 *
 * This is where promptBuilder → aiQuerier → parser → scorer
 * all come together. Each step feeds into the next.
 *
 * Why is this one big function instead of separate steps?
 * Because the steps MUST run in order. You can't parse
 * before querying, can't score before parsing.
 * Keeping it in one function makes the flow obvious.
 *
 * Error handling:
 * If anything fails, we catch the error, mark the scan
 * as FAILED with the error message, and rethrow.
 * This way the database always reflects reality.
 */
export async function runScan(payload: ScanJobPayload): Promise<void> {
  const { scanId, clientId, businessName, niche, location } = payload

  try {
    // ── Step 1: Mark scan as RUNNING ──────────────
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: ScanStatus.RUNNING },
    })

    // ── Step 2: Build prompts ─────────────────────
    // Creates ~5 prompts × 3 platforms = ~15 BuiltPrompt objects
    const prompts = buildPrompts(payload)

    // ── Step 3: Query all AI platforms ────────────
    // Sends all 15 prompts concurrently using Promise.allSettled
    // Returns AIResponse[] (raw text from each platform)
    const responses = await queryAllPlatforms(prompts)

    // ── Step 4: Parse responses ──────────────────
    // Checks each response for: mention? position? sentiment?
    // Returns ParsedScanResult[]
    const parsed = parseAll(responses, prompts, businessName)

    // ── Step 5: Calculate score ──────────────────
    // Crunches all parsed results into a 0-100 score
    const score = computeScore(parsed)

    // ── Step 6: Save results to database ─────────
    // Save each individual result as a ScanResult row
    // Using a transaction: either ALL saves succeed or NONE do.
    // This prevents partial data in the database.
    await prisma.$transaction(async (tx) => {
      // Save individual results
      for (const result of parsed) {
        await tx.scanResult.create({
          data: {
            scanId,
            platform: result.platform,
            prompt: result.prompt,
            category: result.category,
            response: result.response,
            mentioned: result.mentioned,
            position: result.position,
            sentiment: result.sentiment,
          },
        })
      }

      // Update the scan with score and status
      await tx.scan.update({
        where: { id: scanId },
        data: {
          status: ScanStatus.COMPLETED,
          score: score.overall,
          promptsUsed: prompts.map((p) => p.text),
          rawResults: score as object,
        },
      })
    })
  } catch (error) {
    // ── If anything fails, mark scan as FAILED ───
    // The error message gets saved so we can debug later
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error"

    await prisma.scan
      .update({
        where: { id: scanId },
        data: {
          status: ScanStatus.FAILED,
          errorMsg,
        },
      })
      .catch((updateErr) => {
        // If even the failure update fails, just log it
        console.error("Failed to update scan status:", updateErr)
      })

    throw error
  }
}

/**
 * Gets a single scan by ID with all its results.
 *
 * The `include` tells Prisma to also fetch related ScanResults
 * in the same query. Without it, you'd get the scan but not
 * the individual results — you'd need a separate query.
 * This is called "eager loading" — grab everything at once.
 */
export async function getScanById(scanId: string) {
  return prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      scanResults: true,
      client: true,
    },
  })
}

/**
 * Gets all scans for a specific client, newest first.
 *
 * Used in the dashboard to show scan history:
 * "Jan scan: 12 → Feb scan: 28 → Mar scan: 45" — progress!
 */
export async function getScansByClient(clientId: string) {
  return prisma.scan.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: {
      scanResults: true,
    },
  })
}