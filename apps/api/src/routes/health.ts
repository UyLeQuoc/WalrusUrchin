import { Hono } from "hono"
import { healthResponseSchema } from "@workspace/cores/validations"

import { API_PORT } from "../config/server"

export const healthRoutes = new Hono().get("/", (context) => {
  const response = healthResponseSchema.parse({
    service: "walrus-urchin-api",
    status: "ok",
    port: API_PORT,
  })

  return context.json(response)
})
