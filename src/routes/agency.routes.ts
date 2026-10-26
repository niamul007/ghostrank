import { Router } from "express"
import { getAgency, updateAgency } from "../controllers/agency.controller"
import { authenticate } from "../middleware/auth"
import { validate } from "../middleware/validate"
import { updateAgencySchema } from "../schemas/agency.schema"

const router = Router()

// Current agency only — the id comes from the token
router.use(authenticate)

router.get("/", getAgency)
router.patch("/", validate(updateAgencySchema), updateAgency)

export default router
