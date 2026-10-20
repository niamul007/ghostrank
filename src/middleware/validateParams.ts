import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { AppError } from "../utils/AppError"

const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9]+$/)

export function validateParams(...names: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const name of names) {
      if (!idSchema.safeParse(req.params[name]).success) {
        next(new AppError("Invalid id", 400))
        return
      }
    }
    next()
  }
}
