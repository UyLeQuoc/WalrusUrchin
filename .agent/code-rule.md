# Coding Rules

## General Rules

- Code must be type-safe, clear, maintainable, and easy to review.
- Prefer explicit types for public APIs, shared utilities, contract bindings, request/response DTOs, and cross-package boundaries.
- Avoid `any`. If an unknown value is unavoidable, validate or narrow it before use.
- Use clear, descriptive variable and function names that explain intent, not implementation trivia.
- Keep functions small and focused. A function should do one thing well.
- Optimize for correctness first, then performance, then convenience.
- Always consider best practices for performance, security, accessibility, testability, and long-term maintenance.
- Do not add abstractions until they remove real duplication or simplify a real workflow.
- Do not duplicate business logic across frontend, backend, SDK code, or contracts.
- Shared logic used by both frontend and backend must live in shared packages.
- Shared schemas, DTOs, constants, validation helpers, Sui object types, transaction builders, and SDK helpers must live in shared packages when reused.
- Keep secrets, private keys, service credentials, and privileged signing logic out of frontend code.
- Validate all external input at system boundaries.
- Prefer schema validation for API payloads, config, environment variables, and untrusted data.
- Use predictable error handling. Return useful errors without leaking secrets or private implementation details.
- Make async logic explicit and resilient. Handle retries, timeouts, idempotency, and partial failures where relevant.
- Avoid hidden global state. Use shared state only when it is needed and well-scoped.
- Keep comments short and useful. Comment why something exists when the reason is not obvious.
- Remove dead code introduced by your own changes.
- Match existing project conventions before introducing new ones.

## Frontend Rules

- Split UI and logic into components and hooks. This is mandatory for non-trivial frontend code.
- Components should focus on rendering and user interaction.
- Hooks should contain reusable state, side effects, data fetching, transaction orchestration, and business logic.
- Keep large screens composed from smaller, named components.
- Do not put complex async flows directly inside JSX components when they can be extracted into hooks or shared helpers.
- Keep form state, validation, loading states, and error states explicit.
- Use shared DTOs, schemas, constants, and SDK helpers instead of redefining frontend-only copies.
- Keep frontend code free of server secrets and privileged credentials.
- Encrypt private content before upload. Never rely on UI gating alone for paid or private content.
- Make UI states complete: loading, success, empty, error, retry, unauthorized, and expired access.
- Keep accessibility in mind: semantic HTML, keyboard support, labels, focus states, and readable contrast.
- Avoid unnecessary rerenders. Memoize only when there is a real performance reason.
- Prefer clear data flow over clever state management.
- Keep components testable by separating pure logic from rendering where possible.

## Backend Rules

- Backend code must be organized into clear layers.
- Separate routing, validation, authentication, authorization, business logic, storage adapters, external service clients, and persistence/indexing logic.
- Routes should be thin. They should validate input, authorize the request, call services, and return a response.
- Business rules should live in service-layer code, not directly inside route handlers.
- External integrations such as Harbor, Enoki, memwal, Sui RPC, and storage providers should be wrapped behind typed clients or adapters.
- All request and response shapes must be typed and validated.
- Never trust client-provided sender addresses, object IDs, prices, package targets, or access claims without verification.
- Sponsorship and privileged actions must verify the authenticated user, allowlisted targets, and expected transaction intent.
- Make write operations idempotent when retries or indexer replays are possible.
- Log enough to debug production issues, but never log private keys, bearer tokens, decrypted content, OAuth tokens, or sensitive user data.
- Use explicit config loading and validation. Fail fast when required config is missing.
- Keep background jobs and cron-like reconciliation separate from request handlers.
- Prefer dependency injection for service clients so tests can mock external systems cleanly.

## Contract Rules

- Move contracts must keep authorization explicit through capability objects and owned/shared object rules.
- Split contract code into multiple modules/files when it improves clarity, testability, or ownership boundaries.
- Keep monetization, access policy, profile, tier, subscription, PPV, bundle, and event logic separated where practical.
- Contract entry functions must validate price, ownership, expiry, tier access, and object relationships before mutating state.
- Revenue splits must be deterministic, transparent, and emitted through events.
- Access objects should have stable, queryable fields so external apps can compose with them.
- `seal_approve` logic must be side-effect-free and suitable for dry-run access checks.
- Do not put paid checks, transfers, or mutations inside `seal_approve`.
- Prefer small, well-named helper functions for repeated Move logic.
- Add Move tests for authorization, expiry, payment splits, resale rules, and failure paths.

## Shared Package Rules

- Shared code must be the single source of truth for reused business logic.
- Put shared validation schemas, DTOs, generated contract bindings, transaction builders, constants, and SDK adapters in shared packages.
- Frontend and backend should import shared logic instead of copying implementations.
- Keep shared packages framework-agnostic when possible.
- Shared functions must have stable names, precise types, and focused responsibilities.
- Avoid importing frontend-only or backend-only dependencies into shared packages unless the package is explicitly scoped for that side.

## Testing Rules

- Add tests when changing business logic, access control, payment logic, encryption/decryption helpers, API validation, or contract behavior.
- Prefer focused tests that verify the actual rule being changed.
- Test failure paths, not only success paths.
- Use contract tests for Move authorization, expiry, splits, and object ownership behavior.
- Use API tests for validation, authorization, idempotency, and external-client adapter behavior.
- Use frontend tests for hooks, important UI states, and critical user flows.
- Do not rely only on manual testing for critical payment or access-control flows.

## Security Rules

- Private content must be encrypted before storage.
- Treat plaintext paid content uploaded to public storage as a security incident.
- Never ship service keys, Enoki secret keys, Harbor credentials, memwal delegate keys, or private Sui keys to the browser.
- Never store decrypted paid content in shared logs, analytics, memory systems, or public caches.
- Keep access checks tied to on-chain state wherever possible.
- Use short-lived session/access material where practical.
- Be explicit about revocation limits: already-decrypted content may remain available to the user who decrypted it.

## Performance Rules

- Avoid repeated network calls when one typed batch call or cached read is enough.
- Keep expensive operations out of render paths.
- Use pagination, streaming, or chunking for large lists, media, and indexer reads.
- Avoid unnecessary encryption/decryption work. Reuse short-lived session authorization only within safe limits.
- Prefer deterministic, idempotent background reconciliation over fragile one-off side effects.

## Review Rules

- Every change should be explainable in terms of the user workflow or system invariant it supports.
- Review for type safety, secret leakage, duplicated logic, missing validation, poor naming, and misplaced business logic.
- Review frontend changes for component/hook separation.
- Review backend changes for layered design and thin route handlers.
- Review contract changes for authorization, object ownership, expiry, and event correctness.
- Do not merge code that weakens encryption, access control, or payment transparency.
