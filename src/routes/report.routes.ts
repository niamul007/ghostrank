// ──────────────────────────────────────────
// GhostRank — Report Routes
// ──────────────────────────────────────────

import { Router } from "express"
import { createReport, getReport, listReports } from "../controllers/report.controller"
import { authenticate } from "../middleware/auth"
import { validateParams } from "../middleware/validateParams"

const router = Router()

// All report routes require authentication
router.use(authenticate)

router.post("/scans/:scanId/report", validateParams("scanId"), createReport)
router.get("/reports/:id", validateParams("id"), getReport)
router.get("/clients/:clientId/reports", validateParams("clientId"), listReports)

export default router