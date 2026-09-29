# FID: 402 from any direct provider is misreported as a SavantCode-backend out-of-credits error

**Filename:** `FID-2026-0929-002-direct-provider-402-out-of-credits-misfire.md`
**ID:** FID-2026-0929-002
**Severity:** high
**Status:** verified
**Created:** 2026-09-29
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

In direct-provider mode (no SavantCode backend; `DIRECT_PROVIDER` or
`INFERENCE_BASE_URL` set), a provider-side 402 Payment Required is caught by
`isOutOfCreditsError()` and rewritten to `OUT_OF_CREDITS_MESSAGE` — *"Out of
credits. Please add credits at https://savant-code.com/usage"* — plus
`setInputMode('outOfCredits')`, which replaces the entire input box with the
`OutOfCreditsBanner` (backend balance polling, "Press Enter to buy more
credits" → savant-code.com). The operator hit this on the APInex free lane: a
provider account-state refusal was surfaced as a claim that *our* (currently
nonexistent) backend had charged out, with UI lockout and a billing CTA for a
product surface that is not deployed. The misclassification makes the provider's
own honest message invisible.

## Environment

- **OS:** Windows (win32), Git Bash
- **Language/Runtime:** TypeScript monorepo, Bun ≥ 1.3.11
- **Tool Versions:** bun 1.3.14 (engines-pinned)
- **Commit/State:** `main` working tree 2026-09-29 (post-FID-2026-0928-013)

## Detailed Description

### Problem

The operator's 2026-09-29 session ended with an error stating they were out of
credits while running entirely on direct providers with no Savant backend
involved. The message text, the input lockout, and the buy-credits CTA all
reference the SavantCode backend's billing system.

### Expected Behavior

In direct-provider mode, a provider 402 must surface as **provider account
state**, not backend billing: quote the provider's message (it explains itself
— which upstream, which account), name the provider, point at `/health` for a
live reading and `/provider` to switch. No backend-branded message, no
`outOfCredits` input-mode lockout, no buy-credits CTA, no balance polling —
those belong to real backend-mode credit exhaustion only. (In genuine backend
mode the current behavior is correct and stays.)

### Root Cause

`isOutOfCreditsError()` (`cli/src/utils/error-handling.ts:37-48`) keys on
`statusCode === 402` alone. Its only consumers,
`handleRunCompletion`/`handleRunError` (`cli/src/hooks/helpers/send-message/
run-results.ts:95-102, 218-225`), apply it unconditionally — no
`isDirectProviderMode()` check — so any gateway's 402 is converted into the
backend-branded message and the full `outOfCredits` UI mode. The codebase
already has the correct tool (`quotaHint`,
`cli/src/hooks/helpers/send-message/fallback-hints.ts` — FID-2026-0919-026)
and the correct mode gate (`isDirectProviderMode`,
`cli/src/utils/env.ts:96-105`), but the 402 branch predates both and never
learned about them.

### Evidence

- `cli/src/utils/error-handling.ts:37-48` — `isOutOfCreditsError`:
  `statusCode === 402` is the entire predicate.
- `cli/src/utils/error-handling.ts:225` — `OUT_OF_CREDITS_MESSAGE = "Out of
  credits. Please add credits at ${defaultAppUrl}/usage"` with
  `defaultAppUrl = env.NEXT_PUBLIC_SAVANT_FREE_APP_URL ||
  'https://savant-code.com'` (`:13-14`).
- `cli/src/hooks/helpers/send-message/run-results.ts:95-102` and `:218-225` —
  the only `isOutOfCreditsError` consumers; both do
  `updater.setError(OUT_OF_CREDITS_MESSAGE)` +
  `useChatStore.getState().setInputMode('outOfCredits')` +
  `invalidateActivityQuery(usageQueryKeys.current())` with no provider check.
- `cli/src/utils/keyboard-actions.ts:47-62` — `outOfCredits` mode blocks all
  input; Enter → `open-buy-credits`.
- `cli/src/components/chat-input-bar.tsx:166-168` — the whole input box is
  replaced by `<OutOfCreditsBanner />`.
- `cli/src/components/out-of-credits-banner.tsx:76-78` — the banner
  *does* check `IS_SAVANT_FREE || isDirectProviderMode()` and renders null in
  direct mode, so the operator saw the error banner but never the credits
  banner — two surfaces disagreeing about the same state.
- Prior art: `dev/fids/archive/FID-2026-0917-005` (model-picker 402
  passthrough — same class, one producer fixed, classifier left unconditional)
  and the 2026-07-19 debugging session (identical misfire from
  `useUsageMonitor`/`OutOfCreditsBanner`, fixed with direct-mode bypasses —
  the run-results path was missed because the model-picker defect masked it).
- FID-2026-0919-026 built `quotaHint` for exactly this class
  (`isQuotaRefusal` matches `insufficient_quota`/`insufficient balance`
  message/code shapes) but a bare 402 without those substrings never reaches
  it — the 402 branch wins first.

## Impact Assessment

### Affected Components

- `cli/src/utils/error-handling.ts` (classifier or message construction)
- `cli/src/hooks/helpers/send-message/run-results.ts` (both 402 branches)
- `cli/src/hooks/helpers/send-message/fallback-hints.ts` (hint extension)
- New/extended test: `cli/src/hooks/helpers/__tests__/send-message-error-specialized.test.ts`
  (already covers the 402 → `outOfCredits` path; gains direct-mode pins)
- New test: `cli/src/utils/__tests__/error-handling-direct-402.test.ts`
  (classifier/selector pins)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround — in direct mode the run dies,
      the input box is locked to a billing action for an undeployed backend,
      and the provider's actionable message (which quota, which fix) is
      discarded. Misleads the operator about the system's architecture (a
      "backend" that does not exist).
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Fix the **consumer**, minimally (Law 13: extend the existing hint seam rather
than adding a second message-construction path; keep the classifier as-is so
genuine backend-mode behavior is byte-identical):

1. In `run-results.ts` (both branches), route the 402 through
   `isDirectProviderMode()` first:
   - **Direct mode:** build the error from the provider's own payload via a
     new `providerOutOfCreditsError(error, providerId)` selector in
     `fallback-hints.ts` — message text = the provider's message (raw body
     message via the existing `extractApiErrorDetails` path), with provider
     name + `/health` pointer appended in the established
     `${label} quota refusal: ${note} Run /health…` shape; fall back to a
     neutral generic (`"The provider returned 402 Payment Required"`) when the
     body carries nothing; **no** `setInputMode('outOfCredits')`, **no** usage
     invalidation, normal error finalize.
   - **Backend mode:** existing `OUT_OF_CREDITS_MESSAGE` flow unchanged.
2. Extend `quotaHint`'s refusal matcher to treat any 402 status as a quota
   refusal (it already has the provider id + note plumbing) so registry-declared
   notes flow into the direct-mode message; providers without a note get the
   neutral generic (never a backend-branded line).

### Steps

1. `cli/src/utils/error-handling.ts`: add `providerOutOfCreditsError(error,
   providerId)` (exported, pure selector: direct-mode message construction,
   fail-silent fallback) — the seam lives beside `isOutOfCreditsError` so both
   credit surfaces share one truth.
2. `cli/src/hooks/helpers/send-message/fallback-hints.ts`: widen
   `isQuotaRefusal` to accept `statusCode/status === 402`.
3. `cli/src/hooks/helpers/send-message/run-results.ts`: gate both 402 branches
   on `isDirectProviderMode()`; direct → `providerOutOfCreditsError(...)` +
   `quotaHint(...)` appendHint (existing pattern), no input-mode flip, no
   usage invalidation; backend → unchanged flow.
4. Tests: (a) new `cli/src/utils/__tests__/error-handling-direct-402.test.ts`
   — selector returns provider message + label + /health pointer, neutral
   fallback when body is empty, never contains `savant-code.com`; (b) extend
   `send-message-error-specialized.test.ts` — direct-mode 402 does NOT flip
   input mode and does NOT emit `OUT_OF_CREDITS_MESSAGE`; backend-mode 402
   keeps both (regression pin for today's correct path).

### Verification

- Both new/extended suites pass with pasted output.
- `typecheck cli` exit 0; `gate: quality` clean.
- Call-graph: `providerOutOfCreditsError` has exactly one production caller
  set (the two 402 branches); grep pasted into the FID at implementation.
- Manual live probe (operator, NEEDS-REVIEW): APInex free-lane 402 renders the
  provider message without lockout.

> Contract rule (FID-2026-0918-006): every promised test artifact names its
> repo-relative `*.test.ts(x)` path and appears as a declared `gate: test`
> below.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/error-handling-direct-402.test.ts
- gate: test cli/src/hooks/helpers/__tests__/send-message-error-specialized.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:cd607de014f1488a6cb30df4b6596b086b3ac9637bad7767f9fda7e2474d8191
- verified: 2026-09-29T17:44:40.848Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/error-handling-direct-402.test.ts: exit 0
- test cli/src/hooks/helpers/__tests__/send-message-error-specialized.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Misclassification chain measured end-to-end (evidence above): bare
  402 → backend-branded message + UI lockout in a mode with no backend; two
  UI surfaces disagree (banner gates on direct mode, error path does not);
  provider message discarded; prior art shows the same class fixed twice at
  the producer while the classifier stayed unconditional.
- **GREEN:** Consumer-side mode gate + provider-honest message via the
  existing hint seam; classifier untouched; backend path byte-identical.
- **AUDIT:** Declared gates re-run live by `fid:verify --write` (stamped):
  `[PASS] typecheck cli (exit 0)` · `[PASS] test
  cli/src/utils/__tests__/error-handling-direct-402.test.ts (exit 0)` ·
  `[PASS] test
  cli/src/hooks/helpers/__tests__/send-message-error-specialized.test.ts
  (exit 0)` · `[PASS] quality (exit 0)`. Law 4 call-graph: `grep -n
  providerOutOfCreditsError` → exactly the two declared production call sites
  (`run-results.ts:104` in `handleRunCompletion`, `run-results.ts:243` in
  `handleRunError`), both gated by `isDirectProviderMode()`; definition at
  `error-handling.ts:61`. Full cli workspace suite re-run: 3881 pass / 0 fail
  (backend-mode 402 regression pin green — `outOfCredits` flip still asserted
  in the no-DIRECT_PROVIDER case). Manual re-read of both branches post-prettier:
  direct path → provider message + hint, finalize, no `setInputMode`, no
  `invalidateActivityQuery`; backend path byte-identical to pre-change.
  Live 402 reproduction on a direct lane is operator-run (NEEDS-REVIEW).
- **ADVERSARIAL:** Challenge — should `isOutOfCreditsError` itself become
  mode-aware? Rejected: it is a pure predicate with test coverage asserting
  402 ⇒ true; making it env-dependent (Law: no environment-dependent guards,
  LEARNINGS 2026-08-23) would poison both callers' semantics for no gain. The
  consumer is where the mode boundary is real. Challenge — what if a direct
  provider legitimately mirrors our 402 semantics? None do; 402 semantics are
  backend-mode by definition in this product (FID-2026-0806-009 gate makes
  backend calls unreachable in direct mode).
- **CHANGE DELTA:** Implementation pass ≈ 1.1% of FID text — selector +
  matcher widening + two gated branches + two test files.

### Missed Questions

1. **Why not make `isDirectProviderMode` injectable for testability?** The
   existing suites already stub `process.env` for direct-mode pins
   (`env.test.ts` pattern); `isDirectProviderMode` reads a cached CLI env —
   tests set the env before first call, which the existing suite proves works.
   No new seam needed (YAGNI).
2. **Does `IS_SAVANT_FREE` need the same gate?** Yes — covered: the free
   variant runs direct by construction, and the free SPEC already marks
   `outOfCredits` "never triggered"; the direct-mode branch handles it, and
   the existing banner gate (`IS_SAVANT_FREE || isDirectProviderMode()`)
   confirms the intended contract.
3. **What about `getSavantFreeRateLimitErrorMessage`-style 402 handling in
   free mode?** Out of this FID's blast radius: free mode has no credits
   concept on its gates (428/429/409/410 classes only). If a free-lane 402
   ever appears, the direct-mode branch renders it honestly — which is the
   fix.
4. **Keep `invalidateActivityQuery` in direct mode?** No — it polls a backend
   usage endpoint that FID-2026-0806-009 already gates off; dropping it in the
   direct branch is consistent, not new behavior.

## Resolution

- **Closed Date:** —
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Archived:** —

## Lessons Learned

To be recorded at closure: error classifiers that encode a product's billing
model must be mode-scoped at the consumer — a bare status code is a claim
about *someone's* account state, and in a multi-provider product the someone
is whatever the active transport is.
