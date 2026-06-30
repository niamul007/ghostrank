// ──────────────────────────────────────────
// GhostRank — Client Routes
// ──────────────────────────────────────────

import { Router } from "express"
import { authenticate } from "../middleware/auth"
import {
  createClient,
  listClients,
  getClient,
  updateClient,
  deleteClient,
} from "../controllers/client.controller"

const router = Router()

router.use(authenticate)

router.post("/", createClient)
router.get("/", listClients)
router.get("/:id", getClient)
router.patch("/:id", updateClient)
router.delete("/:id", deleteClient)

export default router