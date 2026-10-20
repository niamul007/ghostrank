// ──────────────────────────────────────────
// GhostRank — Report Controller
// ──────────────────────────────────────────

import { Request, Response, NextFunction } from "express"
import { generateReport, getReportById, getReportsByClient } from "../services/report.service"
import { AppError } from "../utils/AppError"

/**
 * POST /api/scans/:scanId/report
 *
 * Generates a report from a completed scan.
 * The agency calls this after a scan completes
 * to get the structured report they can share.
 */
export async function createReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const scanId = req.params.scanId as string

    const agencyId = req.user!.agencyId

    const report = await generateReport(scanId, agencyId)

    res.status(201).json({
      status: "success",
      data: report,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/reports/:id
 *
 * Gets an existing report by ID.
 */
export async function getReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string

    const agencyId = req.user!.agencyId

    const report = await getReportById(id, agencyId)

    if (!report) {
      throw new AppError("Report not found", 404)
    }

    res.json({
      status: "success",
      data: report,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/clients/:clientId/reports
 *
 * Lists all reports for a client.
 */
export async function listReports(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = req.params.clientId as string

    const agencyId = req.user!.agencyId

    const reports = await getReportsByClient(clientId, agencyId)

    res.json({
      status: "success",
      data: reports,
    })
  } catch (error) {
    next(error)
  }
}