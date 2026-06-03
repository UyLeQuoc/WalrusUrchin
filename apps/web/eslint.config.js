import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createReactConfig } from "@workspace/eslint-config/react"

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))

export default createReactConfig({ tsconfigRootDir })
