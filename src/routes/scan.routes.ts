// ──────────────────────────────────────────
// GhostRank — Scan Routes
// ──────────────────────────────────────────

import { Router } from "express"
import { startScan, getScan, listScans } from "../controllers/scan.controller"

const router = Router()

// Start a new scan for a client
router.post("/clients/:clientId/scans", startScan)

// Get a specific scan by ID (with results)
router.get("/scans/:id", getScan)

// List all scans for a client
router.get("/clients/:clientId/scans", listScans)

export default router