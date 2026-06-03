type ServerReadyOptions = {
  host: string
  port: number
}

const ANSI = {
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  reset: "\x1b[0m",
} as const

function color(value: string, code: string) {
  if (process.env.NO_COLOR) {
    return value
  }

  return `${code}${value}${ANSI.reset}`
}

function getDisplayHost(host: string) {
  if (host === "0.0.0.0" || host === "::") {
    return "localhost"
  }

  return host
}

function getBaseUrl({ host, port }: ServerReadyOptions) {
  return `http://${getDisplayHost(host)}:${port}`
}

export function logServerReady(options: ServerReadyOptions) {
  const baseUrl = getBaseUrl(options)

  console.log(
    [
      "",
      `  ${color("HONO", ANSI.cyan)} ${color("WalrusUrchin API", ANSI.bold)} ${color("ready", ANSI.green)}`,
      "",
      `  ${color("➜", ANSI.green)}  Local:   ${color(`${baseUrl}/`, ANSI.cyan)}`,
      `  ${color("➜", ANSI.green)}  Health:  ${color(`${baseUrl}/`, ANSI.cyan)}`,
      "",
      color("  Secrets stay server-side in apps/api.", ANSI.dim),
    ].join("\n")
  )
}
