// ──────────────────────────────────────────
// GhostRank — Scan Controller
// ──────────────────────────────────────────
// Handles HTTP requests for scan operations.
// Controllers are THIN — they validate input, call the service,
// and return the response. No business logic here.
//
// Think of controllers as waiters in a restaurant:
// They take the order (request), pass it to the kitchen (service),
// and bring back the food (response). They don't cook.

import { Request, Response, NextFunction } from "express"
import { createScan, runScan, getScanById, getScansByClient } from "../services/scan.service"
import { prisma } from "../lib/prisma"

/**
 * POST /api/clients/:clientId/scans
 *
 * Starts a new scan for a client.
 *
 * Flow:
 * 1. Validate the client exists and belongs to this agency
 * 2. Create a scan record (PENDING)
 * 3. Kick off the scan in the background (don't wait for it)
 * 4. Return the scan ID immediately
 *
 * Why not wait for the scan to finish?
 * A scan takes 30-60 seconds (15 API calls).
 * If we waited, the HTTP request would hang for a full minute.
 * Instead we return immediately and let it run in the background.
 * The agency can poll GET /api/scans/:id to check progress.
 */
export async function startScan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = req.params.clientId as string

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!client) {
      res.status(404).json({
        status: "error",
        message: "Client not found",
      })
      return
    }

    // Create the scan record
    const scan = await createScan(clientId)

    // Build the job payload
    const payload = {
      scanId: scan.id,
      clientId: client.id,
      businessName: client.businessName,
      niche: client.niche,
      location: client.location,
    }

    // Run the scan in the background — don't await it
    // The .catch logs errors but doesn't crash the server
    runScan(payload).catch((err) => {
      console.error(`Scan ${scan.id} failed:`, err)
    })

    // Return immediately with the scan ID
    res.status(201).json({
      status: "success",
      data: {
        scanId: scan.id,
        message: "Scan started. Poll GET /api/scans/" + scan.id + " for results.",
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/scans/:id
 *
 * Gets a scan by ID with all results.
 * Used to check scan progress and view results.
 *
 * Returns different data based on status:
 * - PENDING/RUNNING: just the status (still working)
 * - COMPLETED: full results + score
 * - FAILED: error message
 */
export async function getScan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string

    const scan = await getScanById(id)

    if (!scan) {
      res.status(404).json({
        status: "error",
        message: "Scan not found",
      })
      return
    }

    res.json({
      status: "success",
      data: scan,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/clients/:clientId/scans
 *
 * Lists all scans for a client, newest first.
 * Shows scan history — agencies love seeing progress over time.
 */
export async function listScans(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = req.params.clientId as string

    const scans = await getScansByClient(clientId)

    res.json({
      status: "success",
      data: scans,
    })
  } catch (error) {
    next(error)
  }
}