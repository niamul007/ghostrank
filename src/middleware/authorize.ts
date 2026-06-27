import { Request, Response, NextFunction } from "express"
import { AppError } from "../utils/AppError"

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Forbidden: insufficient permissions", 403))
    }
    next()
  }
}
