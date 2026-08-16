<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Extend az-v0.0.24 Harness Live Test with FID-2026-0814-002..007 Coverage

**Filename:** `FID-2026-0814-008-az-v024-live-test-002-007-coverage.md`
**ID:** FID-2026-0814-008
**Severity:** medium
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — reuses the existing `az-v0.0.24-harness-live-test.md` row/ID machinery (a new `5e` phase + static-grep rows + two Phase 3 live rows + Agent View items); adds no new code, no new config, no new store, no new test harness — only deterministic rows pointing at the already-shipped suites for FID-2026-0814-002..007

---

## Summary

`dev/test-prompts/az-v0.0.24-harness-live-test.md` (v1.1.0) covers the 0.0.24
delta only through `FID-2026-0814-001`: ZTAP provenance, the Teacher, the
version-bump tool, harness observability (`023`), and the live-sidebar
remediation (`001`). The five-child remediation program just closed
(`FID-2026-0814-002..007` — durable goal mode, hook system, harness frictions +
project-wide model unification, Trust Matrix `no_verdict` resolution, compaction
freshness + visible feedback) has **no deterministic rows** in the test. Those
features would only surface indirectly through the Agent View (§7), never as a
`PASS`/`FAIL` with a concrete trigger path. The operator's directive: *"I am
not testing something that is not complete."* — the prompt must be complete
before the next live run.

This FID extends the prompt with a `5e` phase (FID-2026-0814-002..007), a
matching set of static-grep absence/presence rows, two operator Phase 3 live
rows (`/goal`, and the compaction signal), and three Agent View re-examination
items — all pointing at already-shipped suites and already-wired call sites.

---

## Perfection Loop

### Missed Questions

Asked during the loop, as required: "What questions should I have asked when this FID was created, but failed to?"

1. **Do the referenced suites exist and stay deterministic?** Yes — every `5e` row points at a suite/grep verified on disk during the loop (goal engine/tools/driver, hook runner+engine, micro-compact, model-store, compaction-store, pruner phase-3, provenance `no_verdict`, run-readonly-command H-02, snapshot FID-006); no row degrades to `NEEDS-REVIEW`.
2. **Does the `5e` phase collide with existing row IDs?** No — the prior range ends at V024-146; the new rows start at V024-150 (through V024-167), verified no collision.
3. **Do any rows point at renamed/moved suites?** The two later-added rows (V024-164 `run-readonly-command.test.ts`, V024-165 `snapshot.test.ts`) were re-verified against their actual paths during Loop 2.

### Code Verification Evidence

```text
$ grep -n "update_goal\|get_goal" common/src/tools/constants.ts agents/savant/savant.ts
(registered + on the main agent template)
$ grep -n "PreToolUse" packages/agent-runtime/src/tools/tool-executor/native.ts
(additional project gate wired)
$ grep -n "no_verdict" common/src/types/provenance.ts packages/agent-runtime/src/provenance/session.ts
(receipt status + finalize)
$ grep -rn "CompactionSignal" cli/src/components/compaction-signal.tsx cli/src/chat/panels.tsx
(component + mount)
$ grep -rn "deepseek/deepseek-v4-pro" cli/src/teacher cli/src/headless-run.ts
(no match — no paid hardcode in the run path)
```

### Loop 1 — RED (catalog)

- **Gap A (goal mode, FID-002):** the prompt has no row for the durable goal
  engine. Deterministic suites exist: `goal-engine.test.ts`,
  `goal-tools.test.ts`, `goal-driver.test.ts`; the tools are registered
  (`common/src/tools/constants.ts:86,88,129,130`,
  `agents/savant/savant.ts:160-161`) and the continuation driver is called from
  `packages/agent-runtime/src/main-prompt.ts` (`driveGoalTurns`).
- **Gap B (hook system, FID-003):** no row for the `hooks:` config or the
  `PreToolUse` gate. Suites exist (`hooks/__tests__/runner.test.ts`,
  `engine.test.ts`); the gate is wired at
  `packages/agent-runtime/src/tools/tool-executor/native.ts:340-347`; config
  parsing is in `common/src/util/protocol-config.ts` (`parseHookConfigs`).
- **Gap C (harness frictions + model unification, FID-004):** no row for the
  exit-code-preserving micro-compact (`context-compactor-micro.test.ts`), the
  H-07 factory threading (`agents/__tests__/context-pruner-phase3.test.ts`), or
  the P0 one-model invariant (`cli/src/state/__tests__/savant-free-model-store.test.ts`;
  paid hardcode now absent from the run path).
- **Gap D (Trust Matrix resolution, FID-005):** no row for `no_verdict`
  (`common/src/types/provenance.ts:26`; `provenance/session.ts:307`).
- **Gap E (compaction feedback, FID-006):** no row for the `CompactionSignal`
  (mounted at `cli/src/chat/panels.tsx:211`) or the SDK-boundary
  `contextWindow`/`compression` threading
  (`sdk/src/run/execution.ts:95-96,338-339`).
- **Exit: all gaps cataloged.**

### Loop 1 — GREEN (converged solution)

Add to `dev/test-prompts/az-v0.0.24-harness-live-test.md`:

1. **New `5e` phase — FID-2026-0814-002..007 (goal engine, hooks, frictions +
   model unification, Trust Matrix resolution, compaction feedback)** with rows:

   | ID | Test | Expected |
   |---|---|---|
   | V024-150 | `cd packages/agent-runtime && bun test src/run-agent-step/__tests__/goal-engine.test.ts src/tools/handlers/tool/__tests__/goal-tools.test.ts src/__tests__/goal-driver.test.ts` | Exit 0 (state machine, budgets, tools, continuation driver — DI-seamed, no module mocking) |
   | V024-151 | `cd packages/agent-runtime && bun test src/hooks/__tests__/runner.test.ts src/hooks/__tests__/engine.test.ts` | Exit 0 (fail-open runner + allow/block engine) |
   | V024-152 | `cd packages/agent-runtime && bun test src/context-compactor-micro.test.ts` | Exit 0 (exit-code-preserving placeholder, pressure gate, keep-recent) |
   | V024-153 | `cd cli && bun test src/state/__tests__/savant-free-model-store.test.ts` | Exit 0 (one-model invariant: no run path constructs a paid model when the store resolved free) |
   | V024-154 | `cd cli && bun test src/state/__tests__/chat-store-compaction.test.ts` | Exit 0 (bounded `CompactionSignal` lifecycle events) |
   | V024-155 | `cd agents && bun test __tests__/context-pruner-phase3.test.ts` | Exit 0 (H-07: `keepRecentTokens`/ratios threaded as baked literals) |
   | V024-156 | `cd packages/agent-runtime && bun test src/provenance/__tests__/provenance.test.ts` | Exit 0 (`finalize` resolves open receipts to `no_verdict` with a signed system-role annotation) |
   | V024-164 | `cd packages/agent-runtime && bun test src/tools/handlers/__tests__/run-readonly-command.test.ts` | Exit 0 (H-02: quote/character-class-aware shell filter) |
   | V024-165 | `cd sdk && bun test src/run/execution/__tests__/snapshot.test.ts` | Exit 0 (FID-006: snapshot emits on status/context change, identity-skip preserved) |

2. **Static-grep rows (same phase or a `5e-static` block):**

   | ID | Grep | Expected |
   |---|---|---|
   | V024-157 | `grep -rn 'update_goal\|get_goal' common/src/tools/constants.ts agents/savant/savant.ts` | Registered + on the main agent template |
   | V024-158 | `grep -n 'PreToolUse' packages/agent-runtime/src/tools/tool-executor/native.ts` | Gate wired as an *additional* project gate (composes with EHEL `beforeToolCall`) |
   | V024-159 | `grep -n 'no_verdict' common/src/types/provenance.ts packages/agent-runtime/src/provenance/session.ts` | `ReceiptStatus` includes `no_verdict`; `finalize` sets it |
   | V024-160 | `grep -rn 'CompactionSignal' cli/src/components/compaction-signal.tsx cli/src/chat/panels.tsx` | Component defined + mounted at the transcript bottom |
   | V024-161 | `grep -n 'contextWindow\|compression' sdk/src/run/execution.ts` | Threaded across the SDK boundary (no silent 200k fallback) |
   | V024-162 | `grep -rn 'deepseek/deepseek-v4-pro' cli/src/teacher cli/src/headless-run.ts` | 0 matches (no paid hardcode in the run path) |
   | V024-163 | `grep -rn 'parseHookConfigs\|hooks' common/src/util/protocol-config.ts` | `hooks:` block parsed; invalid entries dropped fail-safe |
   | V024-166 | `grep -n 'classifyFileKind' packages/agent-runtime/src/util/echo-compliance.ts` | H-03 code-vs-docs write classification present |
   | V024-167 | `grep -rn 'inheritParentModel' agents/` | No `false` escape (only removal-reference comments remain) |

3. **Phase 3 live rows (operator, type OPERATOR):**
   - **`/goal` lifecycle** — `/goal refactor the state layer --budget turns=2`
     starts a durable run; the sidebar goal row appears; `/goal status` shows
     state + consumption; `/goal cancel` terminates it.
   - **Compaction signal** — a long session crossing the resolved window shows
     the in-stream `⚙ Compacting context…` → `✓ Compaction complete (−N tokens)`
     block (in addition to the existing sidebar `Compaction` row).

4. **Agent View (§7) minimum additions:**
   - Re-examine the durable-goal continuation driver for runaway-turn risk and
     whether any non-main surface still hardcodes a model.
   - Re-examine the hook `PreToolUse` gate for a denial-of-service surface
     (timeout/default 30s, output cap) and confirm fail-open holds.
   - Re-examine the `CompactionSignal` for any history mutation (must be
     render-only) and the one-window invariant (display/threshold/pruner agree).

5. **Version bump:** prompt `1.1.0 → 1.2.0`; target paragraph extended to name
   `FID-2026-0814-002..007`.

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep — presence/absence):**

```text
$ grep -rn "update_goal\|get_goal" common/src/tools/constants.ts agents/savant/savant.ts
common/src/tools/constants.ts:86:  'update_goal',
common/src/tools/constants.ts:88:  'get_goal',
common/src/tools/constants.ts:129:  'update_goal',
common/src/tools/constants.ts:130:  'get_goal',
agents/savant/savant.ts:160:      'update_goal',
agents/savant/savant.ts:161:      'get_goal',

$ grep -rn "PreToolUse" packages/agent-runtime/src/tools/tool-executor/native.ts
native.ts:340:    // FID-2026-0814-003: PreToolUse hooks — an ADDITIONAL project gate at the
native.ts:347:          event: 'PreToolUse',

$ grep -rn "no_verdict" common/src/types/provenance.ts packages/agent-runtime/src/provenance/session.ts
common/src/types/provenance.ts:26:export type ReceiptStatus = 'pending' | 'complete' | 'no_verdict'
packages/agent-runtime/src/provenance/session.ts:307:      receipt.status = 'no_verdict'

$ grep -rn "CompactionSignal" cli/src/components/compaction-signal.tsx cli/src/chat/panels.tsx
cli/src/components/compaction-signal.tsx:23:export const CompactionSignal = React.memo(...)
cli/src/chat/panels.tsx:211:          <CompactionSignal />

$ grep -n "contextWindow\|compression" sdk/src/run/execution.ts
95:  contextWindow,
96:  compression,
338:    contextWindow,
339:    compression,

$ grep -rn "deepseek/deepseek-v4-pro" cli/src/teacher cli/src/headless-run.ts
(no matches — exit 0)
```

**Method 2 (suite inventory — files exist):**

```text
$ ls packages/agent-runtime/src/run-agent-step/__tests__/goal-engine.test.ts \
     packages/agent-runtime/src/tools/handlers/tool/__tests__/goal-tools.test.ts \
     packages/agent-runtime/src/__tests__/goal-driver.test.ts \
     packages/agent-runtime/src/hooks/__tests__/runner.test.ts \
     packages/agent-runtime/src/hooks/__tests__/engine.test.ts \
     packages/agent-runtime/src/context-compactor-micro.test.ts \
     cli/src/state/__tests__/savant-free-model-store.test.ts \
     cli/src/state/__tests__/chat-store-compaction.test.ts \
     agents/__tests__/context-pruner-phase3.test.ts \
     packages/agent-runtime/src/provenance/__tests__/provenance.test.ts
(all present)
```

**Law 4 (call-graph):** this FID adds no new function or config field — it only
references existing suites and existing call sites. Every static row has a
non-empty grep target (shown above); the P0 model-invariant row is
absence-shaped and the grep returns 0 matches as required. **AUDIT passes →
ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **Row ID collision CONFIRMED free:** `V024-150..163` do not collide with the
  existing `V024-100..146` range.
- **OMISSION caught and fixed:** the original GREEN listed only 5 suites; the
  compaction store (`chat-store-compaction.test.ts`) and the H-07
  context-pruner suite were missing from the first pass — added as V024-154 and
  V024-155.
- **OMISSION caught and fixed:** the `hooks:` config parse grep (V024-163) was
  missing; `parseHookConfigs` fail-safe dropping is a core FID-003 contract and
  now has a row.
- **Refuted concern:** "a static-only FID needs no AUDIT" — it does, because the
  rows must cite real suites and real call sites or the prompt would send the
  in-harness agent on a wild-goose chase. Both methods above are tool output,
  not self-report.
- **Severity upheld at `medium`** — test-coverage gap, not a product defect; no
  new product code is at risk.
- **No refutations; no other omissions. ADVERSARIAL passes → COMPLETE (planning).**

### Loop 2 — RED (fresh catalog, second pass)

Re-ran the suite inventory from scratch rather than trusting the first GREEN.
Found **four omissions** in Loop 1:

1. **H-02 shell-filter suite missing.**
   `packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts`
   has a dedicated H-02 block (`allows metacharacters inside single quotes`,
   `grep -rn 'savantCode[$]1'`, `echo 'a | b'`) — added as V024-164.
2. **FID-006 SDK snapshot suite missing.**
   `sdk/src/run/execution/__tests__/snapshot.test.ts` —
   `describe('startStateSnapshotting (FID-2026-0814-006 freshness)')` with 4
   tests (identity-skip preserved, emit on `compactionStatus` change, emit on
   `contextTokenCount` change, single emit on both) — added as V024-165.
3. **H-03 doc-write classification had no row.**
   `classifyFileKind` (`echo-compliance.ts:81`) is the code-vs-docs classifier;
   there is no dedicated unit test, so the guard is the static grep — added as
   V024-166.
4. **H-11 thinker escape had no row.**
   `grep -rn 'inheritParentModel' agents/` returns only removal-reference
   comments (no `false` escape) and there is no dedicated unit test, so the
   guard is the static absence grep — added as V024-167.

**Exit: all Loop-1 omissions cataloged.**

### Loop 2 — SELF-CORRECT (GREEN amended)

Appended V024-164..167 to the GREEN tables (two executable rows, two static
grep rows). No other section changed; the Agent View items and Phase 3 live
rows already covered the goal driver, hook DoS surface, and `CompactionSignal`
render-only invariant.

### Loop 2 — AUDIT (double audit, tool output)

```text
$ grep -n "classifyFileKind" packages/agent-runtime/src/util/echo-compliance.ts
81:export function classifyFileKind(path: string): 'code' | 'docs' {

$ grep -rn "inheritParentModel" agents/
agents/thinker/thinker-gemini.ts:10:  // `inheritParentModel: false` escape were removed — this thinker now inherits
agents/thinker/thinker-with-files-gemini.ts:9:  // `inheritParentModel: false` escape were removed — this thinker now
(comments only — no `false` escape; exit 0)

$ grep -n "test(\|describe(" sdk/src/run/execution/__tests__/snapshot.test.ts
36:describe('startStateSnapshotting (FID-2026-0814-006 freshness)')
37-107: 4 tests (identity-skip, compactionStatus emit, contextTokenCount emit, single emit)

$ grep -n "allows metacharacters inside single quotes" packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts
288:  it('allows metacharacters inside single quotes', ...)
```

**Law 4:** V024-164..167 are suites/greps that already exist in the tree (all
shown above); no new function or config field is added by this FID. **AUDIT
passes → ADVERSARIAL.**

### Loop 2 — ADVERSARIAL (fresh meta-verification)

- **Row ID range extended CONFIRMED free:** `V024-150..167` still do not collide
  with the existing `V024-100..146` range.
- **Cross-check CONFIRMED:** `headless-run.test.ts` and the
  `agent-validation-part-*.test.ts` files were considered for H-12/H-11 but
  rejected — `headless-run.test.ts` uses `resolvedAgent` as a test-agent fixture
  (not the removed model bypass) and the validation suites assert
  `inheritParentModel: true` (schema acceptance), not the `false`-escape removal.
  The static greps (V024-166/V024-167) are the correct guards for those two.
- **No refutations; no further omissions. ADVERSARIAL passes → COMPLETE (planning).**

### Loop 2 — COMPLETE (planning)

Plan converged after two loop passes (one SELF-CORRECT for the four omitted
rows). FID status → `analyzed`. Implementation (the prompt edit) is **presented
for operator approval before any edit**, per Law 2 (Present Before Act). No
`az-v0.0.24-harness-live-test.md` change is made until the operator approves.

## Resolution

- **Status:** `fixed` — implemented 2026-08-14 under operator approval.
- **Fix Description:** Added the `5e` phase (9 executable rows + 9 static-grep
  rows, V024-150…167), extended the Phase 3 live rows with `/goal` + the
  `CompactionSignal` signal, added 3 Agent View items, and bumped the prompt
  `1.1.0 → 1.2.0` with the target paragraph extended to name
  `FID-2026-0814-002..007`.
- **Tests Added:** No (test-prompt documentation; the referenced suites already
  exist and pass).
- **Verification Evidence:** markdownlint clean; Prettier clean on
  `dev/test-prompts/az-v0.0.24-harness-live-test.md`.
- **Archived:** Yes — moved to `dev/fids/archive/` on closure (2026-08-14).
