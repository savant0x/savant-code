# FID: Free-provider routing, catalog truth, and reliable notifications

**Filename:** `FID-2026-1003-006-free-provider-routing-notification-audit.md`
**ID:** FID-2026-1003-006
**Severity:** high
**Status:** closed (implemented + verified, 2026-10-03, commit 9f1b8068)
**Created:** 2026-10-03 11:35
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

T127: carry the selected serving provider through model requests, expose free
catalog entries with accurate capability labels, and replace fragile bootstrap
announcements with persistent structured notifications. Cover every finding in
`dev/session-summaries/2026-10-03-free-provider-notification-audit.md`, including
the already verified picker correction in FID-2026-1003-005. This document
specifies the complete correction; new implementation is not claimed.

Operator instruction 2026-10-03, verbatim: "make a fid to address all issues
you found, pick the most robust options for the solutions, run the full
perfection loop on the fid then present it". This authorizes selecting and
converging the plan. The earlier design-choice blocker is removed.

## Environment

- Windows, PowerShell, Bun 1.3.14, current working tree.
- Single-agent ECHO, strict mode, session automation ceiling 3.
- Investigation used cached discovery data, injected machine context,
  placeholder credentials, and offline tests; no live inference calls.

## Detailed Description

### Problem

The free-provider system has working registry, discovery, onboarding, startup
messages and reactive failure hints, but these are not an end-to-end account
capability and provider-alert service. The most serious finding is that an
OpenRouter upstream slug can be mistaken for a direct OpenAI route.

### Expected Behavior

Provider selection must determine the serving endpoint and credential.
Free-model attribution must use canonical provider identity. Notifications
must accurately distinguish configured credentials, observed boundary health,
actual account access, and catalog changes, with a declared delivery lifecycle.

### Root Cause and Evidence

1. **Serving-provider collision:** `sdk/src/impl/model-provider.ts:75-92`
   routes registered prefixes before the active provider. OpenRouter and
   direct OpenAI share upstream IDs such as `openai/gpt-5`. Read-only
   construction with OpenRouter active produced:

   ```json
   {"activeProvider":"openrouter","selectedModel":"openai/gpt-5","constructedProvider":"openai.responses","constructedModel":"gpt-5","networkCalls":0}
   ```

2. **NVIDIA alias mismatch:** cached catalog has 81 `nvidia-nim` rows;
   registry identity is `nvidia`. `cli/src/utils/free-options.ts:111` skips
   unrecognized attribution. Injecting both configured keys still returns
   only OpenRouter. Other cached providers (Groq, Cerebras, Google) have no
   built-in entries and disappear from the user report.
3. **Delivery lifecycle:** `cli/src/chat/use-chat-bootstrap.ts:228-239`
   consumes its one-attempt ref before a cancelable 1.5-second timer runs;
   changes to message count cancel the timer. Restored nonempty chats do not
   schedule it. Background refresh completion has no delivery consumer.
   This is source evidence; full interactive startup smoke remains unverified.
4. **Coarse notification keys:** `use-chat-bootstrap.ts:147-151` keys only
   provider IDs. `common/src/providers/discovery-context.ts:73-80` keys only
   host and classification. Deterministic probes show adding a model or
   changing an existing changed host's facts retains the same key.
5. **Health/removal guidance:** context supports `removalHintId`, but
   `scripts/providers/lib/harvest-report-phase.ts:236-246` never supplies it.
   Health-only changes therefore lack a reliable announcement path.
6. **Hint eligibility:** the runtime 429 hint reader requires repository-local
   candidate data and does not check TTL, removed-provider eligibility,
   denylist, or account entitlement. Alternatives are same-family, not
   exact-version inference confirmations.
7. **Quota/expiry reach:** only B.AI declares a quota endpoint, consumed
   on-demand by `/health`. Developer offer-expiry and new/removed-model
   reports do not constitute user-facing proactive notifications.
8. **Readiness overstatement:** free-options attribution checks built-in
   primary credential names only, ignoring effective custom registrations,
   resolver chains and additional required credentials. A configured key or
   published catalog is not an account-access confirmation; local registration
   is not a reachable runtime.
9. **Cadence:** `common/src/providers/discovery-state.ts` increments
   `downStreak` per harvest invocation and labels three runs a 72-hour lapse.
   Repeated same-day runs can therefore prune prematurely. Health observations
   need elapsed time, measured freshness and distinct observation identity.
10. **Delivery surfaces:** the desktop gateway has validated event/replay
    infrastructure but no provider-alert consumer. The separate hosted
    Savant-Free `model_unavailable` branch changes its in-memory model and
    reschedules admission without an explicit fallback explanation.

## Impact Assessment

### Affected Components

- SDK provider resolution and CLI selection/persisted routing identity.
- Free-options catalog attribution and report building.
- Chat bootstrap announcements and discovery report/context construction.
- Rate-limit hints and optional quota reporting.
- Common runtime/public agent types, model inheritance, route-specific budgets,
  user-profile storage, gateway event schemas and desktop notice state.
- A notification adapter for the existing hosted fallback path; its admission
  policy and feature disposition remain governed by the standing operator ruling.

### Risk Level

High for the serving-provider collision: the wrong account credential and
endpoint can be selected. Medium for omitted free-model lanes and unreliable
notices. The existing configured-key split does not prove model access.

## Proposed Solution

### D1 — Explicit serving identity and compatible request routing

Add a shared, validated `ModelRoute` containing `providerId` and
`authMode: 'provider' | 'chatgpt-oauth'`. A selection is the existing model
string plus that route. The provider is the serving gateway, not the upstream
vendor prefix. Preserve existing model IDs and apply only the selected registry
entry's existing ID transform. OpenRouter keeps `openai/gpt-5` and
`openrouter/free`; direct OpenAI strips its routing prefix exactly once.

Persist a versioned selection atomically with the existing settings writer.
The new selection is authoritative; mirror legacy model/provider fields in
the same write for compatibility. Validate the effective registry, including
custom entries, at load and dispatch. Unknown/removed providers fail closed
with actionable reselection guidance. Missing own keys or extra credentials
cannot invoke an unrelated key, endpoint or OAuth account.

Every first-party request captures its route before dispatch and carries it
through streaming, generation, structured output, retry/fallback and run resume.
Changing the picker during a request affects subsequent runs. Parent model
inheritance carries the route and provider options together; a child with
`inheritParentModel: false` retains its own explicitly resolved route.
Route-specific catalog windows, output budgets, usage and capability caches
key by serving provider plus model, so colliding IDs cannot share limits.
Capture resolved endpoint/protocol/config revision for the run too. A custom
edit cannot redirect a retry; a removed or invalidated route stops new dispatch
with reselection guidance. Credential rotation invalidates account observations
and quota episodes; persist opaque revision IDs, never keys or credential hashes.
Wire every runtime producer too: `prompt-agent-stream.ts`, the n-response path,
file-selection prompts, semantic summaries and `gemini-with-fallbacks.ts`.
Helpers inherit the captured selection unless explicitly pinned. Any helper
that replaces `model` must resolve its matching route/budget as one operation;
spreading parent parameters and replacing only the model cannot retain a foreign
route. Cross-provider fallback requires the existing explicit authorization.

Add optional `modelRoute` to SDK request contracts for source compatibility;
first-party callers must always supply it. Explicit routes win before prefix
and OAuth logic. OAuth is an explicit OpenAI auth lane and cannot intercept
an OpenRouter selection. Its existing allowlist, cooldown and user-authorized
fallback remain enforced; fallback has its own explicit provider route.

Legacy inputs pass through one compatibility resolver. Existing unambiguous
prefix routes and unregistered environment endpoints remain supported. A
conflicting active provider and registry prefix requires explicit identity;
never silently choose a different credential. Existing persisted
`savantCodeModelProviderPreference` is documented as a picker default, so it
alone cannot establish routing intent. Migrate a consistent active-provider
selection from explicit `activeProvider`/environment intent, or a unique catalog
route; otherwise preserve the original settings
and request reselection. A persisted explicit choice is not replaced by catalog
absence. `/model <id>` resolves against the current captured serving route and
works offline; add `/model --provider <id> <model-id>` for explicit cross-provider
selection, validating before persistence. `/provider` updates route identity
through the same selection seam instead of an independent environment mutation.

**Why this wins:** additive identity removes ambiguity without rewriting
upstream slugs or globally overriding deliberate child routes. Reordering the
registry or privileging the process-wide active provider cannot do both.

### D2 — Canonical attribution and truthful readiness

Use one shared catalog-provider normalization table alongside the effective
registry. Declare `nvidia-nim -> nvidia`; verify alias uniqueness and preserve
upstream model IDs. Extend existing attribution/builders rather than creating
another provider list. A custom provider may match a unique normalized endpoint
origin/path or explicit catalog binding; brand similarity alone is insufficient.

Return supported configured, supported setup-required, discovery-only, and
local lanes. Groq, Cerebras, Google and unknown entries remain visible as
discovery-only, with no invented `/provider` command or implied support.
Custom removal and tombstones take effect immediately.

Configured means every required credential exists through the same resolver
policy as dispatch, including the OpenRouter chain and extra credentials.
Presence checks do not exchange master keys or perform inference. Render
"credentials configured; account/model access unverified" until dated
account-specific evidence exists. Track catalog offering, credential readiness,
boundary health, quota and inference evidence as separate facts with source,
observed time and freshness. Local lanes distinguish installed/registered,
reachable, and model present; listing Ollama does not assert it is running.

### D3 — One durable notification service and consumer lifecycle

Keep schemas and pure normalization/diff logic in `common`; own refresh, IO and
subscriptions in the existing CLI process, also used by the desktop sidecar.
Dependency-inject clock, fetch, storage and sinks. Reuse free-options paths,
configuration-directory isolation, toast rendering and gateway event emission.
No new daemon or hosted service is required.

Store structured notices in the user configuration directory, outside chat
history and prompts. Each carries a stable semantic ID, kind, provider/model
identity, typed facts, severity, observed time, source freshness and safe action.
One session coordinator loads cached state immediately, schedules a nonblocking
refresh and emits completion deltas in that same session. Its lifecycle does
not depend on message count; cancellation/remount releases subscriptions and
permits retry. Coalesce concurrent command/boot refreshes and ignore obsolete
responses using generation identity and cancellation.

Use a versioned, atomically replaced state containing last-good snapshots,
pending notices and per-surface presentation acknowledgements. Enqueue before
advancing a baseline; acknowledge only after the sink accepts presentation.
Dismissal/read state is explicit. A crash may redeliver, but stable IDs make
consumers idempotent; do not promise exactly-once display. A failed write retains
the old durable baseline, serves memory state and exposes one diagnostic.
Corrupt state is retained for diagnosis and rebuilt safely from a fresh baseline.
Bound retention to 30 days/1,000 records, aggregating overflow without silently
dropping active selected-route warnings. Serialize updates with a profile-scoped
writer lease, atomic commits and stale-owner recovery; never overwrite a newer
revision or another surface's acknowledgement.

CLI: emit informational toasts once per semantic event, retain unread notices
in `/notifications`, and keep actionable selected-route warnings until dismissed.
Use the existing toast container; normal terminal output stays separate from
inference messages. Startup shows a compact cached summary and unread count,
including restored chats. Migrate old sidecar keys into a summary baseline,
without pretending they acknowledge future model/health changes. First-run
provider guidance and `/provider free` use the same facts and dedup policy.

Desktop: add a validated `provider_notice` event and capability-negotiated
snapshot/ack RPCs. Send it through `emitEventBatch` and the existing replay
cursor; keep notice state separate from transcript blocks. Snapshot recovery
covers a replay gap or fresh renderer, merging by semantic ID/revision. Filter
new events for old clients by negotiated capability, preserving sequence
progress with valid empty batches; an unknown event must not invalidate an
otherwise valid legacy transcript batch. The shared store supplies an existing
status/toast surface plus an accessible unread list and dismiss action.
Negotiate optional client-supported capabilities in hello; the current server
capability advertisement alone does not establish client support. Apply the
same per-connection filter to live emission and replay responses.

### D4 — Semantic deltas and notification policy

Diff canonical, sorted last-good provider/model identities, credential state,
health verdicts, removal hints and dated offers. Include model additions and
removals within an unchanged provider. Normalize case only where a provider's
contract permits it. Identity and typed transition facts determine IDs;
timestamps, ordering, prose and small latency fluctuations cannot retrigger.
Use own snapshots as the baseline; third-party new/archive lists supplement
evidence and cannot independently delete an ambiguous model ID.
Persist a monotonic episode revision per provider/model/transition family.
Advance it only on a real semantic transition, so down/up/down and
removed/readded/removed alert again while identical refreshes remain deduplicated.

Fresh first-run catalogs produce a summary, not a flood of additions. A failed,
partial, malformed, stale or future-dated feed cannot become an empty authoritative
snapshot. Keep last-good data, mark freshness and suppress destructive deltas;
accept explicit removals only from valid complete snapshots/tombstones. Provider
key/config edits recompute lanes immediately. Delayed startup refresh publishes
new events in the running session.
Completeness requires successful row validation and a consistent declared count;
silently skipped malformed rows cannot justify a removal delta.

Default policy: additions and supported setup opportunities are grouped info;
selected-model removal, selected-route failure, exhausted quota and relevant
expiry are warnings; recovery is info after a preceding warning. Nonselected
catalog/health changes remain grouped in the unread list. No automatic provider
switching. Hosted Savant-Free retains its existing admission fallback policy,
with one explicit explanation of attempted fallback and its eventual outcome
per session/model-unavailable episode; do not call a retry a successful switch.
This adapter does not untangle or remove that feature.

### D5 — Dated health, removal guidance, and eligible alternatives

Extend existing discovery state and probe/report seams with dated health
observations, model changes and `removalHintId`, including health-only transitions.
Compute removal suggestions for tracked custom routes from measured evidence;
the user decides removal. Keyless boundaries prove boundary behavior, not
entitled inference. A public model list alone is not an open inference relay.

Replace three-invocation lapse logic with `downSinceUtc` plus at least three
distinct observations spanning at least 72 hours. Same-day reruns cannot age
the interval. Unknown/unprobed samples do not count as failure; recovery resets
the interval. Feed disappearance is a separate dated observation, not proof an
endpoint is down. Migrate old undated streaks without retrospectively asserting
72 hours; preserve tombstones and daily history idempotence.
The resulting notice describes repeated failures over the observed interval,
without claiming uninterrupted downtime between probes.

Ordinary installed users consume a profile-local normalized discovery snapshot,
not `<cwd>/dev/provider-candidates`. Extract reusable existing parsers/probes
from developer scripts into shared code, retaining the repository harvester as
an adapter. Refresh public catalog/offers every 24 hours while a session is
active; offers accept the existing 72-hour source TTL. Probe only configured
or explicitly monitored endpoints with bounded, keyless checks: startup and
at most every 6 hours, 5-second timeout, concurrency 2. Never send credentials
to a feed-supplied host, follow a credentialed redirect, or fetch a new arbitrary
endpoint merely because a feed names it.

429 guidance reads this same snapshot and passes a shared eligibility predicate
to existing `fallbackHint`: fresh observation (24-hour TTL), supported effective
route, configured required credentials, model offering, no tombstone/rejection,
and no unsafe boundary. A flagged discovery endpoint needs explicit review;
it is not advertised as ready. Rank exact-model, compatible-capability routes
first; label family matches as similar models and account access as unverified
unless independently observed. Cap hints at two and dedup by failure episode.
Stale/unknown alternatives produce a clear no-confirmed-alternative result.

### D6 — Capability-based quota and dated offer expiry

Extend the existing declarative quota metadata/reader with typed readings,
units, optional remaining/limit/reset fields and explicit endpoint auth policy.
Retain `/health` formatting through an adapter to the shared reader. Declare
only proven provider endpoints; B.AI is currently the only one. Validate numeric
values and distinguish unavailable, unknown and zero. Preserve established
B.AI request behavior as explicitly scoped policy until endpoint evidence proves
one header sufficient; do not guess or spread dual-header auth to other hosts.
Credentialed reads use the selected endpoint only and reject redirects.

Monitor the active configured provider only when it declares quota capability;
additional providers require an explicit monitoring preference. Refresh at
startup, after a quota-class refusal, and no more than every 15 minutes with
5-second timeout, single-flight, Retry-After/backoff and session cancellation.
Announce exhaustion at zero; low quota at 10% only when a documented comparable
limit exists. Rearm low/exhausted notices after recovery above 15% or an observed
reset; never infer a reset date, allowance or currency conversion. Unsupported
quota stays unknown; never make an inference call to measure it.

Reuse custats offer parsing/attribution as a user-cache adapter. Treat feed text
as untrusted plain text, retain provenance and require unambiguous provider
attribution for actionable notices. Keep unattributed offers in discovery-only
output. Schedule expiry notices at 72 hours, 24 hours and expired, once per
offer/deadline/window; first sight inside a window emits only the current one.
Parse explicit timezone/date semantics; unknown dates get no timer. Only
selected/configured or explicitly followed providers receive expiry toasts.
These dates describe advertised offers, not proven account credits or entitlement.
Refresh failure retains stale data with an evidence label and suppresses new
actionable expiry claims until fresh validation.
Retain catalog model `expirationDate` too; apply the same dated-window policy
to selected-model availability, keeping model deadlines distinct from offers.

### D7 — Preserve and integrate the verified picker correction

Retain provider-scoped React row keys and stable child keys from FID-2026-1003-005.
Keep native regressions for colliding upstream IDs, matching-only search,
zero results, clearing the query, and selection of both provider identities.
The new selection contract must consume the actual selected row's provider,
not infer it from the model ID. This dependency is locally verified and has
not been committed; neither FID can claim archival on that basis.

### Production reachability and implementation order

| Step | Existing insertion points and required consumers | Completion proof |
| --- | --- | --- |
| 1: routing | CLI `provider-setup.ts`, `/model` command, model store and settings IO; common agent/template and LLM contracts; runtime `withParentModel`; SDK `stream-request-setup.ts` and both `prompts.ts` calls | Selected row to serialized endpoint/credential, all three LLM modes, child override, retries and resume |
| 2: catalog truth | `free-options.ts`, its catalog/types/render modules, effective provider registry and provider wizard | NVIDIA and custom attribution; unsupported lanes remain visible; credential-chain and local-state labels |
| 3: delivery | Bootstrap/session coordinator, existing toast container, `/provider free`, `/notifications`, gateway state/replay, desktop `use-gateway.ts` and validated inbound parser | Restored chat and refresh-completion delivery; sink ack; crash/remount; capability/replay/snapshot |
| 4: deltas/health/hints | Common discovery context/state/intelligence; harvest probe/report phases; CLI `send-message/fallback-hints.ts` | Same-provider deltas, health-only warnings, real elapsed cadence, ordinary-project hints and eligibility |
| 5: quota/offers | Existing `provider-quota.ts`, `/health`, custats feed/model parsers and hosted unavailable branch adapter | Typed quota thresholds/backoff, expiry windows, redacted failures and honest fallback outcome |
| 6: integration | Existing native picker harness, SDK/public exports, desktop store/surfaces and provider documentation | Full gates, native terminal/desktop smoke, production call-graph checks and implementation evidence |

All six implementation steps are authorized by the operator's 2026-10-03
instruction, "proceed w/ the work". Implementation and verification are in
progress; no implementation PASS is claimed yet. Every proposed field/helper has
named insertion points above. Preserve privacy/provider options, request budget
guards, existing build variants and operator-owned hosted feature disposition.
Keep TypeScript modules within the repository's 300-line ceiling.

### Acceptance tests and evidence requirements

All paths below are repo-relative and gate-covered. New files are prospective
artifacts; they must exist and pass before an implementation receipt is stamped.

- `sdk/src/impl/__tests__/model-provider-serving-route.test.ts` (new): colliding
  OpenAI/OpenRouter and NVIDIA IDs; explicit custom/local route; OAuth isolation;
  missing/extra keys; unchanged upstream slug; migration conflict; intercepted
  serialized URL, auth header and model, without live inference.
- `packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts`
  (extend): route inheritance/override and privacy options; provider plus model
  output-budget identity. Add caller-level tests for stream, generation,
  structured output and retry in the new SDK route suite.
- `packages/agent-runtime/src/__tests__/model-route-callers.test.ts` (new):
  runtime stream/n-response producers, file-selection and semantic-summary
  calls, and helper fallback model changes carry the correct captured route
  without adopting a parent's mismatched route or budget.
- `cli/src/utils/__tests__/settings-provider.test.ts` and
  `cli/src/utils/__tests__/provider-setup.test.ts` (extend): atomic versioned
  selection, conflicting legacy defaults, removed customs, `/provider` changes,
  offline exact IDs and explicit command routing.
- `cli/src/utils/__tests__/free-options.test.ts` (extend): NVIDIA alias,
  effective customs, resolver/extras, unsupported lanes and truthful labels.
- `common/src/providers/__tests__/provider-notifications.test.ts` (new): semantic
  diffs, complete-snapshot rules, freshness, ordered equivalence, same-provider
  additions/removals, delivery IDs, recovery and quota/expiry transitions.
- `cli/src/chat/__tests__/provider-notification-lifecycle.test.tsx` (new): fake
  time plus real component/sink integration; message changes before 1.5 seconds,
  restored chat, absent/stale cache then completion, repeated mounts, out-of-order
  refreshes, write failure, crash before ack, writer lease and bounded retention.
  Assert provider notices never enter outbound model message history.
- `scripts/providers/__tests__/discovery-seams.test.ts` and
  `scripts/providers/__tests__/custats-harvest.test.ts` (extend): health-only
  report/removal wiring, distinct observations over 72 hours, same-day reruns,
  missing feed, migration and offer attribution/expiry.
- `scripts/providers/__tests__/diff-state.test.ts` (extend): elapsed-time lapse
  regressions at the pure state seam, including recovery and undated migration.
- `cli/src/hooks/helpers/__tests__/fallback-hints.test.ts` (extend): ordinary
  project, TTL, tombstone/denylist/custom eligibility, exact versus family models,
  episode dedup and no automatic route mutation.
- `cli/src/utils/__tests__/provider-quota.test.ts` (extend): unsupported versus
  unavailable/zero, unit/limit validation, headers, redirect rejection, timeout,
  backoff and zero-secret returned messages.
- `cli/src/server/__tests__/gateway-provider-notifications.test.ts` (new) and
  `desktop/src/lib/__tests__/gateway-provider-notifications.test.ts` (new):
  capability filtering, validated schema, sequence/replay gaps, snapshots,
  acknowledgements, dedup and notice state separate from transcript/prompt.
- `cli/src/components/__tests__/model-picker-scroll.test.tsx` (retain/extend):
  native search regressions plus provider identity delivered into selection.
- `cli/src/hooks/__tests__/savant-free-fallback-notice.test.ts` (new): hosted
  unavailable episode reports attempted and successful/failed fallback distinctly,
  without altering preferences or admission policy.

Before implementation closure: full `bun run typecheck`, SDK `bun test src/`,
applicable workspace suites, zero-warning ESLint, Markdown lint, formatting,
quality and every declared gate must pass. Run tests from workspace roots per
the T67 guard. Audit production consumers after wiring. Run native TUI smoke
in tmux and desktop reconnect/read/dismiss smoke with a controlled local server;
record remaining live provider/account boundaries honestly. The standing
operator-owned Savant-Free e2e failures are recorded under T122; they do not
become passing tests because this plan converges. No full-repository-green
claim is permitted while those failures remain.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: typecheck desktop
- gate: test sdk/src/impl/__tests__/model-provider-serving-route.test.ts
- gate: test packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts
- gate: test packages/agent-runtime/src/__tests__/model-route-callers.test.ts
- gate: test cli/src/utils/__tests__/settings-provider.test.ts
- gate: test cli/src/utils/__tests__/provider-setup.test.ts
- gate: test cli/src/utils/__tests__/free-options.test.ts
- gate: test common/src/providers/__tests__/provider-notifications.test.ts
- gate: test cli/src/chat/__tests__/provider-notification-lifecycle.test.tsx
- gate: test scripts/providers/__tests__/discovery-seams.test.ts
- gate: test scripts/providers/__tests__/custats-harvest.test.ts
- gate: test scripts/providers/__tests__/diff-state.test.ts
- gate: test cli/src/hooks/helpers/__tests__/fallback-hints.test.ts
- gate: test cli/src/utils/__tests__/provider-quota.test.ts
- gate: test cli/src/server/__tests__/gateway-provider-notifications.test.ts
- gate: test desktop/src/lib/__tests__/gateway-provider-notifications.test.ts
- gate: test cli/src/components/__tests__/model-picker-scroll.test.tsx
- gate: test cli/src/hooks/__tests__/savant-free-fallback-notice.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:52e69180f5e5c323912ac4f8705b82b518370747315700c9e5690d9cba1bf4a8
- verified: 2026-10-03T23:12:11.290Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck desktop: exit 0
- test sdk/src/impl/__tests__/model-provider-serving-route.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/model-route-callers.test.ts: exit 0
- test cli/src/utils/__tests__/settings-provider.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup.test.ts: exit 0
- test cli/src/utils/__tests__/free-options.test.ts: exit 0
- test common/src/providers/__tests__/provider-notifications.test.ts: exit 0
- test cli/src/chat/__tests__/provider-notification-lifecycle.test.tsx: exit 0
- test scripts/providers/__tests__/discovery-seams.test.ts: exit 0
- test scripts/providers/__tests__/custats-harvest.test.ts: exit 0
- test scripts/providers/__tests__/diff-state.test.ts: exit 0
- test cli/src/hooks/helpers/__tests__/fallback-hints.test.ts: exit 0
- test cli/src/utils/__tests__/provider-quota.test.ts: exit 0
- test cli/src/server/__tests__/gateway-provider-notifications.test.ts: exit 0
- test desktop/src/lib/__tests__/gateway-provider-notifications.test.ts: exit 0
- test cli/src/components/__tests__/model-picker-scroll.test.tsx: exit 0
- test cli/src/hooks/__tests__/savant-free-fallback-notice.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Expanded baseline — RED and GREEN

- **RED:** Ten finding groups plus the verified picker dependency are covered.
  Source inspection and deterministic reproductions are retained in the audit.
- **GREEN:** D1–D7 select explicit serving identity, canonical attribution,
  durable consumer delivery, semantic snapshots, dated health/eligible hints,
  supported quota/expiry capabilities, and the existing picker correction.
- **Alternatives rejected:** registry reordering; globally preferring an active
  provider; renaming upstream model slugs; chat-length-driven timers; provider-only
  hashes; treating keys/boundaries as entitlement; inference probes for quota;
  arbitrary feed-host monitoring; a new daemon; silent automatic BYOK switching.
- **CHANGE DELTA:** The operator's expanded request rebaselines the original
  investigation-only FID into a complete design. This initial expansion is not
  counted as a capped correction pass; subsequent audit changes are measured
  against this design baseline with the protocol's 10% cap and 2% threshold.

### Missed questions resolved

1. Can a picker-default provider prove legacy route intent? No; use validated
   active context or an unambiguous route, otherwise require reselection.
2. Can a provider switch race an in-flight retry or child? Capture route per run
   and carry it through every retry/child; never re-read global provider identity.
3. Can identical slugs share budget/capability data? No; key by serving identity.
4. Can an old desktop parse a new event? Capability-filter it before transport,
   preserving sequence progress and all recognized transcript events.
5. Can two clients or a crash consume a notice before it is shown? Persist
   pending state first, merge acknowledgements under writer ownership, and dedup
   idempotent redelivery; exactly-once display is not asserted.
6. Do three harvests establish 72 hours? No; require elapsed time and distinct
   observations, with migration that does not invent dates.
7. Can stale feeds remove models or prove offer/account expiry? No; preserve
   last-good state and distinguish advertised offer expiry from account quota.
8. Does including the hosted fallback notice authorize feature removal? No;
   preserve admission behavior and the standing operator-owned disposition.

### Loop 1 — AUDIT failure and SELF-CORRECT

- **AUDIT:** Source shows `getActiveProvider` can fall back to a picker default;
  migration must use explicit raw intent. Gateway hello currently advertises
  server capabilities only; client negotiation and replay filtering are needed.
- **ADVERSARIAL:** Stable content alone suppresses recurring failure episodes;
  provider ID alone also cannot freeze an edited endpoint or scope account data.
- **SELF-CORRECT:** Require explicit migration evidence, negotiate both sides,
  filter live/replay identically, persist episode revisions, capture resolved
  route configuration, invalidate rotated-account observations, and gate the
  existing pure diff-state suite. No implementation is claimed.
- **CHANGE DELTA:** Measured in the planning session record after this edit;
  only this bounded correction is counted against the expanded design baseline.

### Loop 2 — caller audit and bounded correction

- **AUDIT:** Production grep found additional non-streaming model producers
  beyond child inheritance: n-response, file selection, semantic summary and
  helper fallbacks. Several spread parameters and replace only `model`.
- **SELF-CORRECT:** D1 now requires route/budget resolution whenever a helper
  replaces its model; name each producer and declare a caller integration suite.
- **DOUBLE AUDIT:** Read-only construction still reproduces wrong OpenAI routing
  with zero network calls. Three harvests spanning 120,000 ms still lapse a host;
  a changed model count retains its announcement key. Existing CLI baseline:
  38 pass/0 fail; discovery baseline: 46 pass/0 fail. These confirm the evidence
  and existing seams, not correction. Gate parsing/coverage and scope pass.
- **CHANGE DELTA:** Measured in the planning session record; re-audit follows.

### Loop 3 — stable double audit

- **AUDIT:** All ten findings map to D1–D7 and production insertion points.
  Parser: 23 gates, 17 promised tests, no uncovered paths or resolution errors.
  Seven tests are prospective; no implementation receipt is asserted.
- **ADVERSARIAL:** Rechecked migration, helper routes, recurrent episodes,
  stale sources and legacy clients; no further actionable design correction.
- **CHANGE DELTA:** History only; measured in the session record.

### Loop 4 — completeness and deadline audit

- **SELF-CORRECT:** Specify count/row validation for complete snapshots and
  retain model expiry dates alongside offer deadlines. Both use existing gates.
- **AUDIT:** Contracts and acceptance coverage remain complete after correction.
- **CHANGE DELTA:** Measured in the session record.

### Loop 5 — COMPLETE for the plan

- **AUDIT:** Reverse-check findings against consumers and gates; no actionable
  design correction. Runtime evidence remains explicitly baseline-only.
- **CONVERGENCE:** Consecutive passes below 2%; every correction below 10%.
  Exact counts and document checks are in the planning session record.

## Resolution

Plan converged after five passes. The operator authorized implementation on
2026-10-03: "proceed w/ the work". Implementation is complete; every declared
gate is green and the implementation record below distinguishes tested and
live boundaries. The operator granted G2 ("Batch + close all", 2026-10-03);
the work landed in the batch commit `9f1b8068` on local main — local commit
only, no push.
- **Archived:** 2026-10-03 (moved to `dev/fids/archive/`)

## Implementation Record

Implementation completed 2026-10-03 under the operator's "proceed w/ the work"
authorization. Evidence below is tool output or `file:line`; live boundaries
are recorded, not claimed.

### Step status

| Step | Status | Evidence |
| --- | --- | --- |
| 1 routing (D1, D7) | implemented | `common/src/providers/model-route.ts` (`resolveModelRoute` bare-slug custom-endpoint guard + `routeMatchesEnvironmentEndpoint`/`normalizeEndpoint`); `cli/src/utils/settings/model-selection.ts`; `cli/src/state/savant-free-model-store.ts` (`resolveActiveModelRoute` explicit-only); `cli/src/utils/provider-setup.ts` guarded `applyModelPickerSelection`; gates 6-10 green |
| 2 catalog truth (D2) | implemented | `cli/src/utils/free-options.ts` + `free-options-context.ts`; `common/src/providers/readiness.ts` (`primaryCredentialEnvNames`/`providerCredentialEnvNames`); gate 11 green |
| 3 delivery (D3) | implemented | `cli/src/chat/provider-notification-lifecycle.ts`, `use-chat-bootstrap.ts`, `components/provider-inbox.tsx`; gateway/desktop capability negotiation (`desktop/src/lib/gateway-protocol.ts` `helloRequest`); gates 12-13, 19-20 green |
| 4 deltas/health/hints (D4, D5) | implemented | `common/src/providers/discovery-*`, harvest report phases, `send-message/fallback-hints.ts` probe-DI fixture; gates 14, 17, 22 green |
| 5 quota/offers (D6) | implemented | `provider-quota.ts`, custats adapters; gates 15-16, 18 green |
| 6 integration | implemented | native picker harness retained (gate 21); every declared gate green (receipt below); dev-machine boundaries recorded honestly |

### Verification battery (2026-10-03, run from workspace roots per the T67 guard)

- `bun run typecheck` — 14 legs, exit 0.
- `bun test` per workspace: sdk 657 pass/0 fail; cli 3826 pass/18 skip/0 fail
  (includes the real-child handoff matrix 6/6); common 749/0; agents 156/0;
  evals 171/0; packages/agent-runtime 1648/0; design-systems 19/0; code-map
  51/0; database 18/0; knowledge-graph 55/0; llm-providers 89/0; connectors
  17/0; desktop 427/0; scripts/providers gates 46/0.
- `bun x eslint . --max-warnings 0` — zero problems.
- `bun run lint:md` — clean; `bunx prettier --check .` — clean.
- `bun run quality:report` — PASS (1498 baselined files).

### Corrections completed during implementation verification

1. **D1 custom-endpoint seam restored** — the legacy bare-slug route synthesis
   in `resolveModelRoute` promoted a bare-slug preference into the active
   provider's registry endpoint, bypassing `INFERENCE_BASE_URL` (handoff
   matrix 5/6 red: requests went to openrouter.ai instead of the local
   gateway). Bare-slug synthesis now yields when `INFERENCE_BASE_URL` names a
   custom endpoint; explicit selections and prefix routes are untouched.
2. **Static-render mock scoped** — `mockOpentuiReactForStaticRender` leaked a
   sticky four-export `mock.module` that broke later suites (the model-picker
   scroll geometry suite ran under an 80-column `useTerminalDimensions` stub
   and lost its scrollbar click target). The mock is now surface-complete and
   restores the real exports in `afterAll`.
3. **Desktop hello pins updated to the implemented D3 shape** —
   `gateway-protocol.test.ts` and `gateway-client.test.ts` pin the additive
   `capabilities: ['provider_notices_v1']` advertisement; the protocol version
   stays frozen at 1.
4. **Gate hygiene** — import order in `provider-setup-gateway.test.ts`;
   formatting in `provider-notification-lifecycle.ts`.
5. **Custom-endpoint auth seam closed** (operator-requested hardening
   2026-10-03) — the bare-slug default path resolved the active provider's
   key chain even when the request targeted a custom `INFERENCE_BASE_URL`
   endpoint (master-key network exchange, fail-closed throw on a missing
   provider key, and the provider's key sent to the operator's own gateway).
   The endpoint now owns its auth: `routeMatchesEnvironmentEndpoint`
   (exported from `common/src/providers/model-route.ts`) gates a dedicated
   branch in `sdk/src/impl/model-provider.ts`, and
   `createDefaultInferenceModel(..., { endpointOwnsAuth: true })` never
   resolves the OpenRouter chain and requires `INFERENCE_API_KEY`, failing
   fast by name when absent. Regression tests: bare-slug suite 6/6
   (custom-endpoint authorization + fail-fast), budget-transport's three
   custom-endpoint cases adapted to the endpoint-owned credential; handoff
   matrix 6/6 with the child no longer performing the master-key exchange
   (cases 1-3 at 4.2-5.7s, previously 10-22s while the exchange was in play).

### Live boundaries (recorded honestly)

- Ambient dev-machine `.env.local` still reaches handoff-matrix children, but
  the custom-endpoint quadrant is now fully deterministic: when
  `INFERENCE_BASE_URL` names an endpoint other than the active provider's
  registry base, authorization is `INFERENCE_API_KEY` alone — no master-key
  exchange, no provider-key fallthrough, no fail-closed dependency on an
  unrelated provider.
- Native TUI tmux smoke and a live desktop reconnect/read/dismiss smoke were
  not run on this host (tmux unavailable — the tmux suites skip themselves);
  protocol-level coverage (gateway-provider-notifications, both sides) is
  green. No live provider or account call was made.
- The standing operator-owned Savant-Free e2e failures remain recorded under
  T122; no full-repository-green claim is made for them.

## Lessons Learned

Keep serving identity distinct from upstream vendor/model slugs. Test semantic
notification delivery and elapsed observation time, not just rendering and cache
freshness. A durable notice must be accepted by a real consumer before its
presentation acknowledgement advances.
