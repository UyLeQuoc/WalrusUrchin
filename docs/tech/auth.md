# Authentication — zkLogin, Passkey & Enoki (sponsored gas)

> Status: **design / docs-only** (June 2026). Targets **Sui testnet** first. This is the
> per-technology reference for the **Auth + gas** layer in
> [`architecture.md`](./architecture.md) §1. It defines how a WalrusUrchin user (fan or creator)
> signs in passwordlessly, gets a stable Sui address, signs transactions, and never has to hold
> SUI — and how that same signer is reused to decrypt Seal-encrypted content.

WalrusUrchin's whole pitch — "a fan signs in with Google and subscribes in two clicks, no wallet,
no SUI" — lives in this layer. We use **Enoki** (`@mysten/enoki` 1.0.8) as the primary path: it
wraps **zkLogin** (OAuth → Sui address + Groth16 proof) and a **Gas Station** (sponsored
transactions) behind the wallet standard, so the SPA treats "Sign in with Google/Apple/Twitch" as
just another connectable wallet. **Passkey** (SIP-9, WebAuthn) is the no-OAuth, self-custodial
fallback for crypto-native creators. The recurring theme: the Enoki **public** key and all signing
happen in [`apps/web`](./monorepo.md); the Enoki **secret** key and gas sponsorship live only in
[`apps/api`](./monorepo.md), the trust boundary (architecture.md §3). The authenticated signer is
then reused verbatim to mint a [Seal](./seal.md) `SessionKey` for client-side decryption.

This doc covers: the zkLogin flow and address derivation, Passkey, Enoki registration + the
sponsored-tx pattern, the Seal SessionKey hand-off, the address-stability invariant, and the two
known integration risks (new dapp-kit wiring; Enoki personal-message intent byte).

---

## 1. The three auth paths, mapped to WalrusUrchin

| Path | Custody | OAuth? | Holds SUI? | WalrusUrchin role |
| --- | --- | --- | --- | --- |
| **Enoki zkLogin** | Managed (Enoki owns salt + proving) | Yes (Google/Apple/Twitch) | No (gas sponsored) | **Primary**. Fans + most creators. Two-click subscribe/tip/unlock. |
| **Passkey (SIP-9)** | Self-custodial (device/HW key) | No | No (still backend-sponsored) | Fallback for crypto-native creators wanting non-OAuth onboarding. |
| **External wallet** | Self-custodial | No | Yes (or sponsored) | Power users / advanced creators who already have a Sui wallet. |

All three resolve to a **Sui address**, which is the canonical user id everywhere in WalrusUrchin
(it is the subject of `seal_approve`, the owner of the `Subscription` NFT, the `payout` address on
`CreatorProfile`). Email-from-JWT and the [`creatorname.sui`](./suins.md) handle are **UX only** —
never the primary key.

```
                  ┌──────────────────────────────────────────────┐
   Browser        │  apps/web (SPA, Walrus Site, world-readable)   │
                  │  • Enoki PUBLIC key                            │
                  │  • createDAppKit + registerEnokiWallets        │
                  │  • builds tx KIND bytes (no gas, no sender)    │
                  └───────────────┬───────────────┬───────────────┘
       signs (no popup)           │               │  zkLogin: OAuth redirect,
       the sponsored tx           │               │  proof fetch (Enoki-managed)
                                  ▼               ▼
              ┌─────────────────────────────┐   ┌──────────────────────────┐
              │ apps/api (Hono, TRUST       │   │  OAuth IdP + Enoki proving│
              │ BOUNDARY)                   │   │  (Google / Apple / Twitch)│
              │ • Enoki SECRET key          │   └──────────────────────────┘
              │ • createSponsoredTransaction│
              │ • executeSponsoredTransaction
              │ • verifies sender == user   │
              │   + target ∈ allowlist      │
              └─────────────────────────────┘
```

---

## 2. zkLogin — OAuth in, Sui address out

zkLogin lets a user prove "I am the holder of this OAuth identity" to the Sui chain **without
revealing the OAuth identity on-chain** and **without a stored private key**. In WalrusUrchin,
Enoki performs steps 3–5 for us, but you must understand the flow because the **address derivation**
(§2.2) is a hard invariant and the **`max_epoch` ~24h** lifetime drives our re-auth UX.

### 2.1 The flow

```
1. EPHEMERAL KEY   client generates an ephemeral Ed25519 keypair + max_epoch
                   (current epoch + N; N chosen so the key lives ~24h)
                   + jwt_randomness.
2. NONCE           nonce = Poseidon(extended_ephemeral_pubkey, max_epoch, jwt_randomness).
                   This nonce is passed into the OAuth authorize URL.
3. OAUTH JWT       IdP (Google/Apple/Twitch) authenticates the user and returns a JWT
                   containing { iss, aud, sub, nonce }. The JWT commits to our nonce,
                   binding the login to the ephemeral key.
4. USER_SALT       fetch user_salt for this (iss, aud, sub). Enoki owns this for us.
5. GROTH16 PROOF   send (JWT, ephemeral pubkey, max_epoch, jwt_randomness, salt) to a
                   ZK prover → a Groth16 proof that all of the above are consistent
                   WITHOUT exposing the JWT on-chain.
6. SIGN            for each tx until max_epoch: sign with the ephemeral key, then wrap
                   the ephemeral signature + the ZK proof into a zkLogin signature.
                   The fullnode verifies the proof + ephemeral sig + epoch bound.
```

`@mysten/sui/zklogin` primitives (used directly only if we ever self-host; Enoki normally hides
them): `generateRandomness`, `generateNonce`, `getExtendedEphemeralPublicKey`, `jwtToAddress`,
`genAddressSeed`, `getZkLoginSignature`.

### 2.2 Address derivation — the invariant

```
addr_seed   = Poseidon( hash(sub), hash(aud), user_salt )
zkLogin_addr = Blake2b( flag=0x05, iss, addr_seed )
```

Consequences that WalrusUrchin **must** respect (architecture.md §3, "address stability is a hard
invariant"):

- The address is a deterministic function of **`(iss, aud, user_salt)`** (plus `sub`). Change **any**
  of them and you get a **different, unrecoverable** address — i.e. a different user who has lost the
  original's `CreatorProfile` earnings, SuiNS handle, and content NFTs.
- **Pin exactly one OAuth client id (`aud`) per environment.** A testnet client id and a mainnet
  client id are different `aud` → different addresses; that is expected (re-onboard on promotion), but
  silently rotating a client id within one environment is catastrophic.
- **Let Enoki own `user_salt`.** Self-hosting the salt (HKDF, or Mysten's `get_salt` service) means
  running a highly-available, secret-seed-protected service whose loss permanently bricks every user.
  We accept Enoki's managed salt for MVP; this is the single biggest reason we don't hand-roll zkLogin.
- Each **provider is a different `aud`**, so the same human gets a different address per provider. Pick
  **one provider per identity** (or build explicit account-linking later). For MVP: Google primary.

### 2.3 `max_epoch` ~24h → design for re-auth

The ZK proof and ephemeral key are valid only until `max_epoch` (≈ one day on Sui). Implications:

- A fan watching a paid stream must not be silently dropped — build **silent re-auth** (re-run the
  OAuth + proof step in the background before expiry).
- **Background jobs cannot cache a proof.** Subscription `renew()` nudges and scheduled payouts (the
  indexer/cron in architecture.md §2) run with the **backend's** own service signer, not a user's
  cached zkLogin proof.
- Refresh the [Seal](./seal.md) `SessionKey` (its own TTL, §5) before it lapses, independently of the
  zkLogin epoch.

> zkLogin mainnet providers (June 2026): Google, Facebook, Twitch, Apple, AWS Tenant, Karrier One,
> Credenza3. WalrusUrchin ships **Google + Apple + Twitch**.

---

## 3. Passkey (SIP-9) — the no-OAuth path

Passkey support is [SIP-9](https://github.com/sui-foundation/sips/blob/main/sips/sip-9.md): a
WebAuthn credential (Face ID / Touch ID / YubiKey) signs Sui transactions directly, **no OAuth, no
salt, no prover**. In WalrusUrchin this is the self-custodial onboarding for crypto-native creators
who don't want a Google account in their trust path.

`@mysten/sui/keypairs/passkey` exports `PasskeyKeypair`, `BrowserPasskeyProvider`,
`getPasskeyInstance`, `signAndRecover`, `findCommonPublicKey`, `signTransaction`,
`signPersonalMessage`.

**The catch:** a passkey's public key is **not directly readable**. To learn the address you must run
a one-time, two-signature **`signAndRecover`** ceremony, then `findCommonPublicKey`:

```ts
import {
  PasskeyKeypair,
  BrowserPasskeyProvider,
  findCommonPublicKey,
} from '@mysten/sui/keypairs/passkey';

const provider = new BrowserPasskeyProvider('WalrusUrchin', {
  rpName: 'WalrusUrchin',
  rpId: window.location.hostname, // passkeys are bound to this domain
});

// One-time onboarding: sign two messages, recover candidate pubkeys, intersect.
const sigA = await PasskeyKeypair.signAndRecover(provider, new TextEncoder().encode('msg-a'));
const sigB = await PasskeyKeypair.signAndRecover(provider, new TextEncoder().encode('msg-b'));
const publicKey = findCommonPublicKey(sigA, sigB);

const keypair = new PasskeyKeypair(publicKey.toRawBytes(), provider);
const address = keypair.getPublicKey().toSuiAddress(); // cache this — it's the canonical user id
```

WalrusUrchin notes:
- Run the two-signature ceremony **once** and **cache the recovered address** — don't make creators
  re-derive on every login.
- Passkeys bind to an **`rpId` (domain)** and to a specific **credential/device**. Cross-domain (our
  Walrus Site domain vs a custom domain) and cross-device portability need explicit handling — call
  this out in the creator onboarding flow.
- Passkey signers can still be **gas-sponsored** by the backend (§4) — Passkey only changes *how the
  user signs*, not who pays gas.

---

## 4. Enoki 1.0.8 — registration + sponsored gas

[`@mysten/enoki`](https://www.npmjs.com/package/@mysten/enoki) `1.0.8` (published 2026-05-15; peer deps `@mysten/sui ≥ 2.16.3`,
React ≥ 17) gives us: managed zkLogin (proving + salt), a **Gas Station** for sponsored transactions,
and wallet-standard integration. It is the primary auth + gas layer.

### 4.1 Frontend: `registerEnokiWallets` with the PUBLIC key

The SPA registers Enoki as wallet-standard wallets so "Sign in with Google" appears in the Connect
modal. **Only the Enoki *public* `apiKey` is used here** — and the SPA is world-readable on Walrus
Sites, so nothing else secret may appear.

```ts
// apps/web — runs in the browser. PUBLIC key only.
import { registerEnokiWallets, isEnokiNetwork } from '@mysten/enoki';

function registerWalrusUrchinWallets(client: SuiClient, network: 'testnet' | 'mainnet') {
  if (!isEnokiNetwork(network)) return;
  const { unregister } = registerEnokiWallets({
    apiKey: import.meta.env.VITE_ENOKI_PUBLIC_API_KEY, // enoki_public_…  (safe to ship)
    client,
    network,
    providers: {
      google:  { clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID },
      // apple / twitch configured similarly — each a distinct `aud` (see §2.2)
    },
  });
  return unregister; // call on network switch / teardown
}
```

`registerEnokiWallets` returns `{ unregister }`; companions `isEnokiWallet` / `isEnokiNetwork` let us
detect Enoki-backed accounts and gate by network.

> **RISK — new dapp-kit wiring (architecture.md §9, "single riskiest integration").** Enoki's
> published docs and the `sui-foundation/enoki-example-app` still target **legacy dapp-kit**
> (`SuiClientProvider` + `WalletProvider`, and worse, the deprecated `EnokiFlowProvider` /
> `useEnokiFlow` on Enoki 0.x / sui 1.x). WalrusUrchin uses the **new** `@mysten/dapp-kit-react` v2 +
> `@mysten/dapp-kit-core` `createDAppKit` (architecture.md §7). There is **no copy-paste example** for
> `registerEnokiWallets` + `createDAppKit`. You must call `registerEnokiWallets` against the dApp-kit
> `SuiClient` after the kit is created (and re-register on a testnet→mainnet switch, since Enoki
> wallets are network-bound). **Budget a spike. Do not copy the example app verbatim** — it pins
> `enoki 0.3.5` / `sui 1.0.5`; only its backend sponsor/execute split (§4.2) is still current.

### 4.2 Backend: `EnokiClient` with the SECRET key (sponsored gas)

The Enoki **secret** key lives only in `apps/api`. It is the gas-pool credential — leaking it lets
anyone drain WalrusUrchin's sponsored-gas budget.

```ts
// apps/api — server only. SECRET key. The trust boundary.
import { EnokiClient } from '@mysten/enoki';

const enoki = new EnokiClient({ apiKey: process.env.ENOKI_SECRET_API_KEY! }); // enoki_private_…

// POST /sponsor  — build the sponsored tx from client-supplied KIND bytes.
const sponsored = await enoki.createSponsoredTransaction({
  network: 'testnet',
  transactionKindBytes,            // from the client (TransactionKind only — no gas/sender)
  sender,                          // the authenticated user's Sui address
  allowedAddresses: [sender],      // belt-and-suspenders: only this user
  allowedMoveCallTargets: WALRUS_URCHIN_TARGETS, // see §4.4 allowlist
});
// → { bytes, digest }  — return { bytes, digest } to the client to sign.

// POST /sponsor/:digest/execute — submit after the client signs.
const { digest } = await enoki.executeSponsoredTransaction({
  digest: req.digest,
  signature: req.userSignature,    // the user's signature over `bytes`
});
```

`createSponsoredTransaction({ network, transactionKindBytes, sender, allowedAddresses,
allowedMoveCallTargets })` → `{ bytes, digest }`; `executeSponsoredTransaction({ digest, signature })`.
HTTP base: `api.enoki.mystenlabs.com/v1`.

### 4.3 The sponsored-transaction pattern

This is the canonical money-moving flow for every WalrusUrchin action (subscribe / buy PPV / tip /
buy bundle / renew / claim split / mint+transfer subscription NFT). See [`data-flows.md`](./data-flows.md)
for the full subscribe sequence.

```
  CLIENT (apps/web)                BACKEND (apps/api)                 CHAIN
  ─────────────────                ──────────────────                 ─────
1. build PTB, serialize as
   transactionKindBytes
   (kind only: no gas coin,
    no sender, no budget)
        │  POST /sponsor { kindBytes, sender }
        ▼
                          2. verify sender == authenticated user
                             verify target ∈ allowlist (§4.4)
                          3. createSponsoredTransaction(...)
                             → { bytes, digest }
        ◀───────────────────────────┘
4. user signs `bytes`
   (Enoki wallet: NO popup)
        │  POST /sponsor/:digest/execute { signature }
        ▼
                          5. executeSponsoredTransaction(
                               { digest, signature })  ──────────────▶ executes
        ◀──────────────────────────────────────────────  { effects }
```

The order is the contract: **build kind bytes (client) → sponsor (backend) → sign (frontend) →
execute (backend)**. The backend's secret-key path is *required* because gas-coin/object-transfer
sponsorship cannot be done frontend-only.

### 4.4 Sponsor allowlist of Move targets

Set the **Enoki Portal** allowlist of Move-call targets to **exactly** the WalrusUrchin entry
functions, and **re-check it server-side in `/sponsor`** before sponsoring:

```
walrus_urchin::subscriptions::subscribe
walrus_urchin::subscriptions::renew
walrus_urchin::ppv::buy_ppv
walrus_urchin::tips::tip
walrus_urchin::bundles::buy_bundle
walrus_urchin::revenue::claim_split
walrus_urchin::subscriptions::mint_and_transfer   // transferable tier NFTs
walrus_urchin::profile::register_creator          // + SuiNS handle bind
```

- **Sponsorship silently fails for any unlisted target** — if a new entry fn isn't added, the
  user just can't transact. Add targets when you add entry functions.
- `/sponsor` additionally enforces **`sender == authenticated user`** so the gas pool can't be drained
  by an attacker sponsoring arbitrary senders (architecture.md §3).
- Not every tx is sponsorable (e.g. using the **gas coin as a Move-call argument**, or pure
  frontend-only object transfers). Always provide a **wallet-paid fallback** path for those.
- **Enoki wallets sign with no confirmation popup.** Add an **explicit confirm UI** in the SPA for
  every value-moving action (subscribe, tip, buy) — the user must see "you are paying X SUI" because
  the wallet won't show it.

---

## 5. Reusing the auth signer for Seal SessionKey

The payoff of putting auth first: **logged-in == able-to-decrypt**. The exact same authenticated
signer — Enoki zkLogin, Passkey, or an external wallet — mints the [Seal](./seal.md) `SessionKey` that
unlocks tier/PPV content. The user's Sui address is the subject of `seal_approve`, so authentication
and authorization use one identity.

```ts
import { SessionKey } from '@mysten/seal';

// `signer` is the SAME object dapp-kit/Enoki gave us at login.
const sessionKey = await SessionKey.create({
  address,                       // the zkLogin / passkey / wallet address
  packageId: HARBOR_ORIGINAL_PACKAGE_ID, // Path A: SessionKey.create uses the ORIGINAL pkg
  ttlMin: 10,                    // short TTL; refresh before expiry (§2.3)
  signer,                        // a Signer ⇒ SessionKey self-signs the personal message
  suiClient,                     // the single shared SuiClient (§6)
});
// Path A (Harbor): fan was granted via grant_bucket_access, builds bucket_policy::seal_approve,
//   decrypts ciphertext client-side. (architecture.md §5, habour.md.)
// Path B (self-managed): walrus_urchin::access_policy::seal_approve reads the on-chain Subscription.
```

> **RISK — Enoki personal-message intent byte (Sui issues
> [#17504](https://github.com/MystenLabs/sui/issues/17504),
> [#17912](https://github.com/MystenLabs/sui/issues/17912)).** `SessionKey.create` works by having the
> signer **`signPersonalMessage`** over a Seal challenge. Enoki's `signPersonalMessage` has
> historically **prepended an extra intent byte**, which can make the Seal key servers reject the
> SessionKey signature. **You must verify end-to-end on testnet that an Enoki-signed SessionKey passes
> Seal `seal_approve` and the key servers release the DEK.** If a mismatch appears, normalize the
> signature (strip/adjust the leading intent byte) before handing it to Seal. This is the highest-risk
> interaction between the auth layer and the content layer — test it before relying on it.

Harbor specifics (Path A, architecture.md §8 / [`habour.md`](./habour.md)): `encrypt` and
`SessionKey.create` use **`HARBOR_ORIGINAL_PACKAGE_ID`**; the decrypt `seal_approve` PTB targets
**`HARBOR_LATEST_PACKAGE_ID`**; use Harbor's **3 pinned key servers** with `verifyKeyServers:false`
and threshold **2-of-3** (not the generic `getAllowlistedKeyServers('testnet')` set).

---

## 6. One SuiClient, one network config

Thread a **single** `SuiClient` + network config through dapp-kit, Enoki, Seal, and Walrus. The
zkLogin/Enoki/Passkey address signs the Seal `SessionKey`, which decrypts Seal-encrypted blobs stored
on [Walrus](./walrus.md) via [Harbor](./habour.md). Store the **address as the canonical user id**;
treat email-from-JWT and the [`creatorname.sui`](./suins.md) handle as UX only.

Bind `creatorname.sui` to the creator's address at registration, and **allowlist its SuiNS mint +
transfer call** in Enoki so creator onboarding is also gas-sponsored.

---

## 7. WalrusUrchin auth decisions (summary)

- **Primary:** Enoki zkLogin with Google/Apple/Twitch — passwordless, fans never hold SUI.
- **Fallback:** Passkey (SIP-9) for non-OAuth self-custodial creators; still backend-sponsored.
- **Secrets:** Enoki **secret** key only in `apps/api`; SPA holds only the Enoki **public** key.
- **Gas:** all WalrusUrchin entry functions sponsored via the backend Gas Station; allowlist enforced
  both in the Enoki Portal and server-side, with `sender == user` check.
- **Identity:** Sui **address** is the canonical user id and the `seal_approve` subject; one shared
  access signer mints the Seal SessionKey.
- **Lifetimes:** zkLogin `max_epoch` ~24h and Seal SessionKey TTL are short — design silent re-auth
  and SessionKey refresh.

---

## Gotchas

- **`user_salt` is the single catastrophic failure point.** A non-deterministic salt for a given
  `(iss, aud, sub)` changes the address and **permanently loses** funds, the SuiNS handle, and content
  access. Enoki removes this risk by owning the salt; if you ever self-host, the salt service must be
  highly-available and secret-seed-protected. **Never rotate `aud`/client id within an environment.**
- **`max_epoch` ≈ 24h.** Long-lived sessions, scheduled payouts, and background jobs **cannot** rely
  on a cached proof. Background `renew()`/payout jobs use the backend service signer, not a user proof.
- **Enoki adds an extra intent byte to personal-message signatures** (Sui issues #17504 / #17912),
  which can break **Seal SessionKey** verification. **Test on testnet**; normalize the signature if a
  mismatch appears. (§5.)
- **New-dapp-kit wiring is unexampled.** Enoki docs target **legacy dapp-kit** /
  `EnokiFlowProvider`; wiring `registerEnokiWallets` into the new `createDAppKit` is the **riskiest
  integration** — budget a spike, don't copy `enoki-example-app` verbatim. (§4.1.)
- **The Enoki secret key must never leave `apps/api`.** Leaking it lets anyone drain the sponsored-gas
  budget. The SPA on Walrus Sites is world-readable — only the public key ships there.
- **Not all transactions are sponsorable** (gas coin as a Move-call argument, frontend-only object
  transfers). Always provide a **wallet-paid fallback**.
- **Sponsorship silently fails for any unlisted Move target.** Keep the Enoki Portal allowlist in sync
  with every new entry function. (§4.4.)
- **Enoki wallets sign with NO confirmation popup.** Add explicit confirm UI for every value-moving
  action so the user sees what they're paying.
- **Enoki wallets are network-bound** — re-register on a testnet→mainnet switch.
- **Passkey public keys aren't directly readable** — the two-signature `signAndRecover` ceremony is
  mandatory; passkeys bind to an `rpId` domain + device, so cross-domain/cross-device portability needs
  explicit handling. (§3.)
- **Different providers / client ids → different addresses for the same human.** Pick one provider +
  client id per identity, or build explicit account-linking.
- **No public, stable, unauthenticated zkLogin prover URL** is documented for production — proving goes
  through Enoki or a self-hosted Docker prover (`prover-stable` / `prover-fe-stable`). A pure DIY
  zkLogin path is real infra burden; this is why we standardize on Enoki. **UNVERIFIED:** Enoki
  pricing/quota (MAA caps, sponsored-tx limits, free tier) is gated behind the Portal and not public as
  of June 2026 — sponsored gas is "free" only to the *user* (we fund the pool). Confirm in the Portal.

---

## Sources

- https://docs.sui.io/concepts/cryptography/zklogin
- https://docs.sui.io/guides/developer/cryptography/zklogin-integration
- https://docs.sui.io/concepts/cryptography/passkeys
- https://sdk.mystenlabs.com/sui/cryptography/passkey
- https://github.com/sui-foundation/sips/blob/main/sips/sip-9.md
- https://docs.enoki.mystenlabs.com/ts-sdk/register
- https://docs.enoki.mystenlabs.com/ts-sdk/sponsored-transactions
- https://docs.enoki.mystenlabs.com/http-api
- https://github.com/sui-foundation/enoki-example-app
- https://registry.npmjs.org/@mysten/enoki
- https://sdk.mystenlabs.com/seal
- https://github.com/MystenLabs/sui/issues/17912
- https://blog.sui.io/zklogin-salt-server-architecture/
- https://walform.wal.app/
