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

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return next(new AppError("Email already in use", 409))

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
    })

    const { password: _, ...userWithoutPassword } = user

    res.status(201).json({ status: "success", data: { user: userWithoutPassword } })
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

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return next(new AppError("Invalid credentials", 401))

    const match = await bcrypt.compare(password, user.password)
    if (!match) return next(new AppError("Invalid credentials", 401))

    const token = generateAccessToken({ userId: user.id, role: user.role })

    res.status(200).json({ status: "success", data: { accessToken: token } })
  } catch (err) {
    next(err)
  }
}
