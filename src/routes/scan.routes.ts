// ──────────────────────────────────────────
// GhostRank — Scan Routes
// ──────────────────────────────────────────

import { Router } from "express"
import { startScan, getScan, listScans } from "../controllers/scan.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

// All scan routes require authentication
router.use(authenticate)

router.post("/clients/:clientId/scans", startScan)
router.get("/scans/:id", getScan)
router.get("/clients/:clientId/scans", listScans)

export default router