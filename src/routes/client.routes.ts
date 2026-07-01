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
import { validate } from "../middleware/validate"
import { createClientSchema, updateClientSchema } from "../schemas/client.schema"

const router = Router()

router.post("/", validate(createClientSchema), createClient)
router.get("/", listClients)
router.get("/:id", getClient)
router.patch("/:id", validate(updateClientSchema), updateClient)
router.delete("/:id", deleteClient)

export default router