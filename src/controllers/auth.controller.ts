import { Request, Response, NextFunction } from "express"
import bcrypt from "bcrypt"
import { prisma } from "../lib/prisma"
import { generateAccessToken } from "../utils/generateToken"
import { AppError } from "../utils/AppError"
import { RegisterInput, LoginInput } from "../schemas/auth.schema"

export async function register(
  req: Request<{}, {}, RegisterInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, email, password } = req.body

    const existing = await prisma.agency.findUnique({ where: { email } })
    if (existing) return next(new AppError("Email already in use", 409))

    const hashed = await bcrypt.hash(password, 10)
    const agency = await prisma.agency.create({
      data: { name, email, password: hashed },
    })

    const { password: _, ...agencyWithoutPassword } = agency

    res.status(201).json({ status: "success", data: { agency: agencyWithoutPassword } })
  } catch (err) {
    next(err)
  }
}

export async function login(
  req: Request<{}, {}, LoginInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password } = req.body

    const agency = await prisma.agency.findUnique({ where: { email } })
    if (!agency) return next(new AppError("Invalid credentials", 401))

    const match = await bcrypt.compare(password, agency.password)
    if (!match) return next(new AppError("Invalid credentials", 401))

    const token = generateAccessToken({ agencyId: agency.id, role: agency.role })

    res.status(200).json({ status: "success", data: { accessToken: token } })
  } catch (err) {
    next(err)
  }
}
