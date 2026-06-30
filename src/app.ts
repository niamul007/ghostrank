import express from "express"
import cookieParser from "cookie-parser"
import authRoutes from "./routes/auth.routes"
import clientRoutes from "./routes/client.routes"
import scanRoutes from "./routes/scan.routes"
import { errorHandler } from "./middleware/errorHandler"
import { validateAIConfig } from "./config/ai.config"

const app = express()

app.use(express.json())
app.use(cookieParser())

// Check AI API keys on startup
validateAIConfig()

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/clients", clientRoutes)
app.use("/api", scanRoutes)
app.post("/test", (_req, res) => {
  res.json({ test: "works" })
})
app.use(errorHandler)

export default app