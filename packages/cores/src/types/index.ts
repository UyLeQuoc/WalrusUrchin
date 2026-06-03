export type HealthStatus = "ok"

export type HealthResponse = {
  service: "walrus-urchin-api"
  status: HealthStatus
  port: number
}
