import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

function getParserOptions(tsconfigRootDir) {
  if (!tsconfigRootDir) {
    return {}
  }

  return { tsconfigRootDir }
}

export function createReactConfig({ tsconfigRootDir } = {}) {
  return defineConfig([
    globalIgnores(["dist", "node_modules", ".turbo"]),
    {
      files: ["**/*.{ts,tsx}"],
      extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        reactHooks.configs.flat.recommended,
        reactRefresh.configs.vite,
      ],
      languageOptions: {
        globals: globals.browser,
        parserOptions: getParserOptions(tsconfigRootDir),
      },
      rules: {
        "react-refresh/only-export-components": [
          "warn",
          { allowConstantExport: true },
        ],
      },
    },
  ])
}

export default createReactConfig()
