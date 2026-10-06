# FID: Availability verdict taxonomy and truthful quota states

**Filename:** `FID-2026-1005-008-availability-verdict-and-quota-states.md`
**ID:** FID-2026-1005-008
**Severity:** medium
**Status:** closed
**Created:** 2026-10-05 17:14
**Automation level:** 3
**YAGNI-Compliance:** Verified

> **Operator directive (verbatim):** *"what are the top 5 most impactful"* and
> *"Draft FIDs for the top 5 ideas, ranked, following the FID template"* —
> raised in the 2026-10-05 reference-project review session ("review a few
> projects saved locally for ideas"). Rank 4 of 5. Register item: T141.

## Summary

Infrastructure faults are allowed to masquerade as facts about models and
accounts. A gateway timeout, a 5xx, a rate limit, or a mis-parsed response
can make a perfectly usable model disappear from the free-options surfaces,
and a quota reading of "no data" can flow toward the same notification path
as "quota gone". This FID introduces two explicit vocabularies, both
borrowed from measured reference designs: an **availability verdict
taxonomy** (provider rejection = verdict; gateway fault = not a verdict;
eligibility-gated = its own class) and a **truthful quota-state enum**
(`healthy` / `approaching_limit` / `exhausted` / `unavailable` / `unknown`)
with the hard rule that `unknown` is never `exhausted` and never disables
anything, and that estimates are never presented as billing facts.

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Files:** `common/src/providers/provider-quota.ts`,
  `common/src/providers/provider-quota-policy.ts`,
  `common/src/providers/provider-notifications.ts`,
  `cli/src/utils/free-options-render.ts`, `cli/src/utils/discovery-inbox.ts`
- **Commit/State:** worktree dirty (18 modified files from prior sessions,
  uncommitted); this FID is new
- **Governance:** ECHO Protocol v0.1.2-single-agent
  (`dev/echo-v0.1.2-single-agent.md`), FID-bound, Laws 1/3/4

## Detailed Description

### Problem

1. **Availability claims conflate verdicts with faults.** Nothing
   distinguishes "the provider says this model will not route" (a durable
   fact to record) from "this probe round failed" (no fact at all). The
   reference project measured the concrete failure: a mis-parse of a 200
   response misclassified fully available models as un-routable and hid
   them from the picker for a round.
2. **Quota states are not truthful.** The quota fetch returns
   `{ status: 'unavailable', detail: 'no quota endpoint declared' }`-style
   outcomes that share vocabulary with real exhaustion signals, and the
   notification kinds (`quota-low`, `quota-exhausted`, `quota-recovered`)
   have no documented rule for when each is lawfully emitted. A
   `quota-recovered` emitted after a "no data" round claims a fact nobody
   observed.

### Expected Behavior

Every availability observation carries a class: **verdict** (explicit
provider rejection — recorded with reason, model hidden from advertised
lists, auto-restored on a later success), **gateway-fault** (5xx / 429 /
timeout / parse failure — the model stays reachable, no verdict recorded),
or **eligibility-gated** (region/account-qualified — its own group, not a
rejection). Every quota reading resolves to exactly one of the five truth
states; `exhausted` requires an observed zero; `quota-recovered` requires a
prior observed exhaustion; `unknown` disables nothing.

### Root Cause

The probe and quota layers return free-form statuses; the consumers
(renderers, notification service) interpret strings without a declared
vocabulary, so the semantics drift per call site.

### Evidence

```text
resources/dsh-our-free-model-main/README.md (measured):
  "选择器只广播可用的模型——上游清单已声明但网关明确拒绝路由的模型 ... 从下拉框
   移除，仅在设置页保留记录并注明拒因；网关自身故障（5xx）、配额限制（429）、
   超时与断网不属于对模型的判定，一律保持可达；被地区策略拦截的模型归入
   region-limited 分组" — declared-but-not-routed models are removed WITH the
   reason recorded; gateway faults (5xx, 429, timeout, offline) are NOT a
   verdict and the models stay reachable; region-blocked models get their
   own group and migrate back automatically on reprobe.
  "该错误对象携带 status: 200，还会使可用性探测将完全可用的模型判为'不可路由'，
   使其在下拉框中消失一轮" — the mis-parse with status 200 made available
   models vanish; fixed by classifying on body shape, not on the error's
   existence.

resources/OmniRoute-v3.8.51/docs/OMNIROUTE_QUOTA_TELEMETRY.md:
  "healthy / approaching_limit / exhausted / unavailable / unknown"
  "exhausted is emitted only when a source reports zero capacity or usage at
   its limit."
  "Unknown is not exhausted and does not disable a provider."
  "Local estimates are never presented as provider billing data."
  Source preference: official provider API > authenticated usage API >
   explicitly mapped response headers > administrator configuration >
   local estimates > unknown. "Response headers are parsed only through an
   explicit provider mapping. Generic header names are not assumed."

Our side (ground truth, this tree):
  common/src/providers/provider-quota.ts — quota fetch with stringly
    statuses ('unavailable', 'no quota endpoint declared' as detail)
  common/src/providers/provider-quota-policy.ts — quotaEpisode(...)
  common/src/providers/provider-notifications.ts — kinds include
    'quota-low', 'quota-exhausted', 'quota-recovered'
  cli/src/utils/free-options-render.ts — already honest in wording
    ("advertised free models; account access unverified";
     "Configured keys and public listings do not verify your account quota")
    — the vocabulary should make that honesty mechanical
  dev/fids/archive/FID-2026-1003-006 — D3 durable notification service,
    D6 capability-based quota (the consumer surfaces)
```

## Impact Assessment

### Affected Components (reconciled to as-built at `verified`)

- `common/src/providers/availability-verdict.ts` (NEW) — the verdict
  taxonomy + body-shape-first classification
- `common/src/providers/provider-quota-state.ts` (NEW) — the five-state
  resolver with evidence sources + notification preconditions
- `common/src/providers/provider-quota-policy.ts` — `quotaEpisode` evolved
  to the five-state vocabulary (hysteresis/reset mechanics preserved)
- `cli/src/utils/provider-quota-monitor.ts` — the emission gate wired (the
  one real consumer that mints quota notices today)
- `common/src/providers/provider-quota.ts` and
  `common/src/providers/provider-notifications.ts` were **not** edited —
  the kinds remain declared there; the preconditions gate at the emission
  site instead (deviation from the converged plan, recorded in Loop 2)
- `common/src/providers/availability-state.ts` records serving-call verdicts;
  `prompt-agent-stream.ts` admits only explicit model refusal codes from a
  decoded provider error body, and successful calls restore routing.
- `model-picker-grouping.ts` and `free-options.ts` filter only recorded
  `declared-not-routed` models. `free-options-render.ts` derives quota
  caveats from typed quota evidence. `discovery-inbox.ts` remains a candidate
  inbox; it has no probe loop, so the existing serving call is the observation.

### Risk Level

- [ ] Critical
- [ ] High
- [x] **Medium** — user-visible wrongness (models vanish, notifications
  claim unobserved facts) with a workaround (reprobe / refresh), but the
  wrongness directly erodes trust in the free-provider surfaces
- [ ] Low

## Proposed Solution

### Approach

Two pure types and their consumers. No new I/O: this FID re-classifies
observations the code already makes. Both vocabularies are closed enums at
the trust boundary; consumers switch exhaustively.

### Steps

1. **Availability verdict type:** `routable` | `declared-not-routed`
   (carries provider reason + observation time) | `gateway-fault` (kind:
   `5xx` | `429` | `timeout` | `parse`) | `eligibility-gated` (kind:
   region / account). Probe results produce verdicts; only
   `declared-not-routed` hides a model from advertised lists, and only after
   the classification rule is met; a later success restores it
   automatically.
2. **Parse-fault rule:** a response that cannot be decoded is a
   `gateway-fault` of kind `parse` — never a model verdict — regardless of
   the HTTP status it arrived with (the measured 200-with-SSE-body case).
3. **Quota state enum:** `healthy` | `approaching_limit` | `exhausted` |
   `unavailable` | `unknown`, each reading tagged with its evidence source
   in the preference order (official API > authenticated usage API >
   explicitly mapped headers > config > local estimate > none). `exhausted`
   only from an observed zero/at-limit reading; estimates only ever produce
   `approaching_limit` or `unknown`.
4. **Notification preconditions:** `quota-exhausted` requires `exhausted`;
   `quota-recovered` requires a prior recorded `exhausted` transitioning to
   `healthy`; `quota-low` requires `approaching_limit` from a non-estimate
   source (or is labeled an estimate where allowed); `unknown` and
   `unavailable` emit nothing alarming — "no quota endpoint declared" is
   `unknown`, and `unknown` never disables a lane.
5. **Render honesty:** `free-options-render.ts` derives its caveats from the
   classes instead of prose-only warnings.

### Verification

Pure-function tests over the classification table (every fault kind, the
200-parse-fault rule, region-gated migration on reprobe). State-machine
tests for the five quota states including the negative proofs: `unknown`
never yields `exhausted` or `quota-recovered`; a no-endpoint provider is
`unknown` and stays enabled; estimate-sourced readings never mint
`exhausted`. Notification kind tests assert the preconditions above.

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below.

> Declared now so promise and gate are paired from creation (FID-2026-0918-006).
> They become live enforcement at the `fixed`/`verified` flip
> (FID-2026-0823-009); a `created`/`converged` record is outside the C1–C3
> contract.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: test common/src/providers/__tests__/availability-verdict.test.ts
- gate: test common/src/providers/__tests__/quota-state-truthfulness.test.ts
- gate: test packages/agent-runtime/src/__tests__/prompt-agent-stream-forwarding.test.ts
- gate: test cli/src/components/__tests__/model-picker-free-section.test.ts
- gate: test cli/src/utils/__tests__/free-options.test.ts
- gate: test cli/src/utils/__tests__/provider-monitoring.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b605b2b2267492825e5c95d7c3b66a078096160a04d5ddc5dd7e8d3eb6309fb1
- verified: 2026-10-06T04:19:34.261Z
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- test common/src/providers/__tests__/availability-verdict.test.ts: exit 0
- test common/src/providers/__tests__/quota-state-truthfulness.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/prompt-agent-stream-forwarding.test.ts: exit 0
- test cli/src/components/__tests__/model-picker-free-section.test.ts: exit 0
- test cli/src/utils/__tests__/free-options.test.ts: exit 0
- test cli/src/utils/__tests__/provider-monitoring.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Two issues cataloged (faults masquerading as model verdicts;
  quota vocabulary without truth rules). Call-graph check: all five named
  components are live consumers today (the notification kinds are wired
  through the FID-2026-1003-006 service; the renderers are referenced by
  `free-options.ts`, `provider-subcommands-handlers.ts`, and
  `use-chat-bootstrap.ts`), so the change rewires existing callers rather
  than adding an orphan surface — Law 4 grep evidence still required at
  implementation.
- **GREEN:** Design converged — see "Design decisions (GREEN, Loop 1)"
  below; implementation follows that plan when this FID is actioned.
- **AUDIT:** The two suites above plus a re-read of the notification
  preconditions against `provider-notifications.ts` (kinds live at :19-21)
  and `provider-quota.ts` read 0-EOF (122 lines; the `unavailable` bucket
  conflates "no source" with "source down" — decision 2 separates them).
  Latent defect fixed: the Verification Receipt prose was unparseable by
  `scripts/fid-verify.ts` (learned at FID-2026-1005-010's stamp) — the
  section now starts empty.
- **ADVERSARIAL:** Answered below — the hide/disable standing question is
  closed structurally (type-enforced), with the call-site list recorded.
- **CHANGE DELTA:** Converged the design (GREEN block + adversarial
  answers + the source/down split + cross-FID taxonomy coordination);
  status `created` → `converged`.

### Design decisions (GREEN, Loop 1)

All seams below were read or grep-proven live at convergence (Law 1/Law 7).

1. **Availability verdict type** — new pure module
   `common/src/providers/availability-verdict.ts`:
   `routable | declared-not-routed {reason, observedAt} | gateway-fault
   {kind: '5xx'|'429'|'timeout'|'parse'} | eligibility-gated
   {kind: 'region'|'account'}`. Classification keys on BODY SHAPE first,
   never on the error's existence (the measured 200-with-SSE-body case):
   an undecodable body is `gateway-fault{parse}` regardless of HTTP status.
   Only `declared-not-routed` hides a model from advertised lists; a later
   success auto-restores (the picker/FID-2026-1003-005 surfaces consume
   this, never a raw string).
2. **Quota truth states + the source/down split** — the reading resolves
   to `healthy | approaching_limit | exhausted | unavailable | unknown`,
   each tagged with an evidence source in preference order
   (`official-api > authenticated-usage-api > mapped-header > config >
   local-estimate > none`). Mapping from today's `ProviderQuotaResult`
   (read 0-EOF at convergence): a SOURCE-ABSENT reading ("no quota endpoint
   declared", "no key configured", "no numeric reading at …") is
   `unknown`; a SOURCE-DOWN reading (timeout, "request failed", HTTP 5xx,
   origin mismatch) is `unavailable`; `exhausted` requires an observed
   zero/at-limit number (`amount === 0` or observed `amount >= limit`);
   estimates produce only `approaching_limit` or `unknown`. Header parsing
   only via explicit per-provider mappings (no generic header names).
3. **`quotaEpisode` evolves, stays pure** — `QuotaEpisode.level` adopts the
   five-state vocabulary (`ok`→`healthy`, `low`→`approaching_limit`),
   consuming states not strings; the reducer enforces `unknown` →
   `exhausted` is impossible without an observed zero, and `unavailable`
   and `unknown` never bump the level down to `exhausted`. The pinned suite
   `cli/src/utils/__tests__/provider-quota-policy.test.ts` evolves with the
   vocabulary (its level assertions update with the rename — the truth
   rules it already pins (hysteresis, reset observation) stay).
4. **Notification preconditions** — in `provider-notifications.ts`:
   `quota-exhausted` requires observed `exhausted`; `quota-recovered`
   requires a RECORDED prior `exhausted` transitioning to `healthy` (a
   no-data round can never mint one); `quota-low` requires
   `approaching_limit` from a non-estimate source (estimate-sourced is
   labeled as an estimate); `unknown`/`unavailable` emit nothing alarming
   and never disable a lane.
5. **Render honesty** — `free-options-render.ts` derives its caveats from
   the classes (its current prose honesty — "account access unverified" —
   becomes mechanical output of the evidence-source tag), and
   existing serving calls record explicit decoded refusal codes; the picker
   and free listing apply hide/restore from `declared-not-routed` only.
6. **Cross-FID taxonomy coordination (006)** — `gateway-fault.kind` is the
   transient subset of FID-2026-1005-006's failure `reason`s. If 006 lands
   first, decision 1 imports the shared mapping; otherwise 008 defines
   both kinds locally and 006 aligns to it. Two vocabularies for one
   observed fault are forbidden (Law 13 one-truth).

### Adversarial answers (Loop 2)

- **Can any consumer still reach a hide/disable action without a verdict?**
  No, structurally: the hide action's signature takes the verdict type (a
  `declared-not-routed` object), and the disable surface (readiness,
  `common/src/providers/readiness.ts`) is driven by credential presence,
  not observations — it cannot be reached by a probe result at all. Call
  sites to grep at implementation (Law 4): `discovery-inbox.ts` (probe
  loop), the picker visibility path (FID-2026-1003-005 surfaces),
  `free-options-render.ts` lane lists.
- **Can a 200-with-garbage body hide a model?** No — decision 1's
  body-shape rule makes it `gateway-fault{parse}`; tested with the measured
  case as a negative fixture.
- **Can `quota-recovered` claim an unobserved fact?** No — it requires a
  recorded prior `exhausted` (decision 4); the negative proof is a named
  test.
- **Does `unavailable` disable anything?** No — only `exhausted` changes
  user-facing availability claims, and only from an observed zero; both
  `unknown` and `unavailable` are display-neutral (tested).

### Missed Questions

1. **What happens to existing persisted probe state with old statuses?**
   Migrated on read: unrecognized legacy statuses map to `unknown` (safe —
   `unknown` disables nothing and claims nothing), and the next probe round
   rewrites them. No one-shot migration script — the read path normalizes.
2. **Can an operator force-hide a model?** Yes — an explicit operator
   configuration is a verdict class of its own (authority), recorded as
   such, and never confused with an observation.
3. **Do 429s during observation throttle anything?** A 429 is a gateway
   fault for availability (no verdict). FID-006's serving-call breaker
   handles repeated transient failures with 30→120 min cooldown and a
   manual probe bypass, without touching any model verdict.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** e229d9a1 (local batch commit; not pushed)
- [x] **File:line ranges:**
  - `common/src/providers/availability-verdict.ts:29` (`GatewayFaultKind`,
    incl. the 006-shared mapping at `:32`), `:41` (`AvailabilityVerdict`),
    `:65` (`classifyAvailabilityObservation`), `:96`
    (`isVisibleInAdvertisedLists` — hide only on `declared-not-routed`)
  - `common/src/providers/provider-quota-state.ts:17` (`QuotaState`), `:25`
    (`QuotaEvidenceSource`), `:33` (`EVIDENCE_SOURCE_PREFERENCE`), `:67`
    (`resolveQuotaState` — source-absent→`unknown`, source-down→
    `unavailable`, `exhausted` only from observed zero/at-limit), `:108`
    (`quotaNoticeKindForTransition` — the emission preconditions)
  - `common/src/providers/provider-quota-policy.ts:22` (`quotaEpisode` —
    five-state levels, pinned hysteresis/reset preserved)
  - `cli/src/utils/provider-quota-monitor.ts:7,16,98` — prior-level tracking
    + the precondition gate replacing the unconditional ternary (the
    measured `quota-recovered`-from-no-data minter is dead)
  - `common/src/providers/availability-state.ts` — in-process verdict
    record; gateway faults cannot overwrite a verdict
  - `packages/agent-runtime/src/provider-boundary/availability-observation.ts`
    — decoded body must carry an explicit model-routing refusal code;
    `prompt-agent-stream.ts` records rejection/success at the serving boundary
  - `cli/src/components/model-picker-grouping.ts` and
    `cli/src/utils/free-options.ts` — advertised lists consult the verdict
    record; `free-options-render.ts` derives caveats from quota state/evidence
- [x] **Gate output:** the refreshed verification receipt below covers
  `common`, `cli`, and `agent-runtime` typechecks; verdict, quota,
  production-stream, picker, free-options, and quota-monitor suites; and
  the repository quality gate.
- [x] **Reproducibility:** `cd common && bun test availability-verdict
  quota-state-truthfulness` and `cd cli && bun test provider-quota-policy`
  re-run deterministically (pure functions, no I/O)
- [x] **Step statuses:** 1 `implemented` (verdict taxonomy + parse-fault
  rule, negative fixture = the measured 200-parse case) · 2 `implemented`
  (five-state enum + source preference + the absent/down split) ·
  3 `implemented` (`quotaEpisode` five-state; pinned suite evolved with the
  vocabulary) · 4 `implemented` (preconditions; wired at the real emission
  site, `provider-quota-monitor.ts`) · 5 `implemented` — the renderer reads
  typed quota/evidence state, while existing serving calls supply
  availability observations without new I/O. Only a decoded, explicit
  model refusal hides a model; picker and free listing restore it on success.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code
> exists. FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist (all as-built
      paths verified by grep/wc in the audit leg)
- [x] Implementation matches the Proposed Solution (steps 1–5 implemented;
      the serving call replaces the originally assumed probe loop)
- [x] Typecheck/tests/lint pass — gate output above; `lint:md`, Prettier,
      ESLint green in the final sweep
- [x] Production call-graph evidence: `quotaNoticeKindForTransition` called
      at `cli/src/utils/provider-quota-monitor.ts` (live emission);
      `recordModelAvailability` is called from the classified serving
      boundary, and the picker/free report call `advertisedModelVisible`
- [x] FID status reflects the actual implementation state — `verified`
      with all steps wired

### Loop 2 — Independent audit and self-correction

Convergence audit complete (1 iteration): grounding leg (provider-quota.ts
read 0-EOF, notification kinds located, consumers grep-proven:
`health-command.ts`, `provider-quota-monitor.ts`, the three renderer
callers) + manual re-read — one substantive refinement (the
source-absent/source-down split, decision 2) and one latent defect fix
(receipt-section grammar). No overclaims found beyond that.

Implementation audit (2nd iteration, at `verified`): static leg (grep the
as-built call-graph, wc the new files against the ratchet) + manual re-read.
Findings and corrections: (a) decision 4 placed the preconditions
"in `provider-notifications.ts`" but as-built they gate the emission site
(`provider-quota-monitor.ts:98`) — the kinds file stays declaration-only;
recorded as a deviation, behavior identical to the promise; (b) step 5 is
not implementable as written without new I/O — recorded `blocked` with the
measured absence instead of a silent skip; (c) test-harness correction
during GREEN: the default fixture 5/100 (5%) legitimately classifies
`approaching_limit` (≤10% rule) — the fixture was fixed to a healthy
ratio, not the assertion weakened; also pre-fixed an unreachable estimate
branch in `resolveQuotaState` before first run.

### Loop 3 — Final convergence

Design complete: every promise pairs with a declared gate (the two named
suite paths, typecheck common + cli, quality), all three missed questions
carry explicit defaults (legacy-status read-migration, operator force-hide
as its own authority class, 429 probe backoff without verdicts),
adversarial questions answered with structural guarantees, YAGNI reviewed
(no new I/O — pure re-classification of observations the code already
makes; no migration script — read-path normalization). Status `converged` —
the correct pre-implementation status. Implementation is NOT started:
FID-bound execution.

### Loop 4 — Single-agent implementation correction (2026-10-06)

- **RED:** The earlier audit correctly found no periodic availability probe,
  but incorrectly treated that absence as an unavoidable step-5 blocker.
  The existing serving request is an observation and needs no new I/O.
- **GREEN:** Classified stream failures now accept only decoded provider
  error bodies with explicit model-routing refusal codes as verdicts;
  successful calls restore routing. An in-process verdict record feeds the
  picker and free list. The quota monitor now reads its prior episode from
  persisted facts, so a restart does not erase the prerequisite for a
  `quota-recovered` notice. The renderer's caveat reads typed quota state.
- **AUDIT:** Direct call paths are `runWithClassifiedRetry` →
  `prompt-agent-stream` callbacks → `recordModelAvailability` →
  `advertisedModelVisible` in both advertised lists. Focused serving,
  picker, free-option, verdict, and quota-monitor tests cover rejection,
  faults, restoration, and persisted recovery.
- **ADVERSARIAL:** A bare HTTP 404 or undecodable body does not hide a model;
  `explicitModelRejection` requires a named refusal code. In-process state
  is deliberately scoped to the current serving process; a restart clears
  a negative verdict and leaves the model reachable until new evidence.
- **CHANGE DELTA:** Prior step-5 `blocked` status is superseded by the
  production observation path above; the historical finding remains in
  Loop 2 as the audit trail.

## Resolution

- **Closed Date:** 2026-10-06; commit e229d9a1 (local, not pushed)
  archive per the Auto-Archive rule)
- **Fix Description:** Introduced the availability-verdict taxonomy
  (body-shape-first; faults never verdicts) and the truthful five-state
  quota vocabulary with evidence sources; evolved `quotaEpisode` to the new
  levels; gated quota-notice emission on real transitions (a no-data round
  can no longer mint `quota-recovered`). Existing serving calls now record
  explicit model-routing refusals and successes; picker/free listings use
  those verdicts, while the renderer reads typed quota evidence.
- **Tests Added:** verdict and quota-state suites in `common`, serving-call
  and picker integration pins, free-options rendering, and a quota-monitor
  restart transition pin in `cli`.
- **Verification Evidence:** receipt stamped by `bun run fid:verify --write`
  below; gate output recorded in Implementation Evidence
- **Archived:** dev/fids/archive/FID-2026-1005-008-availability-verdict-and-quota-states.md

## Lessons Learned

Both reference projects earned this vocabulary the same way: by shipping the
wrong claim once and measuring the cost. The unifying rule is that a claim
about a model or an account must name its evidence class, and absence of
evidence is its own class (`unknown`) — never silently upgraded to a fact.
The five-state quota enum exists precisely so that "we don't know" can flow
through the system without ever being mistaken for "it's gone".
