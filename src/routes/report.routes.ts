import { Router } from "express"
import { authenticate } from "../middleware/auth"

const router = Router()

router.use(authenticate)

// TODO: wire report controller once generateReport / getReport / listReports are implemented
// router.post("/scans/:scanId/report", generateReport)
// router.get("/reports/:id", getReport)
// router.get("/clients/:clientId/reports", listReports)

export default router
