<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Live Sidebar Surfaces Remediation — Compaction Status, Trust Matrix Real-Time, Teacher Panel

**Filename:** `FID-2026-0814-001-live-sidebar-surfaces-remediation.md`
**ID:** FID-2026-0814-001
**Severity:** high
**Status:** closed
**Created:** 2026-08-14
**Closed:** 2026-08-14 (Nova planning + implementation audit PASS + operator closure approval)
**YAGNI-Compliance:** Verified — reuses the existing `compactionStatus` field, the 2s heartbeat, the event-sourced `TrustMatrix`, and the `LearnOverlay` component; no new store slice, no new hook where a selector suffices, no new control/write authority
**Depends On:** none (remediates defects in the live sidebar surfaces shipped by the closed/archived 2026-08-13 teacher-sidebar and observability-remediation program, found during the 0.0.24 A–Z live test `dev/test-prompts/az-v0.0.24-harness-live-test.md`)

---

## Summary

The 0.0.24 A–Z live test run and the operator's live `bun dev` review surfaced three clusters of defects in the **live sidebar surfaces** shipped by FID-2026-0813-022 (teacher panel) and FID-2026-0813-023 (compaction status + trust-matrix empty-state):

1. **Compaction status is broken and misleading (P1).** The runtime **never emits `phase: 'compacting'`** — the sidebar's `compacting…` label is dead code, so the `idle → compacting… → compacted` transition promised by the 0.0.24 test contract (row V024-P3-5 and AV-04) **cannot render**. The real context-pruner spawn sets no status, so the sidebar is stuck on `warning` while the pruner runs (or silently fails). The displayed percent ("102% of auto threshold") is computed against a **different threshold than the pruner trigger**, reads as alarming while nothing visibly happens, and the pruner re-spawns every step above 80% — appearing "too aggressive" with zero visible feedback.
2. **Trust Matrix has no live session signal (P2).** The panel is purely event-sourced — rows appear only on write/verdict events, so between writes it is static and in read-only sessions it stays on the placeholder forever. The operator's "does not update in real time" complaint (recorded in the teacher A–Z report) was partially addressed by FID-023's empty-state fix, but the **no-live-updates UX gap remains** and row V024-P3-3 was left operator-gated with no deterministic trigger path.
3. **Teacher panel: double-spacing + dropped terminal state (P2).** `LearnOverlay` renders up to ~25 separate text children inside a `gap={1}` column — every event on its own double-spaced row with a `  • ` prefix, far airier than the compact `KeyValueRow` sections. Separately, the sidebar drops `TeacherSessionState.phase`/`completionState` (re-deriving them from the event log), so `/learn cancel` — which sets `completionState='cancelled'` **without** pushing a `result` event — never renders a completion badge: a cancelled attempt looks perpetually in-progress.

All findings below are verified at source with `file:line` evidence. No code is written until this FID converges through the Perfection Loop.

## Environment

- **OS:** Windows target; platform-agnostic CLI (OpenTUI).
- **Language/Runtime:** TypeScript/Bun 1.3.14; React 19 / OpenTUI 0.2.2; zustand (immer middleware).
- **Tool Versions:** `ContextCompactor` (Layers 2–4), `agents/savant/handle-steps.ts` (pruner trigger), 2s snapshot heartbeat, `TrustMatrix`, `LearnOverlay`, zustand chat store.
- **Commit/State:** working tree 0.0.24, unreleased. FID-2026-0813-022/023 are closed/archived; this FID remediates defects in the surfaces they shipped.

## Detailed Description

### Problem

The operator's live review of the 0.0.24 A–Z test run reported:

- "In the sidebar I see compaction, 102% of auto threshold" — and "reading some of the agent responses it seems like compaction is too aggressive" — while no compaction was visibly happening (no `compacting…`, no `compacted (−N tokens)` row).
- "These sections [the] teacher [panel] has double spacing issues."
- The standing instruction to "address the design for the trust matrix, it also does not update in real time" (from the pre-0.0.24 teacher A–Z session) was only partially resolved by FID-023's empty-state fix.

The 0.0.24 test report (`dev/scratchpad/az-v0.0.24-harness-live-test-report.md`) itself flags the boundary: AV-04 says the `idle → compacting… → compacted` transition is "the only remaining verification is the operator's visual confirmation" — but the code proves that transition **cannot happen** because `compacting` is never emitted.

### Expected Behavior

1. The sidebar `Compaction` row shows the **real** compaction lifecycle: `idle` (below trigger) → `warning` (approaching) → **`compacting…` while the context-pruner actually runs** → `✓ compacted (−N tokens)` with the result, or the degradation warning if ineffective. The displayed percentage must be unambiguous — tied to the model context window and to the actual pruner trigger, not a hidden internal threshold.
2. A pruner spawn that fails or is ineffective must be visible (status reflects the outcome), and the pruner must not re-run silently every step in a way that reads as "too aggressive" with no feedback.
3. The Trust Matrix panel must give a live session-level signal (e.g., a heartbeat-driven "N signed events this session" line) so an event-sourced panel is legible: no new rows = no new writes, not "frozen." A deterministic trigger path must exist for testing the real-time behavior.
4. The Teacher panel renders compact rows consistent with the rest of the sidebar, and terminal states (`cancelled`, `unavailable`, `passed`) always render a completion badge — including after `/learn cancel`.

### Root Cause (verified at source)

#### Workstream A — Compaction status lifecycle

**A1. `phase: 'compacting'` is never emitted anywhere in the runtime.**
- `common/src/types/session-state.ts:133` — `CompactionStatus.phase: 'idle' | 'compacting' | 'compacted' | 'warning'`.
- `packages/agent-runtime/src/run-agent-step/context-tokens.ts:208-220` — the only writer sets `'warning'` | `'compacted'` | `'idle'`; the `'compacting'` branch is never taken.
- `cli/src/components/right-sidebar.tsx:92-94` — the `case 'compacting': return { label: 'compacting…' }` is dead code.
- Absence check: `grep -rn "phase: 'compacting'\|'compacting'" packages/agent-runtime/src` → **0 matches** in emit sites.

**A2. The actual pruner spawn sets no status.**
- `agents/savant/handle-steps.ts:133-157` — the `spawn_agent_inline` yields for `context-pruner` write **no** `compactionStatus`. The sidebar keeps whatever the last step boundary wrote (`warning` if over the ContextCompactor threshold) while the pruner runs — and stays there if the spawn errors silently.

**A3. Two divergent thresholds make the display misleading.**
- Display percent: `context-compactor.ts:189-190` `percentUsed = round(contextTokenCount / thresholds.autoCompact * 100)`, where `autoCompact = max(contextWindow − 30_000, 100_000)` (`context-compactor.ts:80`; `AUTO_COMPACT_BUFFER = 30_000` at `state.ts:45`).
- Pruner trigger: `loop-context.ts:279-280` `initialAgentState.maxContextLength = autoCompact + 30_000`, then `handle-steps.ts:133` spawns at `contextTokenCount > maxContextLength * 0.9` (force) and `:147` at `> maxContextLength * 0.8`.
- For a 262k window: the sidebar warns at `(262k−30k) = 232k` (display "100%") while the pruner fires at `262k × 0.8 = 209.6k` — a **different number**. "102% of auto threshold" ≈ 90% of the model window; the label never references the window or the trigger, so it reads as alarming/aggressive while nothing visibly happens.

**A4. The pruner re-spawns every step while over threshold, with the outcome invisible.**
- `handle-steps.ts:147` — the `else if` re-yields the spawn on **every** loop iteration while `contextTokenCount > maxContextLength * 0.8` (the `while (true)` generator yields it each cycle). If the pruner's summary does not get context under the threshold, the anti-thrash score records a failure (`context-compactor.ts:222-238`) and the next step re-arms — a silent re-compaction loop that reads as "compaction is too aggressive" from the agent responses while the sidebar shows a stuck `⚠ 102%`.

**A5. The status row updates only at step boundaries via a 2s poll.**
- `send-message-monitors.ts:80-91` — heartbeat mirrors `snap.sessionState.mainAgentState.compactionStatus` every 2s; between step boundaries the row is stale, and during a pruner run (which can take many seconds) it never shows in-flight state.

#### Workstream B — Trust Matrix live signal

**B1. Purely event-sourced; no session-level live signal.**
- Events are emitted only on write receipts (`packages/agent-runtime/src/tools/tool-executor/native.ts:681-700`) and verdict bindings (`spawn-agents.ts:275`, `spawn-agent-inline.ts:178`).
- The CLI forwards every event (`cli/src/utils/sdk-event-handlers.ts:94-96` → `addProvenanceEvent`, `sidebar-actions.ts:90-97`; the immer middleware produces a new array reference, so re-render works — verified at `chat-store.ts:45-46`).
- Between write/verdict events the panel is static; in a read-only session it stays on the placeholder text ("No signed provenance events yet — signed writes and verdicts appear here live."). The operator's "does not update in real time" is by design, but **there is no counter-signal** (e.g., live ledger count) so it reads as frozen. Row V024-P3-3 ("Trust Matrix real-time") was left operator-gated with no deterministic driver path — the same NEEDS-REVIEW gap this FID's trigger-path discipline must close.

**B2. Emission is async post-write (acceptable, but untested live).**
- `native.ts:696` — the `provenance_receipt` chunk is emitted in `.then()` after the receipt promise resolves; there is no live-streaming test asserting the row count increments during an active run (only the pure reducer is unit-tested: `trust-matrix.test.ts` 7/7).

#### Workstream C — Teacher panel

**C1. Double-spacing.**
- `cli/src/components/savant-ui/teacher/learn-overlay.tsx:61-62` — root `<box flexDirection="column" gap={1}>` with up to ~25 text children: header, objective, prompt, guidance, phase line, up to 20 event rows (`:86-91`), completion label, receipt line, progression line. Every event is its own `gap=1`-separated row with a `  • ` prefix (`:89`).
- Contrast: the `Session` section renders compact `KeyValueRow`s (`key-value-row.tsx`, row flex, no vertical gap between rows). The Teacher section is visibly double-spaced/airier than every other sidebar section.

**C2. Terminal state dropped (cancellation invisible).**
- `right-sidebar.tsx:261-268` passes only `challenge/events/receipt/persisted/competencyState` to `LearnOverlay` (mount at `:261-262`, props at `:263-268`) — **`phase` and `completionState` are dropped**.
- `learn-overlay.tsx:44-49` re-derives both from the event log: `completionState = last?.type === 'result' ? last.state : null`; `phase = completionState ? 'result' : last?.type`.
- `cli/src/teacher/runtime.ts:275-278` `cancelTeacherExercise()` sets `completionState = 'cancelled'` **without pushing a `result` event** (events are only pushed at `:237` on `type === 'result'`).
- Net effect: after `/learn cancel`, the panel stays mounted (`challenge` is still non-null — `active` is not cleared) rendering the **last live phase** with **no completion badge** — a cancelled attempt looks perpetually in-progress. (Cataloged in the A–Z export Agent View at `dev/scratchpad/az-export-text.txt:9011-9012`.)

## RED — Issue Catalog (evidence)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| A-01 | high | `compacting` phase never emitted — sidebar `compacting…` is dead code; promised `idle → compacting… → compacted` cannot render | `context-tokens.ts:208-220` (only `warning`/`compacted`/`idle`); `right-sidebar.tsx:92-94` (dead case); `common/src/types/session-state.ts:133` (type allows it); grep `'compacting'` in `packages/agent-runtime/src` → 0 emit sites |
| A-02 | high | Pruner spawn (`handle-steps.ts:133-157`) writes no `compactionStatus` — sidebar stuck on stale `warning` during/after real pruner runs | `handle-steps.ts:133-157` (no status write); `send-message-monitors.ts:80-91` (2s poll of last step-boundary status) |
| A-03 | medium | Display percent uses ContextCompactor threshold (`contextWindow − 30k`); pruner trigger uses `maxContextLength × 0.8` (`= contextWindow × 0.8`) — "102% of auto threshold" is misleading (≈90% of window) and shows no relation to the trigger | `context-compactor.ts:80,189-190`; `loop-context.ts:279-280`; `handle-steps.ts:133,147`; `right-sidebar.tsx:84` |
| A-04 | medium | Pruner re-spawns every step above 80% (`while(true)` yield); ineffective summaries score failures and re-arm — silent re-compaction loop reads as "too aggressive" with zero feedback | `handle-steps.ts:147`; `context-compactor.ts:222-238` |
| B-01 | medium | Trust Matrix is event-sourced-only with no live session signal — static between write/verdict events; read-only sessions show placeholder forever; no deterministic real-time trigger path (V024-P3-3 operator-gated) | `native.ts:681-700`; `right-sidebar.tsx:276-284`; `trust-matrix.tsx:106-117`; `dev/scratchpad/az-v0.0.24-harness-live-test-report.md` V024-P3-3 |
| C-01 | medium | Teacher panel double-spacing: `gap={1}` column with up to 25 text children, each event its own row with `  • ` prefix — inconsistent with compact `KeyValueRow` sections | `learn-overlay.tsx:61-62,86-91`; `key-value-row.tsx` |
| C-02 | high | `/learn cancel` invisible in the panel: `phase`/`completionState` dropped by the sidebar; `cancelTeacherExercise()` sets `completionState='cancelled'` without a `result` event; panel stays mounted with no completion badge | `right-sidebar.tsx:261-268`; `learn-overlay.tsx:44-49`; `runtime.ts:275-278,237`; `dev/scratchpad/az-export-text.txt:9011-9012` |

## GREEN — Proposed Solution (converged)

1. **A — Real compaction lifecycle on the same status channel.**
   - Make `agents/savant/handle-steps.ts` write `agentState.compactionStatus = { phase: 'compacting' }` when it yields the pruner spawn (`:133-157`), and have the pruner completion path (`packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts:196-200`, the `set_messages` boundary) write `{ phase: 'compacted', tokensSaved }` (or `{ phase: 'warning' }` when the post-pruner token count is still over threshold). This makes the sidebar transition `idle → warning → compacting… → compacted` real.
   - Reconcile the thresholds: compute the displayed `percentUsed` against the **same** denominator the pruner trigger uses (`maxContextLength × 0.8`), and change the sidebar label from `⚠ N% of auto threshold` to a window-relative readout (e.g., `⚠ N% of window · compacting…` / `✓ cleared −N tokens`), so the number matches what the operator sees in the Context row and in the agent's behavior.
   - Prevent the silent re-compaction loop: after a pruner run, `handle-steps.ts` must not re-yield on the immediately following steps while the compacted summary is still settling — gate the re-spawn on a cooldown/`awaitingCompactionScore`-style guard (reuse the existing anti-thrash scoring; surface a `warning` status with the degradation reason when the pruner was ineffective instead of re-spawning blindly).
   - **Split the two `compacted` meanings (adversarial refinement):** today `context-tokens.ts:212-216` writes `phase: 'compacted'` whenever the **micro-compact** clears tool results — so "✓ cleared −N tokens" already renders for tool-result clearing and would falsely imply a full summarization once the pruner writes the same phase. Keep micro-compact as its own distinct label (e.g., `✓ micro −N tokens`) and give the full context-pruner summarization its own outcome (`compacted` with the pruner's real `tokensSaved`, or a separate `pruned` phase in `CompactionStatus`).
2. **B — Trust Matrix live session signal + deterministic trigger path.**
   - Add a live "N signed events this session" line to the panel fed by the existing 2s heartbeat (`send-message-monitors.ts`) reading the store's `provenanceEvents.length` (read-only; no new store), so the panel provably updates during a session and a static panel is legible as "no new writes."
   - Add a deterministic trigger path closing V024-P3-3: an executable test (driver-style, mirroring `dev/test-prompts/az-teacher-driver.ts`) that runs a stub write through the runtime, asserts `provenance_receipt` emission → store append → `reduceTrustMatrixEvents` row count increments, so "real-time" is asserted without an interactive TUI session.
3. **C — Teacher panel: compact rows + real terminal state.**
   - Pack the event list: render events as a single compact block (no per-event `gap=1`; keep the bounded 20-event cap) and drop the redundant `  • ` prefix or align it to the phase line — consistent vertical rhythm with `KeyValueRow` sections.
   - Pass `phase` + `completionState` through `right-sidebar.tsx` → `LearnOverlay`, and render the completion badge from the runtime's `completionState` (falling back to the derived one), so `cancelled`/`unavailable` render a terminal badge after `/learn cancel` (and the panel correctly shows a cancelled attempt, never a perpetual in-progress one).
   - Add render tests: cancelled-terminal state, and a spacing/packing assertion (event count does not inflate row count).

**Out of scope:** changing the trust model or ledger semantics; adding any control/write path to the sidebar; re-architecting `ContextCompactor` internals beyond the status/denominator reconciliation; the bundled sub-agent model-override question (AV-02 in the 0.0.24 report) is tracked separately.

## Verification Matrix (exit gates)

| Area | Hard evidence |
|---|---|
| Compaction lifecycle | `handle-steps.ts`/pruner writes `compacting`+`compacted`; sidebar renders `idle → warning → compacting… → compacted (−N)`; grep `phase: 'compacting'` in `packages/agent-runtime/src` → ≥1 emit site; unit test asserts the transition sequence |
| Denominator | `percentUsed` and pruner trigger share one threshold; sidebar label is window-relative; test pins the percent for a known window/count |
| Re-spawn loop | Test asserts no blind re-yield immediately after a pruner run; ineffective pruner yields a visible `warning` |
| Trust Matrix live | New test: stub write → `provenance_receipt` → store append → row count increments; heartbeat "N signed events" line renders |
| Teacher spacing | Render/packing test; panel row count is bounded by events, not inflated |
| Teacher terminal state | `/learn cancel` render test: completion badge shows `cancelled`; `phase`/`completionState` plumbed through `right-sidebar` |
| Repository | typecheck ×4, ESLint zero warnings, Markdownlint, Prettier, `validate:repository`, fid-ledger, full root test suites |

## Governance and Release Boundary

This FID adds no write/control authority to the sidebar, changes no ECHO law, and alters no ZTAP trust semantics. All changes remain subject to the FID Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL → COMPLETE), the Nova planning + implementation audits, and operator approval before any closure, commit, push, release, or deployment.

## Open Questions (to be resolved in the loop)

1. **Re-spawn guard:** reuse the existing anti-thrash `awaitingCompactionScore`/circuit-breaker (recommended, least new surface) or add a dedicated post-pruner cooldown? Default: reuse anti-thrash.
2. **Status writer shape:** `handle-steps.ts` is serialized via `.toString()`/eval and must stay closure-free — the `compacting`/`compacted` writes must be literal-only (like the existing threshold literals). Confirm this constraint in AUDIT.
3. **Trust Matrix counter:** heartbeat-driven count line vs. a per-event animation — default: static count line (no new polling cadence beyond the existing 2s heartbeat).

---

## Perfection Loop

### Missed Questions

Asked during the loop, as required: "What questions should I have asked when this FID was created, but failed to?"

1. **Is the `compacted` phase already in use?** Yes — micro-compact writes it (`context-tokens.ts:212-216`). This drove the adversarial refinement splitting micro (`compacted`) from full-pruner (`pruned`) outcomes; without it the fix would have falsely labeled tool-result clearing as a full summarization.
2. **Is the pruner's completion boundary reachable from the runtime (non-serialized)?** Yes — `parentAgentState` is available at the `set_messages` boundary in `spawn-agent-inline.ts:196-200`, which is where the `pruned`/`warning` result write and the `lastPrunerCompletionAt` cooldown stamp land.
3. **Does the serialized `handleSteps` stay closure-free with the new writes?** The `compacting` write and cooldown guard use only literals, params, and `agentState` fields — no closure variables — preserving the `.toString()`/eval contract (`agents/savant/handle-steps.ts` factory comment).
4. **Is the display percent honest?** The window-relative denominator (`maxContextLength = autoCompact + 30k`) equals the pruner-trigger denominator, so "N% of window" aligns with both the Context row and the actual pruner trigger.
5. **Which FID references are graph-resolvable?** The 022/023 archive records are intentionally untracked working-tree records, so `Depends On` must not carry their FID tokens (fid-ledger certifies only tracked + closed dependencies).

### Code Verification Evidence

```text
$ grep -rn "'compacting'" packages/agent-runtime/src common/src cli/src/state | grep -v test
common/src/types/session-state.ts:133: phase: 'idle' | 'compacting' | 'compacted' | 'pruned' | 'warning'   # type union only
$ bun test agents/__tests__/context-pruner-phase3.test.ts        # 10 pass / 0 fail (incl. 3 new lifecycle tests)
$ bun test packages/agent-runtime/src/context-compactor.test.ts src/provenance src/tools/handlers/tool   # 125 pass / 0 fail
$ bun test cli/src/components/savant-ui/teacher/__tests__/learn-overlay.test.ts \
  cli/src/components/savant-ui/echo/__tests__/trust-matrix.test.ts \
  cli/src/components/savant-ui/echo/__tests__/trust-matrix-live.test.ts \
  cli/src/state/__tests__/chat-store-teacher.test.ts             # 22 pass / 0 fail
$ bun run prebuild:agents (cli)                                  # bundled-agents.generated.ts regenerated with new literals
$ tsc --noEmit (sdk, common, agent-runtime, cli)                 # exit 0 ×4
$ bun x eslint . --max-warnings 0                                # 0 warnings
$ bun run lint:md                                                # 0 issues
$ bun x prettier --check <changed files>                         # all formatted
$ bun run validate:repository                                    # PASS
```

### Loop 1 — RED (catalog)

Issues A-01…A-04, B-01, C-01…C-02 cataloged with `file:line` evidence (see RED table). Severities: A-01/A-02/C-02 high; A-03/A-04/B-01/C-01 medium. **Exit: all issues cataloged.**

### Loop 1 — GREEN (converged solution)

Three-workstream solution documented: real compaction lifecycle on the existing `compactionStatus` channel, Trust Matrix live session signal + deterministic trigger path, teacher panel packing + terminal-state plumb-through. **Exit: all fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep, absence-shaped):**

```text
$ grep -rn "'compacting'" packages/agent-runtime/src common/src cli/src/state | grep -v test
common/src/types/session-state.ts:133:  phase: 'idle' | 'compacting' | 'compacted' | 'warning'   # type union only
$ grep -rn "compactionStatus" packages/agent-runtime/src | grep -v test
context-tokens.ts:209,214,220                                   # 'warning'/'compacted'/'idle' writers only
$ grep -rn "'compacting'" cli/src | grep -v test
right-sidebar.tsx:92: case 'compacting':                        # dead UI label
$ grep -n "compactionStatus" agents/savant/handle-steps.ts
(no matches)                                                   # pruner spawn writes no status
```

**Method 2 (manual verification of the cited code, read 0-EOF):**

| Claim | Verdict | Evidence |
|---|---|---|
| A-01 `compacting` never emitted | **PASS** | Only writer `context-tokens.ts:208-220` sets `warning`/`compacted`/`idle`; only non-type occurrence of `'compacting'` is the dead sidebar case `right-sidebar.tsx:92-94` |
| A-02 pruner spawn writes no status | **PASS** | `handle-steps.ts:133-157` yields `spawn_agent_inline` with no `compactionStatus` write (grep: 0 matches) |
| A-03 threshold divergence | **PASS** | `context-compactor.ts:80` `autoCompact = max(window−30k, 100k)`; `:189-190` percent = `context/autoCompact`; `loop-context.ts:279-280` `maxContextLength = autoCompact+30k`; `handle-steps.ts:133,147` spawn at `×0.9`/`×0.8`; label `right-sidebar.tsx:84` "% of auto threshold" |
| A-04 re-yield every step | **PASS** | `handle-steps.ts:128-158` `while (true)` re-yields the spawn every iteration while `> maxContextLength × 0.8`; ineffective summaries score failure (`context-compactor.ts:222-238`) and re-arm |
| B-01 event-sourced only, no live signal | **PASS** | Emit sites: `native.ts:681-700` (writes), `spawn-agents.ts:275`, `spawn-agent-inline.ts:178` (verdicts); no store timer; panel static between events; V024-P3-3 operator-gated with no driver |
| C-01 double spacing | **PASS** | `learn-overlay.tsx:61-62` root `gap={1}` column; `:86-91` up to 20 event rows each its own text child; contrast `key-value-row.tsx` compact rows |
| C-02 cancel invisible | **PASS** | `runtime.ts:237` sets `completionState` only on `type==='result'`; `runtime.ts:275-282` `cancelTeacherExercise()` sets `'cancelled'` with no event; `right-sidebar.tsx:261-268` passes no `phase`/`completionState` |

**Law 4 (call-graph):** the GREEN plan writes existing `agentState.compactionStatus`/`compactionStatus` store fields and reads existing `provenanceEvents` — no new public function or config field is introduced that requires a caller grep. `formatCompactionStatus` is an existing production consumer. **AUDIT passes → ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **A-01 CONFIRMED:** the only `'compacting'` occurrences repo-wide (non-test) are the type union and the dead UI case — the promised `idle → compacting… → compacted` transition is structurally impossible to render.
- **A-03 CONFIRMED with nuance:** `maxContextLength = autoCompact + 30k` equals `contextWindow` only for windows ≥ 130k; all bundled models exceed this, so "= contextWindow × 0.8" holds in practice (verified for the 262k live-test window).
- **B-01 CONFIRMED:** no timer/heartbeat feeds the matrix; between write/verdict events the panel cannot change.
- **C-02 CONFIRMED:** cancellation produces no event and the sidebar drops `completionState` — the panel cannot represent `cancelled`.
- **OMISSION REFINED (added to GREEN):** `phase: 'compacted'` is currently shared by **micro-compact** (`context-tokens.ts:212-216` sets it whenever `microResult.tokensSaved > 0`) and the would-be pruner result — so "✓ cleared −N tokens" already renders for tool-result clearing and would falsely imply a full summarization. GREEN must **split the two meanings**: micro-compact clears tool results (keep as a distinct label), the pruner result writes a new full-summarization outcome (e.g., `compacted` with `tokensSaved` from the pruner, or a separate `pruned` phase).
- **No refutations; no other omissions.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 1 — COMPLETE (planning)

Plan converged after one loop pass: zero actionable improvements beyond the recorded refinement; no oscillation; delta well under the 10% cap. FID status → `analyzed`. Nova planning sign-off request staged at `dev/nova/outbox/2026-08-14-fid-2026-0814-001-live-sidebar-surfaces-planning-signoff-request.md`. Implementation is not approved until Nova planning PASS + operator approval; closure additionally requires the implementation audit.

### Nova planning review (2026-08-14)

Independent planning audit returned **PASS — planning approved for operator decision** (`dev/nova/inbox/2026-08-14-fid-2026-0814-001-live-sidebar-surfaces-planning-response.md`): all 6 hard questions and all 7 claims (A-01…C-02) verified at source; zero flags. One **precision observation, accepted and corrected**: the teacher `LearnOverlay` mount was cited as `right-sidebar.tsx:232-239` but is actually at `:261-268` (verified by grep — `LearnOverlay` props at `:263-268`). The claim itself (no `phase`/`completionState` passed) verifies; this FID now cites `:261-268`. Planning PASS authorizes no implementation, closure, commit, push, or release — those remain operator-gated.

## Resolution

Implemented under the operator's automation level 3 grant (Autonomous: execute + verify), 2026-08-14, after the Nova planning PASS.

**Workstream A — Compaction lifecycle (A-01…A-04 + adversarial refinement):**

- `agents/savant/handle-steps.ts` — the serialized savant handleSteps now writes `agentState.compactionStatus = { phase: 'compacting' }` before every proactive/force/idle pruner spawn, and gates the 0.8 proactive spawn behind a 30s cooldown (`prunerCooldownMs` vs `agentState.lastPrunerCompletionAt`); the 0.9 force path still fires for hard-overflow safety. `cli/src/agents/bundled-agents.generated.ts` regenerated via `bun run prebuild:agents`.
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts` — the context-pruner completion boundary (`set_messages`, main-agent only) stamps `lastPrunerCompletionAt` and writes `phase: 'pruned'` with an estimated `tokensSaved` when messages were removed, or `phase: 'warning'` when a real proactive/force compaction removed nothing (the amortized fold never overwrites).
- `packages/agent-runtime/src/run-agent-step/context-tokens.ts` — status `percentUsed` is now window-relative (`maxContextLength = autoCompact + 30k`), aligning the displayed percent with the Context row and the pruner trigger.
- `common/src/types/session-state.ts` — `CompactionStatus.phase` adds `'pruned'`; `AgentState` adds `lastPrunerCompletionAt?`.
- `common/src/templates/initial-agents-dir/types/agent-definition.ts` — the agents-side `AgentState` mirror adds `compactionStatus` + `lastPrunerCompletionAt` for the serialized-handleSteps contract.
- `cli/src/components/right-sidebar.tsx` — `formatCompactionStatus` splits micro vs pruner outcomes: `⚠ N% of window` / `✓ micro −N tokens` / `✓ pruned −N tokens` / `compacting…` / `idle`.
- `cli/src/components/help-banner.tsx` — governance legend updated to the new lifecycle.
- Tests: `agents/__tests__/context-pruner-phase3.test.ts` +3 (compacting emit, cooldown backoff, force bypass during cooldown) + serialization literal checks.

**Workstream B — Trust Matrix live signal (B-01):**

- `cli/src/components/savant-ui/echo/trust-matrix.tsx` — live `N signed event(s) this session` footer in both the empty and populated states (reactive via the store selector; no new polling cadence).
- `cli/src/components/savant-ui/echo/__tests__/trust-matrix-live.test.ts` (new) — closes V024-P3-3 headlessly: store append (`addProvenanceEvent`) → `reduceTrustMatrixEvents` row count increment, plus the footer source assertion.

**Workstream C — Teacher panel (C-01, C-02):**

- `cli/src/components/savant-ui/teacher/learn-overlay.tsx` — event log packed into one compact block (no per-event gap, single `•` prefix); new optional `phase`/`completionState` props; the runtime values are authoritative when provided, falling back to the derived event-log state — closing the `/learn cancel` gap (cancel sets `completionState='cancelled'` with no result event).
- `cli/src/components/right-sidebar.tsx` — forwards `teacherState.phase`/`completionState` to `LearnOverlay`.
- Tests: `learn-overlay.test.ts` +2 (runtime-completion precedence for cancellation, compact single-bullet rows).

**Quality ratchet:** documented approved-growth entries raised (never lowered) for `common/src/types/session-state.ts`, `common/src/templates/initial-agents-dir/types/agent-definition.ts`, `packages/agent-runtime/src/run-agent-step/context-tokens.ts`, `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`, `agents/savant/handle-steps.ts`, `cli/src/components/help-banner.tsx`, and `cli/src/components/right-sidebar.tsx` in `dev/quality-baseline.json`.

**Gates:** typecheck ×4 exit 0 · focused suites 22/22 (CLI) + 125/125 (agent-runtime) + 10/10 (agents phase3) · ESLint 0 warnings · lint:md 0 · Prettier clean · `validate:repository` PASS. Status → `fixed`. A Nova implementation sign-off request was staged at `dev/nova/outbox/2026-08-14-fid-2026-0814-001-live-sidebar-surfaces-implementation-signoff-request.md`; closure additionally requires the Nova implementation audit PASS and operator approval.

### Nova implementation review (2026-08-14)

Independent implementation audit returned **PASS — implementation independently verified; eligible for operator closure** (`dev/nova/inbox/2026-08-14-fid-2026-0814-001-live-sidebar-surfaces-implementation-response.md`). All 7 hard questions verified at source with quoted `path:line` evidence (spot-re-verified here: `handle-steps.ts:123,144,162` compacting emits; `spawn-agent-inline.ts:219,228,240` pruner result/cooldown; `context-tokens.ts:210-212,219,225,230` window-relative percent; `trust-matrix.tsx:121,172` footers; `learn-overlay.tsx:68,74` + `right-sidebar.tsx:278-279` teacher props). Zero flags; no ECHO law weakened; no new authority. The implementation PASS verifies the code — it does **not** authorize closure, archive movement, commit, push, release, or deployment; operator closure is the remaining gate.
