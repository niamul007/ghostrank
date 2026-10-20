const MIN_SECRET_LENGTH = 32

// Fail fast at startup if the JWT signing secret is missing or too short
export function validateAuthConfig(): void {
  const secret = process.env.ACCESS_TOKEN_SECRET
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`ACCESS_TOKEN_SECRET must be at least ${MIN_SECRET_LENGTH} characters`)
  }
}
