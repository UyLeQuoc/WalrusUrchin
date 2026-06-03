# memwal / Walrus Memory — portable encrypted AI memory

> Status: **beta / testnet** (June 2026). `@mysten-incubation/memwal` is at `0.0.7` (0.0.x churn,
> breaking changes between minors). In WalrusUrchin, memwal is the **agent-memory** layer only —
> NOT the media store. Encrypted tiered content lives on Harbor/Walrus + Seal (see
> [`habour.md`](./habour.md) and [`walrus.md`](./walrus.md)); memwal stores short, Seal-encrypted,
> semantically-searchable **text facts** for the creator concierge, the fan-support bot, and per-fan
> preference recall.

Walrus Memory (a.k.a. MemWal) is Mysten Labs' privacy-first, decentralized AI-memory stack: a
TypeScript **SDK** + a **relayer** (REST API that does embedding/encryption/storage) + a Sui Move
**smart contract** (ownership + delegate keys) + an **indexer** (syncs on-chain state for fast
lookups) + a **dashboard** + an **MCP server** + a **Python SDK**. Memories are Ed25519-signed,
Seal-encrypted, embedded for semantic search, and stored as Walrus blobs; ownership and delegate
access are enforced on Sui. For WalrusUrchin it is the substrate for a creator AI concierge, a
fan-support chatbot with portable cross-session context, per-fan preference recall, and a creator
knowledge base — all multiplexed through **one** platform account and **one** backend delegate key.
This doc is the engineering reference for that integration. The system-wide picture is in
[`architecture.md`](./architecture.md) §6; identity/auth/gas wiring is in [`suins.md`](./suins.md)
and [`auth.md`](./auth.md); end-to-end sequences are in [`data-flows.md`](./data-flows.md).

---

## 1. Where it fits in WalrusUrchin

memwal is **mandated** but narrowly scoped. The hard rules:

- **memwal is agent memory, not content storage.** Paid media stays encrypted on Harbor/Walrus with
  WalrusUrchin's own Seal tier/PPV policies (Path A / Path B in [`architecture.md`](./architecture.md) §5).
  `remember()` is text-oriented and **append-only** — never push large media blobs through it.
- **One platform `MemWalAccount` + one delegate key, held only in `apps/api`.** The contract enforces
  **one account per Sui address**, so we do *not* create per-user accounts. We multiplex every creator
  and fan through **namespaces** under the single platform account.
- **The delegate private key is a server-only bearer credential.** It lives in `apps/api` (the trust
  boundary) alongside the Enoki secret key and Harbor service keys. It must never ship in the
  Vite/React SPA — the SPA is world-readable on Walrus Sites. The browser only ever sees the Enoki
  **public** key.
- **Relayer host is configurable.** Store `MEMWAL_SERVER_URL` in `packages/config`; do not hardcode.
  Authoritative default: `https://relayer.memwal.ai` (production) / `https://relayer.staging.memwal.ai`
  (testnet/staging). See [§9 Gotchas](#9-gotchas) for the URL discrepancy.

### Namespace convention (flat, exact-match, no wildcards)

A namespace is an opaque string; you cannot query across namespaces in one call. Pick the convention
deliberately and document it:

| Namespace | Holds | Used by |
| --- | --- | --- |
| `creator:<suins>` | brand voice, tier descriptions, posting cadence, past answers | creator AI concierge (`withMemWal`) |
| `fan:<addr>` | a fan's durable preferences, owned tiers, history | per-fan recall, fan-support bot |
| `kb:<creatorId>` | a creator's FAQ / refund policy / posting rules | RAG knowledge base (`/api/ask`) |
| `dm:<creatorId>:<fanAddr>` | per-creator support-thread context | fan-support chatbot threads |

> Memory isolation is keyed by `owner address + namespace + app_id`, where `app_id` is the MemWal
> **package ID** of the relayer deployment. The same namespace string under different package IDs never
> collides — another reason to pin the package ID per network (§5).

### The four use cases

1. **Creator AI concierge** — `withMemWal(model, …)` in `apps/api` auto-recalls brand voice / cadence
   from `creator:<suins>` and auto-saves new facts after each turn.
2. **Fan-support chatbot** — portable cross-session context per fan via `fan:<addr>` /
   `dm:<creatorId>:<fanAddr>`; recall prior context, analyze each turn for durable facts.
3. **Per-fan preference recall** — store signals (genres watched, tips, PPV unlocks) with `analyze()`;
   later `recall()` powers recommendations and tier-upgrade nudges.
4. **Creator knowledge base** — `rememberBulk` a creator's FAQ into `kb:<creatorId>`, then expose
   `/api/ask` (RAG answer + cited memories) so the bot answers grounded in the creator's own KB.

---

## 2. Package surface (`@mysten-incubation/memwal` 0.0.7)

ESM-only (`"type": "module"`), Apache-2.0, maintained by Mysten Labs, repo
`github.com/MystenLabs/MemWal` (`packages/sdk`). Hard deps are only `@noble/ed25519` + `@noble/hashes`;
everything else is an **optional peer dep**, pulled in only by the flows that need it.

| Subpath | Exports | When you need it |
| --- | --- | --- |
| `.` | `MemWal` (default/TEE client) | remember/recall/analyze/embed/restore against the managed relayer |
| `/manual` | `MemWalManual` (E2E client) | client-side encrypt/embed/upload; relayer sees only ciphertext + vectors |
| `/ai` | `withMemWal` (Vercel AI-SDK middleware) | wrap a `LanguageModel` for auto recall + auto save |
| `/account` | `createAccount`, `addDelegateKey`, `removeDelegateKey`, `generateDelegateKey` | on-chain account + delegate-key lifecycle |

```ts
import { MemWal } from "@mysten-incubation/memwal";
import { MemWalManual } from "@mysten-incubation/memwal/manual";
import { withMemWal } from "@mysten-incubation/memwal/ai";
import {
  createAccount,
  addDelegateKey,
  removeDelegateKey,
  generateDelegateKey,
} from "@mysten-incubation/memwal/account";
```

| Peer dep | Range | Needed by |
| --- | --- | --- |
| `@mysten/sui` | `>=2.5.0` | account helpers; SessionKey build (default client); `MemWalManual` |
| `@mysten/seal` | `>=1.1.0` | SessionKey (default); encrypt/decrypt (`MemWalManual`) |
| `@mysten/walrus` | `>=1.0.3` | blob up/download (`MemWalManual`) |
| `ai` | `>=4.0.0` | `withMemWal` middleware |
| `zod` | `^3.23.0` | schema validation |

> The **default** `MemWal` client needs no Sui/Seal/Walrus libs server-side except to build the
> ephemeral Seal SessionKey (so install `@mysten/seal` + `@mysten/sui`). Keep all peer-dep versions
> within range; mixing CJS / pre-2.x `@mysten/sui` will break (see [§9](#9-gotchas)).

Companion artifacts (not used by `apps/api` directly, but relevant): MCP server
`@mysten-incubation/memwal-mcp` `0.0.2` (six tools: `memwal_remember`, `memwal_recall`,
`memwal_analyze`, `memwal_restore`, `memwal_login`, `memwal_logout`; browser-wallet sign-in), the
OpenClaw/NemoClaw plugin `@mysten-incubation/oc-memwal` `0.0.4`, and the Python SDK `memwal` `0.1.4`
(`MemWal`, `MemWalManual`, `with_memwal`).

---

## 3. `MemWal.create(...)` + the core API

```ts
import { MemWal } from "@mysten-incubation/memwal";

// apps/api only — MEMWAL_PRIVATE_KEY is a server secret, never bundled in apps/web.
const memwal = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY!,        // Ed25519 delegate priv key (hex or Uint8Array)
  accountId: process.env.MEMWAL_ACCOUNT_ID!,   // MemWalAccount object ID on Sui
  serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer.staging.memwal.ai", // CONFIGURABLE (testnet=staging; prod=relayer.memwal.ai)
  namespace: "default",                        // default; override per call
});
```

| Method | Shape | Notes |
| --- | --- | --- |
| `remember(text, namespace?)` | `→ { job_id, status }` (HTTP 202) | fire-and-forget; **ALWAYS APPENDS**, never upserts |
| `rememberAndWait` / `waitForRememberJob(job_id)` | `→ { id, job_id, blob_id, owner, namespace }` | block until stored (UI confirmation) |
| `getRememberStatus(job_id)` | states `pending\|running\|uploaded\|done\|failed\|not_found` | poll a write |
| `rememberBulk` / `rememberBulkAndWait` | **max 20 items / call** | batches Sui PTBs; `getRememberBulkStatus`, `waitForRememberJobs` |
| `recall({ query, limit?\|topK?, namespace?, maxDistance? })` | `→ { results: [{ blob_id, text, distance }], total }` | semantic search; positional form deprecated |
| `analyze(text)` / `analyzeAndWait(text)` | extracts discrete facts | one `job_id` per fact; optional `occurredAt` anchor |
| `embed(text)` | `→ { vector }` | raw embedding (default model `text-embedding-3-small`) |
| `restore(namespace, limit = 10)` | rebuild index from Walrus | newest-first, single-shot, **no cursor** (§9) |
| `health()` / `compatibility()` | relayer liveness + `minSupportedSdk` handshake | run at startup to fail loud on drift |

**`ask` is NOT a TS class method.** RAG-style Q&A (`/api/ask` → `{ answer, memories_used, … }`) exists
on the **relayer REST surface** and in the MCP/Python SDKs, but is **not** surfaced on the `MemWal`
class in `0.0.7`. To use it from TypeScript, hit the REST endpoint directly with the same signed-request
auth (§6), or go through MCP/Python. Do not assume `memwal.ask()` exists.

**Distance semantics (recall):** `distance < 0.25` ≈ near-duplicate; `~0.55–0.7` ≈ weak relevance;
`maxDistance` drops results `>=` the threshold. (`withMemWal` instead uses `minRelevance`, a 0–1
*similarity*, default `0.3`.) For WalrusUrchin: dedup before writing by `recall(..., maxDistance: 0.25)`
since `remember()` only appends; for fan-support context, `recall({ namespace, maxDistance: 0.6 })` is a
reasonable inject threshold.

### Async vs blocking in a chat turn

```ts
// fire-and-forget during a turn (don't block the response)
const job = await memwal.remember("Fan prefers behind-the-scenes posts", `fan:${fanAddr}`);

// block ONLY where the UI shows "saved to your profile"
const stored = await memwal.rememberAndWait("Upgraded to Gold tier", `fan:${fanAddr}`);
```

> Eventual consistency: a just-`remember()`-ed fact may not appear in the next immediate `recall()`
> until its status reaches `done`.

---

## 4. AI-SDK middleware (`withMemWal`)

`withMemWal` wraps a Vercel AI-SDK `LanguageModel`. Before each call it `recall()`s relevant memories
and injects them into the system prompt; after each call it `analyze()`s the exchange and auto-saves
facts (fire-and-forget). This is the cleanest path for the **creator concierge** in `apps/api`.

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { withMemWal } from "@mysten-incubation/memwal/ai";

const model = withMemWal(openai("gpt-4o"), {
  key: process.env.MEMWAL_PRIVATE_KEY!,
  accountId: process.env.MEMWAL_ACCOUNT_ID!,
  serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer.staging.memwal.ai", // testnet staging
  namespace: `creator:${creatorSuiNs}`,  // scope to THIS creator
  // withMemWal extras (on top of MemWalConfig):
  maxMemories: 5,      // injected per call (default 5)
  autoSave: true,      // analyze + save after each turn (default true)
  minRelevance: 0.3,   // similarity floor, 0–1 (default 0.3)
  debug: false,
});

const result = await generateText({
  model,
  messages: [{ role: "user", content: "Draft my next-post caption in my usual voice" }],
});
// the model now sees the creator's recalled brand voice / cadence as context
```

---

## 5. On-chain model (Move package + registry)

```
MemWalAccount  (owned object — one per Sui address)
├─ owner: address
├─ active: bool                       (owner can (de)activate)
└─ delegate_keys: vector<DelegateKey> ── { public_key, sui_address (derived), label }

AccountRegistry (shared object) ── enforces ONE account per address
```

Move entry points (against `{MEMWAL_PACKAGE_ID}`):

```move
account::create_account(registry, clock)
account::add_delegate_key(account, public_key, sui_address, label, clock)
account::remove_delegate_key(account, public_key)
// access gating:
account::seal_approve(...)
```

**Permissions:** only the **owner** may add/remove delegates or (de)activate the account; **delegates**
may `remember`/`analyze`/`recall`/`restore` but cannot manage keys or activation. The account must be
`active` for any access to succeed.

### `seal_approve` — two branches

Seal releases the decryption key (via `seal_approve`) only if one branch passes, and only while the
account is active:

- **OWNER branch** — the Seal key id must end with (`has_suffix`) the BCS-encoded **owner address
  bytes**, AND the caller `== owner`.
- **DELEGATE branch** — the caller's address is in `delegate_keys` (and the owner-suffix check is
  **skipped**).

> Manual-mode Seal id layout: `hex(utf8(namespace)) || hex(callerAddress[2:])` — the namespace prefix
> gives per-namespace key isolation; the owner-address suffix satisfies `has_suffix`. The id layout has
> changed across betas; ciphertext encrypted under an old layout is **unrecoverable** (§9).

### Verified IDs — reuse, do not invent

These match [`architecture.md`](./architecture.md) §8; pin them in `packages/config` per network.

| Network | `MEMWAL_PACKAGE_ID` (`app_id`) | `MEMWAL_REGISTRY_ID` |
| --- | --- | --- |
| **Testnet** (build target) | `0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6` | `0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437` |
| Mainnet | `0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6` | `0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd` |

### WalrusUrchin onboarding flow

The single platform account is provisioned once; we do not create per-user accounts.

```ts
// 1) generate the backend delegate keypair (store private key ONLY in apps/api secrets)
const delegate = generateDelegateKey();

// 2) create the platform MemWalAccount (owner = platform wallet; route gas via Enoki sponsorship)
const accountId = await createAccount({ /* packageId, registryId, walletSigner */ });

// 3) register the backend delegate against it
await addDelegateKey({ /* accountId */ label: "WalrusUrchin backend" /* , delegate.publicKey */ });

// 4) persist accountId in config; the delegate PRIVATE key never leaves apps/api
```

`create_account` / `add_delegate_key` cost Sui gas + WAL storage; wire them through WalrusUrchin's
Enoki sponsored-transaction flow (the relayer even exposes `POST /sponsor` + `POST /sponsor/execute`)
so the platform wallet/creators never need to hold SUI. Rotate the delegate via
`removeDelegateKey` + `addDelegateKey`.

---

## 6. Relayer REST surface + signed-request auth

`apiVersion 1.0.0`. Base = `MEMWAL_SERVER_URL`.

| Method + path | Auth | Purpose |
| --- | --- | --- |
| `GET /health`, `GET /version` | public | liveness / version + network |
| `POST /sponsor`, `POST /sponsor/execute` | public | sponsored on-chain account/key txs |
| `POST /api/remember`, `GET /api/remember/:job_id` | signed | write + status |
| `POST /api/remember/bulk`, `POST /api/remember/bulk/status` | signed | bulk write (≤20) + status |
| `POST /api/remember/manual` | signed | manual-mode write (vector mapping) |
| `POST /api/recall`, `POST /api/recall/manual` | signed | semantic search |
| `POST /api/analyze` | signed | extract facts |
| `POST /api/ask` | signed | **RAG Q&A** (not on the TS class — call REST directly) |
| `POST /api/restore` | signed | rebuild index from Walrus |

### Auth = per-request Ed25519 signature

Every authenticated call signs a **canonical message** with the delegate key:

```
{timestamp}.{method}.{path_and_query}.{body_sha256}.{nonce}.{account_id}
```

(`GET` uses the SHA-256 of an empty body.) The signature + metadata travel as headers:

| Header | Value |
| --- | --- |
| `x-public-key` | delegate Ed25519 public key (hex) |
| `x-signature` | Ed25519 signature over the canonical message |
| `x-timestamp` | unix ms; **5-minute** acceptance window |
| `x-nonce` | UUID v4; replay-tracked in Redis (TTL 600s) |
| `x-account-id` | the `MemWalAccount` object ID |
| `x-seal-session` *(optional)* | ephemeral Seal SessionKey (default/TEE mode) |
| `x-delegate-key` *(optional)* | delegate key reference |

> The SDK builds these headers for you. If you call `/api/ask` (or any endpoint) **directly** from
> `apps/api`, you must reproduce the canonical message and signature yourself with the same delegate key.

---

## 7. Trust models — default (TEE) vs `MemWalManual` (E2E)

memwal's encryption claim ("all content Seal-encrypted before Walrus") is true, but **who decrypts**
differs by client:

| | Default `MemWal` (relayer / TEE) | `MemWalManual` (end-to-end) |
| --- | --- | --- |
| Embedding | server-side (relayer) | **client-side** (in `apps/api`) |
| Seal encrypt / decrypt | relayer, via ephemeral SessionKey (~5-min TTL, scoped to `packageId`, sent as `x-seal-session`) | **client-side** with `@mysten/seal` |
| Walrus up/download | relayer | **client-side** with `@mysten/walrus` |
| Relayer sees | plaintext, decrypted recalls, embeddings | **only** ciphertext + vectors + blob IDs |
| Delegate private key | used to sign requests (not the data path) | **not transmitted** |
| Cost to us | minimal (managed) | manage Seal config, Walrus signer, embedding key, WAL gas |

**WalrusUrchin posture:** use the **default** client for low-sensitivity memory (creator brand voice,
public KB). For sensitive fan/creator data — private DMs, supporter-only summaries — prefer
**`MemWalManual`** so encryption/embedding happen inside `apps/api` and the relayer sees only ciphertext
+ vectors. Caveat: the public relayer is *described* as TEE-capable (Nautilus), but the docs do **not**
definitively confirm the public relayer runs in a TEE by default — treat default mode as "trust the
relayer with plaintext" until attestation is verified.

```ts
import { MemWalManual } from "@mysten-incubation/memwal/manual";

const e2e = MemWalManual.create({
  key: process.env.MEMWAL_PRIVATE_KEY!,
  accountId: process.env.MEMWAL_ACCOUNT_ID!,
  serverUrl: process.env.MEMWAL_SERVER_URL!,
  // E2E extras:
  suiPrivateKey: process.env.MEMWAL_SUI_KEY,   // or walletSigner / suiClient
  packageId: process.env.MEMWAL_PACKAGE_ID!,
  suiNetwork: "testnet",                        // SDK default is "mainnet" — set explicitly
  embeddingApiKey: process.env.OPENAI_API_KEY!, // client-side embeddings
  embeddingModel: "text-embedding-3-small",
  sealThreshold: 2,                             // default 2
  walrusEpochs: 50,                             // default 50; set explicitly for durability (§9)
});
```

---

## 8. Embeddings & self-hosting

**Embeddings.** Default model is OpenAI `text-embedding-3-small` (OpenAI-compatible base overridable).
The default client embeds **server-side**; `MemWalManual` embeds **client-side** with your own
`embeddingApiKey`/`embeddingApiBase`/`embeddingModel`. The relayer's vector index is **PostgreSQL +
pgvector**; it also uses **Redis** for rate-limiting and replay-nonce tracking.

**Indexer (optional but recommended).** Polls Sui (`suix_queryEvents`) for `AccountCreated` events,
syncs `account_id → owner` into a Postgres `accounts` table (cursor in `indexer_state`) so the relayer
resolves delegate keys fast. Without it, the relayer falls back to expensive on-chain registry scans.

**Self-hosting the relayer** (for full data sovereignty — no third-party relayer sees fan plaintext)
requires:

| Component | Why |
| --- | --- |
| PostgreSQL + **pgvector** | memory metadata + vector index |
| Redis | rate limiting + replay nonces |
| **SUI-funded wallet** (or pool via `SERVER_SUI_PRIVATE_KEYS`) | pays gas + **WAL storage** for each blob |

Required env: `DATABASE_URL`, `MEMWAL_PACKAGE_ID`, `MEMWAL_REGISTRY_ID`,
`SERVER_SUI_PRIVATE_KEY[S]`, `SIDECAR_AUTH_TOKEN`. Recommended: `OPENAI_API_KEY`/`OPENAI_API_BASE`
(**without it the relayer falls back to MOCK hash embeddings** — useless for real search),
`SEAL_KEY_SERVERS`/`SEAL_SERVER_CONFIGS`, `WALRUS_AGGREGATOR_URLS`, `REDIS_URL`, and `RATE_LIMIT_*`
(defaults ~60/min, 500/hr, delegate 30/min, 1 GB storage). Concrete WAL/SUI amounts are not published —
size empirically. This is a **later-phase** option for WalrusUrchin, not MVP.

---

## 9. Gotchas

- **Relayer URL discrepancy (verify before hardcoding).** The SDK README/quickstart and our research
  use `relayer.memwal.ai` / `relayer.staging.memwal.ai` (dashboard `memwal.ai`, also `memwal.wal.app`).
  The Walrus docs site *also* lists `relayer.memory.walrus.xyz` / `relayer.staging.memory.walrus.xyz`
  (dashboard `memory.walrus.xyz`). The old paste in this file used the `*.memory.walrus.xyz` hosts;
  these are **UNVERIFIED / possibly aliased** against the published package. **Authoritative default:
  `relayer.memwal.ai` / `relayer.staging.memwal.ai`.** Always read it from `MEMWAL_SERVER_URL`; confirm
  the network via `GET /health` / `GET /version` before assuming testnet vs mainnet.
- **`remember()` ALWAYS APPENDS.** No upsert/update/delete in the SDK surface. Duplicate calls create
  duplicate blobs and grow WAL cost monotonically. Dedup at the app layer (`recall(..., maxDistance:
  0.25)` before writing) and budget storage.
- **`ask` is REST/MCP/Python only**, not a `MemWal` TS method in `0.0.7`. Call the REST endpoint with
  signed-request auth, or use MCP/Python.
- **Beta churn / version pinning.** `0.0.x` ships breaking changes; the Seal id layout and `recall`
  signature have already shifted. Pin the exact version, re-verify on upgrade, and call
  `compatibility()` at startup (the SDK can hard-fail against a relayer whose `minSupportedSdk` is
  higher).
- **Delegate key is a bearer credential.** Anyone holding it can read/write every namespace on the
  account (the delegate `seal_approve` branch skips the owner-suffix check). Server-only; rotate via
  `removeDelegateKey` + `addDelegateKey`; never ship to the SPA.
- **Default-mode privacy.** The managed relayer (and/or its TEE) decrypts and sees plaintext, recalls,
  and embeddings. TEE/Nautilus operation is not definitively confirmed for the public relayer — use
  `MemWalManual` for sensitive WalrusUrchin data.
- **`restore()` is single-shot, no cursor.** Newest-first up to `limit` (default 10), slow on cold
  caches, and **silently drops** decrypt/embed failures. Call repeatedly with growing `limit` for large
  namespaces; don't assume one call rebuilds everything.
- **Walrus epoch defaults differ by network** (50 testnet vs 2 mainnet) unless overridden — mainnet
  memories can expire much sooner. Set `walrusEpochs` explicitly for durable creator data.
- **ESM-only + `@mysten/sui` 2.x.** Mixing CJS / older `@mysten/sui` breaks. In the browser pass a
  pre-built `suiClient` (e.g. from dapp-kit) — but for WalrusUrchin, memwal runs **server-side** in
  `apps/api`, not in the SPA.
- **Eventual consistency.** A just-remembered fact may not surface in an immediate `recall()` until its
  job reaches `done`.
- **Canonical org.** Use `github.com/MystenLabs/MemWal`. A stray README footer references
  `github.com/CommandOSSLabs/MemWal` — treat that as a mirror/fork, not authoritative.
- **Keep memwal separate from Harbor.** memwal text facts ≠ media blobs. Encrypted tiered media stays on
  Harbor/Walrus + WalrusUrchin Seal policies; do not conflate the two storage paths.

---

## 10. Quick checklist for `apps/api`

- [ ] `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_SERVER_URL` in backend secrets only.
- [ ] `MEMWAL_PACKAGE_ID` / `MEMWAL_REGISTRY_ID` pinned in `packages/config` per network (testnet IDs in §5).
- [ ] `serverUrl` defaults to `https://relayer.staging.memwal.ai` (testnet) — never hardcoded inline.
- [ ] Startup `health()` + `compatibility()` check.
- [ ] Namespace helpers (`creator:`/`fan:`/`kb:`/`dm:`) centralized; no ad-hoc namespace strings.
- [ ] Dedup-before-`remember()` policy (append-only) + WAL storage budget.
- [ ] `MemWalManual` reserved for sensitive (DM / private) memory; default client elsewhere.
- [ ] Account/key on-chain txs routed through Enoki sponsorship.

---

## Sources

- https://github.com/MystenLabs/MemWal
- https://registry.npmjs.org/@mysten-incubation/memwal (tarball `memwal-0.0.7.tgz`: `README.md`, `dist/memwal.d.ts`, `dist/types.d.ts`, `dist/manual.d.ts`, `dist/account.d.ts`, `dist/ai/middleware.d.ts`)
- https://raw.githubusercontent.com/MystenLabs/MemWal/main/SKILL.md
- https://raw.githubusercontent.com/MystenLabs/MemWal/main/docs/relayer/api-reference.md
- https://raw.githubusercontent.com/MystenLabs/MemWal/main/docs/relayer/self-hosting.md
- https://raw.githubusercontent.com/MystenLabs/MemWal/main/docs/contract/ownership-and-permissions.md
- https://raw.githubusercontent.com/MystenLabs/MemWal/main/docs/fundamentals/concepts/memory-space.md
- https://raw.githubusercontent.com/MystenLabs/MemWal/main/docs/indexer/purpose.md
- https://raw.githubusercontent.com/MystenLabs/MemWal/main/docs/mcp/overview.md
- https://raw.githubusercontent.com/MystenLabs/MemWal/main/docs/fundamentals/architecture/data-flow-security-model.md
- https://pypi.org/pypi/memwal/json
- https://www.npmjs.com/package/@mysten-incubation/memwal-mcp
- https://www.npmjs.com/package/@mysten-incubation/oc-memwal
- https://docs.wal.app/walrus-memory/ (301 from docs.memwal.ai)
- https://blog.sui.io/messaging-sdk-beta-live-mainnet/

---

*See also: [`architecture.md`](./architecture.md) (§6 integration) · [`habour.md`](./habour.md) (Harbor media storage — kept separate) · [`seal.md`](./seal.md) (Seal `seal_approve`) · [`walrus.md`](./walrus.md) (blob storage + epochs) · [`auth.md`](./auth.md) (Enoki sponsorship) · [`sui.md`](./sui.md) · [`suins.md`](./suins.md) · [`data-flows.md`](./data-flows.md) · [`monorepo.md`](./monorepo.md).*
