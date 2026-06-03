# Harbor — managed Walrus + Seal storage (mandated file store)

> Status: **alpha / testnet only** (June 2026). Harbor's spec literally warns *"Endpoint shapes
> may change before mainnet GA"* and *"Do not put production data behind this."* WalrusUrchin
> treats it as the **mandated Path A** storage provider, abstracted behind a `StorageProvider`
> interface so it can be swapped for raw Walrus+Seal (Path B) or Harbor-GA later.

Harbor (`api.testnet.harbor.walrus.xyz`) is Mysten Labs' managed **Walrus + Seal** storage
service: a single Bearer-authenticated REST surface that hides Walrus publishers, Seal key-server
selection, the `bucket_policy` Move package, and Enoki gas sponsorship behind a Spaces → buckets →
files model. Files are stored as **Seal ciphertext** on Walrus (Harbor calls its internal blob
layer *"Oyster"*) — Harbor never sees plaintext or the DEK. For WalrusUrchin this is the MVP media
store (creator uploads, per-fan decrypt grants); how it fits the two content-access paths is in
[`architecture.md`](./architecture.md) §5, and the end-to-end sequences are in
[`data-flows.md`](./data-flows.md). Self-managed Seal is [`seal.md`](./seal.md); the underlying blob
layer is [`walrus.md`](./walrus.md); agent memory (a *separate* stack, not media) is
[`memwal.md`](./memwal.md).

---

## 1. What Harbor is (and is not)

| | Harbor (Path A) | Raw Walrus + Seal (Path B) |
| --- | --- | --- |
| What you call | One Bearer REST API (`hbr_…`) | `@mysten/walrus` + `@mysten/seal` directly |
| Walrus publishers | Managed by Harbor | You run/choose them |
| Seal key servers | **Pinned** (3, see §6) | Your choice (committee/threshold) |
| `seal_approve` policy | Harbor's `bucket_policy` package | **Our** `walrus_urchin::access_policy` |
| Gas | Enoki-sponsored by Harbor | You sponsor (our Enoki key) |
| Trust | Harbor holds ACL mirror + sees ciphertext | No backend mediation |
| Maturity | Alpha, testnet, vendor-dependent | More to build, fully decentralized |

Harbor is **not** the agent-memory store. memwal is a different account/delegate-key + Seal-on-Walrus
stack ([`memwal.md`](./memwal.md)); never route agent memory through Harbor or vice versa.

**Canonical docs.** The reliable sources are the **live OpenAPI** (`GET /openapi.yaml`, OpenAPI 3.1,
~39.5 KB) and the **GitHub quickstart** (`MystenLabs/walrus-harbor-quickstart`, `QUICKSTART.md` +
`openapi.yaml` + Postman pair). ⚠️ The hosted `/docs/quickstart` and `/docs/quickstart.md` links
returned **HTTP 404** at fetch time (June 2026) — do not point readers at them; pin the GitHub repo
and `/openapi.yaml` instead. The interactive viewer at `/docs/openapi` (Scalar) does work.

---

## 2. Authentication

```
Authorization: Bearer hbr_…
```

Web sign-in to `testnet.harbor.walrus.xyz` is **zkLogin (Google)** or a Sui wallet; a **Personal
Space** is auto-provisioned on sign-up. API access is HTTP Bearer with `hbr_` keys (OpenAPI scheme
`bearerAuth`).

### 2.1 Two key scopes

| Scope | Allowed | On write attempt |
| --- | --- | --- |
| `read_write` | create/delete buckets, upload/rename/delete files, finalize | — |
| `read_only` | list spaces/buckets/files, status, download | `403` code `read_only_api_key` |

Pick `read_only` for downstream read-side consumers. In WalrusUrchin, **both** scopes live only in
`apps/api`; neither `hbr_` nor the service key may reach the world-readable SPA (see
[`architecture.md`](./architecture.md) §3).

### 2.2 The `suiprivkey1` service key

Creating a **`read_write`** key reveals **two secrets at once**, each shown once and unrecoverable:

1. **`hbr_…`** — the Harbor API key (Bearer header).
2. **`suiprivkey1…`** — an **Ed25519** service private key in Sui keytool / Bech32 format. Harbor
   stores only the derived public address. It **needs no SUI balance** — gas is **Enoki-sponsored**
   by Harbor.

The service key has two jobs: **sign the `finalize` transaction** (bucket policy creation), and
**authenticate decrypt `SessionKey`s** with Seal. This is a genuine privacy footgun (§9).

### 2.3 Enoki-sponsored gas

Every bucket-policy / grant transaction Harbor builds (`reserve`, `grant_bucket_access`, etc.) comes
back as a **base64 Enoki-sponsored Sui tx** with the gas-sponsor signature already attached — your
service key only adds its own signature. WalrusUrchin does **not** call Enoki directly for Harbor
flows (it does for its own zkLogin/sponsored-gas needs, see [`auth.md`](./auth.md)).

---

## 3. Spaces, Personal Space, Team Spaces

`GET /api/v1/spaces` returns `SpaceListItem[]`:

| Field | Values / meaning |
| --- | --- |
| `type` | `personal` \| `team` |
| `role` | `owner` \| `admin` \| `editor` \| `viewer` |
| `storage_used` / `storage_cap` | per-space quota |
| `bucket_count` | buckets in the space |
| `member_count` | (team spaces) shared multi-user ownership |

- **Personal Space** — auto-provisioned on sign-up; the default single-creator case.
- **Team Spaces** (`type:'team'`) enable multi-operator ownership with the role matrix above —
  useful for WalrusUrchin "creator + manager" or label/agency accounts.

⚠️ **Quotas (alpha).** Free tier returns `422 PLAN_LIMIT_EXCEEDED` with
`{ code:'PLAN_LIMIT_EXCEEDED', limit:'storage'|'users'|'buckets', currentTier:'free' }`. Surface
`storage_used`/`storage_cap` per creator, and **do not design mainnet economics on alpha caps.**

---

## 4. The full REST surface — 16 paths

> ⚠️ The prose quickstart claims *"11 endpoints"*; the **live `/openapi.yaml` has 16 paths**. The
> extra five — most importantly the **`/seal/sponsor` grant pair** — are exactly what WalrusUrchin
> needs and were **omitted from the old `habour.md`**. All paths require `Authorization: Bearer hbr_…`.

| # | Method | Path | Purpose |
| --- | --- | --- | --- |
| 1 | `GET` | `/api/v1/spaces` | List spaces |
| 2 | `POST` | `/api/v1/spaces/{id}/buckets` | **Reserve** a bucket (step 1 of handshake) |
| 3 | `GET` | `/api/v1/spaces/{id}/buckets` | List buckets in a space |
| 4 | `GET` | `/api/v1/spaces/{id}/files` | List files across the space |
| 5 | `GET` | `/api/v1/buckets/{id}` | Get one bucket |
| 6 | `PUT` | `/api/v1/buckets/{id}` | Update bucket (**visibility is immutable** → 403) |
| 7 | `DELETE` | `/api/v1/buckets/{id}?confirm=true` | Delete bucket (must be **empty**) |
| 8 | `POST` | `/api/v1/buckets/{id}/finalize` | **Finalize** (step 3 of handshake) |
| 9 | `GET` | `/api/v1/buckets/{id}/files` | List files in a bucket |
| 10 | `POST` | `/api/v1/buckets/{id}/files` | **Upload** (multipart, async) |
| 11 | `GET` | `/api/v1/buckets/{id}/files/{fileId}` | Get one file |
| 12 | `DELETE` | `/api/v1/buckets/{id}/files/{fileId}` | Soft-delete file (async Oyster removal) |
| 13 | `GET` | `/api/v1/buckets/{id}/files/{fileId}/status` | Poll upload status |
| 14 | `GET` | `/api/v1/buckets/{id}/files/{fileId}/download` | Download **ciphertext** |
| 15 | `POST` | `/api/v1/seal/sponsor` | **Build+sponsor a grant PTB** (the gap — §8) |
| 16 | `POST` | `/api/v1/seal/sponsor/{digest}/execute` | Broadcast the signed grant PTB |

---

## 5. The reserve → sign → finalize bucket handshake

Bucket creation is a **two-step handshake** with a local signature in the middle. In alpha, all
buckets are `scope:'private'` — **public bucket creation is disabled at the API boundary** and
visibility is **immutable** after creation.

```
service-key setup → reserve → sign → finalize → (bucket active)
```

### 5.1 Reserve

```http
POST /api/v1/spaces/{spaceId}/buckets
Content-Type: application/json

{ "name": "creatorId-tierId", "scope": "private" }
```

`201` →

```json
{
  "bucket_id": "…",
  "bytes": "<base64 Enoki-sponsored Sui tx>",
  "digest": "…",
  "state": "pending_policy"
}
```

`bytes` is the Enoki-sponsored tx that creates the bucket's Seal access policy, with the **service
key's address as sender** — Harbor cannot sign it (that is the point of client-side encryption) but
has attached the gas-sponsor signature. The bucket stays `pending_policy` (no uploads accepted) until
finalize. Name is 1–100 chars, **unique per space** (a `409` means it is taken — possibly by a stale
`pending_policy` bucket).

### 5.2 Sign `bytes` with the service key

```ts
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';

const { secretKey } = decodeSuiPrivateKey(process.env.HARBOR_SERVICE_PRIVKEY!);
const keypair = Ed25519Keypair.fromSecretKey(secretKey);
const { signature } = await keypair.signTransaction(fromBase64(bytes));
```

`@mysten/sui` handles the Bech32 decode and the Sui signature envelope (`0x00 || sig || pubKey`).

### 5.3 Finalize

```http
POST /api/v1/buckets/{bucketId}/finalize
Content-Type: application/json

{ "signature": "<base64 signature from 5.2>" }
```

`200` →

```json
{ "bucket_id": "…", "seal_policy_id": "…", "state": "active" }
```

`seal_policy_id` is the **on-chain bucket-group object id** used by Seal for access checks — store it
in the WalrusUrchin `Content` object alongside `{ bucket_id, file_id }`.

> ⚠️ **Sponsor signatures expire fast.** Treat reserve → sign → finalize as one tight synchronous
> sequence in the backend. The quickstart prose says a stalled finalize returns
> `{"code":"digest_expired"}` — but **`digest_expired` is prose-only and is NOT in the OpenAPI error
> enum** (§10). Do not branch code on it; the machine code around finalize/scope is
> `bucket_not_finalized` (and `bucket_not_in_scope`). On expiry, re-run reserve for fresh `bytes`.

---

## 6. Pinned Seal config (encrypt + decrypt)

Harbor pins its **own** package ids and key servers. These differ from the generic
`getAllowlistedKeyServers('testnet')` set — **using the generic set will make decrypt fail.** Values
are reused from [`architecture.md`](./architecture.md) §8; do not invent new ones.

| Thing | Testnet value |
| --- | --- |
| `HARBOR_ORIGINAL_PACKAGE_ID` (encrypt + `SessionKey.create`) | `0x8b2429358e9b0f005b69fe8ad3cbd1268ad87f35047a21612e082c64824faf8d` |
| `HARBOR_LATEST_PACKAGE_ID` (`bucket_policy::seal_approve`) | `0xc11d875481544e9b6c616f7d6704266e1633b4034eab7ed76626dc25ebfcd506` |
| Key server 1 | `0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2` |
| Key server 2 | `0x164ac3d2b3b8694b8181c13f671950004765c23f270321a45fdd04d40cccf0f2` |
| Key server 3 | `0x9c949e53c36ab7a9c484ed9e8b43267a77d4b8d70e79aa6b39042e3d4c434105` |
| Threshold | **2-of-3**, `verifyKeyServers: false` |

> ⚠️ **Package-id discipline.** `encrypt` and `SessionKey.create` MUST use the **ORIGINAL** id (Seal
> pins DEK derivation to the canonical/original published id, so an upgrade can't invalidate existing
> blobs). The `seal_approve` PTB MUST target the **LATEST** id. Swapping them silently breaks DEK
> derivation after any package upgrade.

### 6.1 Encrypt (uses ORIGINAL package id)

```ts
import { SealClient } from '@mysten/seal';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { bcs } from '@mysten/sui/bcs';

const HARBOR_ORIGINAL_PACKAGE_ID =
  '0x8b2429358e9b0f005b69fe8ad3cbd1268ad87f35047a21612e082c64824faf8d';
const SEAL_KEY_SERVER_OBJECT_IDS = [
  '0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2',
  '0x164ac3d2b3b8694b8181c13f671950004765c23f270321a45fdd04d40cccf0f2',
  '0x9c949e53c36ab7a9c484ed9e8b43267a77d4b8d70e79aa6b39042e3d4c434105',
];

const sui = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});
const seal = new SealClient({
  suiClient: sui,
  serverConfigs: SEAL_KEY_SERVER_OBJECT_IDS.map((objectId) => ({ objectId, weight: 1 })),
  verifyKeyServers: false,
});

// Per-file Seal id = bcs(struct{ policyObjectId, nonce: 32 random bytes }).hex().
// This bcs layout matches Harbor's on-chain seal_approve check exactly.
const SealIdentity = bcs.struct('SealIdentity', {
  policyObjectId: bcs.Address,
  nonce: bcs.fixedArray(32, bcs.u8()),
});
const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)));
const id = SealIdentity.serialize({ policyObjectId: sealPolicyId, nonce }).toHex();

const { encryptedObject } = await seal.encrypt({
  threshold: 2,
  packageId: HARBOR_ORIGINAL_PACKAGE_ID,
  id,
  data: plaintextBytes, // Uint8Array — upload this next
});
```

> For large media, **envelope-encrypt**: AES-256-GCM the file with a per-file DEK, store that on
> Walrus, and Seal-encrypt only the small DEK here (key servers + threshold freeze at encrypt time).
> See [`architecture.md`](./architecture.md) §5.

### 6.2 Decrypt (`seal_approve` PTB targets LATEST package id)

```ts
import { EncryptedObject, SessionKey } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';

const HARBOR_LATEST_PACKAGE_ID =
  '0xc11d875481544e9b6c616f7d6704266e1633b4034eab7ed76626dc25ebfcd506';

// ciphertext = bytes from GET …/download
const parsed = EncryptedObject.parse(ciphertext);
const idBytes = fromHex(parsed.id.startsWith('0x') ? parsed.id : '0x' + parsed.id);

// 1. Access-check PTB — TransactionKind only, NEVER broadcast.
const tx = new Transaction();
tx.moveCall({
  target: `${HARBOR_LATEST_PACKAGE_ID}::bucket_policy::seal_approve`,
  arguments: [tx.pure.vector('u8', idBytes), tx.object(sealPolicyId)],
});
const txBytes = await tx.build({ client: sui, onlyTransactionKind: true });

// 2. SessionKey lets the key servers verify the caller without re-signing per request.
//    NOTE: packageId here is the ORIGINAL id; the SIGNER is whoever holds decrypt rights —
//    in WalrusUrchin Path A that is the FAN's own zkLogin signer, NOT the service key.
const sessionKey = await SessionKey.create({
  address: signer.toSuiAddress(),
  packageId: HARBOR_ORIGINAL_PACKAGE_ID,
  ttlMin: 10,
  suiClient: sui,
  signer, // fan's signer (Path A) — see §9 custody
});

// 3. Decrypt — SealClient fetches threshold (2-of-3) key shares, reconstructs the DEK locally.
const plaintext = await seal.decrypt({ data: ciphertext, sessionKey, txBytes });
```

The quickstart signs the `SessionKey` with the **service key**, which is fine for the creator's own
read-back but is **not** how fans decrypt in WalrusUrchin — fans use their **own** signer after being
granted via §8. Decryption is fully client-side; Harbor's surface stops at the ciphertext byte stream.

---

## 7. Async multipart upload, status poll, download

### 7.1 Upload (async, multipart)

```http
POST /api/v1/buckets/{bucketId}/files
Content-Type: multipart/form-data
```

| Field | Required | Notes |
| --- | --- | --- |
| `file` | yes | binary (the `encryptedObject`) |
| `name` | no | max 255 |
| `metadata` | no | JSON string, **max 8 KB** |

`202` → `{ "data": { "id": "…", … } }` (a `FileSummary`).

> ⚠️ **First uploads after finalize 403 with `mirror_missing_grant`.** The on-chain `BucketAdmin`
> grant takes a few seconds to land in Harbor's ACL indexer. **Retry every ~3 s, ≤20 attempts.**
> Surface this as a "provisioning" state in the creator UI, not a hard failure.

Stash WalrusUrchin display metadata in `metadata` (≤8 KB), e.g.
`{ tierId, postId, contentType, previewBlobId }`, so the feed can render listings from
`listBucketFiles` / `listSpaceFiles` **without decrypting**.

### 7.2 Status poll

```http
GET /api/v1/buckets/{bucketId}/files/{fileId}/status
```

→ `{ "data": { "state", "progress"?: 0..1, "error"?: { code, message, http_status } } }`

State enum: **`queued` | `active` | `completed` | `failed`** — poll to `completed` (typically <30 s
on testnet). Backed by BullMQ internally; returns `404` after job expiry.

### 7.3 Download (ciphertext only)

```http
GET /api/v1/buckets/{bucketId}/files/{fileId}/download
```

Streams `application/octet-stream` **raw Seal ciphertext** with `Content-Disposition: attachment` and
`Cache-Control: private, no-store`. Decryption is **entirely client-side** (§6.2) — Harbor never sees
plaintext or the DEK. Access is enforced by the **Seal key servers via the on-chain `bucket_policy`**,
not by Harbor's REST ACL.

---

## 8. The grant endpoints — `/seal/sponsor` (the critical gap)

**This is the single most important addition over the old `habour.md`**, which omitted it entirely.
It is how additional addresses (i.e. **paying fans**) get decrypt access to an existing bucket.

```http
POST /api/v1/seal/sponsor
Content-Type: application/json
```

The body picks a `kind`; Harbor builds + Enoki-sponsors the corresponding `bucket_policy` PTB:

| `kind` | Payload | Effect |
| --- | --- | --- |
| `grant_bucket_access` | `{ groupIds[], recipientAddress, scope:'read'\|'readwrite' }` | Grant an address decrypt access |
| `unshare_bucket_access` | `{ groupId, serviceSignerAddress }` | Revoke an address's decrypt access |
| `bucket_group_create` | `{ bucketId }` | Create a Seal group for a bucket |
| `share_admin` | `{ groupId, member }` | Add a group admin |
| `unshare` | `{ groupId, member }` | Remove a group admin |

Response → `{ bytes, digest }`. Sign `bytes` with the service key (as in §5.2), then:

```http
POST /api/v1/seal/sponsor/{digest}/execute
Content-Type: application/json

{ "signature": "<base64>" }
```

→ `{ "digest": "…" }`.

```ts
// apps/api — grant a paying fan decrypt access to a tier's bucket group.
async function grantFan(api: HarborClient, groupId: string, fanAddr: string) {
  const { bytes, digest } = await api.post('/api/v1/seal/sponsor', {
    kind: 'grant_bucket_access',
    groupIds: [groupId],          // the tier's Seal bucket group (seal_policy_id-derived)
    recipientAddress: fanAddr,    // the FAN's Sui address
    scope: 'read',
  });
  const { signature } = await serviceKeypair.signTransaction(fromBase64(bytes));
  await api.post(`/api/v1/seal/sponsor/${digest}/execute`, { signature });
}
```

> ⚠️ Grants are **eventually consistent** — after `execute`, the ACL must mirror into Harbor's
> indexer before access works, so fans may briefly hit `mirror_missing_grant`/decrypt failures right
> after purchase. Build retry + an "unlocking access" UX.

---

## 9. Mapping to WalrusUrchin Path A

Path A (MVP, mandated) = Harbor-managed, with **per-fan grants** so fans decrypt client-side with
their **own** key — never the service key. Both paths sit behind a `StorageProvider`/`AccessPolicy`
interface ([`architecture.md`](./architecture.md) §5, §7).

```
CREATOR UPLOAD (apps/api, holds hbr_ + suiprivkey1)
  1. reserve → sign(service key) → finalize  ⇒ seal_policy_id  (§5)
     bucket_group_create if the tier needs its own Seal group   (§8)
  2. client-side Seal-encrypt media against seal_policy_id       (§6.1, ORIGINAL pkg)
  3. multipart upload ciphertext → poll status to 'completed'    (§7, retry mirror_missing_grant)
  4. store { bucket_id, file_id, seal_policy_id } on the Content object (Sui)

FAN SUBSCRIBE / BUY (apps/api verifies on-chain Subscription/Entitlement, then grants)
  5. POST /api/v1/seal/sponsor kind=grant_bucket_access
       { groupIds:[tier group], recipientAddress: FAN addr, scope:'read' }
     → sign(service key) → /seal/sponsor/{digest}/execute        (§8)

FAN ACCESS (client-side, no service key)
  6. GET …/download → ciphertext
  7. build bucket_policy::seal_approve PTB (LATEST pkg), SessionKey signed by the
     FAN's OWN zkLogin signer, seal.decrypt() locally → plaintext (§6.2)

LAPSE / REFUND (apps/api reconciliation job)
  8. POST /api/v1/seal/sponsor kind=unshare_bucket_access → revoke the fan's decrypt capability
```

**Design notes specific to WalrusUrchin:**

- **One private bucket per creator/tier** (e.g. `creatorId-tierBronze`), members managed purely via
  **grants** on the tier's Seal **group** — so membership changes never require re-uploading or
  re-encrypting content.
- **Service-key custody caveat.** The single `suiprivkey1` signs `finalize` **and** can authenticate
  any decrypt `SessionKey` → **whoever holds it can decrypt that bucket's content.** In Path A the
  **backend** holds it (platform-managed, custodial-*capable* even though the normal flow never
  decrypts server-side). True non-custody requires a **creator-held** service key (worse UX, creator
  must be online to grant). **Document this to users.** Fans are *never* handed the service key — they
  decrypt with their own signer after a grant.
- **Reconciliation, not cron.** Sui has no native scheduler; the indexer mirrors on-chain
  `Subscription` state into grants (`grant_bucket_access` on `SubscriptionCreated`/`Renewed`,
  `unshare_bucket_access` on lapse). Grants are eventually consistent — plan for it.
- **Free / public content.** Public buckets are **disabled in alpha** and visibility is immutable, so
  free-tier/preview assets cannot use a Harbor public bucket today — gate everything via
  private+grant, or store truly-public assets via a separate raw-Walrus path.
- **Team Spaces** map to creator orgs (creator + manager, label/agency) via owner/admin/editor/viewer.
- **Keep it abstracted.** Alpha + testnet-only: own a thin Harbor client in `apps/api`
  (`packages/sdk` `StorageProvider` impl) so swapping to Path B or Harbor-GA never touches
  monetization/content logic.

---

## 10. Verified error code enum

`ErrorResponse` = `{ error: string, code?: enum }`. The enum below is **verbatim from `/openapi.yaml`**
— branch only on these:

```
USED_NONCE            EXPIRED_TIMESTAMP     ADDRESS_MISMATCH
INVALID_CHALLENGE     unauthorized          api_key_registering
api_key_revoking      api_key_revoked       read_only_api_key
bucket_not_in_scope   mirror_missing_grant  bucket_not_finalized
quota_exceeded        payload_too_large     bad_request
```

| Code / status | When | Handling |
| --- | --- | --- |
| `read_only_api_key` (403) | write with a read-only key | use the `read_write` key |
| `mirror_missing_grant` (403) | upload/access before ACL mirrors | retry ~3 s ×≤20 |
| `bucket_not_finalized` | act on a `pending_policy` bucket | finalize first |
| `bucket_not_in_scope` | bucket not visible to key | check space/scope |
| `PLAN_LIMIT_EXCEEDED` (422) | free-tier cap hit | surface quota; `limit:'storage'\|'users'\|'buckets'` |
| `429 Rate limited` | upload throttling | back off (no `Retry-After`/`X-RateLimit-*` headers defined) |

> ⚠️ **`digest_expired` is prose-only** — it appears in the quickstart text for a stale finalize but
> is **not** in the enum. The machine code in that region is **`bucket_not_finalized`** (and
> `bucket_not_in_scope`). Do not write code that matches on `digest_expired`.

---

## Gotchas

- **`digest_expired` ≠ a real code.** Prose-only in the quickstart; the enum has `bucket_not_finalized`
  / `bucket_not_in_scope`. Trust the enum (§10).
- **16 paths, not 11.** The prose undercounts; the `/seal/sponsor[/{digest}/execute]` grant pair plus
  single-bucket/single-file/global-file-search endpoints aren't in the prose. The grant pair is the
  one WalrusUrchin can't ship Path A without.
- **`/docs/quickstart` and `/docs/quickstart.md` 404** (June 2026). Canonical sources =
  `github.com/MystenLabs/walrus-harbor-quickstart` + `/openapi.yaml`. Don't tell readers to curl
  `/docs/quickstart.md`.
- **Package-id discipline.** `encrypt` + `SessionKey.create` → **ORIGINAL** id; `seal_approve` PTB →
  **LATEST** id. Swapping breaks DEK derivation after a package upgrade.
- **Pinned key servers.** Harbor's three IDs are **not** `getAllowlistedKeyServers('testnet')`. Use
  Harbor's three with `verifyKeyServers:false`, threshold **2-of-3**. Don't "fix" the mismatch.
- **Service-key custody footgun.** One `suiprivkey1` signs finalize *and* authenticates decrypt; whoever
  holds it can decrypt everything in that bucket. Decide platform- vs creator-held deliberately;
  never expose `hbr_` or `suiprivkey1` to the browser. Both shown once, unrecoverable.
- **`mirror_missing_grant` is expected**, not an error — after finalize *and* after each grant execute.
  Retry; build "provisioning"/"unlocking access" UX.
- **Sponsor signatures expire fast** — run reserve → sign → finalize (and sponsor → sign → execute) as
  one tight synchronous sequence; re-run reserve on expiry.
- **Visibility immutable + public buckets disabled in alpha** — decide `scope:'private'` at creation;
  no free/public Harbor buckets exist yet.
- **`@mysten/seal` API drift.** Quickstart uses standalone `new SealClient({…})`; current SDK docs
  show `client.$extend(seal({…}))`. Both shipped — pin an exact version and verify which constructor it
  exports before copying. Seal is still beta.
- **`429` rate limits are undocumented** — no `Retry-After`/`X-RateLimit-*` headers; back off defensively.
- **"Oyster" is internal terminology** for Harbor's blob layer, not a separate product. File delete is
  async/soft (dedup by file id, not immediate).
- **Alpha, testnet-only.** Object ids, package ids, key servers, and path shapes can all change before
  GA. *"Do not put production data behind this."* Keep it behind `StorageProvider`.

## Sources

- <https://api.testnet.harbor.walrus.xyz/openapi.yaml> (live OpenAPI 3.1 — authoritative surface)
- <https://github.com/MystenLabs/walrus-harbor-quickstart> (QUICKSTART.md, openapi.yaml, Postman pair, ref app)
- <https://raw.githubusercontent.com/MystenLabs/walrus-harbor-quickstart/main/QUICKSTART.md>
- <https://sdk.mystenlabs.com/seal>
- <https://github.com/MystenLabs/seal>
- <https://blog.walrus.xyz/seal-brings-data-access-control-to-walrus/>
- <https://www.mystenlabs.com/blog/mysten-labs-launches-seal-decentralized-secrets-management-on-testnet>
- <https://walrus.xyz/>
- <https://deepwiki.com/MystenLabs/seal/4.1-sealclient-and-sessionkey>
