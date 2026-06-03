import { Hono } from "hono"

import { healthRoutes } from "./routes/health"

export function createApp() {
  const app = new Hono()

  app.route("/", healthRoutes)

  return app
}

export type AppType = ReturnType<typeof createApp>
