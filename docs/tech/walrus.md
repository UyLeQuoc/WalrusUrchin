# Walrus — decentralized blob storage for media & the SPA

Walrus is Mysten Labs' decentralized blob-storage network on the Sui stack: it stores large binary
objects ("blobs") with RedStuff erasure coding, anchors payment/proofs/lifecycle on Sui via the WAL
token, and serves bytes by a stable content-addressed Blob ID. In WalrusUrchin it is the canonical
store for **all** media — encrypted premium videos/images/audio/archives, unencrypted public previews,
agent-memory blobs (indirectly, via memwal) — and it also **hosts the SPA itself** as a Walrus Site.
Because **every Walrus blob is public**, Walrus is never our access-control layer: private content is
[Seal](./seal.md)-encrypted *before* upload and gated on-chain (see [`architecture.md` §3, §5](./architecture.md)).
For the MVP we never call Walrus directly for paid media — [Harbor](./habour.md) is the mandated managed
Walrus+Seal write path (Path A); raw `@mysten/walrus` + Upload Relay is the self-managed north star (Path B).

> **Status (June 2026):** Walrus is live on mainnet (since March 2025). WalrusUrchin builds on **Sui
> testnet** first. Testnet epochs are 1 day, faucet tokens have no value, and the public `wal.app` portal
> does **not** serve testnet site subdomains — flagged inline below.

---

## 1. What Walrus is, and where it sits in WalrusUrchin

| Concern | Walrus provides | WalrusUrchin uses it for |
| --- | --- | --- |
| Durable bytes | Content-addressed blobs, ~4.5–5x replication via RedStuff | All media: ciphertext for paid tiers/PPV, plaintext for previews/avatars |
| On-chain anchor | Blob registered + certified as a Sui object; emits events | `Content`/`Post` objects reference a Blob ID (never a mutable URL) |
| Read path | HTTP aggregators (CDN-friendly) + SDK `readBlob` | Fans fetch ciphertext, decrypt client-side; previews served directly |
| Write path | Publishers / Upload Relay / SDK | Path A via Harbor; Path B via Upload Relay + `@mysten/walrus` |
| Batching | Quilt (≤ ~660 small files per blob) | Supporter text/image posts, attachments, thumbnails, bundle manifests |
| Hosting | Walrus Sites (static frontends) | `apps/web` deployed as a Walrus Site under a SuiNS name |

The encryption boundary, the two access paths, and the trust model are all defined in
[`architecture.md`](./architecture.md); this doc is the Walrus-specific reference behind those decisions.
Per-network IDs/versions are pinned in [`architecture.md` §8](./architecture.md) — **reuse those exact
values**, do not invent new ones.

---

## 2. RedStuff erasure coding (~4.5–5x)

RedStuff is a 2D erasure-coding scheme: the blob is laid out as a matrix, **columns** are encoded into
*primary slivers* and **rows** into *secondary slivers*; each storage node holds one primary + one
secondary sliver pair.

- **Replication ~4.5–5x** of the original (vs ~25x+ for full-replication systems under a comparable
  Byzantine fault model). This is the number to bill against — **stored/billed bytes ≈ encoded size ≈ 5x
  original + per-blob metadata**, not the raw original size.
- Committee is `n = 3f+1` nodes tolerating `f` Byzantine, with **1000 shards** distributed by stake.
  **Writes** need a 2/3 quorum of acknowledgments; **reads** need only a 1/3 quorum of correct secondary
  slivers — reads are very resilient.
- **Localized self-healing**: a lost sliver is recovered with bandwidth proportional to the *sliver*
  (`O(|blob|/n)`), not the whole blob.

**WalrusUrchin implication:** the ~5x encoded size is the cost basis for the creator-facing storage
estimator (§7), and the read-resilience is why we serve media (public previews and decrypted-on-client
paid media) by Blob ID through an aggregator+CDN rather than hammering storage nodes.

---

## 3. Blob lifecycle: encode → register → upload → certify → read

```
1. ENCODE    client/publisher RedStuff-encodes the blob → derives the Blob ID (deterministic)
2. REGISTER  Sui tx reserves storage for N epochs (Object ID is created)         [needs SUI + WAL]
3. UPLOAD    encoded slivers pushed to storage nodes (directly, or via Upload Relay)
4. CERTIFY   node receipts aggregated into a certificate → Sui tx → Point of Availability (PoA)
             emits a Sui event with Blob ID + availability period
5. READ      fetch by Blob ID via aggregator HTTP or SDK readBlob  (no on-chain work)
```

Steps **2 (register)** and **4 (certify)** are Sui transactions — exactly the transactions we
**Enoki-sponsor** so creators/fans never hold SUI ([`auth.md`](./auth.md)). A blob is only **durably
guaranteed after certification (PoA)** — an uploaded-but-not-certified blob (e.g. a crashed
`writeFilesFlow` before `certify`) is **not** guaranteed durable. Treat content as stored only after
certify confirms.

**WalrusUrchin implication:** for Path B we drive this with `writeFilesFlow` (§6) so the React dashboard
shows real progress and each on-chain step is a discrete sponsored tx. For Path A, Harbor performs the
register/certify lifecycle behind its API and we only persist the resulting refs in the `Content` object.

---

## 4. Blob ID vs Object ID

Every blob has **two** identifiers — keep them straight:

| ID | What it is | Stability | WalrusUrchin usage |
| --- | --- | --- | --- |
| **Blob ID** | Content-addressed hash of the *encoded* data | Stable forever; identical bytes → identical ID | The thing you **read by**. Stored in `Content`/`Post` Move objects + Quilt patch attributes |
| **Object ID** | The on-chain Sui registration/ownership record | Per-registration | The thing you **own / extend / delete** (renewal, deletion txs) |

**Implications:**
- Reference assets in Sui objects by **Blob ID** (or `quilt-patch-id`), never by a mutable aggregator URL —
  caching is then trivial and immutable.
- Because the Blob ID is content-addressed, **the same plaintext always yields the same Blob ID**.
  Uploading paid content unencrypted not only leaks it permanently but is also deduplicated/fingerprintable
  across uploads — another reason Seal-encryption before upload is mandatory.
- Renewal/extension/deletion act on the **Object ID** (see §5, §7).

---

## 5. Lifetime: epochs, deletable vs permanent, max blob size

### Epochs

| Network | Epoch length | Max purchasable | Notes |
| --- | --- | --- | --- |
| **Testnet** (our build target) | **1 day** | **~53 epochs** (≈ 53 days, if the mainnet cap holds — verify live) | `epochs=3` ≈ 3 days — very different from mainnet |
| **Mainnet** | **14 days** | **53 epochs (~2 years)** | USD-pegged price locked for the term |

Storage is **prepaid for a fixed number of epochs** and is **not** "set and forget": if renewals lapse,
content goes dark. Extend before expiry with `walrus.extendBlob` (SDK) / `walrus extend` (CLI), acting on
the Object ID.

**WalrusUrchin implication:** model storage duration as a first-class product concept. The Hono
indexer/cron (the only place that can do it — Sui has **no native scheduler**, so renewals are
pull-based; see [`architecture.md` §4](./architecture.md)) runs a **renewal job tied to subscription
state**: extend blobs that back tiers/PPV with active paying subscribers, before their epoch expiry.
Surface "available until \<date\>" in the UI; an un-renewed blob behind a live `Subscription` is a dead
asset. On testnet, the 1-day epoch makes lapse fast — exercise renewal automation early.

### Deletable vs permanent

| | Deletable (`deletable: true`) | Permanent |
| --- | --- | --- |
| Can be deleted | Yes (Sui tx) — reclaims storage for remaining lifetime, refunds most of the SUI storage-fund deposit | **No** — stays available until epoch expiry |
| Use in WalrusUrchin | Drafts, takedown-able/UGC posts, frequently-replaced media | Assets backing **transferable** Subscription NFTs and sold one-off PPV (buyers retain guaranteed availability for the paid term) |

Caveats that drive product/legal design:
- **Deleting only stops *new* reads.** Anyone who already fetched the ciphertext keeps it — consistent
  with the Seal "gates the key, not the bytes" rule in [`architecture.md` §3](./architecture.md). For
  revocation, **rotate the Seal policy / `unshare_bucket_access`**, do not rely on deletion.
- **Permanent blobs cannot be taken down** (DMCA/abuse risk). Prefer **deletable-by-default** for
  user-generated content; reserve permanent for content that must stay composable for a buyer's paid term.

### Max blob size

- **Max blob = 13.3 GiB (14,273,391,930 bytes).** Storage accounting unit = **1.00 MiB**.
- Small blobs are dominated by fixed per-blob overhead (encoded ~5x + metadata) — the problem Quilt
  solves (§9).

---

## 6. WAL / FROST economics

- **WAL token:** max supply 5,000,000,000; **1 WAL = 1,000,000,000 FROST** (smallest unit). WAL pays for
  storage + write fees, is staked to storage nodes (delegated, performance-based rewards), and is used for
  governance.
- **USD-pegged at the protocol level:** real cost is stable; the WAL *amount* fluctuates with token price.
  Users **prepay and lock** the rate for the term (up to ~2 years on mainnet).
- **Cost formula** (for the creator-facing estimator):

  ```
  storage_cost ≈ price_per_encoded_unit_per_epoch(WAL) × encoded_size(MiB, ~5x original) × epochs
               + write_fee (per unit; includes a refundable deposit factor)
               + Sui gas + Sui object storage deposit
  ```

  `walrus info` shows current per-unit price + write fee; calculators at `costcalculator.wal.app` /
  `blobboard.wal.app`.

**WalrusUrchin implications:**
- A wallet needs **both** WAL (storage) and SUI (gas + Sui storage-fund deposit). **Enoki sponsorship
  covers SUI gas only — not the WAL storage payment and not the Upload-Relay tip.** Decide who funds WAL
  (platform treasury vs creator) and account for refundable portions so cost isn't double-counted.
- Bake the encoded-size cost into the **transparent revenue-share math** so creators see net payout after
  storage; surface a per-upload estimate in the creator dashboard using `walrus info` numbers.

---

## 7. Aggregators & publishers (HTTP), and the 10 MiB cap

Walrus exposes plain HTTP services so you can use it without the SDK:

| Service | Direction | Does on-chain work? | Notes |
| --- | --- | --- | --- |
| **Aggregator** | Read | No | GET blob by Blob ID; CDN/cache-friendly; the read path we put media behind |
| **Publisher** | Write | Yes (spends SUI + WAL) | PUT blob bytes; **public publishers cap uploads at ~10 MiB**; defaults to 8 concurrent sub-wallets (`--n-clients`) |

> **Hard limit:** public publishers cap uploads at **~10 MiB** and are shared/rate-limited — **not**
> suitable for WalrusUrchin's large video/media. Use **Harbor** (Path A), the **Upload Relay** + SDK
> (Path B, §8), your own publisher, or the CLI.

Run-your-own: `walrus aggregator` / `walrus publisher` / `walrus daemon` (installed via `suiup`).
**WalrusUrchin implication:** serve all read traffic (public previews and decrypted-on-client paid media)
by Blob ID through an aggregator behind a CDN; Harbor likely provides this for Path A. Never write large
media through a public publisher.

---

## 8. Upload Relay (browser uploads + tip)

Writing directly to storage nodes is **~2,200 requests** — a non-starter from the browser. The Upload
Relay collapses the upload into a **single HTTP POST**:

```
1. client (browser) RedStuff-encodes + REGISTERs on Sui locally        [register = sponsored Sui tx]
2. POST blob → relay  /v1/blob-upload-relay                            [+ pay a tip]
3. relay distributes slivers, returns a certificate
4. client CERTIFIES on Sui                                             [certify = sponsored Sui tx]
```

- The relay charges a **tip** — `const` or `linear { base, perEncodedKib }` — discoverable at
  `GET /v1/tip-config`.
- SDK config: `walrus({ uploadRelay: { host, sendTip: { max } } })`.
- Testnet endpoint: `https://upload-relay.testnet.walrus.space` (pinned in
  [`architecture.md` §8](./architecture.md)); mainnet `https://upload-relay.mainnet.walrus.space`.

> The relay is **not gasless by itself** — the client still does the on-chain register + certify and pays
> the tip. Pair with **Enoki sponsorship** for the gas, and decide who pays the WAL + tip.

**WalrusUrchin implication:** Path B browser uploads from the Vite/React creator dashboard go through the
Upload Relay. The tip is a per-upload cost the creator or platform funds. Path A avoids this entirely
(Harbor is the managed write path).

---

## 9. Quilt — batching small posts / thumbnails

Quilt batches **many small files into one Walrus blob** (up to **~660 files per batch**) while keeping
each file individually addressable by a **`quilt-patch-id`**. It can cut storage cost for ~10 KB blobs by
**up to ~420x** (avoiding the per-blob fixed-overhead tax that makes <1 MB blobs uneconomical).

> **Gotcha:** `quilt-id` and `quilt-patch-id` are **not guaranteed permanent** (they can change). The
> stable **Blob ID is stored as a patch attribute**, so persist/resolve by Blob ID, not by patch-id alone.

**WalrusUrchin implication:** use Quilt for the many-small-files cases — supporter-only text/image posts,
message attachments, thumbnails, NFT/event metadata, bundle manifests. Reserve standalone blobs for large
media (long videos, big archives). This pairs with **envelope encryption** (§11): each small file's
ciphertext can be a Quilt patch while its DEK is Seal-encrypted separately.

---

## 10. `@mysten/walrus` 1.1.7 + `walrus-wasm` (Path B SDK)

Pinned versions ([`architecture.md` §8](./architecture.md)): `@mysten/walrus` **1.1.7** (peer
`@mysten/sui` `^2.16.2`; ours is 2.17.0) · `@mysten/walrus-wasm` **0.2.2** (WASM required for
encode/decode).

### Recommended client construction (1.x)

```ts
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { walrus } from '@mysten/walrus';
// Vite bundles the WASM via a ?url import (see below)
import wasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
}).$extend(walrus({ wasmUrl }));
// testnet system/staking IDs ship built-in; custom via walrus({ packageConfig: { systemObjectId, stakingPoolId } })
```

> **Transport drift:** older tutorials use `new SuiClient({...}).$extend(WalrusClient.experimental_asClientExtension({...}))`
> (note the `experimental_` prefix) — equivalent, but the docs now recommend gRPC. Pin versions and verify
> method names against the **installed** package, not blog posts. There is also a `0.0.0-experimental-*`
> dist-tag — **do not install it by accident.**

### Key methods

`writeBlob({ blob, epochs, deletable, signer, onStep, resume })` · `readBlob({ blobId })` ·
`writeFiles({ files, epochs, deletable, signer })` / `getFiles({ ids })` (WalrusFile + Quilt) ·
`getBlob({ blobId })` → `blob.files({ identifiers | tags })` · `extendBlob` · `deleteBlob` ·
`readBlobAttributes`. Errors: `RetryableWalrusClientError` → call `client.walrus.reset()` and retry.

### `writeFilesFlow` — progress + resume

Split the lifecycle into discrete steps so the UI can show progress and each Sui step is a separate
sponsored transaction:

```ts
const flow = client.walrus.writeFilesFlow({ files });
await flow.encode();                                  // RedStuff encode → Blob ID (local)
const reg  = flow.register({ epochs, owner, deletable }); // returns a Sui tx → sponsor + sign
//   ... submit reg (Enoki-sponsored), capture digest ...
await flow.upload({ digest });                        // push slivers (or via Upload Relay)
const cert = flow.certify();                          // returns a Sui tx → sponsor + sign → PoA
const files = await flow.listFiles();                 // resolved Blob/quilt-patch IDs → store in Content object
// or: for await (const step of flow.run({ signer, epochs })) { /* drive UI */ }
```

**WalrusUrchin implication:** adopt `writeFilesFlow` for Path B so register/certify are distinct
Enoki-sponsored zkLogin txs and the React dashboard shows real upload progress. **Persist the intermediate
flow state** (Hono backend or IndexedDB) so a failed/abandoned upload **resumes** instead of re-encoding /
re-paying. Always confirm `certify` before writing the Blob ID into the on-chain `Content` object.

### WASM bundling (Vite + Hono)

- **Vite (`apps/web`):** import the WASM as a URL (`@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url`) and
  pass `walrus({ wasmUrl })`. A CDN fallback exists
  (`https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm`) but `@latest` can silently drift
  versions — pin it.
- **Hono (`apps/api`):** mark `@mysten/walrus` and `@mysten/walrus-wasm` as **external** in the server
  bundle, or bundling breaks. (Most of our Walrus work is Path A via Harbor, but keep this rule for any
  server-side Walrus use.)

---

## 11. Mapping to WalrusUrchin (the canonical decisions)

These restate [`architecture.md` §3, §5](./architecture.md) for the storage layer:

- **All blobs are public → Seal-encrypt first.** Premium/tiered/PPV content is encrypted client-side with
  [Seal](./seal.md) **before** upload; only ciphertext lands on Walrus. Decryption keys are gated on-chain
  (Subscription NFT held / tier level / `Entitlement` / time window). Uploading plaintext paid content is a
  **permanent, irreversible leak** — treat it as a security incident class.
- **Public previews stay unencrypted.** Avatars, banners, trailers, free posts go to Walrus unencrypted to
  skip Seal overhead. (Note: Harbor public buckets are **disabled in alpha** — public/preview assets use a
  separate raw-Walrus public path, or private + grant; see [`habour.md`](./habour.md) and
  [`architecture.md` §9](./architecture.md).)
- **Reference by Blob ID, resolve at read time.** Store the stable Blob ID / `quilt-patch-id` in the
  `Content`/`Post` Move object; resolve to bytes via aggregator HTTP or `readBlob`. Never store a mutable
  aggregator URL.
- **Renewal jobs tied to subscriptions.** The Hono cron extends blobs (`extendBlob`) before epoch expiry
  while a tier/PPV has paying subscribers — pull-based, since Sui has no scheduler.
- **Envelope encryption for large media.** Seal's key-server set + threshold are **frozen into the
  ciphertext at encrypt time**. So for long-lived media: per-file **AES-256-GCM DEK** encrypts the blob;
  **Seal encrypts only the small DEK** against the tier/PPV policy. This bounds the Seal payload to tens of
  bytes and lets us **rotate key-server committees / migrate policies for years without re-uploading
  blobs**. Transferred Subscription NFTs work automatically: the Seal policy reads the *current* on-chain
  owner at decrypt time, so decryption rights move with the NFT — no re-encrypt.
- **Two paths, both store ciphertext, both gate on-chain** ([`architecture.md` §5](./architecture.md)):
  - **Path A (MVP, mandated) — Harbor managed write path.** `apps/api` holds the service key for bucket
    lifecycle and issues `grant_bucket_access` per paying fan address; the fan decrypts client-side with
    their **own** SessionKey. Harbor only ever serves ciphertext. Details in [`habour.md`](./habour.md).
  - **Path B (north star) — self-managed Seal.** `walrus_urchin::access_policy::seal_approve` reads the
    fan's on-chain `Subscription`/`Entitlement` directly; ciphertext on Walrus via Harbor file upload or
    the Upload Relay; no backend mediation. Both sit behind the `StorageProvider`/`AccessPolicy` interface.
- **Host the SPA as a Walrus Site** (§12).

---

## 12. Walrus Sites — hosting the WalrusUrchin SPA

Walrus Sites host **fully static** frontends: assets are stored as Walrus blobs/quilts, an on-chain Sui
**Site** object indexes `resource path → blob/quilt-patch ID`, and a **Portal** serves it (public mainnet
portal = `https://wal.app`). Human-readable URLs come from SuiNS (`name.sui` → site object, served at
`name.wal.app`; see [`suins.md`](./suins.md)).

Deploy/update with the Rust **`site-builder`** CLI (install via `suiup`):

```bash
suiup install site-builder@mainnet
site-builder --context=testnet deploy --epochs 53 ./apps/web/dist   # testnet: 1 epoch ≈ 1 day → 53 ≈ 53 days
site-builder --context=testnet deploy --object-id 0x... --epochs 53 ./apps/web/dist  # update existing
site-builder sitemap --id 0x...
```

### `ws-resources.json` — routes, headers, metadata

Controls HTTP headers, **SPA routes** (deep-link fallback to `index.html`; **wildcards only at the end** of
a path), redirects (max 3 on `wal.app`), site metadata, and an ignore list. For our React Router SPA:

```jsonc
{
  "routes": { "/*": "/index.html" },                 // deep links resolve to the SPA shell
  "headers": { "/assets/*": { "Cache-Control": "public, max-age=31536000, immutable" } },
  "metadata": { "name": "WalrusUrchin", "description": "Decentralized creator platform" }
}
```

### Hard constraints (these force architecture)

- **No SSR, no backend on the site, no secrets, no service workers / PWA.** This is *why* the SPA is
  world-readable and **the Enoki secret, Harbor `hbr_`/`suiprivkey1`, and memwal delegate key live only in
  `apps/api`** ([`architecture.md` §3](./architecture.md)) — `apps/api` is deployed **separately**
  (conventional host) and called **cross-origin via CORS** from the Walrus Site
  ([`monorepo.md`](./monorepo.md)).
- **The frontend only ever holds the Enoki PUBLIC key.**
- **Testnet caveat:** the public `wal.app` portal does **not** serve base36 testnet site subdomains — use a
  local/community portal for testnet site previews. **There is no public testnet portal.**
- The `wal.app` portal limits redirects (max 3) and is known not to load in some iOS wallet in-app
  browsers — if the app hard-depends on those, split (static profile on a Walrus Site, dynamic app
  elsewhere) rather than full Walrus-Sites hosting.

**WalrusUrchin implication:** build `apps/web` to static `dist/`, publish with `site-builder`, and map a
SuiNS name (e.g. `walrusurchin.sui` → `walrusurchin.wal.app`). Optionally give each creator a public
landing under `creatorname.wal.app` while the dynamic app runs from the main site. This is viable **only**
because the SPA is static and talks to Sui/Walrus/Harbor from the browser — confirm no SSR/secret/SW
dependency before committing.

---

## Gotchas

- **All Walrus blobs are public.** There is no native private storage. Forgetting to Seal-encrypt before
  upload leaks premium content **irrevocably** — and since the Blob ID is content-addressed, identical
  plaintext yields the same ID (fingerprintable/dedup'd). Security incident class.
- **Permanent blobs cannot be deleted or taken down** (DMCA/abuse risk), and even deletable blobs only stop
  **new** reads after deletion — already-fetched ciphertext is kept. Prefer deletable-by-default for UGC;
  revoke via Seal policy rotation / `unshare_bucket_access`, not deletion.
- **Storage is not permanent-by-default.** Blobs expire after their paid epochs (testnet 1 day! / mainnet
  14 days, max ~53). Un-renewed blobs behind a live subscription go dark — renewal automation is required.
- **PoA matters:** a blob is durable only **after certification**. A crashed `writeFilesFlow` before
  `certify` is not guaranteed stored. Always confirm certify before persisting the Blob ID on-chain.
- **Public publishers cap at ~10 MiB** and are rate-limited — unusable for large media. Use Harbor / Upload
  Relay / own publisher / CLI.
- **Upload Relay is not gasless** — client still does register + certify and pays a tip; Enoki covers SUI
  gas only, not WAL or the tip.
- **Small blobs are economically punished** by fixed per-blob overhead — use Quilt; but `quilt-patch-id`
  can change, so persist/resolve by the stable Blob ID.
- **WASM bundling:** Vite needs the `?url` import + `walrus({ wasmUrl })`; Hono/server must mark
  `@mysten/walrus` + `@mysten/walrus-wasm` **external**. `@latest` CDN WASM drifts — pin it.
- **SDK transport/version drift:** gRPC `walrus()` extension is now recommended over the older
  `experimental_asClientExtension`; pin `@mysten/walrus` 1.1.7 / `walrus-wasm` 0.2.2 / `@mysten/sui` ^2.16.2
  and avoid the `0.0.0-experimental-*` dist-tag.
- **Testnet ≠ mainnet:** epoch length (1d vs 14d) changes what `epochs=N` means; testnet tokens are
  worthless faucet tokens; IDs differ; **no public testnet site portal**.
- **WAL + SUI both required:** USD-pegged price still means the wallet needs WAL (storage) *and* SUI (gas +
  Sui storage deposit). Don't double-count refundable portions (write deposit, Sui storage fund).
- **`~4.5–5x` is encoding overhead**, not raw redundancy — bill against encoded size (~5x + metadata).
- **Harbor specifics are alpha/testnet and were not independently verifiable in public Walrus/Mysten docs
  during research** — confirm its auth model, API surface, file-size limits, Seal integration, and pricing
  against Mysten's Harbor docs before building. Use the **pinned** Harbor IDs/key servers in
  [`architecture.md` §8](./architecture.md) and the surface in [`habour.md`](./habour.md); do not hardcode
  assumed endpoints.

## Sources

- https://docs.wal.app/
- https://docs.wal.app/docs/system-overview/core-concepts
- https://docs.wal.app/docs/system-overview/storage-costs
- https://docs.wal.app/docs/dev-guide/components
- https://docs.wal.app/docs/dev-guide/dev-operations
- https://docs.wal.app/docs/getting-started
- https://docs.wal.app/operator-guide/upload-relay.html
- https://docs.wal.app/docs/operator-guide/aggregator
- https://docs.sui.io/sui-stack/walrus/sui-stack-walrus
- https://docs.sui.io/sui-stack/walrus/sui-stack-walrus-sites
- https://sdk.mystenlabs.com/walrus
- https://sdk.mystenlabs.com/typedoc/classes/_mysten_walrus.WalrusClient.html
- https://www.npmjs.com/package/@mysten/walrus
- https://github.com/MystenLabs/ts-sdks/tree/main/packages/walrus/examples
- https://github.com/MystenLabs/walrus-sites
- https://github.com/MystenLabs/awesome-walrus
- https://blog.walrus.xyz/how-walrus-red-stuff-encoding-works/
- https://www.walrus.xyz/blog/introducing-quilt
- https://www.walrus.xyz/blog/public-mainnet-launch
- https://blog.sui.io/celebrating-walrus-one-year-anniversary/
- https://arxiv.org/abs/2505.05370
- https://walrus.xyz/wal-token/
- https://seal-docs.wal.app/
- https://www.triton.one/products/walrus
- https://costcalculator.wal.app/

---

*Next: [`seal.md`](./seal.md) for the encryption boundary, [`habour.md`](./habour.md) for the managed
Path A write surface, [`data-flows.md`](./data-flows.md) for end-to-end upload/unlock sequences, or back to
[`architecture.md`](./architecture.md).*
