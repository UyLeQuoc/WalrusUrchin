# WalrusUrchin — Documentation

**WalrusUrchin** is a decentralized social creator network built end-to-end on the **Sui Stack**:
public social feeds, profiles, follows, comments, reactions, and discovery live alongside paid
memberships, pay-to-view posts, private blogs, encrypted files, tips, and creator-owned access.

> **Status:** early app scaffold + product planning (June 2026). The current PRD is the product pivot
> from a Patreon-style creator app into a social network with native paid/private creator media. Build
> target is **Sui testnet** first (Harbor and memwal are testnet/beta).

## Start here

| Doc                                                | What it is                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **[PRD.md](./PRD.md)**                             | Product Requirements — vision, problem, personas, features, monetization, roadmap, risks                                    |
| **[tech/architecture.md](./tech/architecture.md)** | The keystone — layered architecture, trust model, on-chain object model, the two access paths, monorepo, per-network config |
| **[tech/data-flows.md](./tech/data-flows.md)**     | End-to-end sequences (onboard, publish, subscribe, unlock, tip, message, resale)                                            |
| **[tech/README.md](./tech/README.md)**             | Index of all per-technology references + recommended reading order                                                          |

## The Sui Stack, at a glance

- **Sui** — programmable logic: subscriptions, payments, tiers, transparent revenue splits, transferable access NFTs.
- **Seal** — threshold encryption + on-chain `seal_approve` access control for private content.
- **Walrus** — decentralized blob storage for all media; also hosts the SPA as a Walrus Site.
- **Harbor** _(mandated)_ — managed Walrus+Seal storage gateway (`api.testnet.harbor.walrus.xyz`).
- **SuiNS** — portable, human-readable creator handles (`creatorname.sui`).
- **zkLogin / Passkey / Enoki** — passwordless sign-in + sponsored gas (users never hold SUI).
- **memwal / Walrus Memory** _(mandated)_ — portable, encrypted AI memory for a creator concierge & fan-support bot.

## How this repo is organized

```
docs/
├── README.md            ← you are here
├── PRD.md               product requirements
└── tech/
    ├── README.md        tech docs index + reading order
    ├── architecture.md  ⭐ keystone (read first)
    ├── data-flows.md    end-to-end sequences
    ├── sui.md           Sui / Move contracts
    ├── seal.md          Seal encryption + access control
    ├── walrus.md        Walrus storage + Walrus Sites
    ├── habour.md        Harbor managed storage (mandated file store)
    ├── memwal.md        Walrus Memory (mandated agent memory)
    ├── suins.md         SuiNS identity
    ├── auth.md          zkLogin / Passkey / Enoki
    └── monorepo.md      Vite + Hono + pnpm + Turborepo + Walrus Sites
```

> Note: the Harbor doc is named `habour.md` (the original filename); the product itself is **Harbor**.

## Conventions

- Everything targets **testnet** until noted otherwise; on-chain IDs and versions are pinned in
  [`architecture.md` §8](./tech/architecture.md#8-per-network-configuration-testnet--the-build-target).
- Every tech doc ends with **Gotchas** and **Sources** sections.
- Facts marked **UNVERIFIED** / alpha / testnet are flagged inline — confirm before relying on them.
