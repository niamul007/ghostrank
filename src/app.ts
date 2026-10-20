import express from "express"
import authRoutes from "./routes/auth.routes"
import clientRoutes from "./routes/client.routes"
import scanRoutes from "./routes/scan.routes"
import reportRoutes from "./routes/report.routes"
import { errorHandler } from "./middleware/errorHandler"
import { validateAIConfig } from "./config/ai.config"
import { validateAuthConfig } from "./config/auth.config"

const app = express()

app.use(express.json())

// Check auth secret and AI API keys on startup
validateAuthConfig()
validateAIConfig()

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/clients", clientRoutes)
app.use("/api", scanRoutes)
app.use("/api", reportRoutes)

app.use(errorHandler)

export default app