# Session Summary: 2026-09-18 19:45

**Session ID:** 2026-09-18-1945-compaction-signal-repin-retirement
**Duration:** ~17:26 — 19:45 EDT
**Status:** completed

---

## Initial State

### Environment

- **OS:** win32 (Git Bash / MSYS)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Branch:** `main`, 4 commits ahead of `origin/main`, working tree clean at start
- **Last Commit:** `27c1f020` — `docs(protocol): close + archive FID-2026-0918-003 with receipt`

### Known Issues

- Operator-reported regression: the compaction summary pinned to the bottom of
  the chat window after completing and never scrolled with history. Every
  message sent after a compact still showed the summary as the last message.
  Two prior fixes (FID-2026-0916-008, FID-2026-0917-006) had not resolved it.

### Dependencies

- None external. Monorepo workspaces `cli`, `packages/agent-runtime`, `common`.

---

## Planned Work

1. [x] RED: root-cause the compaction-signal re-pin
2. [x] Create FID-2026-0918-004
3. [x] Part 1: replace the nullable-epoch retirement with an active-flag +
   retired-value scheme
4. [x] Part 2: emit a dedupe-guarded `compaction_summary` from
   `runMicroCompactPass`
5. [x] Update tests + regression coverage
6. [x] AUDIT (Verifier + Adversary), self-correct findings, close + archive

---

## Work Completed

### Task 1: Root-cause the re-pin (RED)

- **Status:** completed
- **FIDs Created:** FID-2026-0918-004
- **Changes Made:** no code; evidence cataloged with file:line.
- **Verification:** grep evidence across cli + agent-runtime; two independent
  Detective passes; Thinker adversarial analysis of five candidate causes.

**Root cause (two independent holes in the FID-2026-0917-006 retirement
scheme):**

1. `compactionStatusEpochOf` (`compaction-helpers.ts:90-105`) returns `null`
   for every live phase (`warning`/`blocked`/`compacting`/`idle`), but the
   suppression guards required `!== null` to fire. `onNewUserMessage`
   (`sidebar-actions.ts:227`) stamped that null whenever the previous run
   ended on a live phase — which is the **ordinary** post-compaction regime:
   after a compaction that does not drop context back below threshold, every
   subsequent run ends on `phase: 'warning'`. A null stamp suppresses nothing.
2. `applyCompactionStatus` (`sidebar-reset.ts:43-45`) cleared **both** stamps
   on any non-matching status, so the live `warning` of run N+1 retired the
   retirement itself; the stale seed re-mirror (`previousRunStateRef` →
   heartbeat → `adoptAndPersist`) was then accepted as fresh, re-pinning the
   panel **and** double-counting `compactionCount` via `recordRun`.

Secondary design gap: the main-agent micro-compact path never emitted a
`compaction_summary` print-mode event (only the subagent pruner boundary did),
so micro-compact outcomes had no in-stream scrollable record and lived only in
the pinned panel.

### Task 2: Part 1 — retirement hardening

- **Status:** completed
- **Changes Made:**
  - `cli/src/state/chat-store/types.ts`: added `compactionSignalRetired:
    boolean`, `retiredCompactionStatus`, `retiredCompactionReport`; removed the
    two epoch fields.
  - `cli/src/state/chat-store/initial-state.ts`: matching initial values.
  - `cli/src/state/chat-store/compaction-helpers.ts`: added
    `sameCompactionReport`; re-documented `compactionStatusEpochOf` as the
    terminal-outcome predicate that decides retirement *termination*.
  - `cli/src/state/chat-store/sidebar-reset.ts`: `applyCompactionStatus` now
    drops an exact-value re-mirror; records a live phase as the current status
    **without** ending the retirement; ends it only on a genuinely new
    terminal outcome. Falls through to `recordRun` in every branch.
  - `cli/src/state/chat-store/sidebar-actions.ts`: `onNewUserMessage` arms the
    retirement and captures the outgoing values before clearing them;
    `setLastCompactionReport` defers any report while armed (lossless — the
    next mirror re-delivers once a terminal status ends the retirement); both
    reset paths clear the three fields.

### Task 3: Part 2 — micro-compact in-stream emission

- **Status:** completed
- **Changes Made:**
  - `packages/agent-runtime/src/run-agent-step/context-tokens-compaction.ts`:
    `runMicroCompactPass` emits a dedupe-guarded `compaction_summary`
    print-mode event (WeakMap keyed by agentState, mirroring
    `emitCompactionStatus`) when `tokensSaved > 0` and the agent has no parent.
    No type widening needed — `onResponseChunk` already accepts the full
    `PrintModeEvent` union.
- **Verification:** Law 4 call-graph reachability confirmed:
  `runMicroCompactPass` ← `context-tokens.ts:204` (`prepareStepContext`) ←
  `loop-iteration.ts:107` (production step loop).

### Task 4: Tests

- **Status:** completed
- **Changes Made:**
- `cli/src/state/__tests__/chat-store-compaction.test.ts`: migrated
    epoch-field assertions to the new scheme (141 lines after the split).
  - `cli/src/state/__tests__/chat-store-compaction-retirement.test.ts` (new):
    the 8 durable-retirement tests, split out so the original stays under the
    300-line quality ceiling — includes the regression tests for the
    live-phase re-pin hole and the report-lateness hole.
  - `packages/agent-runtime/src/run-agent-step/__tests__/context-tokens-compaction-micro-summary.test.ts`
    (new): 4 tests — emission contract, WeakMap dedupe across step
    boundaries, subagent `parentId` suppression gate, no-op silence.

### Task 5: Audit + self-correct + archive

- **Status:** completed
- **Verification:** typecheck cli ✓, agent-runtime ✓, common ✓; eslint
  `--max-warnings 0` ✓ (one `import/order` warning auto-fixed); prettier ✓
  (all 8 changed files); markdownlint ✓ (one MD040 fixed by tagging the
  evidence fence `text`); chat-store-compaction 18/18 ✓ (60 expect calls);
  agent-runtime 83/83 ✓ (192 expect calls).

The Verifier returned zero FAILs and three NEEDS-REVIEW items it could not
confirm without disk access; all three were resolved by the Orchestrator with
disk evidence. The Adversary confirmed all PASSes and the three resolutions,
then found two real findings, both fixed in self-correct:

- **OMISSION** — the FID's Verification section promised a Part 2 runtime
  test that had not been written. Fixed: the 4-test
  `context-tokens-compaction-micro-summary.test.ts` was added.
- **ADJUSTED (low)** — the armed-window live-phase branch early-returned,
  skipping `recordRun` and silently swallowing the
  `compacting → warning` ineffective-pruner lifecycle event. Fixed: the branch
  now records the live status and falls through to the shared `recordRun`
  derivation while keeping the retirement armed.

FID closed (`verified`), markdownlint-cleaned, and archived to
`dev/fids/archive/`.

---

## Issues Discovered

### Issue 1: EHEL gate circular block (process, severe)

Editing `compaction-helpers.ts` first broke the workspace typecheck; the gate
then held that file unverified and refused writes to `sidebar-actions.ts` —
the only file that could repair the typecheck. Required the operator to end
the turn twice to unlock.

### Issue 2: `run_readonly_command` metacharacter guard over-broad (process)

Rejected `echo "EXIT:$?"`, `;`, and `||`, forcing plain re-runs and dropping
useful composition.

### Issue 3: Law 4 turn-end block on a correctly-wired file (process)

Blocked on `context-tokens-compaction.ts` "callers not verified" even though
the chain is real and short. Cost a manual grep round.

### Issue 4: Verifier subagent had no disk access (process)

Zero FAILs but three NEEDS-REVIEW items it could not check, pushing real
verification onto the Orchestrator + Adversary.

### Issue 5: FID verification contract violated silently (process)

The FID promised a runtime test in its Verification section that was never
written; nothing in the loop caught it until the Adversary read the FID
against the tests.

### Issue 6: FID-2026-0917-006 was the fragile layer (regression)

Its nullable-epoch scheme is exactly what re-broke — the second
compaction-signal fix in two days. Lesson now recorded in the archived FID: a
suppression scheme keyed on a value that can legitimately be `null` cannot
distinguish "no suppression active" from "suppression active with no stable
identity."

### Issue 7: `str_replace` collisions corrupted the test file (tooling)

Overlapping replacements produced literal `})expect(...)`; resolved with a full
`write_file` rewrite. A TypeScript cast on `mock.calls` also failed to
overlap (4 errors) — fixed by closing over the mock directly.

---

## Lessons Learned

1. A suppression scheme keyed on a value that can legitimately be `null`
   cannot distinguish "no suppression active" from "suppression active with no
   stable identity." Prefer an explicit active flag + captured values so
   suppression is an equality test over the full domain.
2. Order interlocked multi-file edits so no intermediate state breaks the
   typecheck, or the EHEL gate will deadlock mid-batch.
3. An FID's Verification section is a contract; each promised test artifact
   must exist before `verified` status is earned.

### Issue 8: Quality-ratchet ceiling breach (tooling, self-caught)

Adding the regression tests pushed `chat-store-compaction.test.ts` to 321
lines, over the 300-line absolute maximum — caught by
`bun run validate:repository` (`quality.ratchet`) during session close. Fixed
by splitting the FID-2026-0918-004 retirement suite into its own colocated
file; `validate:repository` then passed.

### Issue 9: LEARNINGS schema violations (tooling, self-caught)

The two new lessons failed `bun run learnings:check` on scope (must be exactly
`internal`/`embedded`/`release`), evidence (must be clean comma-separated
`path → kind:target` items resolvable to exactly one match), and canonical
rule (each needs a `## Rule:` heading in `dev/LEARNING-RULES.md`). All fixed;
`learnings:check` now PASSes with 18 structured entries.

1. **Commit** the changed files + the archived FID (nothing committed yet).
2. **Push** only when the operator authorizes (4 prior local commits also
   unpushed).
3. **Live TUI confirmation** that the re-pin is gone in a real session.

## Pointers

- FID: `dev/fids/archive/FID-2026-0918-004-compaction-signal-repin-retirement.md`
- Governing protocol: `ECHO.md` (v0.2.0)
- FID ledger: `dev/fids/README.md`

---

## Pending After Handoff