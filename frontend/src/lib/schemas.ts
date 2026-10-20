// ──────────────────────────────────────────
// Frontend validation — mirrors the backend's zod schemas
// (src/schemas/auth.schema.ts, src/schemas/client.schema.ts) so form
// errors show up before a round trip, not just after a 400 comes back.
// Register adds a client-only confirmPassword check the backend doesn't
// have any concept of.
// ──────────────────────────────────────────

import { z } from "zod"

export const registerFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one digit"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export type RegisterFormValues = z.infer<typeof registerFormSchema>

export const loginFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>

export const clientFormSchema = z.object({
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(200, "Business name too long"),
  niche: z.string().min(2, "Niche must be at least 2 characters").max(100, "Niche too long"),
  location: z
    .string()
    .min(2, "Location must be at least 2 characters")
    .max(200, "Location too long"),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>

/** Flattens a zod error into { field: firstMessage } — what Input's error prop expects. */
export function fieldErrors<T extends Record<string, unknown>>(
  error: z.ZodError<T>
): Partial<Record<keyof T, string>> {
  const flat = error.flatten().fieldErrors as Record<string, string[] | undefined>
  const out: Partial<Record<keyof T, string>> = {}
  for (const key in flat) {
    const messages = flat[key]
    if (messages && messages.length > 0) {
      out[key as keyof T] = messages[0]
    }
  }
  return out
}
