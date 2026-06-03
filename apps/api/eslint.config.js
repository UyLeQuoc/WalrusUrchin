import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createNodeConfig } from "@workspace/eslint-config/node"

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))

export default createNodeConfig({ tsconfigRootDir })
