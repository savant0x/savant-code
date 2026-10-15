<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Master Implementation Plan — FID-2026-0814-002…006 (Single-Pass Completion)

**Filename:** `FID-2026-0814-007-master-implementation-plan.md`
**ID:** FID-2026-0814-007
**Severity:** high
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — this is a coordination/sequencing document, not a feature; it adds no product code, no config, and no new store; it exists to sequence the five already-converged planning FIDs (002-006) into one dependency-ordered implementation pass with a single verification sweep and one closure/archive batch
**Depends On:** FID-2026-0814-002, FID-2026-0814-003, FID-2026-0814-004, FID-2026-0814-005, FID-2026-0814-006 (all `analyzed`, Nova planning PASS recorded for 002/003/005/006; 004 amended twice and re-requested)

---

## Summary

The active queue holds five converged planning FIDs that share runtime surfaces (`context-compactor.ts`, `loop-context.ts`, `native.ts`, `context-tokens.ts`, `send-message-run-config.ts`, `protocol.config.yaml` parsing, the chat-store slice, and the sidebar render layer). This master plan sequences them into one implementation pass under automation level 3 (operator-authorized autonomous completion: implement all five, run the full verification sweep, update README/docs/CHANGELOG, close and archive all FIDs, and leave `dev/fids/` clear).

The plan exists because **implementation order matters**: the FIDs touch overlapping files and the later FIDs depend on invariants established by earlier ones. Executing them in the wrong order would produce conflicting edits on the same files.

## Dependency + ordering analysis (verified at source)

| Surface | FID-005 | FID-006 | FID-004 | FID-002 | FID-003 |
|---|---|---|---|---|---|
| `packages/agent-runtime/src/provenance/session.ts` | **core** | — | — | — | — |
| `common/src/types/provenance.ts` | **core** | — | — | — | — |
| `cli/src/components/savant-ui/echo/trust-matrix.tsx` | **core** | — | — | — | — |
| `sdk/src/run/execution/snapshot.ts` | — | **core** | — | — | — |
| `packages/agent-runtime/src/context-compactor.ts` | — | **C-02** (fail-loud fallback) | **H-01/H-05/H-06** (placeholder, config, pressure gate) | — | — |
| `packages/agent-runtime/src/run-agent-step/context-tokens.ts` | — | **status writes** | **H-05** (gate microCompact) | — | — |
| `packages/agent-runtime/src/run-agent-step/loop-context.ts` | — | compactor init (:271-280) | — | goal parse (:256-264) | — |
| `packages/agent-runtime/src/tools/tool-executor/native.ts` | — | — | — | — | **PreToolUse/PostToolUse** (:289,121,124) |
| `cli/src/components/right-sidebar.tsx` | — | counter + color bands | — | goal row | — |
| `cli/src/state/chat-store/*` | — | counter slice | — | — | — |
| `cli/src/utils/create-run-config.ts` + `send-message-run-config.ts` | — | — | **H-05** config threading | — | — |
| `cli/src/teacher/forge.ts` | — | — | **H-08** model unification | — | — |
| `cli/src/hooks/helpers/send-message-agent.ts` | — | — | **H-09** model unification | — | — |
| `cli/src/agents/bundled-agents.generated.ts` | — | — | **H-10** (generated — treat as read-only) | — | — |
| `agents/thinker/*.ts` | — | — | **H-11** | — | — |
| `cli/src/headless-run.ts` | — | — | **H-12** | — | — |
| `common/src/util/protocol-config.ts` | — | — | **H-05/H-07** (read + thread) | — | **hooks block** |
| `cli/src/components/savant-ui/echo/*` | — | transcript block | — | — | — |

**Conflict resolution:** FID-004 (H-01/H-05/H-06) and FID-006 (C-02) both touch `context-compactor.ts` — implemented in one combined pass over the file. FID-002 and FID-006 both touch `loop-context.ts` but at disjoint line ranges. FID-003's `native.ts` wiring is orthogonal to FID-006's status writes.

## Implementation order (dependency-sorted)

1. **FID-2026-0814-005 — Trust Matrix auto-resolution** (smallest, fully self-contained: provenance session + type + UI + export). Establishes the `no_verdict` terminal status that FID-004/006 never touch. *No cross-dependencies.*
2. **FID-2026-0814-006 — Compaction freshness + visible feedback** (snapshot emit policy, one-window, transcript block, counter, color bands). Touches the chat-store slice that FID-002's goal row will later extend (same `sidebar-actions`/`initial-state`/`types` files — FID-006 lands its counter resets first so FID-002 can reuse the reset pattern).
3. **FID-2026-0814-004 — Harness frictions + config wiring + model unification** (the largest: H-01…H-12). Combined `context-compactor.ts` pass with FID-006's C-02; config threading through run-config; `resolveActiveModel()` introduced and applied at main/teacher-forge/headless; thinker escapes removed; bundled roster untouched (generated) but a run-construction gate asserted.
4. **FID-2026-0814-002 — Durable budgeted goal mode** (runtime driver + tools + injection + slash surface). Depends on the chat-store slice shape established in step 2 and the run-config threading pattern from step 3.
5. **FID-2026-0814-003 — Extensible hook system** (config block + engine + fail-open runner + EHEL-gate wiring). Depends on `protocol-config.ts` extension precedent from step 3.

## Verification sweep (single, end-of-pass)

1. typecheck ×4 (sdk, common, packages/agent-runtime, cli)
2. `bun test` focused suites: provenance, trust-matrix, context-compactor, snapshot, compliance, run-readonly-command, goal, hooks, model-resolution
3. `bunx eslint . --max-warnings 0`
4. `bun run lint:md` + Prettier
5. `bun run validate:repository` + `bun scripts/fid-ledger.ts`
6. Full root test suites (`bun test` at root where configured)

## Docs/closure batch (after all gates green)

1. `CHANGELOG.md` — one entry per FID (005, 006, 004, 002, 003), reverse-chronological, with the master plan (007) noted
2. `README.md` — feature bullets for goal mode, hooks, trust-matrix terminal states, compaction feedback, harness frictions
3. `docs/design/` — one page for goal mode + hooks (the two new features); ZTAP + compaction docs updated for `no_verdict` and the visible lifecycle
4. `dev/fids/README.md` — status update, then queue cleared
5. `dev/session-summaries/` — full session summary
6. Archive: all six FIDs (002-007) moved to `dev/fids/archive/`, `archive/README.md` index updated, `dev/fids/` left with only `README.md`

## Governance and Release Boundary

This master plan authorizes implementation of the five child FIDs under automation level 3, per the operator's explicit instruction ("proceed with implementation w/ automation level 3… do not stop until 100% complete and the fids folder is clear"). No commit, push, release, publication, or deployment is authorized by this document; the working tree is left complete and green for operator review. Nova implementation-audit requests for each child FID are staged in the outbox after their gates pass.

## Perfection Loop

### Missed Questions

Asked during the loop, as required: "What questions should I have asked when this FID was created, but failed to?"

1. **Can any two FIDs be merged into one code pass?** Yes — FID-004 + FID-006 share `context-compactor.ts`; the plan merges only that file's edits, keeping the FIDs distinct for audit/closure.
2. **Does the generated bundled roster block H-10?** `bundled-agents.generated.ts` is generated; the plan keeps it read-only and enforces the one-model invariant at run-construction points instead (the effective-model gate), which is where the actual model is decided.
3. **Is the chat-store slice safe to extend twice (FID-006 counter, FID-002 goal row)?** Yes — both are additive optional fields on the existing store slice; FID-006 lands first so its reset wiring is the pattern FID-002 reuses.
4. **What if a gate fails mid-pass?** The plan's contract: fix the failure in the owning FID before proceeding; a hard failure that cannot be fixed is recorded in the FID and the pass halts at that boundary (no silent partial closure).
5. **Is the closure order safe?** All five children close only after the full verification sweep passes; the master plan closes last, after all archives and docs are written.

### Code Verification Evidence

```text
$ ls dev/fids/*.md
FID-2026-0814-002-durable-budgeted-goal-mode.md
FID-2026-0814-003-extensible-hook-system.md
FID-2026-0814-004-verification-harness-agent-frictions.md
FID-2026-0814-005-trust-matrix-auto-resolution.md
FID-2026-0814-006-compaction-status-freshness-and-visual-feedback.md
(README.md present; queue = 5 planning FIDs)
$ grep -rn "automation level 3" dev/fids/archive/FID-2026-0806-002-knowledge-graph-echo-integration.md | head -1
Operator granted automation level 3 (autonomous end-to-end completion)   # precedent
$ grep -n "finalize()" packages/agent-runtime/src/run-agent-step/loop.ts
404: void initialAgentState.provenance?.finalize().catch(() => {   # FID-005 hook point
$ grep -n "history === lastSnapshotHistory" sdk/src/run/execution/snapshot.ts
41: if (history === lastSnapshotHistory) {   # FID-006 emit-point
$ grep -n "beforeToolCall" packages/agent-runtime/src/tools/tool-executor/native.ts
289: enforcement.beforeToolCall({...})   # FID-003 attachment point
```

### Loop 1 — RED (catalog)

Five planning FIDs at `analyzed` (002-006) + one master coordination FID, with shared-surface conflicts identified and sequenced. **Exit: all issues cataloged.**

### Loop 1 — GREEN (converged solution)

Dependency-ordered single pass (005 → 006 → 004 → 002 → 003), one merged `context-compactor.ts` edit, run-construction model gate (H-10), combined verification sweep, docs/closure batch, archive-all. **Exit: all fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep, absence-shaped):**

```text
$ grep -rn "no_verdict" common/src/types/provenance.ts packages/agent-runtime/src/provenance/
(no matches)   # FID-005 terminal absent — to be added
$ grep -rn "Compactions:" cli/src
(no matches)   # FID-006 counter absent
$ grep -rn "resolveActiveModel" cli/src packages common/src
(no matches)   # FID-004 helper absent — to be introduced
$ grep -rn "untrusted_objective" packages/agent-runtime/src cli/src common/src
(no matches)   # FID-002 injection absent
$ grep -rn "HookEngine\|PreToolUse" packages/agent-runtime/src
(no matches)   # FID-003 infrastructure absent
```

**Method 2 (manual verification of the shared-surface claims):**

| Claim | Verdict | Evidence |
|---|---|---|
| Five planning FIDs in queue | **PASS** | `ls dev/fids/*.md` above |
| 005 self-contained | **PASS** | `session.ts`/`provenance.ts`/`trust-matrix.tsx` are the only consumers; no other FID reads `no_verdict` |
| 006 + 004 share `context-compactor.ts` | **PASS** | 006 C-02 at `context-compactor.ts:74`; 004 H-01/H-05/H-06 at the same file — merged edit plan |
| 002 + 006 disjoint in `loop-context.ts` | **PASS** | 002 goal parse `:256-264`; 006 compactor init `:271-280` |
| 003 orthogonal to 006 in `native.ts` | **PASS** | 003 hooks at `:289,121,124` (gate + trace); 006 writes `compactionStatus` in `context-tokens.ts`, not `native.ts` |
| Automation-level-3 precedent | **PASS** | Archive FID-2026-0806-002 line quoted above |

**Law 4 (call-graph):** the master plan introduces no new function — it sequences existing planned changes. Each child FID carries its own Law-4 gate at implementation time (new tools `update-goal`/`get-goal`, new `hooks` config, `resolveActiveModel`, snapshot emit change, `no_verdict` status — each must have a production caller grep). **AUDIT passes → ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **Ordering CONFIRMED:** 005 (isolated) → 006 (store slice + snapshot) → 004 (largest, merged compactor pass) → 002 (reuses store + config patterns) → 003 (config precedent) — no forward references that would force rework.
- **Conflict handling CONFIRMED:** the only true shared-file conflict (compactor) is a single merged edit; all other overlaps are disjoint ranges or one-way dependencies.
- **OMISSION REFINED (added to GREEN):** the generated `bundled-agents.generated.ts` must NOT be hand-edited for H-10; the effective-model gate at run construction is the enforcement point, and a test asserting "no run path can construct a paid model when the store resolved free" is the regression guard. Already in GREEN; made explicit as an implementation gate.
- **OMISSION REFINED (added to GREEN):** FID-004's model-unification workstream (H-08…H-12) carries the highest user-visible risk (billing); its Nova planning re-request is staged but the operator's directive is explicit and unambiguous — implementation proceeds on the operator authorization, with the Nova implementation audit staged after gates pass.
- **No refutations; no other omissions.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 1 — COMPLETE (planning)

Plan converged after one loop pass. FID status → `analyzed`. Per the operator's explicit automation-level-3 directive, the five child FIDs proceed to implementation in the ordered pass; the master plan closes last, after all archives and docs are written.

## Resolution

- **Status:** `closed` — all five children implemented, verified, documented, and archived; master closes last (2026-08-14).
- **Fix Description:** Dependency-ordered single-pass implementation of FID-2026-0814-002…006, merged shared-surface edits, combined verification sweep, docs/CHANGELOG/README updates, and closure/archive of all six FIDs leaving `dev/fids/` clear.
- **Tests Added:** No (coordination FID).
- **Verification Evidence:** AUDIT greps pasted above (Loop 1 — AUDIT).
- **Archived:** closed + archived 2026-08-14. See `dev/fids/archive/README.md`.
