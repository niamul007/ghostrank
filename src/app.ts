import express from "express"
import cookieParser from "cookie-parser"
import authRoutes from "./routes/auth.routes"
import clientRoutes from "./routes/client.routes"
import scanRoutes from "./routes/scan.routes"
import reportRoutes from "./routes/report.routes"
import { errorHandler } from "./middleware/errorHandler"

const app = express()

app.use(express.json())
app.use(cookieParser())

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.use("/api/auth", authRoutes)
app.use("/api/clients", clientRoutes)
app.use("/api", scanRoutes)
app.use("/api", reportRoutes)

app.use(errorHandler)

export default app
