# WalrusUrchin — Product Requirements Document

> **A decentralized social creator network on the Sui Stack.** WalrusUrchin combines
> public social media discovery with paid memberships, pay-to-view posts, private blogs,
> encrypted files, tips, and creator-owned access.

|                    |                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Status**         | Draft v0.2 — product pivot PRD                                                                               |
| **Last updated**   | 2026-06-05                                                                                                   |
| **Build target**   | Sui **testnet** first (Harbor + memwal are testnet/beta)                                                     |
| **Owner**          | UyLeQuoc                                                                                                     |
| **Companion docs** | [Architecture](./tech/architecture.md) · [Data flows](./tech/data-flows.md) · [Tech index](./tech/README.md) |

> This PRD supersedes the earlier "decentralized Patreon" framing. The new product direction is
> a social network first, with Patreon/OnlyFans-style private creator monetization built into the
> same posting, profile, feed, and relationship model. Code changes come later.

---

## 1. Summary

**WalrusUrchin** is a social media app where users can publish public posts, follow each other, comment,
react, repost, share, bookmark, message, and discover creators in a feed. Creators can choose whether each
post, blog, media drop, or file is public, followers-only, subscriber-only, pay-per-view, time-limited, or
part of a paid bundle.

The product should feel familiar to users of X and Facebook for everyday social behavior, while giving
creators the monetization depth of Patreon, OnlyFans, Substack, and private file communities. Public content
drives discovery. Paid and private content lives one step deeper, behind transparent access rules.

The Sui Stack remains the product foundation:

- **Sui** records creator profiles, access objects, subscriptions, purchases, tips, and revenue splits.
- **Seal + Walrus** secure private posts, blogs, media, and downloadable files.
- **Harbor** is the mandated managed Walrus+Seal gateway for the MVP.
- **SuiNS** provides portable creator handles and profile identity.
- **zkLogin / Passkey / Enoki** provide passwordless onboarding and sponsored gas.
- **memwal / Walrus Memory** can later power creator assistants, fan support, and personalized social memory.

The north star is a creator-owned social graph: creators grow reach through public posts, convert fans
inside the same app, and keep portable relationships and access records beyond a single centralized platform.

---

## 2. Problem & opportunity

Social reach, paid communities, private media, and file delivery are fragmented across different products.
Creators often post publicly on one platform, monetize on another, send files somewhere else, and manage
private fans through spreadsheets, chat servers, or manual links. Fans get a fragmented experience and
little transparency into what they own or can access.

| Pain point                                   | Current behavior                                                                               | WalrusUrchin's answer                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Public reach and paid community are split    | Creators build audience on X/Facebook, then push fans to Patreon/OnlyFans/Substack/Discord     | One profile, one feed, one content model: public posts and paid/private posts live together          |
| Paid content lacks portability               | Fans pay for access, but the access usually works only inside one platform                     | Subscription and entitlement objects are portable Sui assets with stable access fields               |
| Private files are hard to secure             | Creators share drive links or platform-hosted files with weak revocation and unclear ownership | Private files are encrypted and access-gated through Seal/Walrus/Harbor                              |
| Platform lock-in is high                     | Followers, paid members, content, and monetization rules are trapped in one app                | Creator identity, access records, and revenue events can be made verifiable and composable           |
| Wallet friction blocks mainstream users      | Seed phrases, gas, and token handling are too hard for normal social users                     | Passwordless sign-in and sponsored gas hide crypto complexity                                        |
| Safety and moderation become harder at scale | Public + private UGC creates spam, abuse, piracy, and illegal-content risk                     | Moderation, reporting, block/mute, visibility controls, and policy enforcement are core requirements |

**Opportunity:** build a social product where everyday engagement is simple and familiar, but monetization,
private access, and creator ownership are native instead of bolted on.

---

## 3. Product principles

- **Social first, monetization native.** Users should understand the feed without knowing crypto. Paid
  unlocks should feel like a natural content visibility option, not a separate product.
- **Public by default, private by explicit choice.** Every creator action should make visibility and pricing
  clear before publishing.
- **Creator ownership without user friction.** On-chain access matters, but normal users should not manage
  seed phrases, gas, or raw objects.
- **Transparent purchases.** Fans should always see price, renewal status, access duration, refund policy,
  and what content/file they unlock.
- **Privacy and security by design.** Private content must be encrypted before storage. Public metadata must
  be intentionally chosen because metadata can still leak sensitive context.
- **Safety is a product requirement.** Public social features and private media require reporting, moderation,
  creator controls, and policy enforcement from the MVP onward.
- **Progressive decentralization.** Harbor-managed access is acceptable for testnet MVP; the long-term path
  should move more access enforcement into public on-chain policy where feasible.

---

## 4. Goals & non-goals

### Goals

- **G1** — Provide core social media functions: profiles, follows, feeds, public posts, comments/replies,
  reactions, repost/share, bookmarks, search/discovery, and notifications.
- **G2** — Let users publish with clear visibility modes: public, followers-only, subscriber-only, PPV,
  paid file, unlisted, scheduled, and draft.
- **G3** — Support creator monetization through memberships, paid posts, private blogs, file sales, tips,
  bundles, and later paid messages/custom requests.
- **G4** — Store private blogs, private media, and files encrypted with access rules tied to subscription or
  purchase state.
- **G5** — Keep onboarding mainstream-friendly with zkLogin/passkeys, sponsored gas, and wallet-optional UX.
- **G6** — Make access and revenue events transparent, auditable, and portable where feasible.
- **G7** — Include trust and safety basics: reporting, block/mute, moderation queues, content labels,
  rate limits, takedown workflow, and admin controls.

### Non-goals (for now)

- Cloning every X/Facebook feature in the MVP. The MVP proves the core social + paid-content loop first.
- Native mobile apps in the MVP. Web-first remains the fastest path and avoids app-store monetization
  constraints during validation.
- Custodial fiat balances or a full fiat on-ramp/off-ramp. Start with SUI/USDC-like settlement and revisit
  after product-market validation.
- Unmoderated hosting. The app must support private content, but illegal, abusive, non-consensual, or policy
  violating content needs active controls.
- Mainnet launch in the MVP. Testnet first while Harbor/memwal and the access model mature.

---

## 5. Personas

- **Social creator (Maya).** Posts public commentary, images, clips, and updates to grow her audience. She
  wants to convert engaged followers into paid subscribers without sending them off-platform.
- **Private creator (Nova).** Publishes private blogs, behind-the-scenes media, downloadable packs, and
  paid file drops. Wants clear access tiers, PPV, and fewer chargeback/support problems.
- **Fan/supporter (Leo).** Browses public content, follows creators, comments, unlocks occasional paid posts,
  subscribes to favorites, and wants all purchased content in one library.
- **Casual social user (Ari).** Mostly uses the app like a normal social network: follows friends/creators,
  posts publicly, comments, reacts, reposts, and bookmarks.
- **Moderator/admin.** Reviews reports, handles spam/abuse, manages content restrictions, and protects the
  app from illegal or policy-violating content.
- **Third-party app.** Wants to honor creator memberships or paid entitlements for events, communities,
  learning, or partner experiences without a private integration deal.

---

## 6. Core product loops

### 6.1 Social discovery loop

1. User publishes a public post.
2. Post appears in follower feeds and discovery surfaces.
3. Other users react, comment, repost/share, bookmark, or follow.
4. Creator gains audience and social proof.
5. More public content improves recommendations and conversion opportunities.

### 6.2 Paid conversion loop

1. Creator publishes a public teaser or preview.
2. Fan opens the paid/private post, blog, file, or collection.
3. Fan sees price, access duration, creator, and unlock terms.
4. Fan subscribes, buys PPV, tips, or purchases a file.
5. Access is granted and private content decrypts client-side.
6. Fan receives library access and renewal/unlock notifications.

### 6.3 Creator publishing loop

1. Creator writes a post/blog or uploads media/files.
2. Creator chooses visibility, price, tier, teaser, comments, and labels.
3. Private content is encrypted and stored through Harbor/Walrus.
4. Public metadata and access requirements are published.
5. Creator tracks reach, engagement, paid unlocks, subscriptions, and revenue.

### 6.4 Retention loop

1. Notifications bring users back for replies, mentions, reposts, new creator posts, expiring subscriptions,
   and new paid drops.
2. Feed and library make it easy to resume public browsing or paid content.
3. Creator analytics help creators publish better public-to-paid funnels.

---

## 7. Feature requirements

**P0** = MVP. **P1** = fast-follow. **P2** = later.

### 7.1 Profiles, identity, and social graph

- **P0** User profile: display name, handle, bio, avatar, banner, links, follower/following counts, joined
  date, and public content tabs.
- **P0** Creator mode: same account can enable monetization, tiers, paid content, and creator dashboard.
- **P0** Follow/unfollow, block, mute, report user, and account-level privacy controls.
- **P0** Profile sections: public posts, paid posts/previews, files/collections, subscriptions, and about.
- **P0** Wallet-optional account onboarding with zkLogin/passkey and sponsored gas.
- **P1** SuiNS-first creator identity (`creatorname.sui`) and free user subnames where feasible.
- **P1** Verification badges for official creators, organizations, and high-risk impersonation targets.
- **P1** Lists, circles/close-friends-style audiences, pages, and communities.
- **P2** Portable social graph export/import and third-party client support.

### 7.2 Publishing and content types

- **P0** Short text posts, long-form blog posts, image/video/audio attachments, file attachments, and link
  previews.
- **P0** Visibility modes: public, followers-only, subscriber-only, PPV, paid file, unlisted, scheduled,
  and draft.
- **P0** Public teaser/preview for paid content: title, excerpt, thumbnail, price, tier requirement, and
  unlock CTA.
- **P0** Edit, delete/hide, comment toggle, repost/share toggle, content warnings, and sensitive-content
  labels.
- **P0** Content library for fans: purchased posts, active subscriptions, files, receipts, and expirations.
- **P1** Polls, albums, collections, scheduled drops, livestream recording uploads, and pinned posts.
- **P1** Creator-controlled comment moderation per post.
- **P2** Collaborative posts, event pages, and richer media studio workflows.

### 7.3 Feeds, search, and discovery

- **P0** Home feed from followed accounts.
- **P0** Creator/profile feeds with public and paid-preview content.
- **P0** Discovery feed for public posts and public paid previews.
- **P0** Search for users, handles, posts, hashtags/topics, and public files/collections.
- **P0** Pagination/infinite scroll, empty states, loading states, and abuse-resistant rate limits.
- **P1** Ranking/recommendation model using follows, engagement, topic signals, and safety filters.
- **P1** Trending topics, hashtag pages, creator categories, and external share previews.
- **P2** Creator marketplace and recommendation APIs for partner clients.

### 7.4 Social interactions

- **P0** Like/reaction, comment/reply, repost/share, bookmark/save, mention, and report content.
- **P0** Notifications for follows, comments, replies, mentions, reposts, paid unlocks, tips, and renewals.
- **P0** Basic anti-spam: rate limits, duplicate detection, suspicious-link controls, and account throttles.
- **P1** Quote reposts, nested comment threads, saved collections, media tagging, and richer reaction sets.
- **P1** Direct messages: 1:1 and group messages using Seal-encrypted blobs where feasible.
- **P2** Paid DMs, custom requests/commissions, live chat, events, and community spaces.

### 7.5 Paid/private access and monetization

- **P0** Monthly subscriptions with tier benefits, expiry, renewal state, and subscriber-only posts/files.
- **P0** Pay-per-view posts and blogs with one-time unlocks.
- **P0** Paid file drops: creator uploads a file/pack, fan buys access, file decrypts/downloads in-app.
- **P0** Tips on posts and profiles with optional message and visible/private tip settings.
- **P0** One-time/lifetime access option for selected content or tiers.
- **P0** Transparent purchase confirmation: price, platform/pass-through fees where applicable, access
  duration, content scope, and refund/support policy.
- **P0** Revenue split events for creator, collaborators, platform fee, and optional referrer.
- **P1** Bundles, trials, coupons, upgrades/downgrades, gift subscriptions, and paid collections.
- **P1** Paid DMs/custom requests with delivery/acceptance states.
- **P2** Transferable premium membership/access NFTs with creator resale royalties.

### 7.6 Private blogs, files, and media vaults

- **P0** Long-form private blog editor with public preview and encrypted body.
- **P0** File vault for paid/private downloads: size/type limits, metadata, access tier, and purchase state.
- **P0** Client-side encryption before upload for private media/files; never store plaintext private content
  in public storage, logs, analytics, or memwal.
- **P0** Download/view controls: allow download, view-only where feasible, expiration, and clear revocation
  limitations.
- **P0** Content status states: draft, processing, published, hidden, reported, restricted, expired, and
  deleted-by-creator.
- **P1** Watermarking, download limits, collections, bulk upload, and creator export.
- **P2** Creator APIs for automated drops and integrations.

### 7.7 Creator dashboard

- **P0** Dashboard cards: followers, paid subscribers, paid unlocks, tips, revenue, pending actions, and
  recent content performance.
- **P0** Content manager: filter by public/private/paid/draft/reported, edit visibility, manage files, and
  review access rules.
- **P0** Earnings ledger from on-chain payment/revenue events.
- **P0** Subscriber list with tier, expiry, renewal status, and export constraints.
- **P1** Funnel analytics from public post -> paid preview -> unlock/subscription.
- **P1** Audience segmentation, scheduled campaigns, and notification targeting.
- **P2** Team roles, agency accounts, payout routing, and creator CRM.

### 7.8 Trust, safety, and moderation

- **P0** Community guidelines, prohibited content policy, and enforcement states.
- **P0** Report user/content/file, block, mute, restrict comments, hide replies, and creator moderation tools.
- **P0** Admin moderation console: report queue, content/user status, evidence links, action history, and
  appeal notes.
- **P0** Sensitive-content labeling and age/region gating requirements must be decided before any production
  private-media launch.
- **P0** DMCA/copyright and non-consensual-content response workflow.
- **P0** Public surfaces can hide/restrict content even if underlying encrypted blobs remain on decentralized
  storage.
- **P1** Automated spam/abuse signals, moderator assignment, escalation queues, and transparency logs.
- **P2** User-selectable moderation filters and community-level moderation.

### 7.9 Portability and composability

- **P0** Access objects use stable fields (`creator_id`, `content_id`, `tier`, `expires_ms`, `service_id`) so
  partner apps can verify access.
- **P0** Public creator profile and public content metadata should be exportable.
- **P1** Token-gated external surfaces such as events, communities, Discord/Telegram roles, and learning
  platforms.
- **P1** Transferable premium access with marketplace resale and creator royalties where legal/appropriate.
- **P2** Third-party clients that can read public social content and honor paid-access objects.

### 7.10 AI and memwal

- **P1** Creator concierge: draft ideas, posting cadence, content organization, audience insights, and support
  triage.
- **P1** Fan support assistant: answer questions about purchased content, subscriptions, renewals, and creator
  FAQs.
- **P2** Personalized feed support using opt-in memory only. Never place private media plaintext or sensitive
  paid content into memwal.

---

## 8. Content and access model

| Mode                 | Who can see preview?  | Who can see full content?           | Typical use                                      |
| -------------------- | --------------------- | ----------------------------------- | ------------------------------------------------ |
| Public               | Everyone              | Everyone                            | Normal social posts, public clips, announcements |
| Followers-only       | Followers             | Followers                           | Semi-private updates, community posts            |
| Subscriber-only      | Everyone or followers | Active tier subscribers             | Private posts, blogs, media drops                |
| Pay-per-view         | Everyone or followers | Buyers with entitlement             | One-off premium post/video/blog                  |
| Paid file            | Everyone or followers | Buyers/subscribers with file access | Download packs, PDFs, source files, archives     |
| Unlisted             | Link holders          | Link holders or eligible buyers     | Soft launch, private shares                      |
| Draft/scheduled      | Creator/team          | Creator/team until publish          | Work in progress                                 |
| Time-windowed/rental | Everyone or followers | Buyers/subscribers until expiry     | Events, rentals, limited drops                   |
| Community/group      | Group members         | Group members or paid group members | Clubs, cohorts, private communities              |

Implementation rule: public previews can be indexed and shared. Private bodies, private media, and paid files
must be encrypted before storage and unlocked only after access is verified.

---

## 9. Monetization model

All monetization should share one purchase UX and one access ledger:

| SKU                       | Access mechanism                            | Notes                                             |
| ------------------------- | ------------------------------------------- | ------------------------------------------------- |
| Subscription              | Expiring tier membership/access object      | Monthly or creator-defined period                 |
| Lifetime/one-time tier    | Non-expiring access object                  | Use carefully; creator must understand permanence |
| Pay-per-view              | Content-specific entitlement                | Post/blog/video unlock                            |
| Paid file                 | File or collection entitlement              | Download/view access                              |
| Tip                       | Direct transfer + event                     | Optional message; no content access by default    |
| Bundle                    | Several content/tier/file entitlements      | Discounted collections                            |
| Paid DM/custom request    | Request/payment state + private delivery    | P1+ because of dispute and moderation complexity  |
| Transferable premium pass | Transferable access object + royalty policy | P2; requires resale and compliance review         |

Fee best practice:

- Show creator price, platform fee, network/storage/key-server pass-through, and final fan total before
  purchase.
- Keep the platform fee low, fixed, and visible.
- Do not promise exact competitor fee comparisons in-product unless verified at launch time.
- Store revenue split events so creators and fans can audit payouts.

---

## 10. Architecture implications

Full technical detail remains in [`architecture.md`](./tech/architecture.md), but the social pivot adds new
product-level requirements:

- **Feeds and discovery need an indexer/cache.** On-chain data is not enough for a fast social timeline.
  Public post metadata, follows, reactions, comments, and rankings need queryable indexes.
- **Private content needs metadata discipline.** Titles, thumbnails, prices, labels, and previews may be
  public even when the body/file is encrypted.
- **Social graph can start off-chain with on-chain anchors.** Follows and reactions may be indexed app data
  in the MVP, while creator profiles, paid access, purchases, and revenue events remain on-chain where
  transparency matters most.
- **Access checks must be reusable.** The same entitlement should unlock in-app viewing, file downloads, and
  later third-party surfaces.
- **Moderation must control app surfaces.** Decentralized storage does not remove the need to hide, restrict,
  label, or delist content from WalrusUrchin UI.

Core stack remains:

- **`apps/web`** — Vite + React SPA; social UI, feed, publishing, payments, and client-side decrypt.
- **`apps/api`** — trust boundary for Enoki sponsorship, Harbor access, memwal adapter, indexing, moderation,
  notifications, and background reconciliation.
- **Move contracts** — profiles, tiers, subscriptions, entitlements, tips, revenue splits, creator caps, and
  future transferable access.
- **Harbor/Walrus/Seal** — encrypted private media/file/blog storage for the MVP.

---

## 11. MVP scope & roadmap

### P0 MVP — "social feed + paid private unlocks"

1. Passwordless account onboarding with sponsored gas.
2. User/creator profiles with follow graph, block/mute/report, and creator mode.
3. Public posting: text, media preview, link preview, comments/replies, reactions, repost/share, bookmarks.
4. Home feed from followed accounts and public discovery feed.
5. Creator tiers, paid previews, subscriber-only posts, PPV posts, paid files, and tips.
6. Private blog/file encryption through Harbor/Walrus/Seal.
7. Fan library for purchased/unlocked content and active subscriptions.
8. Creator dashboard for content, followers, subscribers, revenue, and unlock analytics.
9. Basic notifications.
10. Safety baseline: reports, admin queue, takedown/restriction states, sensitive labels, rate limits.

### P1 — "creator communities and retention"

- Direct messages, group messages, paid DMs/custom requests.
- Bundles, coupons, trials, gift subscriptions, paid collections, and upgrade/downgrade flows.
- Hashtags/topics, trending, ranking, creator recommendations, quote reposts, richer comments.
- Creator comment moderation, audience segmentation, scheduled drops, and notification campaigns.
- SuiNS/subname polish, creator verification, and external token-gated roles/events.
- memwal creator concierge and fan support assistant.

### P2 — "portable social creator network"

- Transferable premium passes and resale royalties.
- Third-party clients and partner app access verification.
- Communities/pages/groups with moderation roles.
- Creator APIs, automation, and marketplace.
- Mainnet hardening, self-managed Seal path, and stronger decentralized access enforcement.

---

## 12. Success metrics

- **Social adoption:** DAU/MAU, new accounts, activated profiles, follows created, posts created.
- **Engagement:** feed sessions, comments, reactions, reposts/shares, bookmarks, notification open rate.
- **Creator conversion:** public preview -> paid unlock rate, follower -> subscriber rate, active creators
  earning revenue.
- **Revenue:** GMV, paid unlocks, active subscriptions, tips, creator take-home percentage, renewal rate.
- **Private access reliability:** unlock success rate, median unlock latency, failed decrypt rate, support
  tickets per 1,000 unlocks.
- **Safety:** report volume, moderation response time, repeat offender rate, spam block rate, appeal outcomes.
- **Portability:** access objects used outside the core app, exports completed, third-party integrations.

---

## 13. Risks & mitigations

| Risk                                                     | Severity    | Mitigation                                                                                                                  |
| -------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Scope creep from combining X/Facebook + Patreon/OnlyFans | High        | Keep P0 focused on feed, profiles, basic social actions, paid posts/files, and safety baseline                              |
| Trust and safety burden for public + private UGC         | High        | Policy before launch, reporting/admin tools in P0, age/region/sensitive-content decisions before production                 |
| Illegal, abusive, pirated, or non-consensual content     | High        | Strict prohibited-content policy, upload controls, reporting, moderation queue, takedown workflow, restricted app surfaces  |
| Feed/indexing complexity                                 | High        | Start with following feed + simple discovery; build indexer/cache before ranking algorithms                                 |
| Metadata privacy leaks                                   | High        | Minimize public metadata for private content; make teaser fields explicit; warn creators what is public                     |
| Harbor is alpha/testnet; APIs may change                 | High        | Keep `StorageProvider` abstraction; pin versions/config; isolate Harbor calls in backend adapter                            |
| Service-key custody in Harbor Path A                     | High        | Disclose custody model; restrict service keys to backend; roadmap self-managed Seal Path B                                  |
| Encrypted content revocation is soft                     | Medium      | Short session TTLs, content versioning, explicit revocation limits, rotate keys for sensitive drops                         |
| Payment/refund disputes                                  | Medium      | Clear purchase terms, receipts, access duration, support flow, and dispute policy                                           |
| Crypto onboarding confusion                              | Medium      | Hide gas/token complexity; support wallet connect for crypto-native users but default to zkLogin/passkeys                   |
| Regulatory/tax/age restrictions for private media        | Medium/High | Decide allowed content categories, KYC/age-gating requirements, settlement currency, and jurisdiction policy before mainnet |
| memwal privacy risk                                      | Medium      | Never store private media plaintext or sensitive paid content in memory; opt-in only for personalization                    |

---

## 14. Open questions

- What content categories are allowed, restricted, or prohibited, especially for private media?
- Is adult/sensitive creator content in scope, and if yes, what age verification and regional compliance is
  required before launch?
- Which social functions are mandatory in P0: quote reposts, DMs, groups, pages, hashtags, polls, stories,
  livestreams, or events?
- Should follows, reactions, comments, and bookmarks be on-chain, off-chain indexed app data, or hybrid?
- What is the default settlement currency: SUI, USDC, or both?
- Who pays Walrus storage and renewal costs: creator, fan, platform treasury, or a blended model?
- What platform fee basis points are acceptable and how should collaborator/referrer splits work?
- What refund policy applies to subscriptions, PPV, paid files, and paid DMs/custom requests?
- Should creators be required to use SuiNS, or should SuiNS be optional/upgradeable?
- What creator verification policy is needed to prevent impersonation?
- How much creator/fan data export is required for "ownership" in v1?
- What is the first ranking strategy beyond a chronological following feed?

---

## 15. Prior art and positioning

Functional inspiration:

- **X / Facebook** — public profiles, feeds, follows, posts, comments, reactions, shares, discovery.
- **Patreon / OnlyFans / Substack** — memberships, private posts, paid blogs, creator subscriptions.
- **Discord / Telegram communities** — fan communities, messaging, gated roles.
- **Farcaster / Lens** — portable social graph and composable social clients.
- **Fundsui / Galliun** — Sui/Walrus proof-of-pattern for paid encrypted creator content and direct tipping.

Positioning:

**WalrusUrchin is not only a Patreon alternative. It is a social network where public reach, paid fandom,
private creator media, and encrypted file access share the same identity, feed, and access model.**

_Technical references for stack components remain in the [tech docs index](./tech/README.md). Architecture
and data-flow docs should be updated after this PRD is accepted._
