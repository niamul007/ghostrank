import jwt from "jsonwebtoken"

interface TokenPayload {
  agencyId: string
  role: string
}

export function generateAccessToken(payload: TokenPayload): string {
  const secret = process.env.ACCESS_TOKEN_SECRET
  if (!secret) throw new Error("ACCESS_TOKEN_SECRET is not defined")
  return jwt.sign(payload, secret, { expiresIn: "15m" })
}
