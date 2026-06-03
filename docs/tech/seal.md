# Seal — threshold encryption & on-chain access control

> Status: **design / docs-only** (June 2026). Targets **Sui testnet** first. Seal itself is on
> mainnet, but WalrusUrchin's content paths run on testnet because [Harbor](./habour.md) and
> [memwal](./memwal.md) are testnet/beta. Where IDs/versions are quoted, they are the values pinned in
> [`architecture.md` §8](./architecture.md) — do not invent new ones.

Seal is the access-control + encryption layer of the Sui Stack and, for WalrusUrchin, the mechanism
that makes "paid content on a public blob store" possible. Every private post, video, downloadable, or
DM is **Seal-encrypted before it ever reaches [Walrus](./walrus.md)** (which is world-readable by Blob
ID), and the decryption key is only released by threshold key servers when an on-chain `seal_approve*`
check confirms the requester actually holds the right `Subscription`, `Entitlement`/`PpvAccess`, or
allowlist membership defined by our [`walrus_urchin` Move package](./sui.md). This doc covers Seal's
cryptography, the identity/contract model, the SDK lifecycle, and — most importantly — how the published
Seal Move *patterns* map onto WalrusUrchin's tiers, PPV, DMs, supporter groups, and scheduled drops, plus
how self-managed Seal (Path B) differs from Harbor-wrapped Seal (Path A).

---

## 1. What Seal is (cryptographic core)

Seal is a **KEM/DEM** (envelope) scheme with a **threshold** twist on the key half:

| Half | Primitive | Notes for WalrusUrchin |
| --- | --- | --- |
| **KEM** (key encapsulation) | Boneh–Franklin **Identity-Based Encryption** over **BLS12-381** (`BonehFranklinBLS12381DemCCA`) | The "identity" is an on-chain-meaningful string (see §2). Per-server key shares are split `t`-of-`n`. |
| **DEM** (data encapsulation) | **AES-256-GCM** (default) or **HMAC-256-CTR** | Use **AES-256-GCM** for all consumer media. Reserve **HMAC-CTR** for the rare case where *Move* must decrypt small data on-chain (sealed-bid, encrypted votes). |

The IBE layer encrypts a fresh symmetric DEM key; the DEM layer encrypts the actual bytes with that key.
Because IBE is identity-based, **no per-recipient public key is needed** — you encrypt to an *identity
string* and the key servers derive the matching private key on demand, but only after `seal_approve*`
passes. That is the whole game: **the policy lives in Move, the keys live in `t`-of-`n` servers, and
neither the encryptor nor the servers can unilaterally hand out a key.**

> Note this is envelope encryption *inside one EncryptedObject*. WalrusUrchin layers a **second**
> envelope on top of it for large media (§9) — Seal encrypts only a small DEK, not the gigabyte video.

---

## 2. Identity model: `[pkgId][inner-id]`

The encryption identity is a byte string `[packageId || inner-id]`:

- **`packageId`** — the Move package that *owns the identity namespace*. The package at `packageId`
  controls the entire subdomain `packageId*` and is the only thing that can define who may obtain keys
  for those identities. For WalrusUrchin this is our single upgradeable `walrus_urchin` package (Path B)
  or Harbor's `bucket_policy` package (Path A).
- **`inner-id`** — everything after the prefix. **You pass only the inner-id to the SDK `id` argument;
  Seal prepends the package prefix for you.** This is where the per-tier / per-blob / per-recipient
  structure lives.

WalrusUrchin's inner-id convention (mirrors the Seal patterns, see §6):

```
subscription tier content : [serviceId][blobId][nonce]     // serviceId == Tier object id
PPV / one-off             : [keyRequestId or blobId][nonce]
supporter allowlist post  : [whitelistId][nonce]
1:1 DM                    : [bcs(recipientAddress)]
scheduled drop            : [bcs(unlock_time_ms)]
```

Binding the inner-id to the **specific Walrus blob** (`||blobId||`) is a hard rule: it stops a stolen
`seal_approve` PTB for one post from unlocking a different post, and lets PPV grants target exactly one
file. Always append a fresh random nonce per encryption (the Seal example uses 5 random bytes).

---

## 3. The `seal_approve*` contract

Key servers do **not** trust the client's claim of access. They evaluate the policy by running the
package's `seal_approve*` entry function against the chain. The rules:

- A policy module defines one or more **non-`public` `entry fun seal_approve*(id: vector<u8>, ...)`**.
  The first argument is always the **inner identity** bytes.
- It **must abort on denial** (a clean return == access granted).
- It **must be side-effect-free** — it cannot mutate state, and it **cannot use secure randomness**.
- Multiple `seal_approve*` variants per module are allowed (e.g. `seal_approve` for subscription,
  `seal_approve_ppv` for key-request).

**How the check runs (and the PTB constraints):**

1. The client builds a PTB that calls *only* `seal_approve*` functions, **all in the same package**, and
   composes them with **no other commands**.
2. The client serializes it with `tx.build({ client, onlyTransactionKind: true })` — a *transaction
   kind*, not a full signable tx.
3. The key server evaluates it with the full node's **`dry_run_transaction_block`**. Inside Move,
   `TxContext::sender()` resolves to the **SessionKey address** (§4), i.e. the fan.
4. If the dry-run succeeds for ≥ `threshold` servers, each returns its IBE key *share* encrypted to the
   requester's ephemeral public key; the client combines shares and decrypts. If the policy aborts, the
   SDK throws `NoAccessError`.

```move
// Path B sketch — walrus_urchin::access_policy (subscription variant)
// id == [serviceId || blobId || nonce]; package prefix is stripped by Seal before this runs.
entry fun seal_approve(
    id: vector<u8>,
    sub: &Subscription,      // owned by ctx.sender() (the SessionKey/fan address)
    tier: &Tier,             // shared; carries service id + period_ms
    clock: &Clock,
) {
    assert!(is_prefix(object::id_bytes(tier), id), ENoAccess);     // id bound to this tier
    assert!(sub.tier_id == object::id(tier), ENoAccess);           // sub matches tier
    assert!(clock.timestamp_ms() <= sub.expires_ms, EExpired);     // TTL still valid
    // NOTE: no state mutation, no payment, no randomness — pure read-only check.
}
```

> Because the check is a stale-tolerant dry-run: never gate on objects created seconds ago (you may get
> `InvalidParameter`; retry after a few seconds), and never rely on tx ordering. Keep **payment + revenue
> split out of `seal_approve`** — those belong in the `subscribe()`/`buy_ppv()` PTB (see
> [`sui.md`](./sui.md)), not in the access check.

---

## 4. SessionKey lifecycle

A `SessionKey` is the fan's time-boxed authorization to fetch keys for one package. It decouples the
expensive wallet signature from the many key fetches a browsing session needs.

```ts
import { SessionKey } from '@mysten/seal';

// 1. Create — packageId is the IDENTITY-NAMESPACE package:
//    Path A → HARBOR_ORIGINAL_PACKAGE_ID ; Path B → walrus_urchin package id.
const sessionKey = await SessionKey.create({
  address: fanAddress,           // zkLogin/Passkey address (see auth.md)
  packageId: SEAL_PACKAGE_ID,
  ttlMin: 15,                    // 10–30 min; short TTL bounds the post-revocation window
  suiClient,
  // signer: enokiSigner,        // optional: skip the wallet prompt entirely with an Enoki signer
});

// 2. User signs the personal message once (one approval authorizes all fetches for ttlMin):
const { signature } = await wallet.signPersonalMessage(sessionKey.getPersonalMessage());
sessionKey.setPersonalMessageSignature(signature);

// 3. Persist across page loads so the fan signs once per session:
//    sessionKey.export() → IndexedDB ; SessionKey.import(...) on return.
//    Guard with sessionKey.isExpired() and sessionKey.getAddress().
```

Lifecycle properties to design around:

- **One approval per package** authorizes key fetches for `ttlMin` minutes.
- `isExpired()` / `getAddress()` for guards; `export()`/`import()` for IndexedDB persistence so a fan
  reading a feed of many posts signs **once**.
- With an **Enoki signer** passed to `create({ signer })`, there is no wallet prompt at all — ideal for
  WalrusUrchin's zkLogin/Passkey UX where the fan never sees a seed phrase ([`auth.md`](./auth.md)).
- The TTL is also the **revocation window**: a key already pulled during a live TTL keeps working until
  it expires (§10).

---

## 5. SealClient: encrypt / decrypt / fetchKeys

```ts
import { SealClient, EncryptedObject } from '@mysten/seal';

// Path A (Harbor): pin Harbor's THREE key servers, threshold 2-of-3, verifyKeyServers:false.
// Path B (self-managed): use the Seal testnet servers / committee from architecture.md §8.
const client = new SealClient({
  suiClient,
  serverConfigs: HARBOR_KEY_SERVERS.map((objectId) => ({ objectId, weight: 1 })),
  verifyKeyServers: false,        // REQUIRED for Harbor's pinned set; true for the generic set
});
```

### encrypt

```ts
const { encryptedObject, key } = await client.encrypt({
  threshold: 2,                   // FROZEN into the ciphertext — see §9/§10
  packageId: SEAL_PACKAGE_ID,     // Path A: HARBOR_ORIGINAL_PACKAGE_ID
  id: innerId,                    // e.g. serviceId || blobId || nonce (NO package prefix)
  data: dekBytes,                 // the small DEK, not the whole video (envelope, §9)
  // kemType / demType default to BF-BLS12381 + AES-256-GCM
  // aad: optional additional authenticated data (NOT secret)
});
// `key` is the raw DEM symmetric key (disaster-recovery backup for CLI symmetric-decrypt).
// It BYPASSES the policy if persisted. WalrusUrchin discards it (Harbor never exposes it).
```

### decrypt

```ts
// Build the seal_approve PTB (onlyTransactionKind), then:
const plaintext = await client.decrypt({
  data: encryptedObject,          // bytes from Walrus/Harbor
  sessionKey,
  txBytes,                        // tx.build({ client, onlyTransactionKind: true })
});
```

### fetchKeys (batch for a feed)

```ts
// Pre-fetch up to 10 ids per PTB so each subsequent decrypt() is LOCAL-only (no network).
await client.fetchKeys({ ids: blobInnerIds, txBytes, sessionKey, threshold: 2 });
// Then decrypt() each EncryptedObject without another round-trip.
```

Inspect ciphertext without decrypting via `EncryptedObject.parse(bytes)` → `{ version, packageId, id,
services: [address, weight][], threshold, encryptedShares, ciphertext }`. Useful to confirm a blob is
bound to the expected package/threshold before trusting it, and to read which servers it was sealed to.

---

## 6. EncryptedObject layout

The on-wire object (BCS, from the ts-sdks `seal` package) is what we store as an opaque blob:

```
EncryptedObject {
  version:          u8,
  packageId:        Address,                  // the identity-namespace package
  id:               bytes,                    // inner-id (hex)
  services:         vector<[Address, u8]>,    // (keyServer objectId, weight) — FROZEN
  threshold:        u8,                        // FROZEN at encrypt time
  encryptedShares:  IBEEncryptions,
  ciphertext:       enum {
    Aes256Gcm  { blob, aad? },
    Hmac256Ctr { blob, aad?, mac },
    Plain,                                     // ⚠ unencrypted — must never occur for paid content
  },
}
IBEEncryptions::BonehFranklinBLS12381 {
  nonce:               bytes(96),
  encryptedShares:     vector<bytes(32)>,
  encryptedRandomness: bytes(32),
}
```

The `services` list and `threshold` being **frozen** is the single fact that drives WalrusUrchin's
envelope strategy (§9) and the inability to fully revoke (§10). Guard explicitly that
`ciphertext != Plain` when treating Seal output as an opaque blob.

---

## 7. Key servers (open / permissioned / committee)

Key servers register on-chain as **`KeyServer` objects**. The stable reference is the **`objectId`** —
the URL on the object can change, so we pin `objectId`s, never URLs.

| Type | Mode | What it means for us |
| --- | --- | --- |
| **Independent** (single operator) | **Open** | One shared master key across *all* packages; anyone can use it. Fixed source-based rate limits. Fine for previews/low-value. |
| **Independent** (single operator) | **Permissioned** | Per-client master key + API key; your package is allowlisted. The API key is a **secret → lives in `apps/api`**, never in the SPA. |
| **Decentralized / committee** (MPC) | n/a | Runs `t`-of-`n` internally (e.g. **3-of-5**), fronted by an `aggregatorUrl`. **Threshold is fixed at committee setup** — do not pass your own `t`. Best durability for paid content. |

Pinned IDs (from [`architecture.md` §8](./architecture.md), testnet):

| Use | objectId(s) |
| --- | --- |
| **Harbor** pinned (Path A, **2-of-3**, `verifyKeyServers:false`) | `0x6068c0ac…6d141da2`, `0x164ac3d2…0cccf0f2`, `0x9c949e53…d4c434105` |
| Seal generic testnet Open (Path B) | `0x73d05d62…356db75`, `0xf5d14a81…91623c8` |
| Seal committee (3-of-5) + aggregator | `0xb012378c…e1e1e98` @ `https://seal-aggregator-testnet.mystenlabs.com` |
| On-chain decrypt pkg (`bf_hmac_encryption`, HMAC-CTR) | testnet `0x40168694…efdb2c3` |

> **Use Harbor's pinned three for Path A** — they are *not* the generic `getAllowlistedKeyServers('testnet')`
> set, which is why `verifyKeyServers:false` is required there. Server REST surface: `/v1/service`
> (on-chain registered info / objectId) and `/v1/fetch_key` (signed personal message + onlyTransactionKind
> PTB + ephemeral pubkey → IBE-derived key shares).

---

## 8. Seal patterns → WalrusUrchin features

Every WalrusUrchin access mode maps to one published Seal Move pattern. In Path B these become variants
of `walrus_urchin::access_policy`; in Path A, Harbor's `bucket_policy` covers the subscription/allowlist
shapes and we lean on Path B for anything richer (combined PPV+subscription, KeyRequest).

| WalrusUrchin feature | Seal pattern | Inner-id | `seal_approve` check | Object model ([arch §4](./architecture.md)) |
| --- | --- | --- | --- | --- |
| **Subscription (tier TTL)** | `subscription` | `[serviceId][blobId][nonce]` | `sub.service_id == service` AND `clock <= created_at + ttl` AND id prefix | `Tier` (fee + `period_ms`/ttl), `Subscription` NFT |
| **Allowlist (supporter group)** | `whitelist` | `[whitelistId][nonce]` | `addresses.contains(ctx.sender())` + prefix | supporter group membership table + admin `Cap` |
| **Key-request (PPV)** | `key_request` | `[blobId][nonce]`-bound | `req.verify(WITNESS, id, sender, clock)` only | `Entitlement`/`PpvAccess` (soulbound) |
| **Account-based (1:1 DMs)** | `account_based` | `[bcs(recipientAddr)]` | only that address derives the key | `dm:<creatorId>:<fanAddr>` content |
| **Time-lock (scheduled drops)** | `tle` | `[bcs(unlock_time_ms)]` | unlocks once `Clock` ≥ time | scheduled `Content`/`Post` |

**Subscription (tier TTL).** Clone `patterns::subscription` per creator: a `Tier`/`Service{fee, ttl,
owner}` shared object + transferable `Subscription{service_id, created_at}`. Because `seal_approve` gates
on `clock <= created_at + ttl`, **monthly expiry is automatic — no revocation tx needed**. And because
the `Subscription` is a `key`-only transferable object, reselling/gifting it instantly transfers decrypt
rights — that is WalrusUrchin's "portable, transferable subscription NFT" feature (with Kiosk +
TransferPolicy royalty for transferable tiers; soulbound `key`-only perks for non-resellable ones).

**Allowlist (supporter group).** Membership lives in a `Table<address, bool>` gated by an admin `Cap`;
`seal_approve` checks `addresses.contains(sender)`. Members can be added/removed **without re-encrypting**
the post — ideal for an evolving supporter circle.

**Key-request (PPV).** The expensive, *paid* policy check happens when minting a per-user
`KeyRequest{inner_id (blob-bound), user, valid_till}` — payment + revenue split run there, in a normal
PTB. `seal_approve` then only calls `req.verify(...)`. This keeps payment logic **out of the dry-run
path** and binds the unlock to one buyer + an expiry (e.g. a 48h rental). Maps to soulbound
`Entitlement`/`PpvAccess`.

**Account-based (1:1 DMs).** Inner-id is `[bcs(recipientAddr)]`, so **only that one address** can derive
the key — exactly what creator↔fan direct messages need. (Note: this is the *content* layer; agent-memory
text lives in [memwal](./memwal.md), not here.)

**Time-lock (scheduled drops).** Inner-id encodes `unlock_time_ms`; `seal_approve` passes only once the
on-chain `Clock` reaches it. Lets a creator pre-upload an encrypted drop that becomes decryptable at a
future moment with no manual action.

---

## 9. Envelope / DEK encryption (and *why*)

For anything larger than a few KB, do **not** Seal-encrypt the bytes directly. Instead:

```
1. Generate a per-file AES-256-GCM DEK (random 32 bytes).
2. AES-256-GCM encrypt the media with the DEK, client-side.
3. Store that ciphertext on Walrus (via Harbor file upload, or @mysten/walrus Upload Relay).
4. Seal-encrypt ONLY the small DEK against the tier/PPV policy id → store the EncryptedObject.
```

**Why this is mandatory, not an optimization:** the set of **key servers and the threshold are frozen
into the EncryptedObject at encrypt time** (§6) and can never be changed for already-encrypted data. A
subscription video must stay decryptable for years; key-server committees rotate and policies migrate.
If you Seal-encrypted the whole blob, rotating servers or migrating policy would mean **re-downloading,
re-encrypting, and re-uploading every gigabyte**. By Seal-encrypting only the ~32-byte DEK, you re-seal
*tens of bytes* and leave the immutable Walrus blob untouched. It also bounds the IBE payload and keeps
the (rate-limited) key-server fetch cheap.

This is the same `StorageProvider`/`AccessPolicy` design described in
[`architecture.md` §5](./architecture.md) and the upload sequences in [`data-flows.md`](./data-flows.md).

---

## 10. Revocation limits

Seal gates the **key request**, not the bytes, and decryption is client-side with **no on-chain audit of
key delivery**. Consequences:

- Removing a fan from an allowlist, or letting a `Subscription` lapse, stops **future** key fetches only.
- Anyone who already pulled a derived key **within a live SessionKey TTL keeps it** and can re-decrypt
  already-fetched content until that TTL expires.
- You cannot "claw back" plaintext a fan already decrypted and saved locally.

Mitigations WalrusUrchin uses:

1. **Short SessionKey TTLs** (10–30 min) to bound the window.
2. **Per-content-version nonces / rotated DEKs** — lapsed fans cannot decrypt *new or rotated* content,
   even if they retain an old key.
3. **Path A hard revoke:** Harbor `unshare_bucket_access` removes the fan's decrypt capability for that
   bucket on lapse/refund (the strongest knob we have; see [`habour.md`](./habour.md)).
4. **App-side telemetry / audit logging** for sensitive content, optionally anchored to Walrus.

> Also: if the policy package is **upgradeable**, its owner can silently change access rules (transparent
> on-chain, but still a trust vector). For fan-protective guarantees, consider an immutable per-creator
> policy package or explicit on-chain versioning (the `subscription` pattern's shared `PackageVersion`).

---

## 11. Path A (Harbor-wrapped) vs Path B (self-managed)

Both store **ciphertext** and gate on-chain; both sit behind the same `StorageProvider`/`AccessPolicy`
interface. We ship **Path A first** (mandated), Path B is the north star.

| | **Path A — Harbor-wrapped Seal** (MVP) | **Path B — self-managed Seal** (north star) |
| --- | --- | --- |
| Who runs encrypt/decrypt envelope | Harbor abstracts it; bucket carries `seal_policy_id` | We call `@mysten/seal` directly |
| Policy package | Harbor `bucket_policy` (`ORIGINAL` for encrypt+SessionKey, `LATEST` for `seal_approve` PTB) | `walrus_urchin::access_policy` (our pkg id) |
| Key servers / threshold | Harbor's **3 pinned**, **2-of-3**, `verifyKeyServers:false` | Seal generic / committee from [arch §8](./architecture.md) |
| Access grant | `apps/api` verifies on-chain `Subscription`/`Entitlement`, then `POST /api/v1/seal/sponsor` `kind=grant_bucket_access` → `/seal/sponsor/{digest}/execute` (Enoki-sponsored bucket-policy PTB) | Fan's `seal_approve` reads `Subscription`/`Entitlement` directly; **no backend mediation** |
| Who decrypts | **The fan**, client-side, with their **own** SessionKey (no service key handed to fans) | The fan, client-side |
| Revocation | `unshare_bucket_access` on lapse/refund | Lapse + nonce rotation only (§10) |
| Custody | Backend holds `suiprivkey1` service key → **custodial-capable** (can decrypt). Disclose to users. | No custodial key in the trust path |
| Trade-off | Less to build; alpha/testnet; bucket visibility immutable; public buckets disabled in alpha | More to build (run/choose servers, thresholds, envelope) but trust-minimized |

**Path A grant call (in `apps/api`, never the SPA — it holds the `hbr_` + service key):**

```http
POST /api/v1/seal/sponsor
Authorization: Bearer hbr_…
Content-Type: application/json

{ "kind": "grant_bucket_access",
  "groupIds": ["<bucketGroupId>"],
  "recipientAddress": "<FAN_SUI_ADDRESS>",
  "scope": "read" }
# → returns { bytes, digest }. Fan signs `bytes` with their OWN zkLogin/wallet signer (NOT a Seal
#   SessionKey — the SessionKey is used later, at decrypt). Then
#   POST /api/v1/seal/sponsor/{digest}/execute { signature }  (Enoki broadcasts). scope = "read" | "readwrite".
# On lapse/refund: kind=unshare { groupId, member: fanAddr } (member-level revoke), or
#   kind=unshare_bucket_access { groupId, serviceSignerAddress } to drop a service signer from the bucket.
```

The grant pair (`grant_bucket_access` / `unshare_bucket_access`, plus `bucket_group_create`,
`share_admin`, `unshare`) is the most important addition over the old Harbor notes — it is how a fan
decrypts with their *own* key without ever receiving the service key. Full surface in
[`habour.md`](./habour.md).

> Package-ID discipline (Path A): **`encrypt` and `SessionKey.create` use `HARBOR_ORIGINAL_PACKAGE_ID`;
> the decrypt `seal_approve` PTB targets `HARBOR_LATEST_PACKAGE_ID`.** Mixing them breaks key fetch.

---

## Gotchas

- **`seal_approve*` runs as a stale-tolerant `dry_run`.** Side-effect-free, no randomness, no tx-ordering
  assumptions. Don't gate on just-created objects (expect `InvalidParameter`; retry after a few seconds).
- **Decrypt PTB is `onlyTransactionKind`, `seal_approve*`-only, single-package, no other commands.**
  Putting payment/transfer calls in the same PTB breaks key-server evaluation.
- **Key servers + threshold are frozen at encrypt time.** You cannot swap servers or change `t` for
  existing ciphertext → **envelope-encrypt the DEK** (§9) for all long-lived content. Non-negotiable.
- **Testnet key servers have NO availability/SLA/persistence guarantees.** Treat testnet content as
  disposable; anything a fan paid for (mainnet) must use committee/permissioned servers.
- **Open-mode servers share one master key across all packages** and have fixed source-based rate limits;
  all servers rate-limit `fetch_key`. **Batch with `fetchKeys` (≤10 ids/PTB)** and reuse
  `SealClient`/`SessionKey` caches, or a creator with many posts hits limits.
- **`encrypt` does not hide plaintext length.** Rare for media; for short DMs, pad before encrypting.
  AAD and nonce are part of the EncryptedObject and **not secret**.
- **The `key` returned by `encrypt` is the live DEM key.** Persisting it creates a second,
  policy-bypassing copy of the secret — **discard it** unless you have a real, secured DR requirement
  (Harbor's flow never exposes it).
- **`Ciphertext::Plain` exists in the BCS enum.** Assert content is actually `Aes256Gcm`/`Hmac256Ctr` and
  never accidentally stored as `Plain` when treating Seal output as opaque.
- **Harbor is External API v0.1.0 / testnet, pre-1.0** — `/seal/sponsor` request bodies are typed as
  generic objects in the public OpenAPI; **confirm exact field names against a live Harbor account before
  coding the relayer.** Bucket `visibility` is immutable (PUT with a new value → 403); public buckets are
  disabled in alpha → free/preview assets need private+grant or a separate raw-Walrus public path.
- **`@mysten/seal` 1.1.3 peers `@mysten/sui ^2.16.2`.** A stray older `@mysten/sui` v1 elsewhere in the
  monorepo will break types/runtime — pin and dedupe across pnpm workspaces. (Arch §8 pins `@mysten/sui`
  2.17.0, `@mysten/seal` 1.1.3.) **UNVERIFIED:** exact minor of the on-chain decrypt package on testnet.
- **memwal is NOT Seal.** `@mysten-incubation/memwal` (Ed25519 delegate key + TEE) is the agent-memory
  layer, not the content-encryption primitive — never substitute one for the other ([`memwal.md`](./memwal.md)).
- **Upgradeable policy package = trust vector.** The owner can change access rules silently (on-chain
  transparent). Consider immutable per-creator policy or explicit on-chain versioning.

---

## Sources

- https://github.com/MystenLabs/seal
- https://github.com/MystenLabs/seal/blob/main/docs/content/Design.mdx
- https://github.com/MystenLabs/seal/blob/main/docs/content/UsingSeal.mdx
- https://github.com/MystenLabs/seal/blob/main/docs/content/ExamplePatterns.mdx
- https://github.com/MystenLabs/seal/blob/main/docs/content/Pricing.mdx
- https://github.com/MystenLabs/seal/blob/main/docs/content/GettingStarted.mdx
- https://github.com/MystenLabs/seal/blob/main/docs/content/SecurityBestPractices.mdx
- https://github.com/MystenLabs/seal/blob/main/move/patterns/sources/subscription.move
- https://github.com/MystenLabs/seal/blob/main/move/patterns/sources/whitelist.move
- https://github.com/MystenLabs/seal/blob/main/move/patterns/sources/key_request.move
- https://github.com/MystenLabs/seal/blob/main/move/patterns/sources/private_data.move
- https://github.com/MystenLabs/seal/blob/main/move/patterns/sources/account_based.move
- https://github.com/MystenLabs/seal/blob/main/examples/move/sources/subscription.move
- https://github.com/MystenLabs/seal/blob/main/examples/frontend/src/EncryptAndUpload.tsx
- https://github.com/MystenLabs/seal/blob/main/examples/frontend/src/SubscriptionView.tsx
- https://github.com/MystenLabs/seal/blob/main/examples/frontend/src/utils.ts
- https://raw.githubusercontent.com/MystenLabs/ts-sdks/main/packages/seal/src/bcs.ts
- https://raw.githubusercontent.com/MystenLabs/ts-sdks/main/packages/seal/src/client.ts
- https://sdk.mystenlabs.com/seal
- https://www.npmjs.com/package/@mysten/seal
- https://www.npmjs.com/package/@mysten-incubation/memwal
- https://api.testnet.harbor.walrus.xyz/openapi.json
- https://blog.walrus.xyz/seal-brings-data-access-control-to-walrus/
- https://www.mystenlabs.com/blog/seal-mainnet-launch-privacy-access-control
