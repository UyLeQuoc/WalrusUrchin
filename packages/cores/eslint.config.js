import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createReactConfig } from "@workspace/eslint-config/react"

export default [
  ...createReactConfig({
    tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
  }),
  {
    files: ["src/components/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]
