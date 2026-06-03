# Monorepo & engineering stack — Vite, Hono, pnpm, Turborepo, Walrus Sites

> Status: **design / docs-only** (June 2026). No code is scaffolded yet; this is the blueprint
> for the repository the rest of WalrusUrchin will be built into. Build target is **Sui testnet**
> first (Harbor and memwal are testnet/beta). All version pins below come from
> [`architecture.md`](./architecture.md) §8 — do not invent new ones.

This document is the engineering-stack reference for WalrusUrchin: the concrete repo layout, the
package manager + build orchestrator (pnpm workspaces + Turborepo), the frontend stack (Vite 8 /
Rolldown + React + the **new** `@mysten/dapp-kit` v2), the backend stack (Hono type-safe RPC on
`@hono/node-server`, which is the single trust boundary for all secrets), the Move→TS codegen wiring,
and the Walrus Sites deploy pipeline. It is the operational counterpart to the system design in
[`architecture.md`](./architecture.md): that doc says *what* the system is and *why* the backend
exists; this one says *how the code is organized and shipped*. For the per-technology depth, see
[`sui.md`](./sui.md), [`seal.md`](./seal.md), [`walrus.md`](./walrus.md), [`suins.md`](./suins.md),
[`auth.md`](./auth.md), [`habour.md`](./habour.md), [`memwal.md`](./memwal.md), and the sequences in
[`data-flows.md`](./data-flows.md).

---

## 1. Version matrix (June 2026 — pinned)

These are the exact pins from [`architecture.md`](./architecture.md) §8. Pin them in
`packages/config` and the root `package.json`; the new dapp-kit + Vite 8 majors are mutually
load-bearing (mixing majors fails to install or build).

| Package | Pin | Role in WalrusUrchin |
| --- | --- | --- |
| `pnpm` | `11.5.1` | Workspace package manager |
| `turbo` | `2.9.16` | Task orchestration / build graph |
| `vite` | `8.0.16` | SPA dev server + build (Rolldown-powered) |
| `@vitejs/plugin-react` | `6.0.2` | React Fast Refresh / JSX (peer `vite ^8`) |
| `@mysten/dapp-kit-react` | `2.0.3` | React bindings (`createDAppKit`, `DAppKitProvider`, hooks) |
| `@mysten/dapp-kit-core` | `1.3.2` | Framework-agnostic core (Lit + nanostores) |
| `@mysten/sui` | `2.17.0` | `SuiGrpcClient`, `Transaction`, `getFullnodeUrl` |
| `@mysten/enoki` | `1.0.8` | zkLogin wallets (frontend) + sponsorship (backend) |
| `@mysten/seal` | `1.1.3` | Client-side encrypt/decrypt (see [`seal.md`](./seal.md)) |
| `@mysten/walrus` | `1.1.7` (`-wasm` `0.2.2`) | Raw Walrus path (see [`walrus.md`](./walrus.md)) |
| `@mysten/suins` | `1.1.4` | SuiNS handle resolution (see [`suins.md`](./suins.md)) |
| `@mysten-incubation/memwal` | `0.0.7` | Agent memory (backend only, see [`memwal.md`](./memwal.md)) |
| `hono` | `4.12.23` | Backend web framework + type-safe RPC |
| `@hono/node-server` | `2.0.4` | Node adapter (peer `hono ^4`) |
| `@hono/zod-validator` | latest | Request validation bound to Zod schemas |
| `@mysten/codegen` | latest | Move-module → TypeScript bindings |

> **DO NOT** install legacy `@mysten/dapp-kit` (last `1.0.6`). It is JSON-RPC-only and explicitly
> not recommended for new projects. The hooks `WalletProvider`, `SuiClientProvider`, and
> `useSignAndExecuteTransaction` belong to that legacy package and **do not exist** in the v2 kit.

---

## 2. Repository layout

This mirrors [`architecture.md`](./architecture.md) §7 with file-level detail. `apps/web` is a
static SPA (no secrets, world-readable on Walrus Sites); `apps/api` is the only place secrets live.

```
WalrusUrchin/
├── apps/
│   ├── web/                      # Vite 8 + React + TS SPA → deployed to Walrus Sites
│   │   ├── src/
│   │   │   ├── dapp-kit.ts        # createDAppKit() + `declare module` Register typing (§3)
│   │   │   ├── main.tsx           # <DAppKitProvider dAppKit={dAppKit}> root
│   │   │   ├── lib/api.ts         # hc<AppType> client → apps/api (§5)
│   │   │   ├── lib/enoki.ts       # registerEnokiWallets (PUBLIC key only) (§3.3)
│   │   │   ├── features/          # creator dashboard, fan checkout, feed, DM
│   │   │   └── index.css          # Tailwind v4 entry (@import "tailwindcss";)
│   │   ├── ws-resources.json      # Walrus Sites: routes "/*" → "/index.html", object_id (§7)
│   │   ├── vite.config.ts         # plugin-react + tailwind + dev proxy /api → :3000 (§4)
│   │   ├── tsconfig.json          # extends @walrus-urchin/config/tsconfig.base
│   │   └── package.json
│   └── api/                       # Hono 4.12 on @hono/node-server — THE TRUST BOUNDARY
│       ├── src/
│       │   ├── index.ts           # method-chained app; export type AppType (§5)
│       │   ├── routes/sponsor.ts  # Enoki SECRET key → /sponsor (§6)
│       │   ├── routes/harbor.ts   # hbr_ + suiprivkey1 service key → grant/upload (see habour.md)
│       │   ├── routes/memory.ts   # memwal delegate key → remember/recall (see memwal.md)
│       │   └── routes/webhook.ts  # indexer / cron: renewals, grant reconcile
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── contracts/                 # Move package `walrus_urchin` (Move.toml edition "2024.beta")
│   │   ├── Move.toml
│   │   ├── sources/               # creator, tier, subscription, access_policy, bundle …
│   │   └── tests/
│   ├── move-client/               # @mysten/codegen output + Transaction builders (turbo `codegen`)
│   │   ├── src/generated/         # GENERATED — do not hand-edit
│   │   └── src/builders.ts        # subscribe()/buyPpv()/tip()/publish() PTB helpers
│   ├── sdk/                       # StorageProvider (Harbor + raw-Walrus), Seal + memwal + SuiNS helpers
│   ├── types/                     # Shared DTOs + Zod schemas; re-exports Hono AppType
│   └── config/                    # tsconfig.base.json, eslint preset, tailwind preset, per-network constants
├── docs/                          # this docs repo (PRD + tech references)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json             # also re-exported via packages/config
├── package.json                   # root: workspace scripts wrapping turbo
└── CLAUDE.md
```

Why this shape: `packages/move-client` is the **single source of truth** for package IDs and entry-
function signatures, consumed by *both* `apps/web` (client-side PTB building) and `apps/api` (sponsor
route builds the same `transactionKindBytes`). `packages/types` exports the Hono `AppType` so the SPA
gets compile-time-checked RPC without codegen drift. Secrets never cross from `apps/api` into any
package that `apps/web` imports.

---

## 3. Frontend: the NEW `@mysten/dapp-kit` v2

The dapp-kit was re-architected (June 2026): a framework-agnostic core
(`@mysten/dapp-kit-core`, Lit web components + nanostores) plus thin React bindings
(`@mysten/dapp-kit-react`). State is reactive via nanostores, so **`@tanstack/react-query` is no
longer required by the kit** (we still pull it in to cache Harbor/memwal/feed reads behind the Hono
RPC client — but provide your own `QueryClientProvider` only if you use it).

### 3.1 The kit instance + global typing

Centralize the kit in `apps/web/src/dapp-kit.ts`. The `declare module` block registers the kit type
globally so every WalrusUrchin hook (`useCurrentAccount`, `useDAppKit`, …) is typed without threading
`dAppKit` through props.

```ts
// apps/web/src/dapp-kit.ts
import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

export const dAppKit = createDAppKit({
  networks: ['testnet'],
  defaultNetwork: 'testnet',
  // gRPC is the default/recommended transport in v2 (legacy kit was JSON-RPC only).
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: 'https://fullnode.testnet.sui.io:443' }),
  autoConnect: true,           // default
  enableBurnerWallet: false,   // dev-only; default false
  // slushWalletConfig: null,  // Slush is built in; set null to disable
});

// Global hook typing — REQUIRED for the v2 hooks to be typed.
declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
```

```ts
// apps/web/src/main.tsx
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { dAppKit } from './dapp-kit';
import '@mysten/dapp-kit-react/ui/styles.css';

createRoot(document.getElementById('root')!).render(
  // DAppKitProvider's ONLY prop is dAppKit.
  <DAppKitProvider dAppKit={dAppKit}>
    <App />
  </DAppKitProvider>,
);
```

### 3.2 Transactions — the v2 surface

All WalrusUrchin writes (subscribe, buy PPV, tip, mint transferable subscription NFT, bundle
purchase) go through `useDAppKit().signAndExecuteTransaction`. There is **no
`useSignAndExecuteTransaction` hook** in v2. The result is a discriminated union — branch on it so
the UI can surface Move abort messages (tier-not-active, insufficient payment) to fans.

```ts
import { useDAppKit } from '@mysten/dapp-kit-react';
import { buildSubscribeTx } from '@walrus-urchin/move-client';

function SubscribeButton({ tierId }: { tierId: string }) {
  const dAppKit = useDAppKit();
  async function onSubscribe() {
    const transaction = buildSubscribeTx({ tierId });
    const result = await dAppKit.signAndExecuteTransaction({ transaction });
    if ('Transaction' in result) {
      console.log('digest', result.Transaction.digest);
    } else {
      // FailedTransaction branch
      throw new Error(result.FailedTransaction.status.error?.message ?? 'tx failed');
    }
  }
  return <button onClick={onSubscribe}>Subscribe</button>;
}
```

**Hooks available in v2** (verbatim): `useDAppKit`, `useWalletConnection`, `useCurrentAccount`,
`useCurrentWallet`, `useCurrentNetwork`, `useCurrentClient`, `useWallets`. **Components:**
`ConnectButton`, `ConnectModal`, `DAppKitProvider` — `ConnectButton`/`ConnectModal` import from
`@mysten/dapp-kit-react/ui`. The kit instance also exposes reactive stores (`$wallets`,
`$connection`, `$currentNetwork`, `$currentClient`) and actions (`connectWallet`, `switchNetwork`,
`signTransaction`, `signAndExecuteTransaction`, `signPersonalMessage`, …).

### 3.3 Enoki wallets (frontend) — PUBLIC key only

zkLogin (Google / Twitch / Facebook) is the default login for fans and creators. The SPA registers
Enoki wallets with the **PUBLIC** Enoki API key; they implement Wallet Standard so they appear in the
standard `ConnectButton` modal alongside Slush. **The secret key never reaches the browser** — it is
world-readable on Walrus Sites (sponsorship is a backend route, §6).

```ts
// apps/web/src/lib/enoki.ts
import { registerEnokiWallets } from '@mysten/enoki';

// Enoki wallets are NETWORK-BOUND: re-register on network switch (hook to the
// kit's $currentNetwork store / useCurrentNetwork, NOT the legacy useSuiClientContext).
export function setupEnoki(client, network) {
  const { unregister } = registerEnokiWallets({
    client,
    network,
    apiKey: import.meta.env.VITE_ENOKI_PUBLIC_KEY, // PUBLIC key
    providers: {
      google: { clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID },
      twitch: { clientId: import.meta.env.VITE_TWITCH_CLIENT_ID },
    },
  });
  return unregister;
}
```

> **UNVERIFIED / risk (the one to budget a spike on):** Enoki's published docs
> (`@mysten/enoki` 1.0.8, "Register Enoki Wallets") still target the **legacy**
> `SuiClientProvider`/`WalletProvider` + a `useEffect` calling `registerEnokiWallets`. There is no
> first-class `createDAppKit`/`walletInitializers` Enoki recipe published yet. Wiring
> `registerEnokiWallets` into the v2 kit (via `walletInitializers` or a `useEffect` that registers
> wallet-standard wallets, re-registering on network switch) is **the single riskiest integration in
> WalrusUrchin** — verify against an updated example before relying on it. This is the
> "Enoki ↔ new dapp-kit wiring" risk tracked in [`architecture.md`](./architecture.md) §9. Auth depth
> lives in [`auth.md`](./auth.md).

---

## 4. Vite 8 (Rolldown) configuration

Vite 8 is Rolldown-powered; `@vitejs/plugin-react` must be `^6` (peer `vite ^8`). Tailwind v4 (what
`npm create @mysten/dapp` emits) uses the `@tailwindcss/vite` plugin and a CSS-first config
(`@import "tailwindcss";`), not the v3 `tailwind.config.js` JS model. The dev proxy routes
`/api` → the Hono dev server so the SPA is same-origin in dev (no CORS).

```ts
// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Dev only: SPA → Hono on :3000, same-origin, no CORS.
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' }, // → fed to site-builder (§7)
});
```

In **prod** the SPA is hosted cross-origin on a Walrus Site and calls the Hono backend over the
network, so the proxy does not apply — configure `hono/cors` with the exact Walrus Site origin and
use wallet-signed-message / JWT auth (not same-origin trust). See §6.

---

## 5. Backend: Hono type-safe RPC (`apps/api`)

Hono runs on `@hono/node-server` for the MVP — the simplest place to hold long-lived
Enoki/Harbor/memwal secrets and to call gRPC fullnodes. Keep handlers Web-Standard so they stay
portable to Bun / Cloudflare Workers later (but avoid edge for routes doing heavy Seal/Harbor crypto
with long-lived secrets unless using Workers secret bindings).

**Critical footgun:** Hono RPC type inference **silently breaks** if routes are registered as
separate statements (`app.route('/a', a); app.route('/b', b)`). The exported `AppType` must come from
a **method-chained** app, or `hc<AppType>` loses route typing. Validate with `@hono/zod-validator`
against the shared Zod schemas in `packages/types`.

```ts
// apps/api/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { sponsor } from './routes/sponsor';
import { harbor } from './routes/harbor';
import { memory } from './routes/memory';

const app = new Hono()
  .use('*', cors({ origin: process.env.WEB_ORIGIN! /* exact Walrus Site origin */ }))
  // MUST be method-chained for hc<AppType> to infer the full route tree:
  .route('/api/sponsor', sponsor)
  .route('/api/harbor', harbor)
  .route('/api/memory', memory);

export type AppType = typeof app; // re-exported via packages/types
serve({ fetch: app.fetch, port: 3000 });
```

```ts
// apps/web/src/lib/api.ts  — fully-typed client, no codegen
import { hc } from 'hono/client';
import type { AppType } from '@walrus-urchin/types';

// In dev the proxy makes '/' same-origin; in prod use the backend URL.
export const api = hc<AppType>(import.meta.env.VITE_API_URL ?? '/');
```

---

## 6. Sponsored gas + secret-bearing routes

Enoki sponsorship is the mechanism behind WalrusUrchin's "fans never hold SUI" promise. The
`/sponsor` route holds `ENOKI_SECRET_KEY`, builds the `transactionKindBytes`, and calls
`EnokiClient.createSponsoredTransaction`. Per [`architecture.md`](./architecture.md) §3, the route
**must verify `sender === authenticated user`** and only sponsor allowlisted `walrus_urchin` entry
functions, so the gas pool can't be drained.

```ts
// apps/api/src/routes/sponsor.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { EnokiClient } from '@mysten/enoki';
import { z } from 'zod';

const enoki = new EnokiClient({ apiKey: process.env.ENOKI_SECRET_KEY! }); // SECRET — server only

const body = z.object({
  transactionKindBytes: z.string(), // base64 tx kind built from packages/move-client
  sender: z.string(),               // must equal the authenticated address
});

// Chained so the route type flows into AppType.
export const sponsor = new Hono().post('/', zValidator('json', body), async (c) => {
  const { transactionKindBytes, sender } = c.req.valid('json');
  // TODO: assert sender === authenticated user (wallet-signed session); reject otherwise.
  const { bytes, digest } = await enoki.createSponsoredTransaction({
    network: 'testnet',
    transactionKindBytes,
    sender,
  });
  return c.json({ bytes, digest }); // wallet signs `bytes`, then /sponsor/:digest/execute
});
```

The same trust-boundary pattern applies to the other secret-bearing routes, each detailed in its own
doc:

| Route | Secret held | Purpose | Reference |
| --- | --- | --- | --- |
| `POST /api/sponsor` | Enoki **secret** key | Sponsored gas (`createSponsoredTransaction`) | [`auth.md`](./auth.md) |
| `/api/harbor/*` | Harbor `hbr_` + `suiprivkey1` service key | Bucket lifecycle, `grant_bucket_access` per fan, `unshare_bucket_access` on lapse | [`habour.md`](./habour.md) |
| `/api/memory/*` | memwal Ed25519 delegate key | `remember` / `recall` / `ask` over namespaces | [`memwal.md`](./memwal.md) |
| `/api/webhook` | (indexer) | Renewal nudges, on-chain → Harbor grant reconcile | [`data-flows.md`](./data-flows.md) |

> The frontend **only ever** holds the Enoki PUBLIC key. Harbor and memwal credentials are never
> embedded in the SPA bundle — `apps/web` uploads ciphertext and stores memory through these thin
> Hono proxies. See the full Harbor REST surface (16 paths incl. the `seal/sponsor` grant pair) in
> [`habour.md`](./habour.md).

---

## 7. Walrus Sites deploy

`apps/web` ships as a Walrus Site: static files on Walrus + a Sui object indexing them + the
`site-builder` CLI + a portal that serves them. SPA deep links (`/c/:handle`, `/post/:id`) must
survive a hard refresh, so `ws-resources.json` maps the wildcard route to `index.html`.

```jsonc
// apps/web/ws-resources.json
{
  // object_id is written by the FIRST deploy; commit it for idempotent redeploys.
  "object_id": "0x…",
  "routes": {
    // Wildcards are END-only ('/path/*' OK; '*/x' and '/x/*/y' are INVALID).
    // Target MUST be a real resource present in dist/ (the Move contract aborts otherwise).
    "/*": "/index.html"
  }
}
```

Deploy pipeline (testnet):

```bash
# 1. Install the site-builder binary + sites-config.yaml (~/.config/walrus/) once.
#    e.g. curl .../site-builder-testnet-latest-$SYSTEM -o site-builder

# 2. Build the SPA.
pnpm --filter @walrus-urchin/web build          # → apps/web/dist

# 3. Deploy. --epochs is REQUIRED and > 0.
site-builder --context=testnet deploy --epochs 30 ./apps/web/dist

# 4. Resolve the Base36 subdomain from the object id.
site-builder convert <object_id>
```

| Walrus Sites fact | Value / note |
| --- | --- |
| `--epochs` | Required, > 0. Testnet epoch = **1 day**, mainnet = 14 days, max **53** epochs (~2 yrs) |
| First deploy | Publishes a new site, writes `object_id` into `ws-resources.json` |
| Subsequent deploys | Update the existing object (track `object_id` in the repo) |
| `ws-resources.json` | Not itself uploaded/served; supports `object_id`, `routes`, `headers`, `metadata` |
| **Testnet portal** | **No official public testnet portal** — self-host (local dev) or use a community portal to share the demo |
| Cost / expiry | Costs SUI + WAL; site goes dark after the purchased epochs — **epoch renewal is an ops obligation** |

See [`walrus.md`](./walrus.md) for blob storage / epoch mechanics and the raw-Walrus upload path.

---

## 8. pnpm workspaces + Turborepo

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```jsonc
// turbo.json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    // Move bindings must regenerate BEFORE anything that imports them builds.
    "codegen": { "cache": false, "outputs": ["src/generated/**"] },
    "build": {
      "dependsOn": ["^build", "codegen"],
      "outputs": ["dist/**", "build/**"]
    },
    "dev": { "cache": false, "persistent": true, "dependsOn": ["codegen"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build", "codegen"] }
  }
}
```

```jsonc
// tsconfig.base.json (also re-exported from packages/config and `extends`-ed by every package)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
```

```jsonc
// root package.json (scripts wrap turbo)
{
  "packageManager": "pnpm@11.5.1",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "codegen": "turbo run codegen"
  }
}
```

### Move → TS codegen in the build graph

`@mysten/codegen` turns the `walrus_urchin` Move modules into TypeScript bindings in
`packages/move-client/src/generated`. Wiring it as a turbo `codegen` task (a `dependsOn` of `build`,
`dev`, and `typecheck`) means a change to the contracts — subscription, access policy, revenue-share,
NFT transfer — regenerates bindings *before* `apps/web` and `apps/api` build. Both the client-side
PTB builders and the server-side `/sponsor` route then share one source of truth for package IDs and
entry-function signatures.

---

## 9. Scaffold & install commands

The official scaffolder is `@mysten/create-dapp`. Its templates ship the v2 stack we want
(React + TS + Vite + Tailwind v4 + `@mysten/dapp-kit-react` + pnpm); the `react-e2e-counter` template
additionally wires `@mysten/codegen` and a `pnpm codegen` script — the closest starting point for
`apps/web` + `packages/move-client`.

```bash
# Scaffold the SPA from the official template (gives the v2 dapp-kit + Tailwind v4 + codegen wiring).
pnpm create @mysten/dapp        # or: npm create @mysten/dapp  → pick react-e2e-counter

# Frontend deps (apps/web) — pin the v2 majors.
pnpm --filter @walrus-urchin/web add \
  @mysten/dapp-kit-react@2.0.3 @mysten/dapp-kit-core@1.3.2 \
  @mysten/sui@2.17.0 @mysten/enoki@1.0.8 @mysten/seal@1.1.3 \
  @mysten/suins@1.1.4
pnpm --filter @walrus-urchin/web add -D \
  vite@8.0.16 @vitejs/plugin-react@6.0.2 @tailwindcss/vite

# Backend deps (apps/api) — secrets boundary.
pnpm --filter @walrus-urchin/api add \
  hono@4.12.23 @hono/node-server@2.0.4 @hono/zod-validator zod \
  @mysten/enoki@1.0.8 @mysten-incubation/memwal@0.0.7

# Root tooling.
pnpm add -Dw turbo@2.9.16 @mysten/codegen
```

> The default Sui CLI publish in `create-dapp` uses `--gas-budget 100000000`; gas-budget flags and
> faucet endpoints drift — verify against the current Sui CLI before baking into deploy scripts. See
> [`sui.md`](./sui.md).

---

## Gotchas

- **Legacy vs v2 dapp-kit.** Of the prompt-era names, only `useCurrentAccount` survives in v2. The
  legacy package (`@mysten/dapp-kit` 1.0.6) is JSON-RPC-only and deprecated for new builds; do not
  scaffold against `SuiClientProvider`, `WalletProvider`, or `useSignAndExecuteTransaction` — they do
  not exist in v2. Use `DAppKitProvider`, `useDAppKit().signAndExecuteTransaction`, `createDAppKit`.
- **Enoki ↔ v2 wiring is UNVERIFIED.** `@mysten/enoki` 1.0.8 docs still show the legacy
  `SuiClientProvider`/`WalletProvider` + `useEffect` `registerEnokiWallets({ unregister })` recipe.
  No first-class `createDAppKit`/`walletInitializers` Enoki integration is published yet — confirm
  against an updated example. This is the single riskiest integration; budget a spike.
- **Enoki wallets are network-bound.** Re-register on network switch, hooked to the kit's
  `$currentNetwork` / `useCurrentNetwork`, **not** the legacy `useSuiClientContext`.
- **Enoki key split is a security boundary.** PUBLIC key in `apps/web`; PRIVATE `ENOKI_SECRET_KEY`
  only in `apps/api`. Leaking the secret into the SPA bundle (world-readable on Walrus Sites) is a
  critical failure — sponsorship MUST be a backend route.
- **Hono RPC inference breaks silently** if routes are not method-chained. The exported `AppType`
  must come from the chained app, or `hc<AppType>` loses route typing.
- **Vite 8 / plugin-react 6 / Tailwind v4 are a matched set.** Vite 8 is Rolldown-based and needs
  `@vitejs/plugin-react ^6`; most tutorials target Vite 5/6. Tailwind v4 uses a CSS-first config, not
  the v3 JS config.
- **`@tanstack/react-query` is NOT required** by the v2 kit (nanostores-based). The legacy install
  line (`@mysten/dapp-kit @mysten/sui @tanstack/react-query`) is misleading; provide a
  `QueryClientProvider` only if you actually use react-query.
- **Walrus Sites route wildcards are END-only**, and route targets must be literally-present
  resources in `dist/` (the Move contract aborts on dangling targets). The SPA fallback must point to
  a real `/index.html`.
- **No official public testnet portal** for Walrus Sites — sharing the demo requires self-hosting or
  a community portal. Easy to overlook for a hackathon/demo.
- **Walrus Sites expire** after the purchased epochs (testnet 1 day/epoch). A forgotten redeploy
  takes the live URL dark — treat epoch renewal as ops.
- **gRPC fullnode uses port 443** (`https://fullnode.testnet.sui.io:443`). Some corporate
  networks/proxies block gRPC-web; keep a JSON-RPC/GraphQL fallback documented if the demo network is
  restrictive.
- **dapp-kit-core uses Lit web components** (custom elements) + a scoped custom-element-registry
  polyfill. Strict CSP or environments blocking custom-element registration can break
  `ConnectButton`/`ConnectModal`. `DAppKitProvider` is SSR-safe, but wallet-interacting components
  must be client-only — relevant only if WalrusUrchin ever adds SSR/prerender.
- **`@mysten-incubation/memwal` is BETA** and relayer-based; its API may churn. Pin `0.0.7` and
  isolate it behind the Hono `/api/memory` adapter so changes don't leak into `apps/web`. See
  [`memwal.md`](./memwal.md).
- **Harbor is alpha/testnet** — confirm endpoint shapes against the live `openapi.yaml` before
  scaffolding the proxy; abstract it behind the `StorageProvider` interface. See
  [`habour.md`](./habour.md).

## Sources

- https://sdk.mystenlabs.com/dapp-kit
- https://github.com/MystenLabs/ts-sdks/blob/main/packages/docs/content/dapp-kit/getting-started/react.mdx
- https://github.com/MystenLabs/ts-sdks/blob/main/packages/docs/content/dapp-kit/dapp-kit-instance.mdx
- https://github.com/MystenLabs/ts-sdks/blob/main/packages/docs/content/dapp-kit/getting-started/create-dapp.mdx
- https://github.com/MystenLabs/ts-sdks/blob/main/packages/docs/content/dapp-kit/react/dapp-kit-provider.mdx
- https://github.com/MystenLabs/ts-sdks/tree/main/packages/dapp-kit/examples/react/simple
- https://registry.npmjs.org/@mysten/dapp-kit-react/latest
- https://registry.npmjs.org/@mysten/dapp-kit-core/latest
- https://registry.npmjs.org/@mysten/enoki/latest
- https://registry.npmjs.org/@mysten/sui/latest
- https://www.npmjs.com/package/@mysten/dapp-kit
- https://docs.enoki.mystenlabs.com/ts-sdk/register
- https://docs.enoki.mystenlabs.com/ts-sdk/sponsored-transactions
- https://docs.enoki.mystenlabs.com/
- https://hono.dev/docs/guides/rpc
- https://hono.dev/docs/concepts/stacks
- https://registry.npmjs.org/hono/latest
- https://registry.npmjs.org/@hono/node-server/latest
- https://registry.npmjs.org/vite/latest
- https://registry.npmjs.org/@vitejs/plugin-react/latest
- https://registry.npmjs.org/turbo/latest
- https://registry.npmjs.org/pnpm/latest
- https://docs.wal.app/docs/sites/getting-started/publishing-your-first-site
- https://docs.wal.app/walrus-sites/commands.html
- https://docs.wal.app/walrus-sites/routing.html
- https://github.com/MystenLabs/walrus/blob/main/docs/content/sites/getting-started/using-the-site-builder.mdx
- https://github.com/MystenLabs/MemWal
- https://www.npmjs.com/package/@mysten-incubation/memwal
