// ──────────────────────────────────────────
// GhostRank — Report Controller
// ──────────────────────────────────────────

import { Request, Response, NextFunction } from "express"
import { generateReport, getReportById, getReportsByClient } from "../services/report.service"

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

    const report = await generateReport(scanId)

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

    const report = await getReportById(id)

    if (!report) {
      res.status(404).json({
        status: "error",
        message: "Report not found",
      })
      return
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

    const reports = await getReportsByClient(clientId)

    res.json({
      status: "success",
      data: reports,
    })
  } catch (error) {
    next(error)
  }
}