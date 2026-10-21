import express from "express"
import cors from "cors"
import authRoutes from "./routes/auth.routes"
import clientRoutes from "./routes/client.routes"
import scanRoutes from "./routes/scan.routes"
import reportRoutes from "./routes/report.routes"
import { errorHandler } from "./middleware/errorHandler"
import { validateAIConfig } from "./config/ai.config"
import { validateAuthConfig } from "./config/auth.config"

const app = express()

// Trust the first N proxies so rate limiting sees real client IPs (set TRUST_PROXY to a positive integer)
const trustProxy = Number(process.env.TRUST_PROXY)
if (Number.isInteger(trustProxy) && trustProxy > 0) {
  app.set("trust proxy", trustProxy)
}

// Allowed frontend origins: comma-separated FRONTEND_URL, or the Vite dev server by default
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((origin) => origin.trim()).filter(Boolean)
  : ["http://localhost:5173"]

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  })
)

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