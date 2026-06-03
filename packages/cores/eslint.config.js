import reactConfig from "@workspace/eslint-config/react"

export default [
  ...reactConfig,
  {
    files: ["src/components/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]
