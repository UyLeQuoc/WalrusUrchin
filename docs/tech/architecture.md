# WalrusUrchin — System Architecture

> Status: **design / docs-only** (June 2026). No application code is scaffolded yet; this
> document is the canonical reference that the rest of `docs/tech/*` and the future
> implementation are built against. Everything targets **Sui testnet** first (Harbor and
> memwal are testnet/beta).

WalrusUrchin is a decentralized, censorship-resistant Patreon built end-to-end on the **Sui
Stack**. Creators own their identity (SuiNS), content (Walrus + Seal), and monetization rules
(Sui Move contracts); fans get transparent, verifiable, encrypted access. There is no custodial
platform that owns the audience relationship, and the platform fee is a small, on-chain,
publicly-auditable constant rather than Patreon's stacked 10% + ~2.9%+$0.30 (+30% Apple).

This document defines: the layered architecture, the trust model, the on-chain object model, the
two content-access paths (Harbor-managed vs self-managed Seal), the monorepo layout, naming and
namespace conventions, and the per-network configuration. Deep references for each technology live
in the sibling docs linked throughout.

---

## 1. The Sui Stack, mapped to WalrusUrchin

| Layer | Technology | Role in WalrusUrchin | Reference |
| --- | --- | --- | --- |
| Programmable logic | **Sui** (Move 2024, objects, PTBs) | Creator profiles, tiers, subscriptions, PPV, tipping, bundles, transparent revenue splits, transferable access NFTs | [`sui.md`](./sui.md) |
| Access control + encryption | **Seal** (IBE threshold encryption, `seal_approve`) | Encrypt private content; gate decryption keys by on-chain subscription / PPV / allowlist | [`seal.md`](./seal.md) |
| Blob storage | **Walrus** (RedStuff erasure coding) | Store all media, downloadables, archives, message blobs; host the SPA as a Walrus Site | [`walrus.md`](./walrus.md) |
| Managed storage API | **Harbor** (`api.testnet.harbor.walrus.xyz`) | **Mandated** managed Walrus+Seal gateway: encrypted buckets, sponsored bucket-policy gas, per-fan access grants | [`habour.md`](./habour.md) |
| Identity | **SuiNS** (`creatorname.sui`) | Human-readable, portable creator handles; subnames per tier/fan; avatar + Walrus Site metadata | [`suins.md`](./suins.md) |
| Auth + gas | **zkLogin / Passkey / Enoki** | Passwordless sign-in (Google/Apple/Twitch); sponsored gas so users never hold SUI | [`auth.md`](./auth.md) |
| Agent memory | **memwal / Walrus Memory** (`@mysten-incubation/memwal`) | **Mandated** portable, encrypted AI memory: creator concierge, fan-support bot, preference recall | [`memwal.md`](./memwal.md) |

End-to-end sequences (subscribe, upload, unlock, tip, message) are in [`data-flows.md`](./data-flows.md).
The repo/build/deploy stack is in [`monorepo.md`](./monorepo.md).

---

## 2. Layered architecture

```
                ┌──────────────────────────────────────────────────────────┐
                │  apps/web  —  Vite 8 + React + TS SPA  (new dapp-kit)      │
                │  Hosted as a Walrus Site (static; no secrets, no SSR)     │
                │                                                           │
                │  • Enoki PUBLIC key → zkLogin/Passkey in Connect modal    │
                │  • Builds PTBs (subscribe / buy / tip / publish)          │
                │  • Client-side Seal encrypt & decrypt (SessionKey)        │
                │  • Reads Sui (gRPC), reads media by Blob ID via CDN       │
                └───────────────┬───────────────────────┬──────────────────┘
            tx kind bytes /      │                       │  reads (gRPC / GraphQL),
            REST (signed)        │                       │  ciphertext by Blob ID
                                 ▼                       ▼
        ┌─────────────────────────────────┐   ┌──────────────────────────────┐
        │ apps/api — Hono 4.12 backend    │   │  Sui testnet fullnode         │
        │ THE TRUST BOUNDARY (secrets)    │   │  (objects, events, Clock)     │
        │                                 │   └──────────────────────────────┘
        │  • Enoki SECRET key → /sponsor  │
        │  • Harbor hbr_ key + service    │        ┌──────────────────────────┐
        │    key → upload, finalize,      │───────▶│  Harbor (Walrus + Seal)  │
        │    grant_bucket_access          │        │  managed storage API     │
        │  • memwal delegate key →        │        └──────────────┬───────────┘
        │    remember / recall / ask      │                       │ ciphertext blobs
        │  • Indexer / webhooks / cron    │        ┌──────────────▼───────────┐
        │    (renewals, grant reconcile)  │───────▶│  Walrus blob store        │
        └───────────────┬─────────────────┘        │  (RedStuff, epochs, WAL) │
                         │ remember/recall          └──────────────────────────┘
                         ▼                          ┌──────────────────────────┐
              ┌────────────────────────┐            │  Seal key servers (t-of-n)│
              │ memwal relayer          │───────────▶│  release DEK iff           │
              │ (Walrus Memory)         │            │  seal_approve passes      │
              └────────────────────────┘            └──────────────────────────┘
```

**Why a backend at all?** The brief says "Hono backend nếu cần" (only where needed). It is needed
in exactly three places, all of which require a long-lived server secret that must never ship in a
publicly-hosted SPA bundle:

1. **Enoki gas sponsorship** — the Enoki *private* API key (`/sponsor` + `/sponsor/:digest/execute`).
2. **Harbor** — the `hbr_` API key and the `suiprivkey1` service key (bucket lifecycle + access grants).
3. **memwal** — the Ed25519 delegate key for the platform's Walrus Memory account.

Plus a thin indexer/cron for things Sui can't do on its own (no native scheduler): subscription / blob / SuiNS-name
renewal nudges, and reconciling on-chain subscription state into Harbor Seal grants. Everything else
(reads, PTB building, client-side encrypt/decrypt) happens in the browser.

---

## 3. Trust model & security invariants

These are non-negotiable and every other doc must respect them:

- **Secrets live only in `apps/api`.** The SPA is hosted on Walrus Sites (or any static host) and is
  world-readable. The Enoki *secret* key, Harbor `hbr_`/`suiprivkey1`, and the memwal delegate key
  never reach the browser. The frontend only ever holds the Enoki **public** key.
- **Walrus is public by default.** Every blob is content-addressed and readable by anyone with the
  Blob ID. Private content **must** be Seal-encrypted *before* upload. Uploading plaintext paid
  content is a permanent, irreversible leak — treat it as a security incident class.
- **`seal_approve` gates the key, not the bytes.** Seal enforces access at decryption-key-request time.
  Anyone who already pulled a DEK (within a SessionKey TTL) keeps it; lapsing a subscription stops
  *future* decryption of *new/rotated* content, not re-viewing of already-decrypted material. Mitigate
  with short SessionKey TTLs, per-content-version nonces, and (for revocation) Harbor `unshare_bucket_access`.
- **Address stability is a hard invariant.** A zkLogin address is derived from `(iss, aud, user_salt)`.
  Pin one OAuth client id per environment and let Enoki own the salt; a changed salt permanently loses
  the user's funds, handle, and content access.
- **Sponsorship is allowlisted.** The Enoki key's allowed Move-call targets are exactly the
  WalrusUrchin entry functions; the `/sponsor` route additionally verifies `sender == authenticated user`
  before sponsoring, so the gas pool can't be drained.
- **Harbor is alpha/testnet.** "Endpoint shapes may change before mainnet GA." It is abstracted behind a
  `StorageProvider` interface (§7) so we can swap to raw Walrus+Seal or Harbor-GA without touching
  monetization/content logic.
- **Storage is not forever.** Walrus blobs are prepaid for N epochs (testnet 1 day, mainnet 14 days, max
  ~53 ≈ 2 years). Renewal automation is part of ops; an un-renewed blob backing a live subscription goes dark.

---

## 4. On-chain object model (Move package `walrus_urchin`)

A single upgradeable Move package owns the identity namespace for all Seal-encrypted content and all
monetization logic. Edition `2024.beta`. Authorization uses the **capability pattern** (hold a typed
`*Cap` object), never `msg.sender`-style address checks.

```
CreatorProfile  (shared object)
├─ handle: SuiNS name reference (creatorname.sui)        ── see suins.md
├─ display: name, bio, avatar_blob, banner_blob          ── public Walrus blobs
├─ payout: address  +  earnings: Balance<SUI> (+ USDC)
├─ platform_fee_bps: u16   (transparent, low, e.g. 0–500)
├─ tiers / content attached as dynamic OBJECT fields (dof) so the profile never bloats
└─ admin-gated by →  CreatorCap (owned)

Tier  (per-creator, follows Seal's Service pattern)
├─ creator_id: ID
├─ price: u64        period_ms: u64  (e.g. 30 days; ttl for seal_approve)
├─ seal_namespace    revenue_split: vector<Share{addr, bps}>
└─ kind: SUBSCRIPTION | LIFETIME (period_ms = u64::MAX)

Subscription  (owned NFT)
├─ tier_id, creator_id, started_ms, expires_ms
├─ TRANSFERABLE tiers → `key + store` + Kiosk + TransferPolicy(royalty bps + lock)  ── resale earns creator
└─ SOULBOUND perks    → `key` only (no store)                                       ── cannot be resold

Entitlement / PpvAccess  (owned, soulbound `key`-only)   ── Seal key_request pattern
└─ content_id (blob-bound), buyer, valid_till            ── one-off / rental unlock

Content / Post  (object or dof of CreatorProfile)
├─ tier_id | ppv (access requirement)     is_encrypted: bool
├─ storage ref: { bucket_id, file_id, seal_policy_id } (Harbor) | { blob_id, seal_identity } (raw)
├─ preview_blob (unencrypted teaser)      published_at
└─ media stays encrypted on Walrus; only refs + metadata are on-chain

Bundle      references multiple tiers/content at a discount → mints several access NFTs in one PTB
AccessPolicy module exposes seal_approve variants: subscription (Clock TTL), allowlist, key_request (PPV)
```

**Events** (consumed by the indexer; `subscribeEvent` websocket is deprecated → poll GraphQL/RPC or run
an indexer): `CreatorRegistered`, `TierCreated`, `SubscriptionCreated`, `SubscriptionRenewed`,
`ContentPublished`, `PpvPurchased`, `TipReceived`, `RevenueSplit`, `BundlePurchased`.

**Money flow:** `subscribe()` / `buy_ppv()` / `buy_bundle()` take a `Coin<SUI>` (or USDC) input and, in the
same atomic PTB, `coin::split` it across the tier's `revenue_split` (creator + optional collaborators +
platform fee + optional referrer), emitting one `RevenueSplit` event per recipient. Tips are a direct
transfer (+ optional split) with a `TipReceived` event. **There is no recurring auto-charge on Sui** —
renewal is a pull-based `renew()` transaction (manual, or relayer-driven and Enoki-sponsored).

See [`sui.md`](./sui.md) for the Move primitives (Kiosk, TransferPolicy/royalty rule, Closed-Loop Token for
tip credits, Clock, dynamic fields, sponsored tx) and [`seal.md`](./seal.md) for the `seal_approve` patterns.

---

## 5. The two content-access paths

This is the central architectural decision. Both store **ciphertext** (never plaintext) and gate
decryption on-chain. We ship **Path A** first (it satisfies the Harbor mandate and still gives fans
*client-side* decryption), and treat **Path B** as the trust-minimized north star. Both sit behind the
same `StorageProvider` + `AccessPolicy` interfaces so they are swappable per content type.

### Path A — Harbor-managed (MVP, mandated default)

```
CREATOR UPLOAD (via apps/api)                 FAN ACCESS (granted, then client-side)
1. reserve bucket  → sign(service key)        1. on subscribe/buy, apps/api verifies the
   → finalize  ⇒ seal_policy_id                  on-chain Subscription/Entitlement, then calls
2. Seal-encrypt media client-side against        Harbor POST /api/v1/seal/sponsor
   seal_policy_id (Harbor's bucket_policy pkg)    kind=grant_bucket_access
3. multipart upload ciphertext → poll status     { groupIds, recipientAddress: FAN, scope:'read' }
4. store {bucket_id, file_id, seal_policy_id}     → /seal/sponsor/{digest}/execute
   in the Content object on Sui               2. fan GET /download → ciphertext
                                              3. fan builds bucket_policy::seal_approve PTB,
   on lapse/refund → unshare_bucket_access       signs a SessionKey with their OWN zkLogin signer,
   to remove the fan's decrypt capability        seal.decrypt() locally  →  plaintext
```

**Key insight (the gap in the original `habour.md`):** fans do **not** need the service key. The backend
holds the service key only for bucket lifecycle (`finalize`) and for issuing **`grant_bucket_access`** to
each paying fan's Sui address. Once granted, the fan satisfies Harbor's `bucket_policy::seal_approve` with
their **own** SessionKey and decrypts in the browser. Harbor only ever serves ciphertext.

**Custody caveat:** whoever holds the `suiprivkey1` service key *can* decrypt that bucket's content. In
Path A the backend holds it (platform-managed). This is custodial-*capable* even though the normal flow
never decrypts server-side. If a creator wants true non-custody, the service key must be creator-held
(worse UX, creator must be online to grant). Document this explicitly to users.

Harbor specifics (testnet, pinned): `ORIGINAL` package `0x8b24…faf8d` (encrypt + SessionKey), `LATEST`
package `0xc11d…d506` (`bucket_policy::seal_approve`), three pinned key servers, threshold **2-of-3**,
`verifyKeyServers:false`. These differ from the generic `getAllowlistedKeyServers('testnet')` set — you
**must** use Harbor's pinned IDs. Full surface in [`habour.md`](./habour.md).

### Path B — Self-managed Seal (decentralized target)

Our `walrus_urchin::access_policy::seal_approve` reads the fan's on-chain `Subscription`/`Entitlement`
directly (subscription pattern checks `service_id` + `Clock` TTL; `key_request` pattern for PPV). Content is
encrypted client-side with `@mysten/seal` against **our** package id; ciphertext is stored on Walrus —
either as an opaque blob via Harbor file upload, or directly via the `@mysten/walrus` Upload Relay. Fans
decrypt client-side with no backend mediation and no custodial key. This is more to build (run/choose key
servers, manage thresholds, envelope-encrypt DEKs) but removes the platform from the trust path entirely.

### Envelope encryption (both paths, for large media)

The set of key servers and the threshold are **frozen into the ciphertext at encrypt time** and cannot be
changed later. So for long-lived media: generate a per-file AES-256-GCM DEK, encrypt the (large) file with
it, store that ciphertext on Walrus, and Seal-encrypt only the small DEK against the tier/PPV policy. This
bounds the Seal payload to tens of bytes and lets you rotate key-server committees or migrate policies for
years-long content without re-uploading blobs.

---

## 6. memwal / Walrus Memory integration

memwal is the **agent-memory** layer, **not** the content store. Media stays on Harbor/Walrus + Seal;
memwal stores short, semantically-searchable text facts.

- **One platform `MemWalAccount` + one delegate key**, held only in `apps/api`. Multiplex all creators/fans
  via **namespaces** (the contract limits one account per Sui address, so we don't create per-user accounts).
- **Namespace convention:** `creator:<suins>`, `fan:<addr>`, `kb:<creatorId>`, `dm:<creatorId>:<fanAddr>`.
  Namespaces are flat, exact-match, no wildcards — pick the convention deliberately.
- **Use cases:** (1) creator AI concierge (`withMemWal` middleware remembers brand voice/posting cadence);
  (2) fan-support chatbot with portable cross-session context; (3) per-fan preference recall for
  recommendations/upgrade nudges; (4) creator knowledge base via `/api/ask` (RAG over a namespace).
- **Privacy:** default client lets the relayer (TEE) see plaintext; use `MemWalManual` for sensitive data so
  encryption/embedding happen in `apps/api` and the relayer sees only ciphertext + vectors.
- **`remember()` always appends** (no upsert/delete) → dedup at the app layer and budget WAL storage.
- **Relayer host is configurable.** Authoritative published default is `https://relayer.memwal.ai`
  (production) / `https://relayer.staging.memwal.ai` (testnet/staging). The `*.memory.walrus.xyz` hosts in
  some pastes are unverified/possibly aliased — store `MEMWAL_SERVER_URL` in config, never hardcode. Verified
  testnet IDs: package `0xcf6a…29c6`, registry `0xe80f…4437`. Details in [`memwal.md`](./memwal.md).

---

## 7. Monorepo layout (pnpm workspaces + Turborepo)

```
WalrusUrchin/
├── apps/
│   ├── web/            Vite 8 + React + TS SPA. New @mysten/dapp-kit-react v2 + dapp-kit-core.
│   │                   Deployable to Walrus Sites (ws-resources.json: routes "/*" → "/index.html").
│   └── api/            Hono 4.12 on @hono/node-server. Trust boundary (Enoki/Harbor/memwal secrets).
│                       Routes: /sponsor, /harbor/*, /memory/*, /access/*, /webhook (indexer/cron).
├── packages/
│   ├── contracts/      Sui Move package `walrus_urchin` (Move.toml edition "2024.beta") + tests.
│   ├── move-client/    @mysten/codegen-generated TS bindings + Transaction builders (turbo `codegen`).
│   ├── sdk/            StorageProvider (Harbor + raw-Walrus impls), Seal helpers, memwal adapter, SuiNS helpers.
│   ├── types/          Shared DTOs + Zod schemas; exports Hono AppType consumed via hc<AppType>.
│   └── config/         Shared tsconfig base, eslint, tailwind preset, per-network constants.
├── docs/               This docs repo (PRD + tech references).
├── pnpm-workspace.yaml   turbo.json   tsconfig.base.json
└── CLAUDE.md           Project context for Claude Code.
```

`apps/api` exports a method-chained `AppType` so `apps/web` calls it with a fully-typed `hc<AppType>` RPC
client. Move changes regenerate `packages/move-client` (single source of truth for package IDs + entry-fn
signatures) before web/api build. Dev: Vite `server.proxy` `/api` → `http://localhost:3000` (no CORS);
prod: the SPA on a Walrus Site calls the Hono backend cross-origin (configure `hono/cors` + signed-request
auth). Full version pins, configs, and scaffold commands are in [`monorepo.md`](./monorepo.md).

---

## 8. Per-network configuration (testnet — the build target)

> Pin these in `packages/config` per network; **verify live before mainnet** — IDs change with releases and
> Harbor is alpha. (Sources: Mysten docs/GitHub, Harbor `/openapi.yaml`, June 2026.)

| Thing | Testnet value |
| --- | --- |
| Sui fullnode (gRPC) | `https://fullnode.testnet.sui.io:443` |
| Harbor API | `https://api.testnet.harbor.walrus.xyz` (Bearer `hbr_…`) |
| Harbor `ORIGINAL` pkg (encrypt + SessionKey) | `0x8b2429358e9b0f005b69fe8ad3cbd1268ad87f35047a21612e082c64824faf8d` |
| Harbor `LATEST` pkg (`bucket_policy::seal_approve`) | `0xc11d875481544e9b6c616f7d6704266e1633b4034eab7ed76626dc25ebfcd506` |
| Harbor key servers (threshold 2-of-3) | `0x6068c0ac…6d141da2`, `0x164ac3d2…0cccf0f2`, `0x9c949e53…d4c434105` |
| memwal relayer (staging/testnet) | `https://relayer.staging.memwal.ai` |
| memwal package / registry | `0xcf6ad755…229c6` / `0xe80f2fee…64437` |
| Seal generic testnet key servers | `0x73d05d62…356db75`, `0xf5d14a81…91623c8` |
| Seal committee (3-of-5) + aggregator | `0xb012378c…e1e1e98` @ `https://seal-aggregator-testnet.mystenlabs.com` |
| Seal on-chain decrypt pkg (HMAC-CTR) | `0x40168694…efdb2c3` |
| Walrus upload relay | `https://upload-relay.testnet.walrus.space` |
| SuiNS core pkg / object | `0x22fa05f2…23bdd93` / `0x300369e8…7ee5a3` |

**Library versions (June 2026):** `@mysten/sui` 2.17.0 · `@mysten/dapp-kit-react` 2.0.3 · `@mysten/dapp-kit-core`
1.3.2 · `@mysten/enoki` 1.0.8 · `@mysten/seal` 1.1.3 · `@mysten/walrus` 1.1.7 (`@mysten/walrus-wasm` 0.2.2) ·
`@mysten/suins` 1.1.4 · `@mysten-incubation/memwal` 0.0.7 · `hono` 4.12.23 · `@hono/node-server` 2.0.4 ·
`vite` 8.0.16 · `@vitejs/plugin-react` 6.0.2 · `turbo` 2.9.16 · `pnpm` 11.5.1.

---

## 9. Open decisions / risks (tracked in the PRD)

- **Key custody** (Path A): platform-held service key (better UX, custodial-capable) vs creator-held
  (non-custodial, creator must be online to grant). Default: platform-held for MVP, disclosed to users.
- **Free/public content under Harbor:** public buckets are disabled in Harbor alpha — free-tier/preview
  assets must use private+grant, or a separate raw-Walrus public path. Don't assume Harbor public buckets.
- **Transferable vs soulbound** per asset: premium tiers transferable (resale royalty), personal PPV
  soulbound. Decided per `Tier.kind`.
- **Sui mainnet stability:** three halts on 28–29 May 2026 from a v1.72 gas edge case → pin versions,
  exercise upgrades on testnet, design `UpgradeCap` from day one.
- **Enoki ↔ new dapp-kit wiring:** Enoki's published docs still target legacy `WalletProvider`; integrating
  `registerEnokiWallets` into `createDAppKit` is the single riskiest integration — budget a spike.

---

*Next: read [`data-flows.md`](./data-flows.md) for concrete sequences, or the per-technology references in
the [`tech/` index](./README.md).*
