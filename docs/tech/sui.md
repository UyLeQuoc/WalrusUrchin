# Sui — programmable logic for subscriptions, payments & access

> Status: **design / docs-only** (June 2026). Build target = **Sui testnet** first
> (Harbor and memwal are testnet/beta). Pin every ID/version against
> [`architecture.md` §8](./architecture.md); do not invent new ones.

Sui is the programmable-logic layer of WalrusUrchin: an object-centric Move L1 where
**all** monetization and access state lives as typed on-chain objects. Everything the
platform charges for or gates — creator identity, subscription tiers, subscriptions,
pay-per-view (PPV) unlocks, tips, bundles, and transparent revenue splits — is a Move
object in the `walrus_urchin` package (edition `2024.beta`). Seal access policies and
Walrus/Harbor storage references hang off these objects and are gated by the same
on-chain ownership + expiry logic, so the chain is the single source of truth for "who
may decrypt what, until when." This doc maps the Sui primitives to that object model and
the `subscribe()` / `renew()` / `buy_ppv()` / `tip()` / `buy_bundle()` entry functions.
See [`seal.md`](./seal.md) for `seal_approve`, [`walrus.md`](./walrus.md) +
[`habour.md`](./habour.md) for storage, [`auth.md`](./auth.md) for zkLogin/Enoki, and
[`data-flows.md`](./data-flows.md) for end-to-end sequences.

---

## 1. The object model (and how WalrusUrchin uses each ownership kind)

Every Sui object is a Move struct with the `key` ability and `id: UID` as its first
field. It carries a 32-byte globally-unique `UID` (derived from creating-tx digest +
counter), an 8-byte monotonic `version`, and an ownership descriptor. Sui has **five**
ownership models — WalrusUrchin uses all of them deliberately:

| Ownership | How it's made | Latency / consensus | WalrusUrchin usage |
| --- | --- | --- | --- |
| **Address-owned** | `transfer::transfer` / `public_transfer` | Fastpath single-writer (lowest latency) | `Subscription`, `Entitlement`/`PpvAccess`, `CreatorCap` — held by a fan or creator |
| **Shared** | `transfer::share_object` | Consensus; any address may use (subject to Move rules) | `CreatorProfile` — many fans subscribe/tip in parallel |
| **Immutable** | `public_freeze_object` | Read-only forever, no consensus | Frozen `TransferPolicy` config / published package |
| **Wrapped** | struct nested inside another | Reachable only via wrapper | `Balance<T>` inside `CreatorProfile`; plain dynamic-field values |
| **Party (consensus-address-owned)** | `party_transfer` family | Single owner but sequenced by consensus | Escape hatch for a hot `CreatorProfile` if shared-object contention bites |

**Transfer / freeze / share surface** (`sui::transfer`):
`transfer` / `public_transfer`, `share_object` / `public_share_object`,
`freeze_object` / `public_freeze_object`, plus the `party_transfer` family. The `public_`
variants require the value's `store` ability and may be called from outside the defining
module; the non-`public_` variants can only be called by the defining module.

**This is the soulbound lever.** An object with only `key` (no `store`) can be moved
**only** by its defining module — no third party can `public_transfer` it, list it in a
Kiosk, or wrap it. That single ability bit is how we split the `Subscription` design:

```move
// Transferable premium tier → resale earns the creator a royalty (Kiosk + TransferPolicy)
public struct Subscription has key, store {           // key + store ⇒ tradeable
    id: UID,
    tier_id: ID,
    creator_id: ID,
    started_ms: u64,
    expires_ms: u64,
}

// Soulbound perk / one-off PPV → can never be resold
public struct Entitlement has key {                   // key only ⇒ soulbound
    id: UID,
    content_id: ID,      // blob-bound
    buyer: address,
    valid_till: u64,
}
```

> **Gotcha:** a `store`-able `Subscription` transferred directly via `public_transfer`
> bypasses royalties entirely (see §6). If a tier must always pay the creator on resale,
> do **not** expose a direct transfer path — force sales through a locked Kiosk.

---

## 2. Move 2024 edition (`2024.beta`)

`packages/contracts/Move.toml` sets `edition = "2024.beta"` in `[package]`. The
`walrus_urchin` package is written against the 2024 dialect; copy-pasted pre-2024
examples will not compile (`sui move migrate` auto-rewrites legacy code). Features we
rely on:

- **`public struct`** — explicit struct visibility is now mandatory (all sketches above
  use it).
- **`let mut` / `mut` params + destructuring** — needed for `&mut Coin<SUI>` splits in
  `subscribe()` and `&mut Balance` accrual.
- **Method/dot-call syntax** — `clock.timestamp_ms()`, `sub.is_active(clock)`.
- **`public(package)`** replaces `friend` — internal helpers (e.g. the revenue-split
  routine shared by `subscribe` / `buy_ppv` / `buy_bundle`) are `public(package)`.
- **Enums + `match`** — `Tier.kind` as `enum TierKind { Subscription, Lifetime }`.
- **Positional struct fields, `use fun` aliases, macro functions** (`vector::do!` for the
  split loop), index syntax `&v[0]`.

---

## 3. Programmable Transaction Blocks (PTBs)

A PTB chains up to **1,024 commands atomically**: outputs of one command feed inputs of
the next, and either all effects apply or the whole block aborts. Command kinds:
`MoveCall`, `SplitCoins`, `MergeCoins`, `TransferObjects`, `MakeMoveVec`, `Publish`,
`Upgrade`. Built client-side in `apps/web` with `Transaction` from
`@mysten/sui/transactions` (v2.17.0), then sponsored via Enoki (§9).

Every WalrusUrchin user action is one PTB so payment + access-grant are all-or-nothing:

```ts
// apps/web — subscribe() as a single atomic PTB
import { Transaction } from '@mysten/sui/transactions';
import { coinWithBalance } from '@mysten/sui/transactions'; // address-balance aware (§8)

const tx = new Transaction();
tx.moveCall({
  target: `${PKG}::subscriptions::subscribe`,
  arguments: [
    tx.object(creatorProfileId),                 // shared CreatorProfile
    tx.pure.id(tierId),
    coinWithBalance({ balance: tierPrice }),      // SUI or USDC, accounts for address balances
    tx.object('0x6'),                             // Clock
  ],
});
// subscribe() internally: split revenue → emit RevenueSplit per recipient →
//   mint Subscription → transfer to fan; emit SubscriptionCreated.

// Hand kind-bytes to apps/api for Enoki sponsorship (the only place a secret is used):
const kindBytes = await tx.build({ client, onlyTransactionKind: true });
```

> Buying a transferable subscription on the secondary market is also one PTB:
> `purchase → royalty add_receipt → confirm_request → place/transfer` (see §6).

---

## 4. Clock (`0x6`) for expiry — and why renewals are pull-based

The `Clock` is a singleton **shared** object at address `0x6`. Pass it by immutable
reference (`&Clock`) and read `sui::clock::timestamp_ms(clock): u64` (Unix ms). Reads are
monotonic across txs and identical within a tx. Any tx touching the Clock goes through
consensus — fine here, since `CreatorProfile` is already shared.

A `Subscription` is **active iff `clock.timestamp_ms() < expires_ms`**. Seal's
subscription-pattern `seal_approve` (both Path A's Harbor policy and Path B's
`walrus_urchin::access_policy::seal_approve`) reads exactly this:

```move
use sui::clock::Clock;

const E_EXPIRED: u64 = 1;

public fun is_active(sub: &Subscription, clock: &Clock): bool {
    clock.timestamp_ms() < sub.expires_ms
}

public fun assert_active(sub: &Subscription, clock: &Clock) {
    assert!(is_active(sub, clock), E_EXPIRED);
}
```

**There is no on-chain scheduler/cron on Sui.** "Recurring" subscriptions cannot
auto-charge — renewal is a **pull-based** `renew()` transaction that extends `expires_ms`
by one period and re-splits the payment. It is driven either by the fan manually or by
the `apps/api` relayer/cron (Enoki-sponsored). Lapsed subscriptions are **not**
auto-revoked on-chain; expiry is enforced only by reading `expires_ms` against `0x6` at
access time (and, in Path A, by Harbor `unshare_bucket_access` — see
[`habour.md`](./habour.md)).

```move
public entry fun renew(
    sub: &mut Subscription,
    profile: &mut CreatorProfile,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let tier = tier_of(profile, sub.tier_id);
    // Renew from max(now, current expiry) so paused renewals don't lose paid time.
    let base = if (sub.expires_ms > clock.timestamp_ms()) sub.expires_ms
               else clock.timestamp_ms();
    sub.expires_ms = base + tier.period_ms;
    split_revenue(profile, tier, payment, ctx);     // emits RevenueSplit per recipient
    event::emit(SubscriptionRenewed {
        subscription_id: object::id(sub),
        creator_id: sub.creator_id,
        new_expires_ms: sub.expires_ms,
    });
}
```

---

## 5. Dynamic (object) fields — attaching tiers & content without bloat

`sui::dynamic_field` (df) attaches arbitrary typed key→value pairs to an object's `UID`
at runtime; gas is paid only when a field is accessed, enabling unbounded heterogeneous
collections. `sui::dynamic_object_field` (dof) is the same but values must have `key` and
stay independently addressable by their own object ID.

WalrusUrchin attaches `Tier` and `Content`/`Post` objects to `CreatorProfile` as
**dynamic object fields**, so a creator can publish unlimited posts/tiers without growing
a single struct, and fans pay gas only for the item they touch:

```move
use sui::dynamic_object_field as dof;

public fun attach_content(profile: &mut CreatorProfile, content: Content) {
    dof::add(&mut profile.id, ContentKey { id: object::id(&content) }, content);
}
```

> **Gotcha:** values stored as **plain** dynamic fields (`df`) are treated as *wrapped*
> and are **not** independently discoverable by explorers/wallets/indexers via their own
> ID. Since the indexer and fans need to enumerate posts/tiers directly, WalrusUrchin
> uses **dof** for `Tier` and `Content`, reserving plain `df` only for internal scalars.

---

## 6. Coin / Balance + Closed-Loop Token (tip credits)

`Coin<T>` is a `key + store` wrapper around the internal `Balance<T>`. Native SUI is
`0x2::sui::SUI`; USDC is the gasless-eligible stablecoin (§8). The on-chain revenue split
that powers `subscribe()` / `buy_ppv()` / `buy_bundle()` is pure `coin::split` /
`balance` arithmetic against the tier's `revenue_split: vector<Share{addr, bps}>`:

```move
use sui::coin::{Self, Coin};
use sui::sui::SUI;

const BPS_DENOM: u64 = 10_000;

public(package) fun split_revenue(
    profile: &mut CreatorProfile,
    tier: &Tier,
    mut payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    let total = coin::value(&payment);
    // 1) platform fee (transparent, low — e.g. 0–500 bps), accrues to platform payout.
    let fee = total * (profile.platform_fee_bps as u64) / BPS_DENOM;
    transfer::public_transfer(coin::split(&mut payment, fee, ctx), PLATFORM_PAYOUT);
    // 2) explicit shares (creator + collaborators + optional referrer).
    let mut i = 0;
    while (i < vector::length(&tier.revenue_split)) {
        let share = vector::borrow(&tier.revenue_split, i);
        let cut = total * (share.bps as u64) / BPS_DENOM;
        let part = coin::split(&mut payment, cut, ctx);
        transfer::public_transfer(part, share.addr);
        event::emit(RevenueSplit { creator_id: object::id(profile), recipient: share.addr, amount: cut });
        i = i + 1;
    };
    // 3) dust remainder → creator's escrow Balance<SUI>.
    coin::put(&mut profile.earnings, payment);
}
```

`tip()` is a direct `Coin<SUI>` (or USDC) transfer to the creator (with optional split),
emitting `TipReceived`.

**Closed-Loop Token for tip credits.** `sui::token::Token<T>` has only `key` (no `store`),
so it cannot be freely transferred, wrapped, or Kiosk-listed. A `TokenPolicy<T>` + rules
gate protected actions (`transfer`, `spend`, `to_coin`, `from_coin`) via `ActionRequest`
hot-potatoes; public actions (`keep`, `join`, `split`, `destroy_zero`) are unrestricted.
This is the ideal vehicle for **non-tradeable platform tip credits**: a fan buys credits
once (one onboarding), then spends them on tips/PPV without re-signing/re-funding.

```move
// Spend a tip credit — TokenPolicy allows `spend` only toward in-app sinks.
public entry fun tip_with_credit(
    credit: Token<TIP>, policy: &TokenPolicy<TIP>, profile: &mut CreatorProfile, ctx: &mut TxContext,
) {
    let amount = token::value(&credit);
    let req = token::spend(credit, ctx);          // ActionRequest hot-potato
    token::confirm_request(policy, req, ctx);     // must be resolved or tx aborts
    event::emit(TipReceived { creator_id: object::id(profile), amount, kind: 1 /* credit */ });
}
```

> **Choose `Coin<T>` vs `Token<T>` deliberately:** `Token` cannot go in a Kiosk or
> anywhere `store` is required. Use `Coin<SUI>`/USDC for real payouts and revenue splits;
> use `Token<TIP>` for non-tradeable in-app credits.

---

## 7. Kiosk + TransferPolicy + royalty rule (transferable subscription NFTs)

For premium tiers we want fans to be able to **resell** a `Subscription` while the
**creator earns a royalty** on every secondary sale. That requires the
Kiosk + TransferPolicy + royalty-rule + lock-rule combination:

- `sui::kiosk` — `new() -> (Kiosk, KioskOwnerCap)`; `place` / `lock` / `take` / `list` /
  `delist` / `purchase`. `purchase<T: key+store>(&mut Kiosk, id, payment: Coin<SUI>) ->
  (T, TransferRequest<T>)`. `lock` (vs `place`) prevents `take`, which is what makes
  royalty enforcement *strong*. Kiosk profits accrue in a `Balance<SUI>` withdrawn via
  `withdraw(&mut Kiosk, &KioskOwnerCap, Option<u64>, ctx) -> Coin<SUI>`.
- `sui::transfer_policy` — the type owner creates `TransferPolicy<Subscription>` +
  `TransferPolicyCap<Subscription>`; rules added with `add_rule`. Every `purchase` mints a
  `TransferRequest<T>` **hot-potato** that must be resolved by `confirm_request` after all
  required `add_receipt` calls **in the same tx**, or the tx aborts. Rule fees deposit
  into the policy balance, withdrawable by the cap holder (the creator).
- **Royalty rule** — `Config { amount_bp: u16 }` in basis points, `MAX_BPS = 10_000`;
  `fee = (paid as u128 * amount_bp / 10_000) as u64`. 1% = 100 bp, 5% = 500 bp. Combine
  with the **lock rule** to force royalties on every secondary sale.

```move
// One-time setup (CreatorCap-gated): make transferable tiers royalty-bearing.
public entry fun init_subscription_market(
    _cap: &CreatorCap, publisher: &Publisher, royalty_bp: u16, ctx: &mut TxContext,
) {
    let (mut policy, policy_cap) =
        transfer_policy::new<Subscription>(publisher, ctx);
    royalty_rule::add(&mut policy, &policy_cap, royalty_bp, /* min_amount */ 0);
    kiosk_lock_rule::add(&mut policy, &policy_cap);   // lock rule ⇒ royalties unavoidable
    transfer::public_share_object(policy);
    transfer::public_transfer(policy_cap, ctx.sender());
}
```

Soulbound `Entitlement`/PPV (`key`-only) is the deliberate opposite: it cannot be placed
or locked in a Kiosk at all, so personal one-off unlocks can never be resold. This is
decided per `Tier.kind` (premium tier = transferable; personal PPV = soulbound), matching
[`architecture.md` §4 / §9](./architecture.md).

> **Gotcha:** `PurchaseCap` (used for exclusive Kiosk listings) is itself a valuable
> object — losing it can permanently lock the listed `Subscription`. Handle it carefully
> in any bundle/escrow flow.

---

## 8. Events + indexing (`subscribeEvent` deprecated) & address balances

**Events.** Define a struct with `copy, drop` and emit via `sui::event::emit(...)`. Each
event carries `sender`, `packageId`, `transactionModule`, fully-qualified type,
`timestamp`, and `parsedJson` (limit ~1,024 events per tx). WalrusUrchin's canonical event
set (consumed by the `apps/api` indexer):

| Event | Emitted by |
| --- | --- |
| `CreatorRegistered` | `register_creator()` |
| `TierCreated` | `create_tier()` (CreatorCap-gated) |
| `SubscriptionCreated` | `subscribe()` |
| `SubscriptionRenewed` | `renew()` |
| `ContentPublished` | `publish_content()` |
| `PpvPurchased` | `buy_ppv()` |
| `TipReceived` | `tip()` / `tip_with_credit()` |
| `RevenueSplit` | `split_revenue()` — one per recipient |
| `BundlePurchased` | `buy_bundle()` |

```move
public struct SubscriptionCreated has copy, drop {
    subscription_id: ID, creator_id: ID, tier_id: ID, subscriber: address, expires_ms: u64,
}
```

> **Gotcha:** `subscribeEvent` (websocket push) is **deprecated** — do not build the feed
> on it. Index via JSON-RPC `suix_queryEvents` / GraphQL polling, or run a
> `sui-indexer-alt-framework` (Rust) indexer. Allow for indexer lag before querying
> freshly emitted events. The indexer also reconciles on-chain `Subscription` state into
> Harbor Seal grants (Path A — see [`habour.md`](./habour.md)) and drives renewal nudges.

**Address balances / gasless stablecoin (protocol 125).** Mainnet protocol v125+ added
**address balances** (per-address `Balance<T>` accounting alongside `Coin<T>` objects)
and **gasless stablecoin transfers** for an allowlisted set (USDC, USDY, FDUSD, AUSD,
USDB, …) where `gasPayment` is empty and `gasPrice = 0`. Funds may therefore live as an
address balance rather than as `Coin` objects — naive coin-selection PTBs can miss them
and look underfunded. Use the SDK's `coinWithBalance` helper (shown in §3) and the
gRPC/GraphQL transports so coin inputs to `subscribe()` / `buy_ppv()` account for both
representations.

---

## 9. Capability pattern & sponsored transactions

**Capabilities, never `msg.sender`.** Authorization is by holding a typed `*Cap` object,
passed by reference and matched against the target's id — not address checks. WalrusUrchin
caps:

| Cap | Gates |
| --- | --- |
| `CreatorCap` (owned) | All `CreatorProfile`/`Tier`/`Content` admin mutations |
| `KioskOwnerCap` | Kiosk marketplace ops (list/delist/withdraw) for the seller |
| `TransferPolicyCap<Subscription>` | Royalty config + policy-balance withdrawal (creator) |
| `TreasuryCap<TIP>` | Mint/burn of the closed-loop tip-credit token |

```move
const E_WRONG_CREATOR: u64 = 2;

public entry fun create_tier(
    cap: &CreatorCap, profile: &mut CreatorProfile, price: u64, period_ms: u64,
    revenue_split: vector<Share>, ctx: &mut TxContext,
) {
    assert!(cap.creator_id == object::id(profile), E_WRONG_CREATOR);  // cap matches target
    // ... build Tier, attach as dof, emit TierCreated ...
}
```

**Sponsored transactions.** A sponsored tx uses `GasData` where the gas-object owner
(sponsor) differs from the sender; both sign the same `TransactionData` (dual signature).
WalrusUrchin uses the **user-proposed** flow via Enoki so fans never hold SUI:

1. `apps/web` builds tx kind bytes (`tx.build({ client, onlyTransactionKind: true })`).
2. `apps/api` (holding the Enoki **secret** key, `EnokiClient`) calls
   `transaction-blocks/sponsor` then `transaction-blocks/sponsor/:digest` with `network`
   + `transactionBlockKindBytes`, returning sponsor-signed bytes.
3. The user co-signs with their zkLogin signer; the dual-signed tx executes.

The Enoki key's allowlist is pinned to exactly the `walrus_urchin` entry functions, and
`/sponsor` verifies `sender == authenticated user` before sponsoring (per
[`architecture.md` §3](./architecture.md)). Full wiring in [`auth.md`](./auth.md).

> **Gotcha:** **gas-object equivocation** — if the sponsor (or user) reuses the same gas
> object *version* across multiple inflight txs, transactions get rejected. The Hono gas
> station must manage a dedicated, non-overlapping gas-coin pool. **UNVERIFIED:** the exact
> high-level `@mysten/enoki` method names and the precise supported `network` values were
> not fully confirmed from docs — verify against `docs.enoki.mystenlabs.com` and the
> `@mysten/enoki` typedoc before coding (HTTP-level endpoint names above are confirmed).

---

## 10. Full `walrus_urchin` object → primitive map

| Object | Ownership / abilities | Key Sui primitives | Notes |
| --- | --- | --- | --- |
| `CreatorProfile` | **shared** | `share_object`, `Balance<SUI>`+USDC escrow, `dof` for tiers/content | Parallel subscribe/tip; SuiNS handle ref (see [`suins.md`](./suins.md)) |
| `CreatorCap` | owned | capability pattern | Admin-gates the profile |
| `Tier` | dof of profile | `enum TierKind`, `vector<Share>` revenue split, `period_ms` (= Clock TTL) | Follows Seal Service pattern |
| `Subscription` (transferable) | owned, `key + store` | Kiosk + `TransferPolicy` + royalty + lock rule | Resale earns creator royalty |
| `Subscription` (soulbound perk) | owned, `key` only | no `store` ⇒ no transfer/Kiosk | Cannot be resold |
| `Entitlement` / `PpvAccess` | owned, `key` only | Clock `valid_till`, Seal `key_request` | One-off / rental, soulbound |
| `Content` / `Post` | dof of profile | storage refs + `seal_policy_id` / `seal_identity` | Media stays encrypted on Walrus |
| `Bundle` | object / config | one PTB mints several access NFTs at a discount | References multiple tiers/content |
| `TIP` credit | `Token<TIP>` (`key` only) | `TokenPolicy` + rules | Non-tradeable in-app credit |

**Entry-function → money-flow summary** (all atomic PTBs, all emit events):

| Entry fn | Input | On-chain effect |
| --- | --- | --- |
| `subscribe(profile, tier_id, Coin, clock)` | `Coin<SUI>`/USDC | `split_revenue` → mint `Subscription` → transfer to fan → `SubscriptionCreated` |
| `renew(sub, profile, Coin, clock)` | `Coin<SUI>`/USDC | extend `expires_ms` → `split_revenue` → `SubscriptionRenewed` (pull-based) |
| `buy_ppv(profile, content_id, Coin, clock)` | `Coin<SUI>`/USDC | `split_revenue` → mint soulbound `Entitlement` → `PpvPurchased` |
| `tip(profile, Coin)` / `tip_with_credit(...)` | `Coin`/`Token<TIP>` | direct transfer (+opt split) → `TipReceived` |
| `buy_bundle(profile, bundle_id, Coin, clock)` | `Coin<SUI>`/USDC | `split_revenue` → mint several access NFTs in one PTB → `BundlePurchased` |

---

## 11. Network / version pins

Reuse the exact values from [`architecture.md` §8](./architecture.md) — do not invent new
ones. The Sui-specific subset:

| Thing | Testnet value |
| --- | --- |
| Sui fullnode (gRPC) | `https://fullnode.testnet.sui.io:443` |
| Move package | `walrus_urchin`, `Move.toml` edition `2024.beta` |
| Clock | `0x6` (singleton shared object) |
| Native coin | `0x2::sui::SUI`; USDC = gasless-eligible stablecoin (protocol 125) |
| `@mysten/sui` | `2.17.0` |
| `@mysten/enoki` | `1.0.8` |
| `@mysten/dapp-kit-react` / `-core` | `2.0.3` / `1.3.2` |

**Network status (June 2026, approximate — confirm at build time):** mainnet ~v1.70–v1.72
(protocol v125+, new Move VM v1.69.2); testnet ~v1.71.x (slightly ahead). WalrusUrchin
builds/tests on **testnet first** because Harbor is at `api.testnet.harbor.walrus.xyz`.
Design `UpgradeCap` from day one and exercise package upgrades on testnet before mainnet.

---

## Gotchas

- **No native cron.** Recurring subscriptions cannot auto-charge — `renew()` is a
  pull-based tx (manual or relayer-driven, Enoki-sponsored). Lapsed subs are not
  auto-revoked on-chain; enforce expiry by reading `expires_ms` against `0x6` at access
  time (+ Harbor `unshare_bucket_access` in Path A).
- **Royalties only hold under lock.** A `store`-able `Subscription` sent via
  `public_transfer` bypasses royalties entirely. Force resale through a **locked** Kiosk
  with the royalty rule **and** the lock rule; never expose a direct transfer path for
  tiers that must always pay the creator.
- **`subscribeEvent` is deprecated.** Build the feed/indexer on GraphQL/RPC polling or a
  `sui-indexer-alt-framework` indexer, and tolerate indexer lag.
- **df vs dof.** Plain dynamic-field values are *wrapped* and not discoverable by their own
  ID. Use **dynamic object fields (dof)** for `Tier`/`Content` so fans and the indexer can
  enumerate them.
- **Move 2024 strictness.** `public struct` and explicit `mut` are mandatory; pre-2024
  examples won't compile under `2024.beta`. Run `sui move migrate`.
- **`Token<T>` has no `store`.** Tip credits can't go in a Kiosk or anywhere `store` is
  required. Use `Coin<SUI>`/USDC for payouts, `Token<TIP>` only for non-tradeable credits.
- **Address balances (protocol 125).** Funds may live as address balances, not `Coin`
  objects. Use `coinWithBalance` + gRPC/GraphQL transports or `subscribe()`/`buy_ppv()`
  inputs may look underfunded.
- **Sponsored-tx gas equivocation.** Reusing a gas-object version across inflight txs gets
  them rejected; the Hono gas station needs a dedicated, non-overlapping gas-coin pool.
- **Shared-object contention.** Every Clock read / shared-`CreatorProfile` tx goes through
  consensus. A very hot profile can become a throughput bottleneck — consider party objects
  or splitting hot state if needed.
- **PTB limits.** 1,024 commands per PTB and ~1,024 events per tx constrain large
  revenue-split fan-outs / bulk bundle mints — span multiple txs for big fan-outs.
- **Mainnet halted 3× on 28–29 May 2026** (v1.72 gas edge case). Treat upgrades as risky;
  pin versions and validate on testnet/devnet first.
- **UNVERIFIED:** exact `@mysten/enoki` method names + supported `network` values, and the
  precise current mainnet/testnet minor versions — confirm against the live docs before
  coding. Harbor is **alpha/testnet**.

## Sources

- https://docs.sui.io/concepts/object-model
- https://docs.sui.io/guides/developer/objects/object-ownership
- https://docs.sui.io/concepts/object-ownership/immutable
- https://docs.sui.io/concepts/dynamic-fields
- https://docs.sui.io/references/framework/sui_sui/dynamic_field
- https://docs.sui.io/references/framework/sui/dynamic_object_field
- https://docs.sui.io/build/move/time
- https://docs.sui.io/references/framework/sui_sui/clock
- https://docs.sui.io/concepts/transactions/prog-txn-blocks
- https://docs.sui.io/guides/developer/sui-101/building-ptb
- https://docs.sui.io/guides/developer/advanced/move-2024-migration
- https://github.com/MystenLabs/sui/issues/14062
- https://github.com/MystenLabs/sui/issues/14063
- https://github.com/MystenLabs/sui/issues/15653
- https://move-book.com/guides/2024-migration-guide/
- https://docs.sui.io/guides/developer/sui-101/using-events
- https://docs.sui.io/references/framework/sui/event
- https://docs.sui.io/references/framework/sui_sui/coin
- https://docs.sui.io/references/framework/sui-framework/balance
- https://docs.sui.io/standards/closed-loop-token
- https://docs.sui.io/references/framework/sui_sui/token
- https://docs.sui.io/standards/kiosk
- https://docs.sui.io/references/framework/sui_sui/kiosk
- https://docs.sui.io/references/framework/sui_sui/transfer_policy
- https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/kiosk/kiosk.move
- https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/tests/kiosk/policies/royalty_policy.test.move
- https://docs.sui.io/concepts/transactions/sponsored-transactions
- https://docs.sui.io/develop/transaction-payment/gasless-stablecoin-transfers
- https://docs.sui.io/guides/developer/digital-assets/migrate-address-balances
- https://www.npmjs.com/package/@mysten/sui
- https://www.npmjs.com/package/@mysten/enoki
- https://docs.enoki.mystenlabs.com/ts-sdk/sponsored-transactions
- https://sdk.mystenlabs.com/typescript
- https://www.sui.io/networkinfo
- https://docs.sui.io/references/release-notes
- https://www.coindesk.com/tech/2026/06/01/three-sui-mainnet-halts-in-48-hours-traced-to-an-upgrade-bug-by-developers
