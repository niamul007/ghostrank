import { Router } from "express"
import {
  createClient,
  getClient,
  listClients,
  updateClient,
  deleteClient,
} from "../controllers/client.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

router.use(authenticate)

router.post("/", createClient)
router.get("/", listClients)
router.get("/:id", getClient)
router.patch("/:id", updateClient)
router.delete("/:id", deleteClient)

export default router
