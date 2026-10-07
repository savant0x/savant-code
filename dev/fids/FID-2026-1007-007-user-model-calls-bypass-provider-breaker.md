# FID: User model calls bypass the provider breaker

**Filename:** `FID-2026-1007-007-user-model-calls-bypass-provider-breaker.md`
**ID:** FID-2026-1007-007
**Severity:** high
**Status:** verified
**Created:** 2026-10-07 17:00
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

An open provider circuit breaker refuses user-initiated model turns before a
physical request. The operator requires that the local breaker never stop a
user from trying a selected model. A provider may still reject the request;
Savant must report that real response rather than impose its own lockout.

## Environment

- **OS:** Windows
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Commit/State:** `main` with pre-existing local changes; this record owns
  only T162 paths in `SCOPE.md`.

## Detailed Description

### Problem

The 2026-10-07 saved chat records KiosAPI breaker refusals at 16:15 and 16:22,
with 14 minutes still remaining at 16:38. Unorouter was rate limited at
16:40 and then refused locally for 30 minutes at 16:46. The exported Markdown
conversation omitted the `userError` field that carries these refusals; the
saved `chat-messages.json` contains them.

### Expected Behavior

Every user-initiated turn sends at least its first physical request to the
selected provider. The breaker may suppress an automatic retry after repeated
transient failures, but it must never preflight-block that first request.

### Root Cause

`runWithClassifiedRetry` calls `breaker.checkCooldown()` at the top of every
attempt and throws `ProviderBoundaryBlockedError` when the circuit is open,
before `params.create()` runs. The default policy allows two attempts; three
transient physical failures across as few as two turns open a 30-minute gate.
`prompt-agent-stream.ts` keys that breaker by provider connection, so switching
models on the same connection does not escape the gate. Separate providers can
each open independently, matching the KiosAPI and Unorouter observations.

### Evidence

```text
Saved chat, 2026-10-07 (times EDT, userError summaries only):
16:15 kiosapi/deepseek-v4.1-flash-free: breaker open, 30min remaining
16:22 kiosapi/deepseek-v4.1-flash-free: breaker open, 30min remaining
16:38 kiosapi/deepseek-v4.1-flash-free: breaker open, 14min remaining
16:40 unorouter/deepseek-v4-flash:free: upstream rate limit, retry in 25s
16:46 unorouter/deepseek-v4-flash:free: breaker open, 30min remaining

packages/agent-runtime/src/provider-boundary/classified-stream-retry.ts:73-79
  checkCooldown() precedes params.create(); refusal throws locally.
packages/agent-runtime/src/provider-boundary/provider-circuit-breaker.ts:18-20
  threshold 3; cooldown base 30 minutes.
packages/agent-runtime/src/prompt-agent-stream.ts:168-172,182-187
  one breaker key per provider connection; passed into user-turn retry.
```

The saved chat does not retain every physical response leading to the KiosAPI
open state, so its exact upstream failure sequence remains unproven. The
local refusals and their source path are directly observed.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/provider-boundary/classified-stream-retry.ts`
- `packages/agent-runtime/src/__tests__/provider-circuit-breaker.test.ts`
- `packages/agent-runtime/src/__tests__/provider-breaker-user-calls.test.ts`
- `packages/agent-runtime/src/__tests__/prompt-agent-stream-forwarding.test.ts`
- User-facing model turns through `prompt-agent-stream.ts`

### Risk Level

- [x] High: user model requests are blocked locally for 30 minutes

## Proposed Solution

### Approach

Let the first physical attempt of every user turn bypass the breaker gate.
Keep failure classification and outcome recording. When the breaker is open,
stop an optional automatic retry and surface the actual classified provider
error. A successful user attempt closes and resets the breaker. No new option
or alternate provider path is needed: `runWithClassifiedRetry` has exactly the
user-turn and user-turn recovery call sites in production.

### Steps

1. Remove the pre-request cooldown refusal from `runWithClassifiedRetry`.
2. Suppress an automatic retry when the breaker is open, while preserving the
   bounded retry for a closed breaker and the actual provider error.
3. Add regression tests proving an open breaker still sends a user request,
   success resets it, and a further upstream refusal is reported as that
   provider failure rather than a local lockout. Update the production-call
   forwarding test to assert a fourth physical request after the breaker opens.

### Verification

- `packages/agent-runtime/src/__tests__/provider-breaker-user-calls.test.ts`
  must exercise the shipped retry boundary with an already-open breaker.
- `packages/agent-runtime/src/__tests__/prompt-agent-stream-forwarding.test.ts`
  must prove the production entry point makes another physical request after
  three transient failures.
- Typecheck the agent-runtime workspace and run the named test suite.
- Grep the production call graph and prove both `prompt-agent-stream.ts`
  call sites still reach the updated boundary.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/provider-circuit-breaker.test.ts
- gate: test packages/agent-runtime/src/__tests__/provider-breaker-user-calls.test.ts
- gate: test packages/agent-runtime/src/__tests__/prompt-agent-stream-forwarding.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:8e895c472147ba3040485f814d222f5e25d727fdb11ec8c87bcf7cc11e940a8d
- verified: 2026-10-07T21:30:47.468Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/provider-circuit-breaker.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/provider-breaker-user-calls.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/prompt-agent-stream-forwarding.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Saved user errors and the pre-request throw identify the defect.
  Production callers are `prompt-agent-stream.ts:182,199`; tests exercise
  the FSM but currently assert a blocked request at test line 236.
- **GREEN:** Admit every first physical request; use the open state only to
  curtail automatic retries; report the upstream verdict.
- **AUDIT:** The approach preserves the two-attempt ceiling and the 429
  one-retry rule, and introduces no new provider request when a turn already
  reached that ceiling. No production caller can reach the old preflight
  refusal after the planned edit.
- **ADVERSARIAL:** A successful provider response after the breaker opens must
  close it. A failed response must remain visible as a classified provider
  error. Both cases require explicit tests; a mocked FSM test alone is
  insufficient.
- **CHANGE DELTA:** First plan pass; no oscillation.

### Loop 2 — GREEN / AUDIT / ADVERSARIAL

- **GREEN:** Removed the pre-request `checkCooldown()` call from the shipped
  retry boundary. The open state now suppresses only an optional automatic
  retry; the physical request runs and its actual response is classified.
- **AUDIT:** Both production call sites in `prompt-agent-stream.ts` still use
  `runWithClassifiedRetry`. A repository search found no production caller of
  the provider breaker cooldown gate. The separate context-compactor breaker
  still gates background compaction, not a user model turn.
- **ADVERSARIAL:** The new open-breaker tests prove a successful request
  closes the breaker and a rejected 429 makes one physical request and reports
  the provider verdict. The production stream test proves a fourth user turn
  reaches the provider after the breaker opened on prior failures.
- **Verification:** Agent-runtime suite 1906 pass, 0 fail; full repository
  `bun run test` exited 0; full `bun run typecheck`, `bun run lint:md`,
  `bun run quality:report`, targeted ESLint and Prettier, and `git diff --check`
  exited 0. The SDK Windows process test failed in earlier runs but passed in
  the final full repository run. No SDK code was changed.
- **CHANGE DELTA:** Updated the obsolete integration expectation from local
  refusal to a fourth physical provider request. Updated source comments to
  match the new boundary behavior.

### Missed Questions

1. Could model switching evade the block? Only when it changes provider
   connection; the key excludes model ID.
2. Could the user still see a failure? Yes, if the provider itself rejects
   the request. That response must be surfaced with its real reason.
3. Does this weaken the automatic retry budget? No; opening the breaker
   disables optional retry while preserving the first user attempt.

## Resolution

- **Closed Date:** Pending local commit authorization.
- **Fix Description:** Every user model turn makes its first provider request;
  an open breaker only prevents an optional automatic retry and preserves the
  upstream error.
- **Tests Added:** `provider-breaker-user-calls.test.ts` (two cases); updated
  production stream integration assertion in
  `prompt-agent-stream-forwarding.test.ts`.
- **Verification Evidence:** Local gates above, with a machine receipt below.
- **Archived:** Pending.

## Lessons Learned

A provider-health breaker may reduce automatic background traffic, but a user
action must not be converted into a long local denial without a physical
provider response.
