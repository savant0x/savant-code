<!-- markdownlint-disable MD013 -->

# Nova Implementation Sign-off Request — FID-2026-0814-001 (Live Sidebar Surfaces Remediation)

**Date:** 2026-08-14
**Scope:** Implementation of the three-workstream remediation — compaction-status lifecycle (real `compacting…`/`pruned` feedback, window-relative percent, re-spawn cooldown), Trust Matrix live session signal + deterministic trigger path, teacher panel compact rows + terminal state.
**Status:** REQUESTED
**Priority:** High (P1 compaction feedback + teacher terminal state; P2 trust-matrix live signal)

## Request

Please independently audit the implemented FID below and return one of:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation sign-off request**. A PASS verifies the implementation; it does **not** authorize closure, archive movement, commit, push, release, publication, or deployment. Operator closure is a separate decision.

## Record under review

`dev/fids/FID-2026-0814-001-live-sidebar-surfaces-remediation.md` — status `fixed` (planning PASS recorded 2026-08-14; implementation completed under operator automation level 3).

## What was implemented (per the converged plan)

| Phase | Change |
|---|---|
| A — Compaction lifecycle | `agents/savant/handle-steps.ts` writes `compactionStatus = { phase: 'compacting' }` before every pruner spawn and gates the 0.8 proactive spawn behind a 30s `lastPrunerCompletionAt` cooldown (force 0.9 bypasses); `spawn-agent-inline.ts` pruner-completion boundary writes `phase: 'pruned'` (with estimated `tokensSaved`) or `phase: 'warning'` when ineffective (fold never overwrites); `context-tokens.ts` `percentUsed` is window-relative (`maxContextLength = autoCompact + 30k`); `CompactionStatus.phase` adds `'pruned'` + `AgentState.lastPrunerCompletionAt?` (`common/src/types/session-state.ts`); agents-side `AgentState` mirror updated; sidebar `formatCompactionStatus` splits `✓ micro −N` / `✓ pruned −N` / `⚠ N% of window`; help-banner legend updated; bundled agents regenerated |
| B — Trust Matrix live signal | `trust-matrix.tsx` live `N signed event(s) this session` footer in empty + populated states; new `trust-matrix-live.test.ts` closes V024-P3-3 headlessly (store append → reducer row count) |
| C — Teacher panel | `learn-overlay.tsx` event log packed into one compact block (no per-event gap, single `•`), new optional `phase`/`completionState` props with runtime-authoritative precedence (closes `/learn cancel` — cancel sets `completionState='cancelled'` with no result event); `right-sidebar.tsx` forwards `teacherState.phase`/`completionState` |

## Verification evidence (reproduce independently)

- **Focused suites:** `agents/__tests__/context-pruner-phase3.test.ts` 10/10 (incl. 3 new: compacting emit, cooldown backoff, force bypass during cooldown + serialization literals) · agent-runtime `context-compactor` + `provenance` + `tools/handlers/tool` + spawn tests 125/125 and 13/13 · CLI `learn-overlay` + `trust-matrix` + `trust-matrix-live` + `chat-store-teacher` 22/22.
- **Typecheck ×4:** sdk, common, agent-runtime, cli — all exit 0.
- **ESLint:** `bun x eslint . --max-warnings 0` — zero warnings. **lint:md:** 0. **Prettier:** clean.
- **`bun run validate:repository`:** **PASS** (incl. quality-ratchet approved-growth entries documented for the 7 grown files — raised, never lowered). **fid-ledger:** clean.

## Hard questions Nova must verify at source

1. **`compacting` is now really emitted.** Confirm `grep -n "phase: 'compacting'" agents/savant/handle-steps.ts` finds the three spawn-site writes, the regenerated `cli/src/agents/bundled-agents.generated.ts` contains them, and no other phase writer regressed (`context-tokens.ts:209-220` still only writes warning/compacted/idle).
2. **Pruner result feedback.** Confirm `spawn-agent-inline.ts` pruner-completion block writes `phase: 'pruned'` with `tokensSaved` (messages-removed × 200 estimate, same convention as micro-compact) when `prunerMessagesRemoved > 0`, `phase: 'warning'` for an ineffective proactive/force run, and never overwrites for the amortized fold (`foldOldestExchange`); confirm `lastPrunerCompletionAt` is stamped on the main agent only (`!parentAgentState.parentId`).
3. **Cooldown semantics.** Confirm the serialized handleSteps reads `agentState.lastPrunerCompletionAt` fresh each iteration, skips the 0.8 proactive spawn within 30s of a pruner completion, and that the 0.9 force path bypasses the cooldown; the generated source stays closure-free (literals/params/agentState only).
4. **Window-relative percent.** Confirm `context-tokens.ts` computes `percentOfWindow = contextTokenCount / (thresholds.autoCompact + 30_000) × 100` and all three status writes carry it; confirm `right-sidebar.tsx` labels `⚠ N% of window`, `✓ micro −N tokens`, `✓ pruned −N tokens`, `compacting…`, `idle`.
5. **Trust Matrix live signal + trigger path.** Confirm the `N signed event(s) this session` footer appears in both the empty and populated `trust-matrix.tsx` branches, and `trust-matrix-live.test.ts` drives the real store (`addProvenanceEvent` → `reduceTrustMatrixEvents` rows increment) — closing V024-P3-3 headlessly.
6. **Teacher terminal state.** Confirm `learn-overlay.tsx` accepts optional `phase`/`completionState`, prefers the runtime values when provided (`completionState !== undefined`), the sidebar forwards `teacherState.phase`/`completionState` (`right-sidebar.tsx:263-270`), and the event log renders compact single-bullet rows (`• ${event.type}`) with no per-event gap.
7. **No ECHO law weakened / no new authority.** The panel/row changes are read-only UI + status writes on existing fields; no new store slice, no new polling cadence, no control/write/spawn path added; ZTAP trust semantics unchanged; private-pack isolation intact (`learn-overlay.test.ts` zero-control + private-pack audits still pass).

## Authorization boundary

This request authorizes no closure, archive movement, commit, push, release, publication, or deployment. Operator closure follows a Nova PASS plus the operator's explicit approval; the FID is then moved to `dev/fids/archive/` and the CHANGELOG closure entry is recorded.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim.
4. Explicit confirmation this is implementation review only and does not authorize production changes or release activity.
