# WalrusUrchin

WalrusUrchin is a Vite monorepo using shadcn/ui components from the shared
`@workspace/cores` package.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
bunx --bun shadcn@latest add button -c apps/web
```

This will place shared UI components in the `packages/cores/src/components`
directory.

## Using components

To use shared components in your app, import them from the `cores` package.

```tsx
import { Button } from "@workspace/cores/components/button"
```
