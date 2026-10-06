# FID: Wire the uncalled adoption modules to production call paths

**Filename:** `FID-2026-1006-003-wire-uncalled-adoption-modules.md`
**ID:** FID-2026-1006-003
**Severity:** high
**Status:** converged
**Created:** 2026-10-06 18:40
**Automation level:** 2
**YAGNI-Compliance:** Pending

---

## Summary

Four modules delivered by `FID-2026-1006-002` (archived) have zero production callers: the compaction
cut-point planner, the cumulative file-tracking ledger, the loop guard rails, and the preset validator —
plus the entry-class writers and the branch-summarization module. That record scoped them as "module +
tests" and reported the missing call path as a *stated limitation*. The operator ruled on 2026-10-06 that a
delivered-but-uncalled module is **not a complete feature**, and directed a FID that wires every one of them
to a real seam. This record converges the plan; implementation follows the declared gates.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** git, bun test, eslint, markdownlint, prettier (repo-pinned)
- **Commit/State:** HEAD `ccf343af`, working tree clean at authoring time

## Detailed Description

### Problem

Law 4 states: "Zero grep results = NOT wired. Do not mark complete." Applied to `FID-2026-1006-002`'s four
library-complete deliverables, the honest reading is that the features do not exist for a user. The
`entry_kind` / `exclude_from_context` columns (WP11) can only ever hold their defaults, because no shipped
path calls a writer; the loop guard rails cannot stop a stale cycle because nothing consults them; the
compaction cut rule is inert because the pruner never receives a plan.

### Expected Behavior

Every delivered module has a production caller whose removal makes a test fail, and the behaviour the module
promises is observable end to end.

### Root Cause

The adoption framing in `FID-2026-1006-002` treated "module + tests, ready for the first consumer" as a
complete deliverable for items whose consumer was not part of that FID's scope. No follow-on item was
registered for the wiring, so the gap had no owner — the same failure mode that record's own Lessons
Learned names ("a review is not done when the report is written; it is done when the report's findings have
an owner").

### Evidence

Reachability greps (2026-10-06, before this record):

```text
$ grep -rn "loop-guard-rails|preset-validation" packages/agent-runtime/src --include=*.ts  (production only)
(no production matches — only the two suites import them)

$ grep -rn "cut-points|file-tracking" packages/agent-runtime/src --include=*.ts
(no production matches)

$ grep -rn "createModelChangeEntry|createCustomEntry|createLabelEntry|getInContextMessages" --include=*.ts
packages/database/src/entry-classes.ts (definitions only; no caller)
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/context-compactor/{cut-points,file-tracking,branch-summarization}.ts`
- `packages/agent-runtime/src/run-agent-step/{loop,loop-iteration,loop-guard-rails,preset-validation}.ts`
- `packages/agent-runtime/src/run-agent-step/context-tokens{,-compaction}.ts`
- `agents/context-pruner/{summarization-context,apply-budgets,minimal-surgery}.ts` (spawn-param consumers)
- `agents/savant/handle-steps-{factory,template-body-a,template-body-b}.ts` (param baking)
- `packages/database/src/entry-classes.ts` + `cli/src/utils/{db-storage,active-run}.ts`
- `common/src/util/protocol-config{,-types,-sections}.ts`, `protocol.config.yaml`

### Risk Level

- [x] High: major feature broken, no workaround (six delivered features are inert)

## Proposed Solution

### Approach

Wire each module to the seam that already exists for its data, not to a synthetic caller:

- The embedded pruner (`agents/context-pruner/*` serialized via `.toString()`) **cannot import runtime
  code**, so its two inputs travel as **data**: an `agentState` field computed at the runtime step boundary
  and forwarded as a spawn param — the same channel `keepRecentTokens` already uses
  (`agents/savant/handle-steps-factory.ts:59` → `summarization-context.ts:47-58`).
- The loop guard rails attach to the per-iteration boundary in `run-agent-step/loop-iteration.ts`.
- Preset validation needs a real declaration before it can have a real caller: the preset moves into
  `protocol.config.yaml`, validated during config parsing (single owner in `common`).
- Entry-class writers attach to `cli/src/utils/db-storage.ts` (model change), the `auditOverride` seam
  (`tool-executor/steering-rule-gate.ts:39,89`), and the completed-compaction boundary; and
  `loadChatStateFromDb` switches to `getInContextMessages` so excluded rows cannot re-enter a resumed chat.
- Branch summarization fires on the navigation-away abort (`cli/src/utils/active-run.ts`).

### Steps

1. Compute the cut plan at the step boundary and honour it in the pruner (never cut at a tool result;
   over-budget turn splits into two mergeable summaries; re-summarize from the previous kept boundary).
2. Maintain the cumulative file ledger across successive compactions and merge it as the pruner's previous
   file state.
3. Gate the step loop with `determineNextAction`: named stop reasons surfaced, single-task injection from the
   checklist, per-role activation budget beside the global cap.
4. Move `validatePreset` + `PresetShape` to `common/src/util/orchestration-preset.ts` (existing module
   re-exports, so its path and suite stay valid); declare the orchestration preset in
   `protocol.config.yaml`; validate during parse; errors fail the repo gate, warnings report.
5. Write durable entries (`model_change`, `custom` for the steering-override audit, `label` at compaction
   boundaries) and source the resumed-chat load from `getInContextMessages`.
6. Emit and persist a branch summary when a chat switch aborts a mid-turn run.

### Verification

Each work package ships a **wiring test that fails if the call is removed** (assert-the-caller), the
pre-existing module suites stay green, and Law 4 grep evidence is recorded per package after implementation.

> Contract rule (FID-2026-0918-006): every promised test artifact names its repo-relative
> `*.test.ts` path, and that path also appears as a declared `- gate: test` line below.
>
> Declaration, not execution (FID-2026-0823-009): this record is `converged`, so the gates are enumerated,
> not stamped. The status moves to `verified` only through `bun run fid:verify <fid> --write`.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: typecheck packages/database
- gate: test packages/agent-runtime/src/__tests__/compaction-cut-plan-wiring.test.ts
- gate: test packages/agent-runtime/src/__tests__/compaction-file-ledger-wiring.test.ts
- gate: test packages/agent-runtime/src/__tests__/loop-guard-rails-wiring.test.ts
- gate: test common/src/util/__tests__/orchestration-preset.test.ts
- gate: test cli/src/utils/__tests__/entry-writers-wiring.test.ts
- gate: test cli/src/utils/__tests__/branch-summary-wiring.test.ts
- gate: test packages/agent-runtime/src/__tests__/compaction-cut-points.test.ts
- gate: test packages/agent-runtime/src/__tests__/compaction-file-tracking.test.ts
- gate: test packages/agent-runtime/src/__tests__/loop-guard-rails.test.ts
- gate: test packages/agent-runtime/src/__tests__/preset-validation.test.ts
- gate: test packages/agent-runtime/src/__tests__/branch-summarization.test.ts
- gate: test packages/database/src/__tests__/entry-classes.test.ts
- gate: test packages/database/src/__tests__/write-order-conformance.test.ts
- gate: test packages/agent-runtime/src/__tests__/steering-rules.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** catalogued six uncalled surfaces with grep evidence (Detailed Description → Evidence) and located
  the real seam for each. Two candidate seams were rejected as synthetic: a hand-written caller for
  `validatePreset` (no preset exists — so the declaration is part of the work), and deriving a duplicate
  model event for `thinking_level_change` without recording the fork first.
- **GREEN:** every work package names its seam as `file:line`, the minimal change, and a wiring test that
  fails when the call is removed. The pruner-facing packages pass **data** because the pruner is serialized
  and cannot import runtime modules.
- **AUDIT:** the reachability table was produced by grep, not recollection; each seam cite was read 0-EOF
  before being written here (`loop-guard-rails.ts`, `db-storage.ts`, `active-run.ts`,
  `context-tokens-compaction.ts`, `summarization-context.ts` hits, `handle-steps-factory.ts:59`).
- **ADVERSARIAL:** "Is WP4 inventing an orchestration engine?" No — the preset is validated as a
  declaration; the consumer is config parsing plus the repo gate, and no runner is introduced.
  "Is WP5's `thinking_level_change` invented?" It has no setting to audit today; the fork is recorded in
  Missed Questions rather than silently decided.
- **CHANGE DELTA:** new document (no prior text to diff).

### Missed Questions

1. **Does a thinking-level setting exist to audit?** No — grep finds no `thinkingLevel` /
   `reasoningEffort` config in `protocol.config.yaml`, `protocol-config-types.ts`, or the CLI run config;
   the only reasoning metadata is per-model catalog data (`cli/src/utils/openrouter-models/types.ts:52`).
   **Answered by the most robust default:** derive the audit entry from an effective reasoning-level change
   (which today can only arrive with a model change), and record the fork here so the operator can rule for
   a real user-facing setting instead before implementation.
2. **Can the pruner import runtime modules?** No — its modules are serialized via `.toString()` and
   re-evaluated, so only baked helpers and plain data reach it. Answer: pass the plan and ledger as data.
3. **Does the repo have orchestration presets to validate?** No (no `triggers`/`publishes` fields anywhere).
   Answer: declare one, validate it at parse time; this is the only honest way to give the validator a caller.
4. **Where does a resumed chat get its messages?** `loadChatStateFromDb` maps every row — which becomes a
   correctness bug the moment a writer exists. Answer: switch it to `getInContextMessages` in the same pass.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:**
- [ ] **File:line ranges:**
- [ ] **Gate output:**
- [ ] **Reproducibility:**
- [ ] **Step statuses:** all six steps `planned` — implementation has not started

### Code Verification Evidence

- [x] Files referenced in Affected Components exist — verified by grep + 0-EOF reads (2026-10-06)
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence present for the new wiring (Law 4 greps per work package)
- [x] FID status reflects the actual implementation state — `converged` (nothing implemented yet)

### Loop 2 — Independent audit and self-correction

- **RED:** pending implementation; a first audit pass found that the original draft of this record did not
  match the FID template (metadata format and required sections), which `validate:repository` flagged with
  nine `fid.metadata` / `fid.structure` issues.
- **GREEN:** the record was rewritten to the template shape; `validate:repository` was re-run afterwards.
- **AUDIT:** see the resolution evidence in `## Resolution` once gates are stamped.
- **ADVERSARIAL:** "Does rewriting the document to satisfy a validator weaken the content?" No — the
  metadata/heading shape changed, the problem statement, seams, and work packages did not.
- **CHANGE DELTA:** new document.

### Loop 3 — Final convergence

- **RED:** no further document-level risk identified at convergence; the open design fork is recorded, not
  hidden.
- **GREEN:** none required.
- **AUDIT:** `bun run lint:md` and `bun run validate:repository` are the two checks that read this document.
- **ADVERSARIAL:** residual risk is scope: WP4 introduces a config surface. It is bounded to a declaration
  plus validation, and the operator may strike it.
- **CHANGE DELTA:** new document.

## Resolution

- **Closed Date:** not set — status is `converged`, awaiting implementation.
- **Fix Description:** authored this record to close the "delivered but uncalled" gap left by
  `FID-2026-1006-002`, with six work packages, each naming its production seam and a wiring test.
- **Tests Added:** No — six wiring test paths are declared; they are written during implementation.
- **Verification Evidence:** `bun run validate:repository` → `validation: PASS` and `bun run lint:md` →
  exit 0, both re-run on the final document bytes.
- **Archived:** not set — not closed.

## Lessons Learned

1. **"Ready for the first consumer" is a hand-off, and a hand-off needs an owner.** `FID-2026-1006-002`
   closed four modules with no registered follow-on item; the same failure its own Lessons Learned had
   already named for T148/T149. A library-complete disposition must create the wiring item in the same pass.
2. **Law 4 is not satisfied by a test that imports the module.** Every gate added here asserts the *caller*,
   so removing the wiring fails the suite instead of only the feature.
3. **Embedded scopes need data-shaped seams.** The pruner's `.toString()` serialization rules out imports,
   so the honest wiring channel is agentState + spawn params; designing for it up front beats discovering it
   during implementation.
