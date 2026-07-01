// ──────────────────────────────────────────
// GhostRank — Report Routes
// ──────────────────────────────────────────

import { Router } from "express"
import { createReport, getReport, listReports } from "../controllers/report.controller"

const router = Router()

// Generate a report from a completed scan
router.post("/scans/:scanId/report", createReport)

// Get a specific report
router.get("/reports/:id", getReport)

// List all reports for a client
router.get("/clients/:clientId/reports", listReports)

export default router