// ──────────────────────────────────────────
// GhostRank — Scan Routes
// ──────────────────────────────────────────

import { Router } from "express"
import { startScan, startScanV2, getScan, getRuns, listScans } from "../controllers/scan.controller"
import { authenticate } from "../middleware/auth"
import { scanLimiter } from "../middleware/rateLimit"
import { validateParams } from "../middleware/validateParams"

const router = Router()

// All scan routes require authentication
router.use(authenticate)

router.post("/clients/:clientId/scans", scanLimiter, validateParams("clientId"), startScan)
router.post("/clients/:clientId/scans/v2", scanLimiter, validateParams("clientId"), startScanV2)
router.get("/scans/:id", validateParams("id"), getScan)
router.get("/scans/:id/runs", validateParams("id"), getRuns)
router.get("/clients/:clientId/scans", validateParams("clientId"), listScans)

export default router