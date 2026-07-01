// ──────────────────────────────────────────
// GhostRank — Report Routes
// ──────────────────────────────────────────

import { Router } from "express"
import { createReport, getReport, listReports } from "../controllers/report.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

// All report routes require authentication
router.use(authenticate)

router.post("/scans/:scanId/report", createReport)
router.get("/reports/:id", getReport)
router.get("/clients/:clientId/reports", listReports)

export default router