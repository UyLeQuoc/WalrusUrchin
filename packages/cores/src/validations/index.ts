import { z } from "zod"

export const healthResponseSchema = z.object({
  service: z.literal("walrus-urchin-api"),
  status: z.literal("ok"),
  port: z.number().int().positive(),
})

export type { HealthResponse } from "../types"
