# WalrusUrchin — Product Requirements Document

> **A decentralized Patreon on the Sui Stack.** Creators own their identity, content, and
> monetization rules; fans get transparent, verifiable, encrypted access — without a custodial
> platform owning the relationship or skimming 12–30% in stacked fees.

| | |
| --- | --- |
| **Status** | Draft v0.1 — docs-only (no app code yet) |
| **Last updated** | 2026-06-03 |
| **Build target** | Sui **testnet** first (Harbor + memwal are testnet/beta) |
| **Owner** | UyLeQuoc |
| **Companion docs** | [Architecture](./tech/architecture.md) · [Data flows](./tech/data-flows.md) · [Tech index](./tech/README.md) |

---

## 1. Summary

Creators today face high, opaque platform fees, restrictive monetization models, deplatforming risk,
and no real ownership of their audience relationship. Fans have little transparency into how their
money supports creators, and content stays locked inside centralized silos.

**WalrusUrchin** is a Web3 Patreon built end-to-end on the Sui Stack. All monetization and access logic
lives on **Sui** as Move contracts; private content is **Seal**-encrypted and stored on **Walrus** (via
**Harbor**, the mandated managed Walrus+Seal gateway); creator identity is a portable **SuiNS** handle
(`creatorname.sui`); sign-in is passwordless via **zkLogin/Passkey/Enoki** with **sponsored gas** so users
never hold SUI; and an optional AI layer (**memwal / Walrus Memory**) gives creators a concierge and fans a
context-aware support bot. Because access rights are real on-chain objects gated by a public `seal_approve`
check, subscriptions are **portable and composable** — they can be resold (with creator royalties), used as
event tickets, or honored by any third-party app, with no permission from us.

---

## 2. Problem & opportunity

| Pain point (today) | Evidence | WalrusUrchin's answer |
| --- | --- | --- |
| Stacked, opaque fees | Patreon: **10%** platform (new creators, post-Aug 2025) + **~2.9% + $0.30** processing + **30%** Apple IAP → blended **12–30%** on small pledges | A small, **on-chain, publicly-auditable** platform fee (basis points, e.g. 0–5%); only gas + WAL storage + key-server pass-through on top |
| No audience ownership | Patreon's own Feb-2025 report: 53% of creators say connecting with followers is harder than 5 years ago | Identity is a **SuiNS handle the creator owns**; subscribers are on-chain objects the creator can reach directly and that survive platform migration |
| Deplatforming / censorship | Centralized takedowns; loss of grandfathered rates on unpublish | **Censorship-resistant** storage (Walrus) + identity (SuiNS) + logic (Sui); the platform cannot silently revoke a creator's audience |
| No transparency for fans | Fans can't see fee splits or verify access rules | **Every payment split and access rule is on-chain** and verifiable; `RevenueSplit` events show exact payouts |
| Locked-in content | Content + access rights trapped in one platform | Access is a **transferable/composable NFT** + a public `seal_approve` policy any app can honor |
| Onboarding friction | Wallets, seed phrases, gas tokens | **zkLogin** (Google/Apple/Twitch) + **Enoki sponsored gas** → no wallet, no seed, no SUI |

**Opportunity:** the Sui Stack supplies near-exact primitives (Seal's subscription/allowlist/PPV access
patterns, Walrus storage, Kiosk royalties, SuiNS identity, Enoki onboarding) so a credible, fee-fair,
creator-owned alternative is buildable today — not a research project.

---

## 3. Goals & non-goals

### Goals
- **G1** — Creators publish encrypted, tier-gated content and get paid with a transparent on-chain split.
- **G2** — Fans subscribe / buy / tip / unlock content with passwordless sign-in and **zero SUI** in hand.
- **G3** — Access is enforced by **on-chain rules** (`seal_approve`), not by a trusted server, wherever feasible.
- **G4** — Identity and access rights are **portable & composable** beyond WalrusUrchin.
- **G5** — Storage uses **Harbor** (mandated); agent memory uses **memwal** (mandated).
- **G6** — The platform fee is **low, fixed, and visible**; no hidden fees.

### Non-goals (for now)
- Native mobile apps (web-first; avoids the 30% Apple tax — a deliberate differentiator).
- Fiat on-ramp / off-ramp (use SUI/USDC; revisit later).
- Building our own key servers or Walrus publishers in the MVP (Harbor abstracts this).
- A general-purpose social network — WalrusUrchin is creator↔fan, not fan↔fan.
- Mainnet launch in the MVP (testnet first; Harbor/memwal are not production-ready).

---

## 4. Personas

- **Creator (Maya, video essayist).** Wants fair payouts, to own her audience, to gate videos behind
  monthly tiers + occasional pay-per-view, and to never be deplatformed. Not crypto-native — needs
  Google sign-in and no gas.
- **Fan (Leo, supporter).** Wants to back Maya, watch exclusive content on any device, tip occasionally,
  and maybe resell a premium annual pass later. Has never used a wallet.
- **Crypto-native creator (Nova).** Wants full non-custody, a `.sui` handle, transferable membership NFTs
  with resale royalties, and composability with other Sui apps.
- **Third-party app (an events platform).** Wants to honor WalrusUrchin subscriptions as event tickets by
  calling the public `seal_approve` / reading the Subscription object — no integration deal required.

---

## 5. Feature requirements

Mapped to the brief's deliverables. **P0** = MVP, **P1** = fast-follow, **P2** = later.

### 5.1 Creator profiles  *(deliverable: Creator profiles)*
- **P0** Public creator page: display name, bio, avatar/banner (public Walrus blobs), tier list, content
  previews. Resolvable by `creatorname.sui` → `CreatorProfile` object. → [`suins.md`](./tech/suins.md)
- **P0** Portable identity: handle + profile persist on-chain beyond the platform; avatar + optional Walrus
  Site stored in the SuiNS name record.
- **P1** Creator dashboard: earnings (on-chain `RevenueSplit` history), subscriber counts, content manager.
- **P2** Team Spaces (Harbor) for creator + manager/agency multi-user accounts.

### 5.2 Secure content hosting & delivery  *(deliverable: Secure content hosting & delivery)*
- **P0** Encrypted storage of media, text posts, downloadable files via **Harbor** (Seal ciphertext on
  Walrus). Large media uses **envelope encryption** (per-file AES DEK, Seal-wrap the DEK). → [`habour.md`](./tech/habour.md), [`walrus.md`](./tech/walrus.md)
- **P0** Tier-based and pay-per-view access controls enforced on-chain. → [`seal.md`](./tech/seal.md)
- **P0** Unencrypted public previews/teasers for discovery.
- **P1** Livestream recordings + large archives as permanent blobs; storage-renewal automation.
- **P2** Per-content-version key rotation for stronger revocation.

### 5.3 Authentication & access management  *(deliverable: Authentication & access management)*
- **P0** Passwordless sign-in (Google/Apple/Twitch via **Enoki zkLogin**) + optional **Passkey** + Sui wallet
  (Slush). → [`auth.md`](./tech/auth.md)
- **P0** **Sponsored gas** (Enoki) — fans/creators transact without holding SUI.
- **P0** Fine-grained access: tier membership, one-off PPV, time-windowed access (events), all via
  `seal_approve`. The same on-chain check gates on-platform decryption **and** off-platform surfaces.
- **P1** Free leaf subnames (`username.walrusurchin.sui`) minted for zkLogin users via Enoki.

### 5.4 Monetization & payments  *(deliverable: Monetization & payments)*
- **P0** Monthly **subscriptions** (expiring `Subscription` NFT; pull-based `renew()`).
- **P0** **One-time purchases** (lifetime tier `ttl = u64::MAX`) and **pay-per-view** (soulbound `Entitlement`).
- **P0** **Tipping** (direct `Coin<SUI>`/USDC transfer + optional split + `TipReceived` event).
- **P1** **Bundles** (one purchase mints several access NFTs / a bundle NFT authorizing several tiers).
- **P0** **Transparent, programmable revenue sharing**: payment split in the same atomic PTB across creator
  + collaborators + platform fee + optional referrer, by basis points, with one `RevenueSplit` event each.
- **P1** **Transferable subscription NFTs** with enforced creator **resale royalty** (Kiosk + TransferPolicy).
  → [`sui.md`](./tech/sui.md)
- **P2** Closed-Loop "platform credit" token for one-tap tips/PPV without re-onboarding.

### 5.5 Community engagement  *(deliverable: Community engagement)*
- **P0** Supporter-only posts/updates gated by the same `seal_approve` (hold a non-expired tier NFT).
- **P1** Direct creator↔fan **messaging**: Seal-encrypted message blobs on Walrus, gated by the
  `account_based` (1:1) or `allowlist` (group) pattern. → [`seal.md`](./tech/seal.md)
- **P1** Behind-the-scenes / exclusive drops via the time-lock pattern (scheduled reveal).
- **P2** Token-gated external surfaces (Discord/Telegram roles) verified by the Subscription NFT.

### 5.6 Content portability & composability  *(deliverable: Content portability & composability)*
- **P0** Access is a real Sui object + a **public** `seal_approve` package id any app can call — designed with
  stable, queryable fields (`service_id`, `tier`, `expiry`).
- **P1** **NFT marketplace** resale of premium subscription NFTs (auto-grants access; creator earns royalty).
- **P1** **Token-gated events/tickets**: an Event is a `Tier` whose `Subscription` is a transferable ticket.
- **P2** **Learning/certification** reuse and **social/messaging** integrations honoring the same access tokens.

---

## 6. Monetization model (concrete)

All five SKUs map onto Seal access patterns + Sui payment PTBs:

| SKU | On-chain mechanism | Access pattern | Notes |
| --- | --- | --- | --- |
| Monthly subscription | `Tier{fee, period_ms}` → mint `Subscription{expires_ms}` | subscription (`Clock` TTL) | expiring; pull-based `renew()` |
| One-time / lifetime | `Tier` with `period_ms = u64::MAX` | subscription (no expiry) | |
| Pay-per-view | `buy_ppv()` → soulbound `Entitlement{content_id, valid_till}` | `key_request` | per-blob; optional rental window |
| Tipping | `Coin` transfer (+ split) + `TipReceived` event | none | no NFT minted |
| Bundle | one PTB mints several access NFTs / a `Bundle` NFT | composite | discounted |

**Fee transparency (the headline):** present an explicit on-chain schedule — platform fee in basis points
(low, e.g. **0–5%**) + pass-through (Sui gas, WAL storage, Seal key-server fees) — and contrast line-by-line
with Patreon's 10% + ~2.9%+$0.30 (+30% Apple). Target message: **creators keep ~95%+, own the audience,
can't be silently deplatformed, and earn secondary-sale royalties.** (Cite fee ranges, not single numbers —
Patreon's blended rate varies by pledge size, currency, and grandfathering.)

---

## 7. Architecture (summary)

Full detail in [`architecture.md`](./tech/architecture.md). In brief:

- **`apps/web`** — Vite + React SPA, deployable as a **Walrus Site**; builds PTBs, encrypts/decrypts content
  client-side, never holds secrets.
- **`apps/api`** — Hono backend = the **trust boundary**: Enoki secret key (gas sponsorship), Harbor
  `hbr_`/service keys (storage + per-fan access grants), memwal delegate key (memory), plus indexer/cron for
  renewals and grant reconciliation. Used only where a server secret is required.
- **Two content-access paths:** **Path A** (MVP, mandated) — Harbor stores ciphertext, backend grants each
  paying fan's address via `grant_bucket_access` so the **fan decrypts client-side** with their own SessionKey;
  **Path B** (north star) — self-managed Seal where our `seal_approve` reads the fan's on-chain subscription
  directly, no backend in the trust path. Both behind a `StorageProvider`/`AccessPolicy` interface.
- **memwal** — agent memory only (not media): one platform account + one backend delegate key, multiplexed by
  namespace; powers creator concierge, fan-support bot, and preference recall.

---

## 8. MVP scope & phased roadmap

**MVP (P0) — "fair, gated, gasless" on testnet:**
1. zkLogin sign-in (Enoki) + sponsored gas.
2. Creator onboarding: register/link `creatorname.sui` → mint `CreatorProfile` + `CreatorCap`.
3. Create tiers; publish encrypted content via Harbor (Path A) with public previews.
4. Fan subscribes (atomic payment + revenue split + `Subscription` NFT); backend grants Harbor access.
5. Fan unlocks & decrypts content client-side; supporter-only posts.
6. Pay-per-view + tipping.
7. Transparent on-chain fee + earnings view.

**P1 — depth & portability:** bundles, transferable subscription NFTs + resale royalties (Kiosk), creator↔fan
messaging, memwal concierge/support bot, renewal automation, dashboard analytics, Enoki subnames.

**P2 — composability & scale:** NFT-marketplace resale, token-gated events/tickets, external integrations
(Discord/Telegram, learning platforms), per-version key rotation, Path B (self-managed Seal), mainnet hardening.

---

## 9. Success metrics
- **Adoption:** # creators onboarded, # active subscriptions, GMV (on-chain, verifiable).
- **Fairness:** effective creator take-home % (target ≥ 95%) vs Patreon benchmark.
- **Onboarding:** % of users who complete sign-up → first action without ever touching a wallet/SUI.
- **Reliability:** content unlock success rate; median unlock latency (incl. `mirror_missing_grant` retries).
- **Portability:** # of subscriptions resold / used in a third-party app (composability proof).

---

## 10. Risks & mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Harbor is alpha/testnet; shapes may change | High | Abstract behind `StorageProvider`; pin config; track GitHub `walrus-harbor-quickstart` + `/openapi.yaml` |
| Service-key custody (Path A) is custodial-capable | High | Disclose to users; offer creator-held key option; roadmap Path B for non-custody |
| Walrus blobs expire; un-renewed content goes dark | High | Renewal cron tied to active subscriptions; surface "available until" in UI; decide who funds WAL |
| Seal revocation is soft (already-decrypted data persists) | Medium | Short SessionKey TTLs, per-version nonces, `unshare_bucket_access`, rotate identities for sensitive content |
| zkLogin salt instability loses accounts | High | Let Enoki own the salt; pin one OAuth client id per env |
| Enoki ↔ new dapp-kit wiring unproven | Medium | Spike early; fall back to legacy provider only if forced |
| Sui mainnet stability (3 halts, 28–29 May 2026) | Medium | Pin versions; test upgrades on testnet; `UpgradeCap` from day one |
| Permanent blobs can't be taken down (DMCA/abuse) | Medium | Deletable-by-default for UGC; rely on revoking Seal access, not deletion; moderation policy |
| memwal beta API churn; default relayer sees plaintext | Low/Med | Pin version; isolate behind a Hono adapter; `MemWalManual` for sensitive data |

---

## 11. Open questions
- Platform fee basis points (final value) and whether collaborators/referrers are in the MVP split.
- Path A key custody default: platform-held (better UX) vs creator-held (non-custodial). *(Proposed: platform-held for MVP, disclosed.)*
- Who funds WAL storage + renewals: platform treasury, creator escrow, or fan-paid? 
- Free-tier/public content under Harbor (public buckets disabled in alpha) — private+grant vs a separate raw-Walrus public path.
- USDC vs SUI as the default settlement currency for prices.

---

## 12. Prior art
Hackathon precedents on the same stack: **Fundsui** (Haulout 2025) — censorship-resistant paid subscriptions to
encrypted podcasts on Walrus+Seal; **Galliun** (Sui Overflow 2025) — link-in-bio where each profile is a Sui
object with direct tipping. Useful as proof-of-pattern, not audited dependencies.

*Technical references for every component are in the [tech docs index](./tech/README.md).*
