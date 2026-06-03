# SuiNS — portable creator handles & identity

> Status: **design / docs-only** (June 2026). Targets **Sui testnet** first; pin all
> package/object IDs from [`architecture.md` §8](./architecture.md) and re-verify live before
> mainnet (SuiNS IDs change with `core/vN` releases).

SuiNS (Sui Name Service) is WalrusUrchin's **identity layer**: it turns a creator's on-chain
address into a human-readable, portable, platform-independent handle (`creatorname.sui`). A `.sui`
name is itself an NFT whose holder controls a mutable target address plus a small bag of public
metadata (`avatar`, `contentHash`, `walrusSiteId`). In WalrusUrchin a creator's `.sui` name is the
canonical share URL that resolves to their `CreatorProfile` (no platform database row needed), the
**reverse "default name"** is the anti-impersonation basis for the creator directory, and **free
leaf subnames** let us mint per-tier / per-fan handles for nothing but gas. zkLogin users who never
buy a name still get a memorable identity via Enoki-managed subnames (`username.walrusurchin.sui`).
This sits beside [`auth.md`](./auth.md) (zkLogin/Enoki), [`sui.md`](./sui.md) (the profile objects
names point at), and [`walrus.md`](./walrus.md) (the Walrus Site a name can link to).

For the full layered picture and trust model see [`architecture.md`](./architecture.md); for
end-to-end sequences see [`data-flows.md`](./data-flows.md).

---

## 1. What a `.sui` name is, and how it maps to WalrusUrchin

| SuiNS concept | What it is | WalrusUrchin role |
| --- | --- | --- |
| `.sui` name (3–63 chars) | An NFT (`SuinsRegistration`); holder controls target + metadata | `creatorname.sui` = the creator's **canonical, portable handle** |
| Forward resolution (`targetAddress`) | Name → address; **mutable** by the NFT holder | Points at the creator's `CreatorProfile` (or owner) address → load Move object |
| Reverse / **default name** (`setDefault`) | Address → one chosen name; set **only by the target** | **Trust anchor**: verifies "this address really is `creator.sui`" (anti-impersonation) |
| Leaf subname (no NFT, free) | Parent-controlled, reclaimable | Per-tier / per-fan handles (`gold.creator.sui`, `fanalice.creator.sui`) |
| Node subname (NFT, free, transferable) | Owns itself, nestable | **Fan-owned, transferable** membership handle (travels with a transferable `Subscription`) |
| Metadata (`avatar`, `contentHash`, `walrusSiteId`) | Public on-chain key/values | Portable avatar + link to the creator's Walrus Site |
| Enoki managed subname | Backend mints under an app parent | Free `username.walrusurchin.sui` for zkLogin-onboarded users |

**Hard rules** (consistent with [`architecture.md` §3](./architecture.md)):

- The name record is **world-readable**. Never store Seal-gated blob IDs, access policies, or
  private content references in `contentHash`/`walrusSiteId`/`avatar`. Public profile data only;
  private refs live in the `Content` / `AccessPolicy` Move objects.
- **Forward `targetAddress` is not proof of ownership.** Anyone holding the NFT can point it
  anywhere. Use the **reverse default name** for any trust/verification UI.
- A creator's identity (and every handle-based deep link + subname membership) **breaks if the name
  lapses**. Renewals are an ops concern, not a nice-to-have — see §7.

---

## 2. The `@mysten/suins` SDK (1.1.4)

Pin `@mysten/suins` **1.1.4** (peer `@mysten/sui ^2.16.2`; we ship `@mysten/sui` 2.17.0 — satisfies
the range). The SDK is a thin wrapper for querying name records and building name-service
transactions; you do **not** need it just to resolve a name (core RPC does that — §6). Live in
`packages/sdk` as the SuiNS helper, alongside the `StorageProvider`/Seal/memwal adapters.

> **UNVERIFIED / version-sensitive:** the SDK bundles network constants and the docs warn that a
> stale version can prevent transactions from building. Keep it pinned-then-bumped deliberately, and
> confirm exact parameter names against the installed package's `.d.ts` before coding — the
> signatures below are from the SuiNS docs, not fully fetched source.

```ts
import { SuinsClient, SuinsTransaction, ALLOWED_METADATA } from '@mysten/suins';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const sui = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });

// Default constructor uses the SDK's bundled network constants…
const suins = new SuinsClient({ client: sui, network: 'testnet' });

// …or pin our own IDs from packages/config (recommended — see §8 of architecture.md):
const suinsPinned = new SuinsClient({
  client: sui,
  network: 'testnet',
  packageIds: {
    // SuiNS testnet core (verify live before mainnet):
    suinsObjectId: '0x300369e8909b9a6464da265b9a5a9ab6fe2158a040e84e808628cde7a07ee5a3',
    suinsPackageId: { latest: '0x22fa05f2…23bdd93' /* core v2 */, v1: '0x…' },
    // utilsPackageId, registrationPackageId, renewalPackageId, registryTableId …
  },
});
```

### Query methods (`SuinsClient`)

| Method | Returns | WalrusUrchin use |
| --- | --- | --- |
| `getNameRecord(name)` | `{ name, nftId, targetAddress, expirationTimestampMs, data: { avatar, contentHash, walrusSiteId } }` | Resolve handle → profile address; read avatar/site; schedule renewal off `expirationTimestampMs` |
| `getName(address)` | default (reverse) name or `null` | Verify identity in directory / DM UI |
| `getPriceList()` | per-length-range registration prices | Show live prices in the buy-a-name flow |
| `getRenewalPricelist()` | per-length-range renewal prices | Renewal reminder / sponsored renew |
| `getPriceInfoObject(tx, coinConfig.feed)` | Pyth `priceInfoObjectId` | Required **only** for SUI/NS payment (§5) |

```ts
const rec = await suins.getNameRecord('creator.sui');
// rec.targetAddress  → load CreatorProfile via @mysten/sui
// rec.nftId          → store against the WalrusUrchin profile
// rec.data.avatar    → portable profile image ref
// rec.data.walrusSiteId → creator's Walrus Site
// rec.expirationTimestampMs → renewal scheduling

const verified = await suins.getName(creatorAddress); // 'creator.sui' | null
```

### Transaction builders (`SuinsTransaction`)

```ts
const tx = new Transaction();
const suinsTx = new SuinsTransaction(suins, tx);

suinsTx.register({ domain, years, coinConfig, coin, priceInfoObjectId });
suinsTx.renew({ /* nft, years, coinConfig, coin, priceInfoObjectId */ });
suinsTx.setTargetAddress({ nft, address, isSubname });          // forward resolution
suinsTx.setDefault({ name });                                   // reverse / anti-impersonation
suinsTx.setUserData({ nft, key, value, isSubname });            // avatar / walrusSiteId / contentHash
suinsTx.createLeafSubName({ parentNft, name, targetAddress });  // FREE per-tier/per-fan
suinsTx.createSubName({ parentNft, name, expirationTimestampMs, allowChildCreation, allowTimeExtension }); // node (NFT)
suinsTx.editSetup(/* … */);
suinsTx.extendExpiration({ nft, expirationTimestampMs });
suinsTx.removeLeafSubName({ parentNft, name });
suinsTx.burnExpired({ nft, isSubname });                         // clean up released names
```

Coin configs come off `suins.config.coins.{ USDC | SUI | NS }`.

---

## 3. Forward vs reverse resolution (the trust distinction)

This is the single most important SuiNS concept for WalrusUrchin's anti-impersonation story.

- **Forward** — `setTargetAddress({ nft, address })` sets where the name points. The NFT holder can
  repoint it at any address (including a `CreatorProfile` object address) at any time. **Mutable →
  treat as a redirect, never as proof.**
- **Reverse / default** — `setDefault({ name })` lets an address advertise one name as its label.
  Critically, **only the signer whose address equals the name's current target can set it.** That
  bidirectional handshake is what makes the default name trustworthy.

```ts
// CREATOR onboarding (forward): point the handle at the profile
const t = new Transaction();
const s = new SuinsTransaction(suins, t);
s.setTargetAddress({ nft: creatorNameNft, address: creatorProfileAddr, isSubname: false });
s.setDefault({ name: 'creator.sui' });  // must be signed by creatorProfileAddr's controller
```

**WalrusUrchin policy:**

- The creator **directory**, **DM/messaging headers**, and any "verified creator" badge resolve via
  the **reverse default name** (`getName(address)` / GraphQL `defaultSuinsName`). If it returns
  `null`, fall back to a truncated address — never silently trust a forward-only resolution.
- Deep links (`walrusurchin.app/@creator`) resolve **forward** (`getNameRecord` / core RPC) to find
  the profile, but the displayed "✓ creator.sui" label is gated on the reverse check matching.
- Cache resolutions client-side (the SDK call is a network round-trip); invalidate on a short TTL or
  on the relevant SuiNS event.

---

## 4. Subnames: free per-tier / per-fan handles

Subnames cost only gas and come in two flavors with different durability/ownership semantics. The
distinction maps directly onto WalrusUrchin's transferable-vs-soulbound access model from
[`architecture.md` §4](./architecture.md).

| | Leaf subname | Node subname |
| --- | --- | --- |
| NFT? | No | Yes (`SuinsRegistration`-like) |
| Controlled by | Parent NFT holder (reclaimable/reconfigurable) | Its own holder; can nest children if allowed |
| Transferable? | No (it's just a parent-controlled record) | **Yes** |
| WalrusUrchin use | **Platform/creator-controlled tier & fan handles** that lapse with a subscription | **Fan-owned membership** that travels with a **transferable `Subscription` NFT** |

```ts
const t = new Transaction();
const s = new SuinsTransaction(suins, t);

// FREE leaf subname for a fan on the Gold tier — reclaimable when the sub lapses
s.createLeafSubName({
  parentNft: creatorNameNft,
  name: 'fanalice.creator.sui',
  targetAddress: fanAddr,
});

// Node subname: fan-owned, transferable — pair with a key+store Subscription NFT
s.createSubName({
  parentNft: creatorNameNft,
  name: 'member-bob.creator.sui',
  expirationTimestampMs,
  allowChildCreation: false,
  allowTimeExtension: false,
});
```

**Mapping to access objects:**

- **Soulbound perks / lapsing tiers** → **leaf** subnames. When a `Subscription` expires (and we
  call Harbor `unshare_bucket_access` per [`habour.md`](./habour.md)), the platform reclaims/repoints
  the leaf subname via `removeLeafSubName` or `setTargetAddress`. No NFT to chase down.
- **Transferable tiers** (`key + store` + Kiosk/`TransferPolicy` royalty) → **node** subnames, so the
  identity handle is portable and resells alongside the subscription NFT.
- Keep the hierarchy **shallow**: subname nesting is capped (~8 levels of subname depth, ~10 total
  including SLD+TLD). Do **not** schematize per-post or per-session subnames.
- **Durability caveat:** leaf subnames have no NFT and are only as durable as the **parent**. If
  `creator.sui` (or `walrusurchin.sui`) lapses or transfers, every leaf under it is affected.

Token-gated events/bundles can key off a resolved node-subname NFT or a reverse default-name match —
a composable primitive layered on SuiNS instead of a bespoke allowlist.

---

## 5. Pricing & payment (SUI / USDC / NS)

Registration price scales by **length**: 3-char names are most expensive, 4-char mid, 5–63 char
cheapest. Prices are governance-set and have changed over time — **read them live** via
`getPriceList()` / `getRenewalPricelist()`, never hardcode.

| Payment coin | Pyth price-info object required? | Notes |
| --- | --- | --- |
| **USDC** | **No** | Default path for WalrusUrchin's Enoki-sponsored flow (simplest). USDC values returned in **MIST** (1 USDC = 1,000,000 MIST) |
| **SUI** | **Yes** — `getPriceInfoObject(tx, coins.SUI.feed)` | Fetch the Pyth feed, pass `priceInfoObjectId` into `register`/`renew` |
| **NS** (governance token) | **Yes** — `coins.NS.feed` | Discounted rates |

```ts
const t = new Transaction();
const s = new SuinsTransaction(suins, t);

// USDC: no price-info object needed
s.register({ domain: 'creator.sui', years: 2, coinConfig: suins.config.coins.USDC, coin });

// SUI/NS: must fetch a Pyth price feed first
const priceInfoObjectId = await suins.getPriceInfoObject(t, suins.config.coins.SUI.feed);
s.register({ domain: 'creator.sui', years: 2, coinConfig: suins.config.coins.SUI, coin, priceInfoObjectId });
```

> Historical-only figures (do **not** hardcode): ~500 SUI (3-char), ~100 SUI (4-char), ~20 SUI (5+
> char) per year.

**WalrusUrchin default:** offer USDC as the primary register/renew path to keep the Hono + Enoki
sponsored-gas flow simple; only invoke `getPriceInfoObject` when the user explicitly pays in SUI/NS.
A stale or omitted feed will fail the transaction.

---

## 6. Resolution without the SDK (core RPC, GraphQL, Move)

You only need `@mysten/suins` to *build name-service transactions*. To merely **resolve**, use core
RPC or GraphQL — this is what the SPA does for fast handle lookups.

```ts
// @mysten/sui SuiClient (no SuiNS SDK):
const addr  = await sui.resolveNameServiceAddress({ name: 'creator.sui' });   // forward
const names = await sui.resolveNameServiceNames({ address: creatorAddr });    // owned names

// Raw JSON-RPC equivalents:
//   suix_resolveNameServiceAddress({ name })
//   suix_resolveNameServiceNames({ address, cursor, limit })

// GraphQL reverse lookup:  Address.defaultSuinsName
```

On-chain (Move, Path B / `walrus_urchin` modules that want to gate on a name) depend on the `suins`
package and read the registry directly:

```move
// Move.toml — testnet core v2 (mainnet uses releases/mainnet/core/v3):
// suins = { git = "https://github.com/mystenlabs/suins-contracts",
//           subdir = "packages/suins", rev = "releases/testnet/core/v2" }

use suins::suins::SuiNS;
use suins::registry::Registry;
use suins::domain;

let record = suins.registry<Registry>().lookup(domain::new(name));
assert!(!record.has_expired(clock), E_NAME_EXPIRED);
let target = record.target_address();   // Option<address>
```

---

## 7. Enoki managed subnames for zkLogin users

WalrusUrchin already mandates zkLogin/Enoki ([`auth.md`](./auth.md)), so every passwordless user can
get a free, memorable handle **without ever buying a name**: mint `username.walrusurchin.sui` under a
platform-owned parent via Enoki's managed subname REST API. This is a **backend** concern — the
`SUBNAMES` feature must be enabled on the Enoki API key and the parent domain linked in the Enoki
Portal — so it goes through `apps/api` (the trust boundary), never the SPA.

| Method | Endpoint | Auth |
| --- | --- | --- |
| Create | `POST https://api.enoki.mystenlabs.com/v1/subnames` | `Authorization: Bearer <apiKey>` + `zklogin-jwt: <userJwt>` (public-key/user flow) **or** `targetAddress` with a backend key |
| List | `GET /v1/subnames` | same |
| Delete | `DELETE /v1/subnames` | same |

```http
POST /v1/subnames HTTP/1.1
Host: api.enoki.mystenlabs.com
Authorization: Bearer <ENOKI_PUBLIC_API_KEY>
zklogin-jwt: <user's zkLogin JWT>
Content-Type: application/json

{ "domain": "walrusurchin.sui", "network": "testnet", "subname": "alice" }
```

- Minting is **asynchronous**: subnames transition `PENDING → ACTIVE`. Build the UI for the pending
  state and for "not yet resolvable at first read."
- Per WalrusUrchin's secret-handling rules, gate minting behind the Hono backend; the SPA only ever
  holds the Enoki **public** key (see [`architecture.md` §3](./architecture.md)).

**Handle-ownership policy (offer both):**

1. **Free default identity** — Enoki subname `username.walrusurchin.sui`. Cheap, centrally managed,
   but only as durable as WalrusUrchin's parent registration (and tied to the platform).
2. **Full portability** — creator-owned top-level `creator.sui`. Upsell this for creators who want
   the "creators own their identity" mandate fully satisfied (the handle survives the platform).

---

## 8. Renewals: the identity-portability operational risk

Names **expire**. After expiry there is a **~30-day grace period** during which only the owner can
renew; afterward the name is **released** and anyone can register it — the human-readable identity
can transfer to a stranger, taking every handle-based deep link, leaf-subname membership, and the
resolved profile with it. For a creator-identity product this is a first-class operational risk, not
an edge case.

Because **Sui has no on-chain cron** ([`architecture.md` §2/§4](./architecture.md)), renewals are
**pull-based**, exactly like `Subscription.renew()`:

- The `apps/api` indexer/cron reads each tracked name's `expirationTimestampMs`
  (`getNameRecord`) and schedules **renewal reminders** as expiry approaches.
- For zkLogin creators, offer an Enoki-**sponsored** renewal `renew()` transaction so they never need
  to hold SUI (USDC payment path = no Pyth object needed). The relayer prompts/sponsors; the creator
  signs.
- Reclaim/cleanup released names with `burnExpired`.

This reuses the same renewal-nudge machinery used for subscription and Walrus-blob renewals, adding
names as a third watched item — one indexer, three things it watches (subscriptions, blobs, names).
Note SuiNS terms are **1–5 years** with a **5-year maximum total term**, so cap the `years` /
`extendExpiration` inputs in the UI accordingly.

---

## Gotchas

- **Forward ≠ ownership.** `targetAddress` is freely mutable by the NFT holder and can point
  anywhere. Never treat "name resolves to X" as proof X owns it — use the **reverse default name**
  (set only by the target itself) for any auth/verification/anti-impersonation UI.
- **Default may be unset.** An address can own a name yet have no default; `getName(address)` returns
  `null`. Fall back to a truncated address; don't crash the directory/DM UI.
- **Names expire (30-day grace, then released).** Identity portability is contingent on renewal. Build
  reminders off `expirationTimestampMs` from day one — see §8.
- **Leaf subnames are only as durable as the parent.** No NFT; if `creator.sui` /
  `walrusurchin.sui` lapses or transfers, every leaf beneath it is affected. Platform-issued
  `*.walrusurchin.sui` identities inherit WalrusUrchin's parent-registration durability.
- **Public metadata leaks.** `avatar`/`contentHash`/`walrusSiteId` are world-readable on-chain.
  **Never** put Seal-gated blob IDs, access policies, or any private/encrypted content reference in
  the name record — those belong in the `Content`/`AccessPolicy` Move objects only.
- **Don't hardcode prices.** Registration/renewal pricing is governance-set and has changed. Read
  `getPriceList()`/`getRenewalPricelist()` live; remember USDC values are in MIST (1 USDC = 1e6).
- **SUI/NS payment needs a Pyth `priceInfoObjectId`** from `getPriceInfoObject(tx, feed)`; USDC does
  not. A stale/omitted feed fails the register/renew tx — prefer USDC for the sponsored flow.
- **IDs are network- and release-specific.** Mainnet core v3 vs testnet core v2; they change with
  releases. Use the pinned testnet IDs in [`architecture.md` §8](./architecture.md) and re-verify
  live before mainnet — do not treat any ID here as permanent. **UNVERIFIED.**
- **SDK is version-sensitive.** `@mysten/suins` bundles network constants; a stale version can break
  transaction building. Pin **1.1.4**, keep `@mysten/sui` within the `^2.16.2` peer range (we run
  2.17.0), and bump deliberately.
- **Confirm SDK signatures against `.d.ts`.** Method/param names below (`createLeafSubName`,
  `getName`, `setUserData` keys, `getPriceInfoObject`) are from the SuiNS docs, not fully fetched
  source. **UNVERIFIED** — verify against the installed package's TypeScript types before coding.
- **Subname nesting is capped** (~8 subname levels, ~10 total incl. SLD+TLD). Keep handle hierarchies
  shallow; no per-post/per-session subnames.
- **Enoki subnames are async + gated.** Requires the `SUBNAMES` feature on the Enoki key and the
  parent domain linked in the Portal; mints go `PENDING → ACTIVE`. Build for the pending state.

## Sources

- SuiNS docs (overview): https://docs.suins.io/
- SuiNS developer docs: https://docs.suins.io/developer
- SuiNS SDK: https://docs.suins.io/developer/sdk
- SuiNS SDK — querying: https://docs.suins.io/developer/sdk/querying
- SuiNS SDK — transactions: https://docs.suins.io/developer/sdk/transactions
- SuiNS SDK — subnames: https://docs.suins.io/developer/sdk/subnames
- SuiNS user registration: https://docs.suins.io/user/registration
- `@mysten/suins` on npm: https://www.npmjs.com/package/@mysten/suins
- `@mysten/suins` registry metadata: https://registry.npmjs.org/@mysten/suins
- SuiNS subnames blog: https://blog.sui.io/suins-subnames-advance-web3-identity/
- Enoki subnames: https://docs.enoki.mystenlabs.com/subnames
- Sui API ref (`suix_resolveNameServiceAddress`): https://docs.sui.io/sui-api-ref#suix_resolvenameserviceaddress
- `@mysten/sui` SuiClient: https://sdk.mystenlabs.com/typescript/sui-client
- SuiNS contracts (Move): https://github.com/MystenLabs/suins-contracts
