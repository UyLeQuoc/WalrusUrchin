Must follow all coding rules in [`.agent/code-rule.md`](./.agent/code-rule.md).

# CLAUDE.md — WalrusUrchin

Project context for Claude Code. Read this first, then [`docs/tech/architecture.md`](./docs/tech/architecture.md).

## What this is

**WalrusUrchin** is a decentralized **Patreon built on the Sui Stack**: creators own identity (SuiNS),
content (Walrus + Seal), and monetization (Sui Move); fans get passwordless, gasless, encrypted access.
The differentiator vs Patreon is a low, **on-chain, transparent** fee, no deplatforming, audience
ownership, and **portable/composable** access rights.

## Current status — INITIAL SCAFFOLD

The repo now contains the docs plus an initial Bun/Turborepo scaffold: Vite web, Hono API,
shared `cores`, shared ESLint/TypeScript config packages, and a starter Move contract project.
Product implementation is still early. **Do not add feature code unless asked.** Build target is
**Sui testnet** first (Harbor and memwal are testnet/beta).

## Mandated stack (non-negotiable)

- **Sui** — Move 2024 contracts for all monetization + access logic.
- **Seal** — encrypt private content; gate decryption with on-chain `seal_approve`.
- **Walrus** — blob storage for media; can also host the SPA as a Walrus Site.
- **Harbor** (`api.testnet.harbor.walrus.xyz`) — **MUST** be used to store files (managed Walrus+Seal). → [`docs/tech/habour.md`](./docs/tech/habour.md)
- **memwal / Walrus Memory** (`@mysten-incubation/memwal`) — **MUST** be integrated for AI memory. → [`docs/tech/memwal.md`](./docs/tech/memwal.md)
- **SuiNS** — `creatorname.sui` portable handles.
- **zkLogin / Passkey / Enoki** — passwordless auth + sponsored gas.
- **Frontend = Vite** + React + TypeScript (not Next). **Backend = Hono**, only where a server secret is needed.

## Current scaffold

```
apps/web        Vite 8 + React + TS SPA. Walrus-Sites deployable.
apps/api        Hono API on port 5000 — THE TRUST BOUNDARY (all secrets live here).
apps/contracts  Starter Sui Move package `walrus_urchin` (Move.toml edition "2024.beta").
packages/cores  Shared UI, types, and Zod validations.
packages/eslint-config  Shared ESLint flat configs.
packages/ts-config      Shared TypeScript configs.
packages/move-client  @mysten/codegen TS bindings + Transaction builders.
packages/sdk          StorageProvider (Harbor + raw-Walrus), Seal helpers, memwal adapter, SuiNS helpers.
packages/config       Per-network constants.
```
Tooling: **Bun workspaces + Turborepo 2.9**. The older deep-dive notes live in
[`docs/tech/monorepo.md`](./docs/tech/monorepo.md); verify them against the current scaffold before relying on
package-manager details.

## Architecture invariants (do not violate)

1. **Secrets only in `apps/api`.** The Enoki *secret* key, Harbor `hbr_` + `suiprivkey1` service key, and the
   memwal delegate key must **never** ship in the SPA bundle (it's world-readable on Walrus Sites). The
   frontend only holds the Enoki **public** key.
2. **Walrus is public** — always Seal-encrypt private content **before** upload. Uploading plaintext paid
   content is a permanent, irreversible leak.
3. **Two content-access paths** (both store ciphertext, gate on-chain):
   - **Path A (MVP, mandated):** Harbor stores ciphertext; backend issues `grant_bucket_access` to each paying
     **fan's** Sui address so the fan decrypts **client-side** with their own SessionKey (no service key given
     to fans). `unshare_bucket_access` on lapse.
   - **Path B (north star):** self-managed Seal — our `walrus_urchin::access_policy::seal_approve` reads the
     fan's on-chain Subscription/Entitlement directly; no backend in the trust path.
   - Both sit behind a `StorageProvider`/`AccessPolicy` interface.
4. **Envelope encryption** for large media: per-file AES-256-GCM DEK encrypts the blob; Seal encrypts only the
   DEK (key servers + threshold are frozen at encrypt time).
5. **No on-chain cron** — recurring subscriptions are pull-based `renew()` txs (manual or relayer-driven).
6. **memwal = agent memory only**, never the media store. One platform account + one backend delegate key,
   multiplexed by flat namespaces (`creator:<suins>`, `fan:<addr>`, `kb:<creatorId>`, `dm:<creatorId>:<fanAddr>`).

## Corrections the research surfaced (don't repeat the old mistakes)

- **Harbor:** the original `habour.md` paste OMITTED the `/api/v1/seal/sponsor` **grant** endpoints
  (`grant_bucket_access` / `unshare_bucket_access` / …) — these are *the* primitive for fan access. The real
  error enum uses **`bucket_not_finalized`** (not `digest_expired`, which is prose-only). Use Harbor's **3
  pinned key servers** with `verifyKeyServers:false` and **threshold 2-of-3** (not the generic allowlist).
  Encrypt + `SessionKey` use `HARBOR_ORIGINAL_PACKAGE_ID`; the decrypt PTB targets `HARBOR_LATEST_PACKAGE_ID`.
- **memwal:** authoritative relayer host is **`relayer.memwal.ai`** / `relayer.staging.memwal.ai` (the
  `*.memory.walrus.xyz` hosts in early pastes are unverified). Keep `serverUrl` configurable. `remember()`
  **appends only** (no upsert/delete) → dedup at the app layer.
- **dApp Kit was re-architected (June 2026):** use **`@mysten/dapp-kit-react@2` + `@mysten/dapp-kit-core`**
  (`createDAppKit` / `DAppKitProvider` / `useDAppKit().signAndExecuteTransaction`). Legacy `@mysten/dapp-kit@1.0.6`
  is deprecated; `useSignAndExecuteTransaction`/`WalletProvider` do **not** exist in v2. Wiring Enoki into the new
  kit is the riskiest integration — verify against a current example.

## Pinned config & versions

Centralized in [`docs/tech/architecture.md` §8](./docs/tech/architecture.md#8-per-network-configuration-testnet--the-build-target)
(testnet IDs/endpoints + library versions, June 2026). Treat it as the single source of truth; verify live
before mainnet.

## Working conventions

- **Docs:** every tech doc ends with **Gotchas** + **Sources**; cross-link siblings with relative paths;
  flag UNVERIFIED/alpha/testnet inline. The Harbor doc file is `habour.md` (call the product "Harbor").
- **Git:** branch off `main`; commit/push only when asked. Co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **When you do write code:** match the pinned versions, keep secrets server-side, abstract Harbor behind
  `StorageProvider`, and wire `@mysten/codegen` so Move changes regenerate `packages/move-client` before build.

## Doc map

- [`docs/README.md`](./docs/README.md) — docs index & project overview
- [`docs/PRD.md`](./docs/PRD.md) — product requirements
- [`docs/tech/architecture.md`](./docs/tech/architecture.md) — ⭐ keystone
- [`docs/tech/data-flows.md`](./docs/tech/data-flows.md) — end-to-end sequences
- [`docs/tech/`](./docs/tech/README.md) — sui · seal · walrus · habour · memwal · suins · auth · monorepo
