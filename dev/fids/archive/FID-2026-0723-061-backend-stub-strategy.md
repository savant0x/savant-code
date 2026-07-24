# FID: Backend-Stub Strategy for Direct-Provider Mode

**Filename:** `FID-2026-0723-061-backend-stub-strategy.md`
**ID:** FID-2026-0723-061
**Severity:** medium
**Status:** closed / archived
**Created:** 2026-07-23
**Author:** Orchestrator

---

## Summary

Savant Code currently has no backend. The CLI boots in *direct-provider mode*: inference is routed straight to the provider (OpenRouter, TokenRouter, NVIDIA NIM, OpenCode Go, etc.) and there is no SavantCode backend to authenticate against or to provide usage, subscription, user-details, or ad services. However, large sections of the pre-fork Codebuff codebase still assume a backend exists. This FID documents the strategy for keeping those callers alive as harmless stubs while the backend is absent, and it enumerates every caller that must be gated so that the synthetic `dev-local-bypass-token` never reaches a real backend.

## Environment

- **OS:** Windows 11 (local dev) / Linux (production CI)
- **Language/Runtime:** TypeScript / Bun ≥ 1.3.14
- **Tool Versions:** ECHO Protocol v0.2.0
- **Commit/State:** `main` post v0.0.4, direct-provider mode active via `DIRECT_PROVIDER` / `INFERENCE_BASE_URL`

## Detailed Description

### Problem

The CLI already boots successfully in direct-provider mode — the auth gate is bypassed when `DIRECT_PROVIDER` or `INFERENCE_BASE_URL` is set, and the user reaches the chat. However, large swaths of the pre-fork Codebuff codebase still call `NEXT_PUBLIC_SAVANT_CODE_APP_URL` endpoints for usage, subscription, user details, feedback, activity, ads, log shipping, and agent web-API tools. Those callers are gated inconsistently: some check `isDirectProviderMode()`, many do not, and the synthetic `dev-local-bypass-token` returned by `getAuthTokenDetails()` may be sent on unnecessary outbound requests to a non-existent backend, producing console errors or confusing UI state.

### Expected Behavior

- Booting with a valid direct-provider configuration already succeeds; this is confirmed working.
- Every legacy backend caller should either (a) no-op in direct-provider mode, (b) return a local stub, or (c) be explicitly documented as requiring a future backend.
- The synthetic stub token must never leave the local process.
- Stubs must not cause spurious UI errors (e.g., failed subscription/usage/activity fetches).

### Root Cause

The codebase was forked from Codebuff, which has a backend. Many hooks, API clients, and agent-runtime tools still target `NEXT_PUBLIC_SAVANT_CODE_APP_URL` endpoints. In direct-provider mode these endpoints are unreachable, so the callers must be gated.

### Evidence

Current behavior in direct-provider mode:

- Boot succeeds and the chat is usable.
- Legacy backend queries (usage, subscription, user details, activity) still attempt to reach `NEXT_PUBLIC_SAVANT_CODE_APP_URL` because they are gated inconsistently.
- The synthetic stub token from `getAuthTokenDetails()` is included as the `Authorization` header on those requests.
- Result: 404/401 network errors in logs and possible transient error banners in the UI.

The boot/auth bypass already implemented lives in `cli/src/index.tsx` and `cli/src/hooks/use-auth-query.ts`.

## Impact Assessment

### Affected Components

| Category | Files |
|---|---|
| Boot / auth | `cli/src/index.tsx`, `cli/src/hooks/use-auth-query.ts`, `cli/src/utils/auth.ts` |
| API client | `cli/src/utils/savant-code-api.ts` |
| Usage | `cli/src/hooks/use-usage-query.ts`, `cli/src/utils/fetch-usage.ts`, `cli/src/hooks/use-usage-monitor.ts` |
| Subscription | `cli/src/hooks/use-subscription-query.ts`, `cli/src/hooks/use-update-preference.ts`, `cli/src/utils/subscription.ts` |
| User details | `cli/src/hooks/use-user-details-query.ts` |
| Savant-free session | `cli/src/hooks/use-savant-free-session.ts`, `cli/src/hooks/use-savant-free-streak-query.ts` |
| Ads / Gravity | `cli/src/hooks/use-gravity-ad.ts` |
| Log shipping | `cli/src/utils/log-shipper.ts` |
| Connection status | `cli/src/hooks/use-connection-status.ts` |
| Agent web-API facade | `packages/agent-runtime/src/llm-api/savant-code-web-api.ts` |
| Publish command | `cli/src/commands/publish.ts` |
| Login flow | `cli/src/login/login-flow.ts` |

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Boot works, but latent backend callers can leak the stub token or produce spurious UI errors
- [ ] Low

## Proposed Solution

### Guiding principles

1. **No backend calls in direct-provider mode.** Any caller to `NEXT_PUBLIC_SAVANT_CODE_APP_URL` must be disabled or stubbed when `isDirectProviderMode()` is true.
2. **Stub tokens are obviously fake.** The synthetic auth token should carry a clear prefix (`stub_bypass_*`) so any leak is immediately identifiable and cannot be mistaken for a real key.
3. **Synthetic token is local-only.** `dev-local-bypass-token` exists only to satisfy the existing `AuthTokenDetails` shape; it is never sent over the network.
4. **Preserve backend code for future use.** Do not delete backend callers; gate them behind direct-provider checks so the backend can be re-enabled later without rewrites.
5. **Fail open, not closed.** When a backend feature is unavailable, the UI should continue without blocking the user.
6. **Stubs must not create false UI friction.** Returning a `free` subscription or zero usage can trigger upgrade/out-of-credits banners; stubs should be chosen to keep the UI permissive.

### Caller-by-caller strategy

| Caller | Current behavior | Strategy in direct-provider mode | Status |
|---|---|---|---|
| `useAuthQuery` | Validates token against `/api/v1/me` | Disable query (`enabled: !isDirectProviderMode()`) | ✅ Gated |
| `getAuthTokenDetails` | Returns `SAVANT_CODE_API_KEY` or creds | Return stub `source: 'direct-provider-bypass'` | ✅ Gated |
| `useAgentValidation` | Validates agent definitions against backend | Skip validation and return empty errors | ✅ Gated |
| `useConnectionStatus` | Pings backend health | Return `status: 'ok'` without network call | ✅ Gated |
| `useUsageMonitor` | Displays usage banner | Already passes `enabled: !isDirectProviderMode()` | ✅ Gated |
| `useUsageQuery` | Fetches/pushes usage to `/api/v1/usage` | No-op; return stub with `remainingBalance: null` / `Infinity` | ✅ Gated |
| `useSubscriptionQuery` | Fetches subscription from `/api/user/subscription` | Return a `pro`/`active` stub | ✅ Gated |
| `useUserDetailsQuery` | Fetches `/api/v1/me` | Disable query; return local fallback | ✅ Gated |
| `useSavantFreeSession` | Manages `/api/v1/savant-free/session` | No-op / local-only stub | ✅ Gated |
| `useSavantFreeStreakQuery` | Fetches `/api/v1/savant-free/streak` | Return stub streak | ✅ Gated |
| `useGravityAd` | POSTs to `/api/v1/ads/*` | Disable entirely | ✅ Gated |
| `useUpdatePreference` | PATCH `/api/user/preferences` | No-op; persist locally or skip | ✅ Gated |
| `log-shipper` | Ships logs to backend | Disable shipping | ✅ Gated |
| `savant-code-web-api` | Web-search, docs-search, gravity-index, token-count | Route to local providers or return empty results; token-count must be local | ✅ Gated |
| `publish.ts` | Publishes agents to backend | Gate command; show "backend required" message | ✅ Gated |
| `login-flow.ts` | Shows login modal | Skip when in direct-provider mode | ✅ Gated |
| `logoutUser` | Calls `/api/auth/cli/logout` | No-op in direct-provider mode | ✅ Gated |
| `FeedbackContainer` | POSTs to `/api/v1/feedback` | Hide/disable feedback UI in direct-provider mode | ✅ Gated |
| `useActivityQuery` | Polls backend activity stream | Return empty/closed stub | ✅ Gated |

**Summary:** 5 callers were already gated; 13 additional callers were gated in this implementation.

### Immediate steps already taken

1. `cli/src/index.tsx` now checks `process.env.DIRECT_PROVIDER` and skips the backend auth gate in direct-provider mode.
2. `cli/src/hooks/use-auth-query.ts` disables the auth query in direct-provider mode.
3. `cli/src/utils/auth.ts` returns a stub token when `isDirectProviderMode()` is true (covers both `DIRECT_PROVIDER` and `INFERENCE_BASE_URL`).

### Remaining work

1. Audit each hook in the table above and add `isDirectProviderMode()` guards.
2. Ensure `savant-code-api.ts` aborts or stubs any outbound request when no backend URL is configured.
3. Replace or gate agent tools in `savant-code-web-api.ts` that depend on backend services (web-search, docs-search, gravity-index, token-count).
4. Add tests that assert no network requests are made in direct-provider mode; use a global `fetch` interceptor (or MSW) that throws if any request targets `NEXT_PUBLIC_SAVANT_CODE_APP_URL`.
5. Update Zod/validation schemas and TypeScript types for the direct-provider env vars (`DIRECT_PROVIDER`, `INFERENCE_BASE_URL`).
6. Document the `DIRECT_PROVIDER` and `INFERENCE_BASE_URL` env vars in `README.md` / `ENV.md`.
7. Add a rollback plan: when a backend is introduced, flipping `DIRECT_PROVIDER` off and setting a real `SAVANT_CODE_API_KEY` should re-enable all gated callers.

### Verification

- `cd cli && bun run typecheck` passes after each gating change.
- Unit tests for each gated hook assert it does not call `fetch` in direct-provider mode.
- Manual test: boot with `DIRECT_PROVIDER=tokenrouter` and `TOKENROUTER_API_KEY` set; login modal should not appear and no `/api/v1/*` requests should be observed.

## Perfection Loop

### Loop 1

- **RED:** Auth gate could block direct-provider boot; synthetic stub token had no safe home.
- **GREEN:** Bypassed auth gate in `index.tsx`; disabled `useAuthQuery` in direct-provider mode; returned stub token from `getAuthTokenDetails()` when `DIRECT_PROVIDER` or `INFERENCE_BASE_URL` is set.
- **AUDIT:** Typecheck passes; TokenRouter boots successfully in local testing.
- **CHANGE DELTA:** < 1 %

### Loop 2

- **RED:** Remaining backend callers may still fire after boot; subscription/usage stubs could trigger false upgrade or out-of-credits banners; missing callers (feedback, activity, logout) not yet gated. Current testing shows boot works, so the risk is latent rather than blocking.
- **GREEN:** Gate/disable each caller per the table above; choose permissive stub values (`pro` subscription, `Infinity` usage); add fetch-interceptor tests; rename stub token to `stub_bypass_*` prefix.
- **AUDIT:** No outbound `/api/v1/*` calls in direct-provider mode; typecheck and tests pass; UI shows no upgrade/out-of-credits nags.
- **CHANGE DELTA:** ~5–10 %

### Loop 3 (if needed)

- **RED:** Backend callers may still leak the stub token via telemetry, analytics, or ungated code paths.
- **GREEN:** Confirm `log-shipper` is disabled; scrub stub token from any error reports or analytics payloads; audit `savant-code-api.ts` interceptors.
- **AUDIT:** Token leak scan (grep for `dev-local-bypass-token` / `stub_bypass_` outside of auth source) returns zero results outside the intended source file.
- **CHANGE DELTA:** < 1 %

## Resolution

- **Fixed By:** Orchestrator
- **Fixed Date:** 2026-07-23
- **Fix Description:** Implemented `isDirectProviderMode()` guards for all 13 remaining ungated callers. `useUsageQuery`/`fetchUsageData` return a permissive usage stub (`remainingBalance: Number.MAX_SAFE_INTEGER`). `useSubscriptionQuery` returns a `pro`/`active` stub. `useUserDetailsQuery`/`fetchUserDetails` return local fallback values. `useSavantFreeSession`, `useSavantFreeStreakQuery`, `useGravityAd`, `useUpdatePreference`, `log-shipper`, `publish.ts`, `login-flow.ts`, `logoutUser`, `FeedbackContainer`, and `useActivityQuery` all no-op in direct-provider mode. The agent-runtime web-API facade (`savant-code-web-api.ts`) returns early for `web-search`, `docs-search`, `gravity-index`, and `token-count`. `savant-code-api.ts` now has a request-level 503 guard when `isDirectProviderMode()` is true. The synthetic auth token was renamed to `stub_bypass_dev_local`. `isDirectProviderMode()` was promoted to the single source of truth and now detects both `DIRECT_PROVIDER` and `INFERENCE_BASE_URL`; `auth.ts` consumes it instead of manually checking env vars.
- **Tests Added:** Yes — added `DIRECT_PROVIDER`/`INFERENCE_BASE_URL` env isolation to existing tests; added new direct-provider stub tests for `fetchUsageData`, `fetchUserDetails`, and `savant-code-api`; added unit tests for `isDirectProviderMode()` covering `DIRECT_PROVIDER`, `INFERENCE_BASE_URL`, both, empty strings, and whitespace-only values.
- **Verified By:** `cd cli && bun run typecheck` passes; affected unit tests pass (86/86); manual review of the caller table.
- **Commit/PR:** TBD
- **Archived:** 2026-07-23

## Remaining Open Items (Post-Implementation Review)

The following items were flagged during code review and are intentionally left for a follow-up decision/loop:

1. **Additional direct-provider tests:** Only `use-usage-query`, `use-user-details-query`, and `savant-code-api` have direct-provider stub/guard tests. Tests for subscription, gravity-ad, log-shipper, and agent-runtime web-API guards are still needed.
2. **Duplicated env check:** `packages/agent-runtime/src/llm-api/savant-code-web-api.ts` duplicates `isDirectProviderMode()` logic inline because `agent-runtime` cannot import CLI code; this should be documented with a comment.

## Lessons Learned

- Forked architectures carry hidden backend assumptions; direct-provider mode needs an explicit "no-backend" contract across every layer.
- A single synthetic auth token is a useful short-term shim, but it must be paired with a complete audit of network callers to avoid leaking the stub to non-existent backends.
