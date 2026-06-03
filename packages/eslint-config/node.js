import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

function getParserOptions(tsconfigRootDir) {
  if (!tsconfigRootDir) {
    return {}
  }

  return { tsconfigRootDir }
}

export function createNodeConfig({ tsconfigRootDir } = {}) {
  return defineConfig([
    globalIgnores(["dist", "node_modules", ".turbo"]),
    {
      files: ["**/*.ts"],
      extends: [js.configs.recommended, tseslint.configs.recommended],
      languageOptions: {
        globals: globals.node,
        parserOptions: getParserOptions(tsconfigRootDir),
      },
    },
  ])
}

export default createNodeConfig()
