import { Router } from "express"
import { register, login } from "../controllers/auth.controller"
import { validate } from "../middleware/validate"
import { registerSchema, loginSchema } from "../schemas/auth.schema"
import { loginLimiter, registerLimiter } from "../middleware/rateLimit"

const router = Router()

router.post("/register", registerLimiter, validate(registerSchema), register)
router.post("/login", loginLimiter, validate(loginSchema), login)

export default router
