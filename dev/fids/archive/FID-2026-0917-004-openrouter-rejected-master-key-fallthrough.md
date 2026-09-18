# FID-2026-0917-004 — Rejected OpenRouter master key silently falls through to a stale regular key

## Metadata

- **Filename:** `FID-2026-0917-004-openrouter-rejected-master-key-fallthrough.md`
- **ID:** FID-2026-0917-004
- **Severity:** high
- **Status:** verified
- **Created:** 2026-09-17

## Summary

`resolveAndCacheOpenRouterApiKey()` treats a rejected master-key exchange
(HTTP 4xx) as a soft failure: it logs a warning, then falls through to
`OPENROUTER_API_KEY`. When that fallback holds a stale or revoked key, the
CLI silently authenticates with a dead credential and the operator sees a
vendor 401 `{"error":{"message":"User not found.","code":401}}` at
chat-completions time — an error that names neither the dead key nor the
failed exchange that selected it. This is the second time this exact
fallthrough has produced a hard-to-diagnose outage (the first,
FID-2026-0917-001, added the missing diagnostics but deliberately kept the
fallthrough).

## Root cause

`sdk/src/impl/openrouter-key-resolver.ts` makes no distinction between "the
exchange endpoint is temporarily unavailable" and "the configured master key
was rejected." A 401/403 is definitive — the credential is invalid.
Continuing to a regular key does not recover; it substitutes a different
(often stale) credential for the one the operator actually configured.

Live evidence captured from the operator's machine during this audit (hashes,
not values):

- Running process `OR_MASTER_KEY` md5 `31fd91d2…` matched **no file on disk**
  — root `.env.local` holds `389dee02…`, the `cli/.env.local` value was
  removed by FID-2026-0917-003, and the registry holds no `OR_MASTER_KEY`.
- Running process `OPENROUTER_API_KEY` md5 `9b65b08c…` was non-empty despite
  being deleted from `HKCU\Environment` and removed from `cli/.env.local`.
- `DIRECT_PROVIDER=openrouter` and
  `INFERENCE_BASE_URL=https://openrouter.ai/api/v1` (both set in
  `cli/.env.local`), and `SAVANT_CODE_IS_BINARY` absent — so the live CLI is
  `bun dev`, whose entry already carries the FID-2026-0917-003
  `--no-env-file` fix at `cli/package.json:17`.

Failure chain, each link evidenced: stale master key → `POST /api/v1/keys`
401 → warn-and-fall-through → stale regular key → `POST /chat/completions`
→ `User not found.`

## Proposed solution

Fail closed on auth rejection. In path 1, when the exchange responds 401 or
403, negative-cache (`cachedKey = null`) and return `undefined` — do not fall
through to path 2. The existing caller chain (`getModelForRequest` →
`resolveActiveProviderKey` at `sdk/src/impl/model-provider.ts:176-185`)
already fails closed with a templated missing-key message for an active
provider, so the operator receives an accurate error instead of a dead key
being sent upstream. Returning `undefined` preserves the existing
`string | undefined` contract — no new throw sites, no caller breakage.

Non-auth failures (429, 5xx, network) keep the existing fallthrough: a
still-valid regular key is legitimately usable while the exchange endpoint
is unavailable.

The negative cache is already invalidated by environment-signature change
and by `resetOpenRouterApiKeyCache()` (the `/provider` store path), so
storing a fresh key recovers without a restart.

## Affected components

- `sdk/src/impl/openrouter-key-resolver.ts` — the path-1 fallthrough gate
- `sdk/src/impl/model-provider.ts:176-185` — `resolveProviderKey` (caller; fail-closed)
- `sdk/src/impl/model-provider/default-inference.ts:51` — `resolvedOpenRouterKey` consumer

## Verification

- `bun run typecheck` (sdk) exit 0
- resolver suite: 5 new regression tests + 7 existing, 0 fail
- eslint 0 warnings, prettier clean, `lint:md` exit 0
- `quality:report` PASS

## Verification Gates

- gate: typecheck sdk
- gate: test sdk/src/impl/openrouter-key-resolver.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:ab8755d2ff1635182be141df11e96ceb977a8882425e3af4b66d9a50fc37c3fe
- verified: 2026-09-18T00:31:51.681Z
- typecheck sdk: exit 0
- test sdk/src/impl/openrouter-key-resolver.test.ts: exit 0
- quality: exit 0
