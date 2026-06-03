# WalrusUrchin — Technical Documentation

Per-technology references for building WalrusUrchin, a decentralized Patreon on the Sui Stack. Read the
**[architecture keystone](./architecture.md)** first — it defines the trust model, on-chain object model,
the two content-access paths, the monorepo, and the pinned per-network configuration that every other doc
relies on.

## Recommended reading order

1. **[architecture.md](./architecture.md)** ⭐ — the whole system on one page; read before anything else.
2. **[data-flows.md](./data-flows.md)** — concrete end-to-end sequences that tie the pieces together.
3. The component you're working on:

| Doc | Component | Role in WalrusUrchin |
| --- | --- | --- |
| [sui.md](./sui.md) | **Sui** (Move 2024) | Profiles, tiers, subscriptions, PPV, tips, bundles, revenue splits, transferable NFTs |
| [seal.md](./seal.md) | **Seal** | Threshold encryption + `seal_approve` access control (tier / PPV / allowlist / DM / time-lock) |
| [walrus.md](./walrus.md) | **Walrus** | Blob storage for media; hosting the SPA as a Walrus Site |
| [habour.md](./habour.md) | **Harbor** *(mandated)* | Managed Walrus+Seal gateway; per-fan access grants |
| [memwal.md](./memwal.md) | **memwal** *(mandated)* | Portable encrypted agent memory (concierge, support bot, recall) |
| [suins.md](./suins.md) | **SuiNS** | Portable creator handles + subnames + on-chain profile metadata |
| [auth.md](./auth.md) | **zkLogin / Passkey / Enoki** | Passwordless sign-in + sponsored gas |
| [monorepo.md](./monorepo.md) | **Engineering stack** | Vite + Hono + pnpm + Turborepo + Walrus Sites; versions, scaffolding |

## Glossary

- **`seal_approve`** — a side-effect-free Move function evaluated (via dry-run) by Seal key servers to decide
  whether to release a decryption key share. The single source of truth for access.
- **SessionKey** — a short-lived, per-package Seal key authorization: the user signs one personal message, then
  fetches decryption keys for `ttlMin` minutes without re-signing.
- **Envelope encryption** — encrypt the (large) blob with a per-file AES DEK, then Seal-encrypt only the small
  DEK. Lets you rotate key servers/threshold (frozen at encrypt time) without re-uploading content.
- **Blob ID vs Object ID** — a Walrus blob has a content-addressed **Blob ID** (read by this) and a Sui
  **Object ID** (own/extend/delete this).
- **Grant (`grant_bucket_access`)** — Harbor's primitive to give a specific Sui address decrypt access to a
  bucket, so a paying **fan** can decrypt client-side without holding the service key.
- **Path A / Path B** — Harbor-managed access (MVP) vs self-managed Seal (north star). See
  [architecture §5](./architecture.md#5-the-two-content-access-paths).
- **Pull-based renewal** — Sui has no scheduler, so recurring subscriptions are renewed by a `renew()`
  transaction (manual or relayer-driven), not an automatic charge.

## Pinned configuration

On-chain package/object IDs, key-server IDs, endpoints, and library versions (June 2026) are centralized in
**[architecture.md §8](./architecture.md#8-per-network-configuration-testnet--the-build-target)**. Treat that
table as the single source of truth; verify live before mainnet (IDs change with releases; Harbor is alpha).
