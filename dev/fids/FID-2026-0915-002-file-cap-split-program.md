# FID: File-cap split program — 11 files exceed the 300-line absolute maximum

**Filename:** `FID-2026-0915-002-file-cap-split-program.md`
**ID:** FID-2026-0915-002
**Severity:** medium
**Status:** analyzed
**Created:** 2026-09-15 (M2 remediation from the 2026-09-15 A-Z ECHO compliance
audit; operator directive "Open the file-cap FID")
**YAGNI-Compliance:** Verified — every split lands on a seam that already
exists (describe boundaries, embeddedHelpers batch pattern, sibling-handler
pattern, format/section clusters); move-only extractions; re-export facades
keep every current import path working; zero behavior change intended except
where noted (none).
**Related:** FID-2026-0913-002 (the split-discipline precedent this program
follows: seams-already-exist, move-only, facades, assertion-count parity);
FID-2026-0915-001 (author of 6 of the 11 over-cap files); FID-2026-0914-002
(author of the 3 context-pruner files + run-results.ts growth);
protocol.config.yaml `quality.max_file_lines: 300` (ceiling-only rule per the
2026-09-13 operator ruling); compliance audit 2026-09-15 (M2).

---

## Summary

`bun run quality:report` FAILs on 2026-09-15 with **11 project-owned
TypeScript/TSX files above the 300-line absolute maximum** (release-blocking
gate). Six are from FID-2026-0915-001 (authored over cap with no declared
split — flagged as violation M2 in the compliance audit), four grew from the
FID-2026-0914-002 compaction program, one is pre-existing UI debt. The
authoritative gate inventory is larger than the audit's first hand-count
(8): the gate surfaced `right-sidebar.tsx` (301) and `spawn-agent-inline.ts`
(309) that hand measurement missed — recorded as an audit lesson. All 11
split along existing seams per the FID-2026-0913-002 discipline. The
context-pruner trio splits via the established **embeddedHelpers batch
pattern** (not plain imports — the modules are `.toString()`-embedded and
re-eval'd; functions resolve by bare name in the eval scope).

## Environment

- **OS:** Windows 11 (win32, Git Bash); Bun 1.3.14
- **Branch/State:** main at f63e61bb + the uncommitted 95-file backlog
  (C1 remediation commits land BEFORE this program's changes so the split
  diff is reviewable in isolation).
- **RED evidence (`bun run quality:report`, 2026-09-15):**

```text
quality: FAIL (11 quality violation(s))
- agents/context-pruner/preserved-state.ts: 362 lines exceeds absolute maximum 300
- agents/context-pruner/structured-summary.ts: 324 lines exceeds absolute maximum 300
- agents/context-pruner/summarize-messages.ts: 310 lines exceeds absolute maximum 300
- cli/src/components/right-sidebar.tsx: 301 lines exceeds absolute maximum 300
- cli/src/hooks/helpers/send-message/run-results.ts: 326 lines exceeds absolute maximum 300
- common/src/providers/discovery-state.ts: 640 lines exceeds absolute maximum 300
- packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts: 309 lines exceeds absolute maximum 300
- scripts/providers/__tests__/harvest-core.test.ts: 744 lines exceeds absolute maximum 300
- scripts/providers/__tests__/intelligence-layer.test.ts: 447 lines exceeds absolute maximum 300
- scripts/providers/harvest-freeairouter.ts: 589 lines exceeds absolute maximum 300
- scripts/providers/lib/report.ts: 423 lines exceeds absolute maximum 300
```

## Detailed Description

### Problem

Eleven files exceed `max_file_lines: 300` (ceiling-only: exceeding is a hard
violation; under-cap growth is free). Six were authored over cap by
FID-2026-0915-001 across three closures with no declared split — the
compliance audit's M2, and a Law-11 failure by the author (me). Four are
FID-2026-0914-002 compaction growth. One is pre-existing (`right-sidebar.tsx`,
1 line over).

### Expected Behavior

`quality:report` → `quality: PASS`; every split is move-only + re-export (or
describe-boundary test split); all existing suites green with assertion
counts ≥ pre-split; no importing file anywhere changes its import path
(facades); the embedded-eval contract of `agents/context-pruner` is preserved
(every moved function registered in `handle-steps.ts` `embeddedHelpers`;
serialization test suite stays green).

### Root Cause

Feature growth (pipeline + compaction programs) shipped without the
split-step the 300-line policy intends; closures verified typecheck/tests but
not `quality:report`, so the gate could not fail the closure.

### Evidence — per-file seams

Verified 2026-09-15 via full declaration maps + grep; the context-pruner
embed contract verified against handle-steps.ts + module headers.

| # | File (lines) | Seam | Destination | Mechanism |
|---|---|---|---|---|
| 1 | `common/src/providers/discovery-state.ts` (640) | (a) index/churn cluster `familyToken`/`KNOWN_FAMILIES`/`boundaryRank`/`ModelIndexEntry`/`buildModelIndex`/`fallbackHint`/`detectDropouts`/`ChurnSummary`/`DAY_MS` (l.407-640 ≈ 234); (b) parse/serialize cluster `serializeStateFile`/`parseHostEntry`/`parseStateFile` (l.96-241 ≈ 146) | (a) `common/src/providers/discovery-intelligence.ts` (b) `common/src/providers/discovery-state-io.ts` | Move-only; `discovery-state.ts` keeps types + diff + history and **re-exports every moved symbol** (facade) — all current import sites unchanged |
| 2 | `scripts/providers/harvest-freeairouter.ts` (589) | (a) `readQualityRows`+`mergeDenylist` (l.65-160 ≈ 96); (b) `collectTrackedProviders`+`readPriorState` (l.177-222 ≈ 46); (c) `main()` body phase blocks (probe-merge, report-write) | `lib/candidates-io.ts` (a+b) + `lib/harvest-phases.ts` (c, phase functions take explicit params) | Move-only; `main()` becomes orchestration. **The one behavior-sensitive split** — CLI flags/output lines pinned identical by the existing suite + LIVE rerun |
| 3 | `scripts/providers/lib/report.ts` (423) | (a) format helpers `boundaryDisplay`/`boundaryRank`/`auditGroupLabel`/`wrapHosts`/`ROSTER_CAP`/`modelsCell` (l.70-126 ≈ 57); (b) section renderers inside `renderReport` (uptime/index/churn/quality table builders) | (a) `lib/report-format.ts` (b) `lib/report-sections.ts` (pure, take `ReportInput` slices) | Move-only; all currently-exported symbols stay exported from `report.ts` |
| 4 | `scripts/providers/__tests__/harvest-core.test.ts` (744) | describe boundaries: parseFeed/stage0/typosquat (keep) vs boundary/probe (l.162-276) vs diff/state (l.277-453) vs report (l.454-744) | `probe-boundary.test.ts`, `diff-state.test.ts`, `report-stable.test.ts` | Test split (0913-002 precedent); shared fixtures → `__tests__/helpers.ts` if duplicated; **assertion count ≥ pre-split** |
| 5 | `scripts/providers/__tests__/intelligence-layer.test.ts` (447) | describe boundaries: W1 ring + state v2 (l.54-194) vs W2-W5 (keep) | `ring-buffer.test.ts` | Test split; assertion count ≥ pre-split |
| 6 | `agents/context-pruner/preserved-state.ts` (362) | merge/normalize cluster `normalizePreservedState`/`unionNewestFirst`/`mergePreservedState` (l.277-362 ≈ 86) | `preserved-state-merge.ts` (new pure embeddable module) | **embeddedHelpers Batch B**: every moved function `.toString()`-registered in `handle-steps.ts` `embeddedHelpers`; origin re-exports not possible for eval scope — call sites inside embedded scope resolve by bare name (the established summary-parsing.ts "Batch A" pattern) |
| 7 | `agents/context-pruner/structured-summary.ts` (324) | section builders `buildFilesSection`/`buildTodosSection`/`buildIdentifiers`/`collectIdentifiers`/`buildPreservedStateSection` (l.259-324 ≈ 66) | `summary-sections.ts` | Same Batch B pattern |
| 8 | `agents/context-pruner/summarize-messages.ts` (310) | `summarizeMessages` is one function to EOF (l.37-310): the per-entry transcriber branches extract as sibling pure functions | `summarize-messages-entries.ts` | Batch B; exact branch boundaries pinned by full read at GREEN start (the file is the embed core — move-only, no signature changes) |
| 9 | `cli/src/components/right-sidebar.tsx` (301) | smallest cohesive subcomponent/const block (pinned at GREEN start by full read; 1 line over) | `right-sidebar-section.tsx` | Plain import (React module graph, not embedded) |
| 10 | `cli/src/hooks/helpers/send-message/run-results.ts` (326) | `isRateLimited` (l.37-44) + `handleSavantFreeGateError` (l.272-EOF ≈ 55) | `run-result-gates.ts` | Plain import; `handleRunCompletion`/`handleRunError` stay exported from `run-results.ts` (zero consumer churn) |
| 11 | `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts` (309) | one cohesive context-pruner guard block (sibling-extraction precedent: `-summary.ts`, `-pruner-outcome.ts`; exact block pinned at GREEN start) | `spawn-agent-inline-pruner-guards.ts` | Plain import |

## Impact Assessment

### Affected Components

- 11 over-cap files + ~12 new modules + 2-3 facades gaining re-exports +
  `handle-steps.ts` embeddedHelpers registrations (Batch B)
- No consumer import-path changes anywhere
- No baseline/negative-cap data changes (ceiling-only rule; under-cap files
  may grow freely)

### Risk Level

- [ ] Critical
- [x] Medium: broad but mechanical; splits are move-only + re-export; the two
  sensitive spots (harvest main() decomposition, context-pruner Batch B) are
  covered by existing pin suites (76 pipeline pins, serialization tests) plus
  a LIVE harvest rerun and the embed-scope eval tests.

## Exit Criteria

1. `bun run quality:report` → PASS (0 violations)
2. All touched-workspace suites green; **assertion counts ≥ pre-split**
   (recorded before/after)
3. Full 12-workspace type_check chain PASS (recorded, per M1 precedent)
4. eslint `--max-warnings 0` + prettier + lint:md
5. LIVE `bun run providers:harvest --probe` → report/state output identical
   in shape (uptime/index/churn/quality sections render; candidates.json v2)
6. context-pruner serialization + eval-scope tests green (Batch B resolves by
   bare name in the embedded scope)
7. G2: changes committed locally (path-scoped, after the C1 backlog commits);
   hash recorded in Resolution

## Perfection Loop Record

- **Loop 1 (catalog):** gate inventory (11, not the audit's hand-count 8) +
  per-file declaration maps + embed-contract verification. Refuted the
  audit's inventory — recorded, not hidden.
- **Loop 2 (seams):** verified each split lands on an existing seam; found
  the plain-import plan **fails** for the context-pruner trio (embedded
  `.toString()` scope — imports don't exist there); refuted to the Batch
  pattern. Also refuted a naive "split discovery-state in two" (leaves 406
  lines, still over) → three-way split.
- **Loop 3 (mechanism):** confirmed facade need per file (which exports move
  vs stay), test-assertion-parity requirement, and C1-commit ordering.
- **Loop 4 (adversarial):** self-challenge — "is any split cosmetic?" The
  summarize-messages extraction is the weakest (single-function file); the
  genuine seam is its per-entry branches; if the full read at GREEN shows no
  clean branch boundary, the fallback is extracting the type + small helpers
  only and flagging a measured erratum rather than forcing a bad seam.

### Missed Questions

- MQ1: Do any splits change behavior? No — move-only extractions + re-export
  facades; the one behavior-sensitive surface (harvest main() phase blocks)
  is pinned by the existing suite plus a LIVE rerun (exit criterion 5).
- MQ2: Do plain imports work for the context-pruner trio? No — the modules
  are `.toString()`-embedded and re-eval'd; call sites resolve by bare name,
  so the embeddedHelpers Batch B pattern is mandatory (Loop 2 finding).
- MQ3: Can `discovery-state.ts` split two-way? No — 640 − ~234 = 406 lines,
  still over cap; three-way split required (Loop 2 finding).

### Code Verification Evidence

(Status `analyzed`: planning converged, implementation not started. This
section records the gate outputs at implementation closure — quality:report
PASS, 12-workspace typecheck chain, per-suite counts with assertion parity,
eslint/prettier/lint:md, LIVE harvest rerun — per the exit criteria.)

## Resolution

- **Closed Date:** —
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Commit:** —
- **Archived:** —

## Lessons Learned

(written at closure)
