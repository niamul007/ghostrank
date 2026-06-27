import { Router } from "express"
import { startScan, getScan, listScans } from "../controllers/scan.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

router.use(authenticate)

router.post("/clients/:clientId/scans", startScan)
router.get("/clients/:clientId/scans", listScans)
router.get("/scans/:id", getScan)

export default router
