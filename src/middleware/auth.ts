import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { AppError } from "../utils/AppError"

interface JwtPayload {
  userId: number
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("No token provided", 401))
  }

  const token = authHeader.split(" ")[1]
  const secret = process.env.ACCESS_TOKEN_SECRET
  if (!secret) return next(new AppError("Server misconfiguration", 500))

  try {
    const payload = jwt.verify(token, secret) as JwtPayload
    req.user = payload
    next()
  } catch {
    next(new AppError("Invalid or expired token", 401))
  }
}
