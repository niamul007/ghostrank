// ──────────────────────────────────────────
// GhostRank — Client Routes
// ──────────────────────────────────────────

import { Router } from "express"
import {
  createClient,
  listClients,
  getClient,
  updateClient,
  deleteClient,
} from "../controllers/client.controller"
import { authenticate } from "../middleware/auth"
import { validate } from "../middleware/validate"
import { createClientSchema, updateClientSchema } from "../schemas/client.schema"

const router = Router()

// All client routes require authentication
router.use(authenticate)

router.post("/", validate(createClientSchema), createClient)
router.get("/", listClients)
router.get("/:id", getClient)
router.patch("/:id", validate(updateClientSchema), updateClient)
router.delete("/:id", deleteClient)

export default router