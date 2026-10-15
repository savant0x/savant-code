# FID: Failure classification before retry + bounded-probe circuit breaker

**Filename:** `FID-2026-1005-006-failure-classification-and-circuit-breaker.md`
**ID:** FID-2026-1005-006
**Severity:** high
**Status:** closed
**Created:** 2026-10-05 17:14
**Automation level:** 3
**YAGNI-Compliance:** Verified

> **Operator directive (verbatim):** *"what are the top 5 most impactful"* and
> *"Draft FIDs for the top 5 ideas, ranked, following the FID template"* —
> raised in the 2026-10-05 reference-project review session ("review a few
> projects saved locally for ideas"). Rank 2 of 5. Register item: T139.

## Summary

Provider-facing call paths retry failures without first classifying them.
Rate limits and administrative refusals are treated like transient network
faults: retries burn quota on errors that will not succeed, and one free
gateway misbehavior can take down an entire session. This FID introduces an
explicit failure taxonomy applied before any retry decision, a per-provider
circuit breaker (`closed` / `open` / `half_open`) whose cooldown schedules a
bounded probe instead of a blind re-entry, and a shape-validation rule for
retry policies so a configuration a consumer reads differently can never
silently produce non-finite delays. Design sources: `resources/OmniRoute-v3.8.51/docs/OMNIROUTE_PROVIDER_FAILOVER.md`
and the measured failure lessons in `resources/dsh-our-free-model-main/README.md`.

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Files:** `packages/agent-runtime` (call/retry path),
  `common/src/providers/provider-quota-policy.ts` (`quotaEpisode`),
  `common/src/providers/provider-quota.ts`
- **Commit/State:** worktree dirty (18 modified files from prior sessions,
  uncommitted); this FID is new
- **Governance:** ECHO Protocol v0.1.2-single-agent
  (`dev/echo-v0.1.2-single-agent.md`), FID-bound, Laws 1/3/4

## Detailed Description

### Problem

1. **Uniform retry treatment.** Timeouts, 5xx, 429, and hard refusals
   (auth, invalid request, model-unavailable) share one retry path. Hard
   refusals cannot succeed on retry; retrying them multiplies quota burn and
   latency for a guaranteed failure.
2. **No breaker state.** A provider that fails for a window keeps receiving
   traffic at the same rate; there is no exclusion window, no bounded probe,
   and no success-driven reset.
3. **Retry-policy shape fragility.** The reference project measured a real
   session-killer: a policy object whose timing keys were nested where the
   consumer read them top-level produced `undefined * 2^n = NaN` backoff
   delays, and the persistent session log rejected the non-finite values —
   one recoverable transient fault escalated into a dead conversation.

### Expected Behavior

Every failure is classified before any retry decision; only transient
failures may retry or fail over. A repeatedly failing provider enters a
cooldown with a bounded probe (success closes the circuit, failure reopens).
Retry-policy configuration is validated against the exact shape the consumer
reads, so a malformed policy fails at load time — loudly — instead of
degrading into non-finite delays at runtime.

### Root Cause

Retry logic evolved as a single loop over "the call failed"; nothing in the
type or the call sites distinguishes *why* it failed, and policy objects are
passed through without shape validation.

### Evidence

```text
resources/OmniRoute-v3.8.51/docs/OMNIROUTE_PROVIDER_FAILOVER.md:
  "Transient failures such as timeouts, network errors, rate limits, and
   provider 5xx responses may fail over. Authentication errors, permission
   errors, invalid requests, unavailable models, and unknown failures are
   not retried blindly."
  "Circuit states are closed, open, and half_open. A cooldown schedules a
   bounded probe; a successful probe closes the circuit and a failed probe
   reopens it."

resources/dsh-our-free-model-main/README.md (measured):
  "429 移出可重试状态码（同一回合不再自动重试三次）" — 429 removed from the
   retryable set; one turn no longer auto-retries three times.
  "providerRetryPolicy() 会被原样保存并使用 ... 将这三项嵌套在 backoff:{} 中，
   调度器读到 undefined，于是 undefined * 2^n = NaN，而持久会话日志会直接
   拒绝非有限数值——一个可恢复的瞬时故障因此导致整轮对话报废" — a nested
   policy shape produced NaN delays and killed whole conversations.
  "探测整轮全为 429 后按 30→120 分钟指数退避（手动 reprobe/出口变化/启动轮
   不受限）" — all-429 probe rounds back off 30→120 min; manual reprobe is
   never throttled.

Our side (ground truth, this tree):
  common/src/providers/provider-quota-policy.ts — quotaEpisode(...)
  common/src/providers/provider-quota.ts — quota fetch returns
    { status: 'unavailable', detail: ... } shapes; failure classes are
    stringly-typed
  dev/fids/archive/FID-2026-1003-002 — gateway reconnect event replay
    (the reconnect surface a breaker must cooperate with)
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime` — provider call/retry path and policy objects
- `common/src/providers/provider-quota-policy.ts` — `quotaEpisode` retry and
  backoff decisions
- Gateway reconnect behavior (post FID-2026-1003-002) — breaker state must
  not fight event replay on reconnect

### Risk Level

- [ ] Critical
- [x] **High** — on free gateways (the operating environment of record) a
  misbehaving endpoint currently degrades whole sessions; retries on
  non-retryable refusals also burn shared quota for nothing
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Classify, then decide. A pure classification function maps each failure to
one of three classes — **transient** (timeout, network, 429, 5xx — may
retry/fail over), **administrative** (auth, permission, invalid request,
model-unavailable — never retried; surfaced immediately with the reason),
and **unknown** (conservative: treated as administrative for retry purposes,
logged for taxonomy growth). Retry policy, failover, and breaker state all
consume the class, never the raw error.

### Steps

1. **Failure taxonomy:** a discriminated class + reason type produced at the
   provider boundary; all call sites switch on class.
2. **Breaker:** per provider (and per connection where the registry
   distinguishes them), states `closed` / `open` / `half_open`; consecutive
   transient failures trip the breaker; cooldown schedules ONE bounded
   probe; probe success closes, probe failure reopens with backoff
   (30→120 min exponential, per the measured reference behavior); manual
   reprobe and startup checks are never throttled.
3. **Retryable-set policy:** 429 and timeouts retry with bounded attempts;
   administrative failures never retry in-loop. A quota-class refusal quotes
   the registry `note` (existing one-truth behavior preserved).
4. **Policy shape validation:** retry-policy objects validated at load time
   against the flat shape the scheduler actually reads; a mismatch throws at
   config load, before any request can observe a non-finite delay.
5. **Reconnect cooperation:** breaker state is advisory on an explicit
   reconnect path (a fresh connection attempt is the bounded probe), so
   event replay after reconnect (FID-2026-1003-002) is unaffected.

### Verification

Classification is a pure function — exhaustive table tests over the error
surface, including the "unknown stays conservative" rule. Breaker behavior
is tested with injected failures through the existing DI seams (dependency
injection, no module mocking): trip after N consecutive transients,
administrative failure does NOT trip, bounded probe reopens/closes, backoff
bounds respected, manual reprobe exempt. Policy-shape validation has a
negative test reproducing the nested-keys defect from the reference
measurement.

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below.

> Declared now so promise and gate are paired from creation (FID-2026-0918-006).
> They become live enforcement at the `fixed`/`verified` flip
> (FID-2026-0823-009); a `created`/`converged` record is outside the C1–C3
> contract.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck common
- gate: test packages/agent-runtime/src/__tests__/failure-classification.test.ts
- gate: test packages/agent-runtime/src/__tests__/provider-circuit-breaker.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:68eb65800df83d79afc7486d71811093f98ba0a95d51b632ecd8cf8e801a6f1e
- verified: 2026-10-06T04:19:06.164Z
- typecheck packages/agent-runtime: exit 0
- typecheck common: exit 0
- test packages/agent-runtime/src/__tests__/failure-classification.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/provider-circuit-breaker.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Three issues cataloged (uniform retry treatment, no breaker
  state, retry-policy shape fragility). Call-graph check for the proposal:
  the retry path and `quotaEpisode` are live call sites today
  (`common/src/providers/provider-quota-policy.ts` is imported by the quota
  flow); the breaker has no existing surface, so its consumer (the provider
  call boundary in `packages/agent-runtime`) must be wired and grep-provable
  per Law 4 at implementation time.
- **GREEN:** Design converged — see "Design decisions (GREEN, Loop 1)"
  below; implementation follows that plan when this FID is actioned.
- **AUDIT:** Two independent methods at convergence: (1) static grounding —
  every named seam read or grep-proven against the live tree (citations in
  the design block); (2) manual re-read of the call sites against this
  document — which caught one overclaim: `quotaEpisode` is the episode-level
  reducer (`QuotaEpisode {level: 'unknown'|'ok'|'low'|'exhausted'}`), NOT a
  retry/backoff decision point as the draft's Affected Components implied.
  Corrected in the design block: the new breaker owns retry/backoff;
  `quotaEpisode` stays a pure level reducer (FID-2026-1005-008 evolves its
  vocabulary — coordinated there).
- **ADVERSARIAL:** Answered below.
- **CHANGE DELTA:** Converged the design (GREEN block + audit correction +
  adversarial answers); status `created` → `converged`.

### Design decisions (GREEN, Loop 1)

All seams below were read or grep-proven live at convergence (Law 1/Law 7).

1. **Grounded seams.** Blind uniform retry exists today at
   `packages/agent-runtime/src/prompt-agent-stream.ts:93` (`maxRetries: 3`,
   client-level, no classification — the problem in one line). A failover
   chain exists at `packages/agent-runtime/src/llm-api/gemini-with-fallbacks.ts`
   (a consumer the class verdict must feed). The in-tree FSM precedent is
   `packages/agent-runtime/src/context-compactor/circuit-breaker.ts`
   (`checkCooldown`/`recordResult`, DI `Logger`, `healthy|open|half-open`),
   read 0-EOF at convergence.
2. **Taxonomy** — new pure module
   `packages/agent-runtime/src/provider-boundary/failure-class.ts`:
   `FailureVerdict = { class: 'transient'|'administrative'|'unknown';
   reason: 'timeout'|'network'|'rate-limit'|'server'|'auth'|'permission'|
   'invalid-request'|'model-unavailable'|'unrecognized'; retryable: boolean }`.
   Table: timeout/network/429/5xx → `transient`; 401/403 →
   `administrative` (auth/permission); 400/422 → `administrative`
   (invalid-request); explicit model-unavailable/unknown-model 404 →
   `administrative` (model-unavailable); everything unrecognized → `unknown`,
   `retryable: false`, raw shape logged once per distinct shape (bounded)
   for taxonomy growth. Retry, failover, and breaker all consume the class,
   never raw strings.
3. **The boundary owns retries.** The classified boundary replaces the
   blind `maxRetries: 3`: client-internal retry set to 0 where configurable
   and retry becomes policy over class; where a client cannot disable its
   internal retry, its output counts as ONE boundary attempt. 429 is
   retried at most once in-turn (the measured dsh rule: 429 left the
   per-turn auto-retry set), then surfaced with the registry `note` quoted
   (one-truth quota refusal behavior preserved). Administrative verdicts
   surface immediately with their reason.
4. **Breaker** — `provider-circuit-breaker.ts` beside the taxonomy, same
   FSM shape as the in-tree precedent (`checkCooldown`/`recordResult` +
   injected `Logger`), states `closed|open|half_open` (documented synonym
   of the compaction breaker's `healthy`; unification deferred — YAGNI
   until a third consumer appears). Keyed per (provider, connection), one
   truth shared by quota probes and chat calls. Trip: N consecutive
   TRANSIENT failures (default 3, constant in the module); `administrative`
   and `unknown` verdicts neither trip nor reset (breaker state is purely
   reachability). Cooldown base 30 min, exponential to a 120 min cap on
   repeated probe failure (measured dsh schedule); `half_open` admits
   exactly ONE bounded probe — success closes + resets, failure reopens
   with escalated cooldown. Manual reprobe, startup checks, and
   exit-change events are never throttled (measured dsh rule).
5. **Policy shape validation** — `validateRetryPolicy()` checked at config
   load against the FLAT shape the scheduler reads (`maxAttempts`,
   `baseDelayMs`, `maxDelayMs`, `retryableClasses`); a nested `backoff:{}`
   shape (the measured session-killer) throws at load with the offending
   path in the message. Every delay the policy can produce is asserted
   finite at validation time.
6. **Reconnect cooperation** — breaker state is advisory on an explicit
   reconnect path: the reconnect attempt IS the bounded probe, and the
   breaker never suppresses replay of already-received events
   (FID-2026-1003-002 replay semantics untouched).

### Adversarial answers (Loop 2)

- **Does classification double-count client-internal retries?** No — the
  boundary flattens them (decision 3): one boundary attempt may contain at
  most the client's single built-in try; counters and backoff operate on
  boundary attempts only.
- **Does the breaker fight the quota monitor
  (`cli/src/utils/provider-quota-monitor.ts` → `quotaEpisode`)?** No —
  `quotaEpisode` remains a pure level reducer with no I/O or scheduling;
  the breaker gates calls. The monitor's quota probes go through the same
  boundary, so a tripped breaker also pauses probes (bounded-probe rule),
  and a probe success can close the circuit.
- **What if classification is wrong for a new provider's error shape?**
  `unknown` is retry-safe by construction (`retryable: false`) and
  breaker-neutral; the bounded raw-shape log feeds the taxonomy instead of
  guessing.

### Missed Questions

1. **Where does the breaker live for quota probes vs chat calls?** One
   breaker per (provider, connection) consumed by both — quota probes and
   chat calls fail for the same underlying reason, and two breakers would
   disagree about a provider's health. Default: shared state, one truth.
2. **Does an administrative failure reset the transient counter?** No — it
   neither trips nor resets. It says nothing about endpoint health, only
   about this request. Default chosen to keep breaker state purely about
   reachability.
3. **What about unknown error shapes from a new provider?** Classified
   `unknown`, treated as administrative for retry (never blindly retried),
   logged with the raw shape once for taxonomy growth — the conservative
   default both reference projects chose.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** e229d9a1 (local batch commit; not pushed)
- [x] **File:line ranges:** `packages/agent-runtime/src/provider-boundary/`
      — `failure-class.ts`, `retry-policy.ts`,
      `provider-circuit-breaker.ts`, `classified-stream-retry.ts`; wiring at
      `packages/agent-runtime/src/prompt-agent-stream.ts` (boundary wrap +
      blind `maxRetries: 3` removed)
- [x] **Gate output:** pasted in Code Verification Evidence
- [x] **Reproducibility:** every gate is a repo script/test path
      (Verification Gates above)
- [x] **Step statuses:** steps 1–5 `implemented` — taxonomy, breaker,
      retryable-set policy at the boundary, policy-shape validation at call
      time (loudly), reconnect cooperation by construction (the breaker
      gates new attempts only and never suppresses replay)

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code
> exists. FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (one recorded
      as-built note: the classified retry is a zero-emission generator
      adapter because `PromptAiSdkStreamFn` returns `AsyncGenerator` —
      failures surface during iteration, and a partially-emitted stream is
      never re-issued)
- [x] Typecheck/tests/lint pass — evidence below
- [x] Production call-graph evidence present: `runWithClassifiedRetry` ←
      `prompt-agent-stream.ts` (return wrap); `classifyFailure` /
      `retryDelayMs` / `checkCooldown` / `recordOutcome` ←
      `classified-stream-retry.ts`; `resolveRetryPolicy` ←
      `prompt-agent-stream.ts` (all grep-provable)
- [x] FID status reflects the actual implementation state (`verified`)

```text
bun test failure-classification provider-circuit-breaker (agent-runtime) → 40 pass / 0 fail
tsc --noEmit (agent-runtime)                                             → exit 0
tsc --noEmit (common)                                                    → exit 0
bun test prompt-agent-stream-forwarding (pin evolution, 4 tests)          → pass
bun run fid:verify …-006-… --write                                       → all declared gates exit 0 (receipt below)
```

### Loop 2 — Independent audit and self-correction

Convergence audit complete (circuit breaker: 1 iteration needed): the
static grounding leg (seams read/grepped, citations above) plus the manual
re-read leg produced one correction (the `quotaEpisode` overclaim, fixed in
the design block) and one latent defect fix (the Verification Receipt prose
was unparseable by `scripts/fid-verify.ts` — learned at FID-2026-1005-010's
stamp; the section now starts empty and is stamped at the flip).

### Loop 3 — Final convergence

Design complete: every promise pairs with a declared gate (the two named
suite paths, typecheck common + agent-runtime, quality), all three missed
questions carry explicit defaults, adversarial questions answered, YAGNI
reviewed (no generalized breaker extraction, no per-model granularity, no
config UI). Status `converged` — the correct pre-implementation status
(template rule, FID-2026-0915-004). Implementation is NOT started:
FID-bound execution.

## Resolution

- **Closed Date:** 2026-10-06; commit e229d9a1 (local, not pushed)
- **Fix Description:** Classify-then-decide at the provider boundary:
  `failure-class.ts` taxonomy, `retry-policy.ts` load-time shape validation
  (the measured nested-`backoff` defect now fails loudly at call time),
  `provider-circuit-breaker.ts` (closed/open/half_open, bounded probe,
  30→120 min exponential cooldown), `classified-stream-retry.ts` (only
  zero-emission transient failures retry; 429 at most once per turn). The
  blind `maxRetries: 3` is gone — the boundary owns retries.
- **Tests Added:** `packages/agent-runtime/src/__tests__/failure-classification.test.ts`
  + `packages/agent-runtime/src/__tests__/provider-circuit-breaker.test.ts`
  (40 tests, both declared gates); the forwarding pin evolved to
  policy-driven `maxRetries: 0` with a new malformed-policy case
- **Verification Evidence:** the Code Verification Evidence block + the
  stamped Verification Receipt below
- **Archived:** dev/fids/archive/FID-2026-1005-006-failure-classification-and-circuit-breaker.md

## Lessons Learned

Both reference projects converged on the same rule from different directions:
classify the failure before spending anything on it. The taxonomy is worth
more than the retry tuning — once the class is explicit, retry counts,
backoff, breaker trips, and user-facing error text all become policy over one
type instead of ad-hoc string matching at five call sites. The shape-
validation half is the cheap insurance: a config the consumer reads
differently is a latent session-killer, and it fails once at load time or a
thousand times at runtime.
