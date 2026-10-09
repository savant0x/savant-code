# FID: Model Compliance Telemetry — per-model law-violation analytics

**Filename:** `FID-2026-1007-012-model-compliance-telemetry.md`
**ID:** FID-2026-1007-012
**Severity:** low
**Status:** closed
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

Formal FID for `dev/build-orders/archive/BO-2026-08-24-model-compliance-telemetry.md`,
which specifies per-model compliance profiles. All seven phases are implemented,
including runtime identity, the mounted desktop panel and SessionEnd reporting.
The operator authorized
completion of all remaining work on 2026-10-09: "complete all of the work so
you can properly close them." The build order remains the design authority.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint`
- **Commit/State:** verified implementation; local commit authorized after archive.

## Detailed Description

### Problem

The original feature was absent. Capture, aggregation, CLI, sentinel, feedback,
runtime route identity and the desktop panel are now implemented and tested.

### Expected Behavior

Per the source build order: a `ComplianceEvent` schema, an in-process
fail-open capture sink, an aggregation engine, a CLI group, a desktop panel,
a drift sentinel, and a LEARNINGS feedback loop.

### Root Cause

Not a defect — an unstarted feature. The build order sat unindexed and
unregistered from 2026-08-24 until 2026-10-07.

### Evidence

Measured 2026-10-07, all absent:

```text
common/src/types/telemetry.ts   ABSENT
dev/telemetry/                  ABSENT
dev/telemetry/compliance.jsonl  ABSENT (repo-wide search)
```

The research precondition was satisfied on 2026-10-08; these absence claims
describe the original baseline, before implementation.

## Impact Assessment

### Affected Components

Implemented: `common/src/types/telemetry.ts`, an in-process sink in the
hooks/enforcement layer, `scripts/telemetry-aggregate.ts`, a `telemetry` CLI
group, a desktop panel, `dev/telemetry/compliance.jsonl`.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

> The rating describes implementation risk: the capture sink observes the
> enforcement path. Fail-open tests prove capture failures do not block work.

## Proposed Solution

### Approach

Adopt the source build order's seven phases unchanged. This FID carries no
independent design.

### Steps

Per `dev/build-orders/archive/BO-2026-08-24-model-compliance-telemetry.md`:

1. FID 1 — `ComplianceEvent` schema (metadata only, no code content).
2. FID 2 — in-process capture sink, fail-open, atomic append.
3. FID 3 — `scripts/telemetry-aggregate.ts`, deterministic streaming aggregation.
4. FID 4 — `telemetry` CLI group (summary / laws / models).
5. FID 5 — desktop compliance panel.
6. FID 6 — drift sentinel into a dedicated ledger, surfaced by SessionEnd
   routing notes within the existing agenda cap (Loop 2 correction).
7. FID 7 — dominant-law proposal drafts, surfaced by SessionEnd for review.

### Verification

Per-phase acceptance gates are declared below. Full root regression also
passes: 8,572 tests, 23 skips, zero failures across 13 workspace legs.

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: typecheck desktop
- gate: test common/src/types/__tests__/telemetry.test.ts
- gate: test common/src/util/__tests__/telemetry-aggregate.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/compliance-capture.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/compliance-context.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/compliance-emission.test.ts
- gate: test cli/src/commands/__tests__/telemetry-command.test.ts
- gate: test cli/src/server/__tests__/gateway-telemetry.test.ts
- gate: test desktop/src/components/chat/__tests__/compliance-panel.test.ts
- gate: test scripts/__tests__/telemetry-sentinel.test.ts
- gate: test scripts/__tests__/telemetry-feedback.test.ts
- gate: test scripts/__tests__/session-end-telemetry.test.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: probe scripts/eslint-check.ts
- gate: probe scripts/lint-md-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:3d22734e29468156e934c1e9839c1966847b9471fe1b49c4ec8cb285cfc72d0b
- verified: 2026-10-09T06:42:27.498Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- typecheck desktop: exit 0
- test common/src/types/__tests__/telemetry.test.ts: exit 0
- test common/src/util/__tests__/telemetry-aggregate.test.ts: exit 0
- test packages/agent-runtime/src/hooks/__tests__/compliance-capture.test.ts: exit 0
- test packages/agent-runtime/src/hooks/__tests__/compliance-context.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/compliance-emission.test.ts: exit 0
- test cli/src/commands/__tests__/telemetry-command.test.ts: exit 0
- test cli/src/server/__tests__/gateway-telemetry.test.ts: exit 0
- test desktop/src/components/chat/__tests__/compliance-panel.test.ts: exit 0
- test scripts/__tests__/telemetry-sentinel.test.ts: exit 0
- test scripts/__tests__/telemetry-feedback.test.ts: exit 0
- test scripts/__tests__/session-end-telemetry.test.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- probe scripts/eslint-check.ts: exit 0
- probe scripts/lint-md-check.ts: exit 0
- quality: exit 0

## Acceptance Evidence Requirements

Targeted suites run from common, agent-runtime, CLI, desktop and scripts
workspace roots. Desktop acceptance includes seeded JSONL through authenticated
gateway/client/panel, empty/error states, window changes and stale-request
cleanup; native sidebar acceptance retains the 84-test battery and captures.

## Perfection Loop

### Loop 1 — RED

- **RED:** No telemetry surface exists; 0 of 7 items implemented.
- **GREEN:** Not reached — design authority is the source build order.
- **AUDIT / ADVERSARIAL:** Not reached.
- **CHANGE DELTA:** n/a

### Missed Questions

1. **Should the build order be deleted now that a FID exists?** → No. It is the
   design record; this FID tracks it. Archiving it would lose the phase gates.
2. **Does Phase 6 conflict with the agenda cap?** → Yes, and it must be resolved
   before FID 6 opens: `dev/agenda.md` is capped at 1–3 items by
   `FID-2026-0824-012` S3-A, and a sentinel writing into it competes with the
   three capabilities already listed there.

### Loop 2 — full-perfection pass, GREEN fold (2026-10-08, operator-triggered)

RED re-confirmed: `common/src/types/telemetry.ts` and `dev/telemetry` ABSENT
(measured today); no `ComplianceEvent` symbol in code (grep: only the build
order and this record).

GREEN fold — mandated missed-questions answered (defaults adopted, operator
decisions named):

1. Do not re-implement identity probing — the identity gauntlet
   (`scripts/providers/identity-gauntlet.ts`) already produces probe reports;
   a later phase composes its output (Law 13).
2. Drift findings must NOT write into `dev/agenda.md` (1–3 item cap measured in
   the file today): dedicated ledger; agenda promotion stays operator-only.
   Resolves Missed Question 2 with a concrete default.
3. Emitting wire-list: structured-violation producers only (pre-write gates,
   escalation ladder, turn-end Law 15 reconciliation); ad-hoc `warn()` calls
   never fabricate telemetry lines.
4. Storage follows the `dev/experiences/raw-traces.jsonl` precedent (tracked
   append + sibling dedup); fixed-size lines, schema-version field, no payloads.
5. The no-bodies red line is compatible with all four detectors (needed fields
   exist in already-collected runtime state).

Five Questions: fixed for "all cases" (emitting wire-list) and "2 years"
(schema version + imported enums). Passes hostile/standard.

Status ruling: `created` → `analyzed`. GREEN remains design-authority-bound —
the build order's `source_research` precondition is still empty (measured
today); the honest next move is the research pass, not Phase 1 code.
Operator decisions named: confirm tracked+dedup git policy; confirm no agenda
competition; approve the emitting wire-list.

### Loop 3 — document convergence (2026-10-08)

- **RED re-verified:** `common/src/types/telemetry.ts` and `dev/telemetry/`
  still absent; zero `ComplianceEvent` references in code (`*.ts/tsx/js/json`
  repo-wide); the build order's `source_research` still empty
  (`BO-2026-08-24`: `source_research: none yet`, L8/L70). Composition targets
  confirmed present: `scripts/providers/identity-gauntlet.ts`,
  `dev/experiences/raw-traces.jsonl`, `dev/agenda.md`.
- **GREEN:** Loop-2 defaults stand — no stale numbers, no unanswered
  missed question. Open items are operator-sovereign, recorded as blocked
  rather than defaulted: tracked+dedup git policy; agenda competition;
  emitting wire-list approval.
- **AUDIT (double):** (1) absences re-proven above (absence-shaped evidence
  re-measured, not trusted). (2) `fid:verify --check` executed on this record
  today: informational "no gates declared" — the uniform pre-implementation
  response, not a defect.
- **Status unchanged:** `analyzed` — accurate (design folded, research
  precondition unmet, no implementation).
- **CHANGE DELTA:** ~3%. **CONVERGED:** zero open questions; the research pass
  is implementation-phase work under a later authorization, not a document gap.

### Implementation progress (operator-authorized completion pass, 2026-10-08)

- **FID 1 (schema) — DONE:** `common/src/types/telemetry.ts`
  (`complianceEventSchema`, zod, mirrors `experienceRecordSchema`
  discipline: plain strings + enums + doc contracts, additive-nullable
  evolution) + `common/src/types/__tests__/telemetry.test.ts` (6 pins:
  full parse, enum rejections, missing-field rejection, unknown-key
  stripping, full enum matrix). Gates: suite 6/6 · `typecheck` (common)
  exit 0 · eslint 0 · prettier clean.

- **FID 2 (sink) — DONE:** `hooks/compliance-capture.ts` (fail-open atomic
  sink mirroring experience-capture; kill-switch `complianceTelemetry.enabled`
  default-on with mtime cache; explicit-root-or-silent) +
  wiring at 4 funnels (Law-1/Law-2 sites, recordLawBlock escalation with
  strikes, pre-write + receipt warnings, turn-end reconcile/Law-4/Law-15
  sites) + config contract (`complianceTelemetry` across types/sections/
  reader/yaml) + release-pre-audit churn listing. Tests: 8 capture pins + 4
  emission pins. Gates: new suites green · typecheck (agent-runtime +
  common) exit 0 · eslint 0 · echo+hooks regression 427/427 · prettier
  clean. Boundaries documented: unattributed producers (immutable, yagni,
  fid, scope-disposition, post-write scanners, design-contract, ungrounded,
  grounding gates) emit nothing — no reason-text parsing, ever; model/
  provider empty (identity-threading follow-up); `corrected` unused;
  session/role proxy is agentId; Q1 purge folded into FID 3; Q2 default-on
  implemented per BO recommendation (named for confirmation). REFINED
  post-green: the first shape (per-call root threading) risked test pollution
  and cap overflow; the shipped shape carries the root on `EnforcementState`
  (seeded once per session by the executor before-paths, zero signature
  changes outside two optional params) with pure reads everywhere —
  `tool-pipeline.ts` is byte-identical to HEAD.

- **FID 3 (aggregate) — DONE:** `scripts/telemetry-aggregate.ts`
  (fail-open parse via the FID-1 schema, rolling 7d/30d/all-time aggregates,
  zero-filled trend series, 90d `--purge` mirroring `purgeExpiredTraces`,
  `--json` output for the CLI phase, `telemetry:aggregate` script alias) +
  `scripts/__tests__/telemetry-aggregate.test.ts` (6 pins: exact counts,
  windows, zero-filled series, empty ledger, purge window, undated
  exclusion). RESTRUCTURED post-green: pure aggregation moved to
  `common/src/util/telemetry-aggregate.ts` (the CLI cannot import from
  scripts/, which is not a package) with the suite moved alongside; the
  scripts file is now a thin file-I/O + CLI wrapper. Gates re-verified
  after the move: suite 6/6 · `typecheck` (common) + `typecheck:scripts`
  exit 0 · eslint 0 · prettier clean · live `--json`/`--window all`/`--purge`
  on the empty tree.

- **FID 4 (CLI) — DONE:** `cli/src/commands/defs/telemetry.ts`
  (`/telemetry [summary|laws|models] [--window]`, one bare command with
  arg-dispatch per the two-word-command lesson; pure parse + render with a
  thin I/O handler reading the project ledger) + registration
  (`MISC_COMMANDS` spread, slash-menu entry for registry/menu parity) +
  `cli/src/commands/__tests__/telemetry-command.test.ts` (8 pins incl.
  deterministic tie-break rule count-desc/key-asc). Gates: suites 14/14
  with registry-gating · `typecheck` (cli) exit 0 · eslint 0 · prettier
  clean.

- **FID 6 (sentinel) — DONE:** `scripts/telemetry-sentinel.ts` (7d vs prior
  7d per-(model,law) drift at ≥2× over a ≥5-event baseline; run ledger
  `dev/telemetry/drift.jsonl`; clean runs recorded too) +
  `telemetry-sentinel.test.ts` (4 pins: drift found, stable clean,
  small-sample silence, empty clean). Scheduling (cron/CI nightly) is
  operator-owned; the module is the deterministic job body.

- **FID 7 (feedback) — DONE:** `scripts/telemetry-feedback.ts` (>40% law
  share over 30d with a ≥10-event floor drafts
  `dev/telemetry/proposals/law<id>-dominance.md`; stale drafts cleared;
  never auto-promotes/registers) + `telemetry-feedback.test.ts` (4 pins:
  dominance proposes, sub-threshold silent, tiny-sample silent, sync
  write+clear). SessionEnd-hook surfacing deferred as its own change
  (hook-critical path; drafts are Scribe-pickable as-is). Gates for 6+7:
  suites 8/8 · `typecheck:scripts` exit 0 · eslint 0 · prettier clean ·
  live `--json`/clean-path runs on the empty tree. Tracking policy set:
  `compliance.jsonl` tracked source (churn-committed like raw-traces);
  drift runs + drafts gitignored as derived/local (`.gitignore`).

### Loop 4 — authorized completion design (2026-10-09)

Seed enforcement identity from the resolved agent template route, session and
role on native/custom executor paths; carry it through all four funnels. Missing
identity stays explicit. Mount a collapsible Compliance panel in the existing
desktop workspace right rail, using current tokens: ranked laws, law/model
heatmap and dated trend, 7d/30d/all filters, loading/empty/error/disconnect states.
Validate RPC windows strictly; preserve Origin/bearer boundaries. Repair required
gateway fixtures, split the oversized handshake module and clear root gate
findings. Capture is metadata-only and fail-open; no extra model requests.

### Loop 5 — independent re-audit of completion design

Call-graph checked: client helper exists but has no public method or panel caller.
Identity uses the existing resolved route, never inferred served-model claims.
Async cancellation must protect window changes/unmount. Numeric cells and
accessible trend labels supplement color. Two document reviews converge with
no further design changes; implementation proceeds under the operator's scope.

### Loop 7 — regression-driven command integration (2026-10-09)

Full CLI regression found duplicate `/telemetry` registry entries: the original
remote-consent handler shadows compliance. Extend that existing handler with
explicit summary/laws/models arguments, preserving bare/status/enable/disable
and the analytics alias. Keep one registry/menu entry. Reject unsupported or
repeated window flags before aggregation. A custom-catalog test still asserted
registry ordering after the operator-approved alphabetical change in archived
`FID-2026-1007-017`; retain the effective-registry pin and correct its grouping
expectation. Independent review confirms consent remains explicit and no command
is lost. Design converged before implementation.

### Loop 6 — finish the insight loop (2026-10-09)

SessionEnd must run the existing sentinel and proposal synchronizer and surface
metadata-only findings in routing notes, preserving the agenda's 50-line/three-item
cap. Honor the capture opt-out; absent ledgers remain silent and write nothing.
Reporting failures cannot abort SessionEnd. Extract existing supplemental notices
into a cohesive module to keep the hook below 300 lines, retaining public exports.
Exclude future timestamps from drift windows; pin all paths with injected time.
Independent review confirms no automatic promotion, extra model call or agenda
competition. Design converged before implementation.

## Resolution

- **Closed Date:** 2026-10-09
- **Commit Authorization:** Operator: "you can commmit it after you properly
  archive it and update the changelog". Archive and changelog completed before
  the authorized local implementation commit; its actual hash is recorded next.
- **Fix Description:** All seven phases implemented; runtime identity seeded
  from resolved routes; authenticated desktop RPC and mounted panel; one
  `/telemetry` command preserving remote-consent controls; fail-open SessionEnd
  drift/proposal reporting, future-window and prototype-key protections.
- **Tests Added:** Schema/aggregate, capture/context/emission, CLI, gateway,
  desktop, sentinel/feedback and SessionEnd suites; browser smoke fixture.
- **Verification Evidence:** Fresh receipt above: 19/19 gates pass; full root
  typecheck, ESLint, markdownlint and quality pass. Root test log:
  `dev/scratchpad/active/model-compliance-completion-2026-10-09/root-tests-unsandboxed.log`.
- **Source:** `dev/build-orders/archive/BO-2026-08-24-model-compliance-telemetry.md`
- **Archived:** `dev/fids/archive/FID-2026-1007-012-model-compliance-telemetry.md`

### Code Verification Evidence

- Identity is seeded on the actual loop and both executor paths:
  `run-agent-step/loop-context.ts:99`, `tools/tool-executor/ehel-gate.ts:36`,
  `tools/tool-executor/custom.ts:178`, under `packages/agent-runtime/src/`.
  Four capture funnels preserve this identity. It is the requested route,
  not attestation of the model served by a provider.
- Authenticated gateway loading uses the configured project root
  (`cli/src/server/gateway.ts:105`); invalid windows and unauthenticated calls
  cannot reach the loader. Gateway/auth suites: 9 pass, 43 assertions.
- The real workspace mounts `CompliancePanel` (`desktop/src/App.tsx:238`).
  Seeded JSONL crosses authenticated RPC, GatewayClient and React in the Edge
  smoke: 10 checks pass, zero page errors, including windows, corrupt lines,
  empty/error/retry, disconnect/reconnect and 320px layout. Evidence and PNGs:
  `dev/scratchpad/active/model-compliance-completion-2026-10-09/`.
- SessionEnd invokes metadata-only reporting
  (`scripts/session-end-review.ts:247`, `scripts/session-end-notices.ts:39`).
  Missing/disabled ledgers are silent; I/O failure is contained; drafts are
  never promoted automatically. Four scripts suites: 25 pass, 78 assertions.
- Registry uniqueness and consent/compliance dispatch are pinned; targeted CLI
  integration: 46 pass, 267 assertions. Complete desktop: 433 pass. Complete
  root chain: 8,572 pass, 23 skip, zero failures. Initial duplicate-command and
  stale provider-order regression failures were repaired before that run.
- Historical implementation bullets above describe earlier intermediate
  states. Loop 7 supersedes the duplicate MISC registration; Loop 6 completes
  the previously pending hook integration. Runtime identity supersedes empty
  identity fields. The schema still intentionally omits message/code payloads.

## Lessons Learned

Compose an existing command before adding a new registry entry. Exercise the
actual authenticated transport and mounted UI, and carry route identity from
its runtime owner. Keep derived insight drafts separate from promotion.
