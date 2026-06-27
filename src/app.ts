import express from "express"
import cookieParser from "cookie-parser"
import authRoutes from "./routes/auth.routes"
import { errorHandler } from "./middleware/errorHandler"

const app = express()

app.use(express.json())
app.use(cookieParser())

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.use("/api/auth", authRoutes)

app.use(errorHandler)

export default app
