import { z } from "zod"

// "" is allowed for brandColor and logoUrl and means "clear the value".
const hexColor = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6})?$/, "Brand colour must be a hex colour like #1e3a5f")

const logoUrl = z
  .string()
  .max(500, "Logo URL must be 500 characters or fewer")
  .refine((value) => {
    if (value === "") return true
    try {
      const { protocol } = new URL(value)
      return protocol === "http:" || protocol === "https:"
    } catch {
      return false
    }
  }, "Logo URL must start with http:// or https://")

export const updateAgencySchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(100, "Name must be 100 characters or fewer").optional(),
  brandColor: hexColor.optional(),
  logoUrl: logoUrl.optional(),
})

export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>
