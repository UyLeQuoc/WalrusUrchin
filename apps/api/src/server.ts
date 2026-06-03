import { serve } from "@hono/node-server"

import { createApp } from "./app"
import { API_HOST, API_PORT } from "./config/server"
import { logServerReady } from "./logger/startup"

export function startServer() {
  const app = createApp()

  serve(
    {
      fetch: app.fetch,
      hostname: API_HOST,
      port: API_PORT,
    },
    (info) => {
      logServerReady({
        host: API_HOST,
        port: info.port,
      })
    }
  )
}
