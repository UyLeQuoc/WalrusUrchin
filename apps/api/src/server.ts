import { serve } from "@hono/node-server"

import { createApp } from "./app"
import { API_HOST, API_PORT } from "./config/server"

export function startServer() {
  const app = createApp()

  serve(
    {
      fetch: app.fetch,
      hostname: API_HOST,
      port: API_PORT,
    },
    (info) => {
      console.log(`Hono API running at http://${API_HOST}:${info.port}`)
    }
  )
}
