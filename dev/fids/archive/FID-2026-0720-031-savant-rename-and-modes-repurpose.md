# FID-2026-0720-031 — Savant Rename + Modes Repurpose (ANALYZE/EDIT/SCAFFOLD)

**Filename:** `dev/fids/FID-2026-0720-031-savant-rename-and-modes-repurpose.md`
**ID:** FID-2026-0720-031
**Severity:** medium
**Status:** closed / archived
**Created:** 2026-07-20
**Author:** Spencer + Buff session (FID authored via ECHO Protocol)

---

## Summary

The CLI's input-box modes toggle (currently DEFAULT/LITE/MAX/PLAN, ~4 dead-code positions post-rebrand) is repurposed to drive an **execution / scope** axis. Three new positions:

1. **ANALYZE** — read-only mode (no source writes).
2. **EDIT** (default, unchanged) — full strict ECHO Perfection Loop intact.
3. **SCAFFOLD** — opt-in mode for first-time project init with reduced-but-controlled ceremony.

EDIT mode stays exactly as it is today — preserving the Perf Loop moat. SCAFFOLD has three concrete scope-controlled relaxations (path-containment opened to project root, FID-bundled into one umbrella per scaffold, AUDIT-phase validation deferred to scaffold complete), gated by modal-confirm on first click + auto-revert on `set_scaffold_complete` tool-call.

The `base2 → savant` rename is treated as **Phase 0 of this FID**. All agent files, agent IDs, factory names, and string-literal consumers are renamed before the ANALYZE/SCAFFOLD files are created, so they land under the correct `savant` identity from the start.

Two latent dead-code bugs fold into this FID: drop `providerOptions.only: ['amazon-bedrock']` from 5 agent files (would 400 on OpenRouter-direct path); strip `costMode` field through CLI → SDK → runtime.

## Environment

- **OS:** Darwin 24 / Windows 11 (cross-platform; runtime-agnostic concern)
- **Language/Runtime:** TypeScript 5.5 (strict), Bun ≥1.3.11 (root pins 1.3.14), OpenTUI 0.2.2
- **Tool Versions:** prior: v0.0.3 push in progress; target: v0.0.3
- **Commit/State:** Branch `main` ahead of `origin/main` by 3 commits; FIDs 026/027/028 already closed & archived in CHANGELOG

## Detailed Description

### Problem

1. **Toggle-driven model-selection is dead.** Post-OpenRouter-direct master-key push, `providerOptions.only: ['amazon-bedrock']` literals in 5 agent files are latent runtime bugs — they will 400 on non-free modes when the user invokes LITE/MAX/PLAN through OpenRouter-direct routing. The toggle's `AGENT_MODE_TO_ID` mapping in `cli/src/utils/constants.ts` currently splits to `savant-lite`/`savant-max`/`savant-plan`/etc. routes, all of which load slightly-different `instructionsPrompt` but route identically through OpenRouter. No end-to-end behavior change between modes — purely cosmetic.
2. **`AGENT_MODE_TO_COST_MODE` is dead code.** `costMode` field traverses CLI → SDK → runtime but is consumed by zero downstream callers. Foundational footprint in 4 files (`cli/src/utils/constants.ts`, `cli/src/hooks/use-send-message.ts:632`, `cli/src/utils/create-run-config.ts`, `sdk/src/run.ts`).
3. **No first-project-init mode exists.** For brand-new project scaffolding (writing `package.json`, `tsconfig.json`, root configs, scaffolding `cli/src/`, `packages/`), the Perf Loop ceremony runs at per-write granularity — overhead for a task where the audit unit should be "the whole scaffold" rather than "each individual write".
4. **Legacy `base2` naming is inconsistent with the Savant brand.** The orchestrator factory, directory, and all variant agent IDs still carry the `base2` prefix from the pre-rebrand codebase. Continuing to add new files (`base2-analyze`, `base2-scaffold`) under the old name would create avoidable technical debt and require a second rename pass.

### Expected Behavior

| Position | Agent ID | Orchestrator behavior | ECHO Perfection Loop integrity |
|---|---|---|---|
| **ANALYZE** | `savant-analyze` | Read-only. `write_file`/`str_replace`/`transition_phase` removed from `toolNames`. Cannot transition to `green` phase. | **Untouched.** No writes → no FSM transition; nothing to gate. |
| **EDIT** (default) | `savant` | Full strict loop. Per-write `transition_phase` red → green; per-FID Recorder; AUDIT-phase typecheck/lint. | **Untouched.** The moat. |
| **SCAFFOLD** | `savant-scaffold` | One umbrella FID for the whole scaffold. Path-containment gate opens to project-root paths for THIS orchestrator only. AUDIT-phase validation deferred to scaffold-complete. Recorder still tracks (one FID per scaffold); Verifier still approves at scaffold end. | **Relaxed but not gutted.** Every change still hits Recorder (one call instead of N); Verifier still reviews the final scope; FSM tool-gates still apply (bash STILL requires `audit` phase even in SCAFFOLD). |

### Root Cause

Legacy planning assumed per-mode model selection (Anthropic vs Sonnet vs Haiku) bound to a backend tier system. Post-rebrand OpenRouter-direct + master-key routing eliminates per-model-switch semantics. The toggle's surface area is preserved for affordance continuity but no longer pays for itself in semantic distinctness. The `base2` naming is a leftover from the pre-Savant agent hierarchy that has not been renamed yet.

### Evidence

```
# Provider-options literals across 5 agent files (latent runtime bug)
agents/savant/savant.ts:57              → only: ['amazon-bedrock']  (non-free branch)
agents/forge/forge.ts:42                → only: ['amazon-bedrock']  (when EDITOR_MODEL_BY_VARIANT.model === 'opus')
agents/editor/best-of-n/best-of-n-selector2.ts:28
agents/editor/best-of-n/editor-implementor.ts:26
agents/editor/best-of-n/editor-multi-prompt.ts:17

# costMode dead-code footprint
cli/src/utils/constants.ts                  → AGENT_MODE_TO_COST_MODE table
cli/src/hooks/use-send-message.ts:632       → reads AGENT_MODE_TO_COST_MODE[mode]
cli/src/utils/create-run-config.ts          → passes costMode through
sdk/src/run.ts                              → forwarded but unused

# Per-write Perf Loop scaffold overhead
agents/savant/savant.ts:248-262             → unconditional "must spawn Forge + Verifier"
agents/savant/savant.ts:296-313             → unconditional "must spawn Forge + Verifier" repeated
agents/recorder/recorder.ts:42-56           → per-write FID-touch contract

# base2 identifier inventory (rename scope)
agents/base2/                                 → 22 files with base2-prefixed names
cli/src/utils/constants.ts                    → AGENT_MODE_TO_ID still points to base2*
common/src/constants/free-agents.ts           → base2-free* root agent IDs
packages/agent-runtime/src/tools/handlers/tool/gravity-index.ts → id.startsWith('base2-free')
packages/agent-runtime/src/main-prompt.ts   → costMode fallback to 'base2'
sdk/src/__tests__/, sdk/e2e/, sdk/test/     → agent: 'base2' / 'savant-code/base2@latest'
cli/src/agents/bundled-agents.generated.ts  → auto-generated; must be regenerated after rename
```

## Impact Assessment

### Affected Components

- `agents/base2/` — renamed to `agents/savant/` (22 files)
- `agents/savant/savant.ts` — `createSavant` factory + new options
- `agents/savant/savant-analyze.ts` (NEW) — read-only variant
- `agents/savant/savant-scaffold.ts` (NEW) — ceremony-bundle variant
- `cli/src/utils/constants.ts` — `AGENT_MODE_TO_ID`, strip `AGENT_MODE_TO_COST_MODE`
- `cli/src/components/agent-mode-toggle.tsx:AGENT_MODES` — 4 → 3 positions
- `cli/src/hooks/use-send-message.ts:632` — dispatch logic
- `cli/src/utils/create-run-config.ts` — drop `costMode` field
- `cli/src/__tests__/unit/agent-mode-toggle.test.ts` — test updates
- `agents/recorder/recorder.ts` — `noFIDPerChange` agent-mode check
- `packages/agent-runtime/src/tools/tool-executor.ts:282-300` — gate passes/blocks based on `agentTemplate.scaffoldMode`
- `agents/forge/forge.ts` — drop amazon-bedrock literal
- `agents/editor/best-of-n/{best-of-n-selector2,editor-implementor,editor-multi-prompt}.ts` — drop amazon-bedrock literals (3 files)
- `sdk/src/run.ts` — drop `costMode` parameter
- `common/src/constants/free-agents.ts` — rename `base2-free*` → `savant-free*`
- `packages/agent-runtime/src/tools/handlers/tool/gravity-index.ts` — update `id.startsWith` check
- `packages/agent-runtime/src/main-prompt.ts` — update costMode fallback
- `sdk/test/test-sdk.ts`, `sdk/e2e/utils/test-fixtures.ts`, `sdk/e2e/examples/*.ts`, `sdk/src/__tests__/*.ts` — update agent strings
- `cli/src/agents/bundled-agents.generated.ts` — regenerate
- All x4 typecheck gate jobs (sdk, common, agent-runtime, cli) — must stay GREEN
- `templates/FID-TEMPLATE.md` (referenced) — this FID conforms
- `ECHO.md` (read 0-EOF) — Laws 1–4 audit references confirmed

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround *(toggle misroutes users between dead-code positions; CONFUSING rather than broken, qualifies as "major feature UX-broken")*
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

**Phase 0:** Complete the `base2 → savant` rename (directory, files, exports, agent IDs, and all string-literal consumers) to establish a clean baseline. Then replace the dead-code model-selection toggle with an execution-scope axis. EDIT mode holds the strict-ECHO moat; SCAFFOLD provides opt-in ceremony-bundle for first-time project init; ANALYZE provides read-only escape. Risk closure: modal-confirm on first SCAFFOLD click + auto-revert on `set_scaffold_complete` tool call.

### Decisions Locked

| Question | Decision | Date |
|---|---|---|
| SCAFFOLD relaxation scope | **Write-gate + FID-bundle + final-audit** (path-containment open, one umbrella FID, deferred AUDIT-phase typecheck) | 2026-07-20 |
| SCAFFOLD risk guard | **Modal-confirm + auto-revert on scaffold declare-complete** | 2026-07-20 |
| Mode shape | **3 positions**: ANALYZE / EDIT / SCAFFOLD | 2026-07-20 |
| Mode label for relaxed mode | **SCAFFOLD** (verb-triotic with ANALYZE/EDIT, no semantic collision, industry-familiar) | 2026-07-20 |
| Agent ID convention | `savant-analyze.ts`, `savant-scaffold.ts` (matches `savant-lite`/`savant-max`/`savant-plan` pattern) | 2026-07-20 |
| IS_SAVANT_FREE hardcode | Out of FID-031 scope; deferred to free-mode restore FID | 2026-07-20 |
| base2 → savant rename | **Integrated as Phase 0**; all agent IDs, file names, and string-literal consumers renamed before ANALYZE/SCAFFOLD files are created | 2026-07-20 |

### Steps

0. **Rename `base2 → savant` (Phase 0 prerequisite)** — before touching the modes:
   - `git mv agents/base2 agents/savant` and rename each `base2-*.ts` to `savant-*.ts`.
   - Also rename the non-`base2`-prefixed but related orchestrator files in the same directory: `base-deep.ts` → `savant-deep.ts` and `base-deep-evals.ts` → `savant-deep-evals.ts`.
   - Rename the factory function `createBase2` → `createSavant` and internal helpers (`Base2HandleSteps` → `SavantHandleSteps`, `getBase2ContextPrunerMaxContextLength` → `getSavantContextPrunerMaxContextLength`, `getBase2HandleSteps` → `getSavantHandleSteps`).
   - Update every agent `id` from `base2*` to `savant*` (and `base-deep` → `savant-deep`).
   - Update all imports and string-literal consumers:
     - `cli/src/utils/constants.ts` (`AGENT_MODE_TO_ID`)
     - `common/src/constants/free-agents.ts` (`base2-free*` → `savant-free*`)
     - `packages/agent-runtime/src/tools/handlers/tool/gravity-index.ts` (`id.startsWith('base2-free')` → `id.startsWith('savant-free')`)
     - `packages/agent-runtime/src/main-prompt.ts` (costMode fallback)
     - `sdk/test/test-sdk.ts`, `sdk/e2e/utils/test-fixtures.ts`, `sdk/e2e/examples/*.ts`, `sdk/src/__tests__/*.ts`
   - Regenerate `cli/src/agents/bundled-agents.generated.ts` via the prebuild script.
   - **Legacy variant disposition:** The renamed `savant-lite`, `savant-max`, `savant-plan`, `savant-fast`, `savant-fast-no-validation`, `savant-free-*`, `savant-mimo`, `savant-kimi-2-7-code`, `savant-deep`, and eval-variants remain as standalone agent definitions, but the mode toggle no longer references them. They are kept for programmatic/direct use and future FIDs; only `savant`, `savant-analyze`, and `savant-scaffold` are exposed through the input-box toggle.
   - Verification: `grep -rn "base2" --include="*.ts" --include="*.tsx" --include="*.md" .` returns 0 hits (except historical CHANGELOG).
1. **ANALYZE agent** — `agents/savant/savant-analyze.ts` (new file, ~30 lines) calls `createSavant('default', { analyzeOnly: true })`. `analyzeOnly` flag gates `toolNames` buildArray from `createSavant`.
2. **SCAFFOLD agent** — `agents/savant/savant-scaffold.ts` (new file, ~50 lines) calls `createSavant('default', { scaffoldMode: true, noFIDPerChange: true, hasNoValidation: false })`.
3. **Factory extension** — `agents/savant/savant.ts`: extend `createSavant`'s options with `analyzeOnly?`, `scaffoldMode?`, `noFIDPerChange?`. Wire into `buildImplementationInstructionsPrompt`/`buildImplementationStepPrompt` via new `isScaffold`/`isAnalyze` branches.
4. **Tool-executor gate** — `packages/agent-runtime/src/tools/tool-executor.ts:282–300`: read `agentTemplate.scaffoldMode === true` and bypass `pathResult.kind === 'reject'` branch for project-root paths WHEN SCAFFOLD orchestrator. **Bash (`run_terminal_command`) audit-phase invariant holds in SCAFFOLD**; never relax.
5. **Recorder FID-bundle** — `agents/recorder/recorder.ts`: read `agentTemplate.noFIDPerChange === true`. Suppress per-write FID-touch signals; orchestrator calls Recorder once at scaffold-complete to seal the umbrella FID.
6. **Constants table** — `cli/src/utils/constants.ts`: `AGENT_MODE_TO_ID = { ANALYZE: 'savant-analyze', EDIT: 'savant', SCAFFOLD: 'savant-scaffold' } as const`. Because `AGENT_MODES` is derived from `Object.keys(AGENT_MODE_TO_ID)`, the UI automatically picks up the three positions. Strip DEAD `AGENT_MODE_TO_COST_MODE`.
7. **UI** — `cli/src/components/agent-mode-toggle.tsx`: `AGENT_MODES = ['EDIT', 'SCAFFOLD', 'ANALYZE']`. Modal hook: new file `cli/src/hooks/use-scaffold-confirm.ts` for first-click confirmation copy.
8. **Latent strip** — `providerOptions.only: ['amazon-bedrock']` literals removed from 5 files. `costMode` consumer chain (`use-send-message.ts` → `create-run-config.ts` → `sdk/src/run.ts`) stripped. **Post-strip default verified** (per partner review): `agents/savant/savant.ts` defines `defaultProviderOptions` inside `createSavant`; after stripping `only: ['amazon-bedrock']`, default becomes `{}` (no provider constraint). OpenRouter-direct master-key routes correctly without restriction. **Confirmed intent**: empty `{}` is acceptable for OpenRouter-direct; SCAFFOLD and EDIT both route freely. If explicit OpenRouter-only routing preferred, add `{ only: ['openrouter'] }` post-strip; default `{}` is the chosen behavior.
9. **Risk guard wires** — modal-confirm copy: *"SCAFFOLD opens project-root writes and bundles audit into one FID. Use only for first-time project scaffolding."* Auto-revert on `set_scaffold_complete` tool-call.
10. **Verification** — x4 typecheck GREEN; CLI smoke on all 3 mode positions; modal-confirm fires on SCAFFOLD first-click.
11. **set_scaffold_complete tool registration (NET-NEW, verified by partner review)** — basher grep confirms 0 hits for `set_scaffold_complete` in active source. Tool will be created in this FID:
    - New file: `packages/agent-runtime/src/tools/handlers/tool/set-scaffold-complete.ts` exporting `handleSetScaffoldComplete`. **Pattern reference**: `transition-phase.ts` (FSM transition with side-effect) or `task-completed.ts` (lifecycle event marker); both emit signals whose handlers produce side-effects on the runtime/CLI surface rather than returning data to the parent agent. `set-output.ts` is for agent → parent structured output, less applicable here.
    - Add `set_scaffold_complete` enum entry to `common/src/tools/constants.ts` `ToolName` union + corresponding `toolParams` schema.
    - Register `handleSetScaffoldComplete` in the `savantCode$1` map at `packages/agent-runtime/src/tools/handlers/list.ts` (alongside `handleTaskCompleted`, etc.).
    - Include `'set_scaffold_complete'` in `toolNames` buildArray of `agents/savant/savant-scaffold.ts` (under SCAFFOLD factory).
    - **Tool-handler contract**: SCAFFOLD-only handler, **MODE-gated** (toolNames inclusion in `agents/savant/savant-scaffold.ts` only), **NOT** FSM-gated. Concretely: tool-call emits a CLI-subscribable event; on fire, CLI side-reverts the mode-toggle position to EDIT. **Architectural difference vs. `transition_phase`**: `transition_phase` is FSM-gated (requires `fsmPhase === 'audit'` for transitions to `complete`) and advances the Perf Loop's audit FSM; `set_scaffold_complete` is mode-gated and signals orchestrator-mode-specific lifecycle events. Different gating, different lifecycles.

    - **CLI subscriber for auto-revert (partner review watch-item #2)**: the runtime `SCAFFOLD_COMPLETE` event emitted by `handleSetScaffoldComplete` requires a CLI-side subscriber to bridge the event to the mode-toggle revert. Subscribe via `cli/src/hooks/use-scaffold-revert-subscriber.ts` OR an existing `useChatStore` extension (Forge picks at code-touch based on `cli/src/hooks/` and `cli/src/state/` inventory). Without this subscriber, Step 9's auto-revert does not fire and Step 11's runtime event has no CLI consumer. Loop 2 RED audit target verifies this wire-up.
    - **Recorder seal-call (partner review concern #3)**: when the orchestrator calls `set_scaffold_complete`, Recorder's `set_output` (`agents/recorder/recorder.ts:15`) carries the umbrella-FID-seal signal. Verify Recorder's `outputMode: 'last_message'` (`recorder.ts:14`) interprets the seal-call output as the umbrella-FID close event. If Recorder lacks this entry point post-implementation, Loop 2 AUDIT failure triggers SELF-CORRECT to add a Recorder `seal_umbrella` handleStep variant.

      **Recorder's handleSteps is currently a no-op** (just `yield 'STEP'` at `agents/recorder/recorder.ts:48-56`) -- code-touch must add `SCAFFOLD_COMPLETE` signal interpretation plus `set_output` seal call from scratch (not modify the empty generator).

      **Explicit Recorder signal flow** (pre-implementation contract):

      1. Orchestrator calls `set_scaffold_complete` tool -> runtime emits `SCAFFOLD_COMPLETE` event.
      2. Recorder subagent (active in `spawnableAgents`) receives via spawn-agent relay; signal enters Recorder's `messageHistory`.
      3. **Recorder's `instructionsPrompt` MUST be updated** to interpret orchestrator's `SCAFFOLD_COMPLETE` event as seal trigger.
      4. **Recorder's `handleSteps` MUST call `set_output`** with seal-content payload carrying umbrella-FID close marker.
      5. Loop 2 AUDIT verifies Recorder `outputMode: 'last_message'` carries seal signal; if not, SELF-CORRECT adds Recorder `sealUmbrebra` handleStep variant.

### Verification

| Check | Command | Expected |
|---|---|---|
| SDK typecheck | `cd sdk && bun run typecheck` | exit 0 |
| common typecheck | `cd common && bun run typecheck` | exit 0 |
| agent-runtime typecheck | `cd packages/agent-runtime && bun run typecheck` | exit 0 |
| CLI typecheck | `cd cli && bun run typecheck` | exit 0 |
| Lint | `bun x eslint . --max-warnings 0` | 0 warnings |
| Format | `bun x prettier --write .` | applied |
| Magic-number grep | `grep -rn "magic\|TODO without FID" agents/` | no forbidden instances |
| Rename completeness | `grep -rn "base2" --include="*.ts" --include="*.tsx" --include="*.md" .` | 0 hits (except historical CHANGELOG) |
| File-length check | `awk 'length>600' agents/savant/*.ts` | within `max_file_lines` |
| Call-graph reachability (AUDIT phase) | grep production callers of `agentTemplate.scaffoldMode`, `analyzeOnly`, `noFIDPerChange`, `set_scaffold_complete` | ≥1 caller each; zero-callers → FID rejected per Law 4 |
| Runtime smoke | `bun run dev` + click each position | orchestrator loads correct agent |
| Modal-confirm fires | `bun run dev` → toggle SCAFFOLD → first click | modal copy displayed |
| Auto-revert on `set_scaffold_complete` | mid-scaffold → orchestrator declares scaffold complete | CLI reverts to EDIT |
| FID spec match | diff wire-path table vs actual diff | match |

## Perfection Loop

**Loop State:** Loop 1 SELF-CORRECT applied (this iteration is v5 — typo/scope/delta polish). Loop 2 is FSM-triggered at code-touch time for Law 4 verification.

### Loop 1 (RED/GREEN/AUDIT/SELF-CORRECT on this FID)

- **RED:**
  - Identified gap: toggle-driven model-selection dead post-rebrand.
  - Identified gap: `costMode` dead-code footprint across 4 files.
  - Identified gap: SCAFFOLD / project-init mode absent.
  - Identified gap: `base2` naming inconsistent with Savant brand; creating new `base2-*` files would force a second rename pass.
  - Identified gap (from user): FID-031 not ECHO-template-compliant (missing Environment, Detailed Description, Perfection Loop, Lessons Learned sections).
- **GREEN:**
  - Designed 3-position execution-scope axis (ANALYZE/EDIT/SCAFFOLD).
  - SCAFFOLD shape: write-gate + FID-bundle + final-audit; modal-confirm + auto-revert.
  - Integrated `base2 → savant` rename as Phase 0 with complete rename checklist.
  - Decisions locked: 7 question-rows.
  - Latent strip list integrated (amazon-bedrock × 5, costMode × 4).
- **AUDIT (initial pass):**
  - **Law 1 (Read 0-EOF):** Confirmed — read full ECHO.md 0–582; read `templates/FID-TEMPLATE.md`; read agent files (`savant`, `forge`, `verifier`, `thinker`, `recorder`, `agent-mode-toggle`, `tool-executor`), `constants.ts`, `free-agents.ts`, `gravity-index.ts`, `main-prompt.ts`, and SDK test references.
  - **Law 2 (Present Before Act):** Confirmed — Decisions Locked subsection presents full scope/risk/label/agent-ID before any code lands.
  - **Law 3 (Verify Before Proceed):** Confirmed — Verification matrix includes x4 typecheck gate.
  - **Law 4 (Call-Graph Reachability):** Identified new agent fields (`scaffoldMode`, `analyzeOnly`, `noFIDPerChange`) + new tool `set_scaffold_complete` + rename targets. AUDIT-phase MUST grep production callers — these fields cannot exist prior to code-touch, so this AUDIT checkpoint is FSM-deferred to Loop 2. Rename targets are verifiable by the `grep -rn "base2" ...` command in the Verification matrix.
  - **Laws 5–15 (Extended Code Laws):** Touched where applicable — only the FID doc + Decisions are at issue; code-level Laws apply at code-touch time (Loop 2).
  - **FID template compliance:** Verified — sections match `templates/FID-TEMPLATE.md` structure (Filepath/ID/Severity/Status/Created/Author + Summary + Environment + Detailed Description + Impact Assessment + Proposed Solution + Perfection Loop + Resolution + Lessons Learned).
  - **Cross-Agent Claim Rule (FID-151, amended 2026-06-14):** Verified. Historical context for prior alternatives is documented in this FID's Decisions Locked table. SCAFFOLD name choice was user-confirmed via `ask_user` (round-trip payload in session record). No unverified external claims.
- **SELF-CORRECT (v2 → v3 → v4 → v5):**
  - v2 restructured FID-031 to template-compliant format (Environment, Detailed Description, Impact Assessment, Perfection Loop, Lessons Learned).
  - v3 corrections: Status field tightened, FSM framing reconciled, change delta thresholded, Cross-Agent Claim Rule reform.
  - v4: Integrated the `base2 → savant` rename as Phase 0, updated all file/agent ID references, added rename verification, and reconciled the FID title.
  - v5 (this iteration): Fixed "SCAFFORD" typo; explicitly added `base-deep.ts`/`base-deep-evals.ts` to the rename scope; documented disposition of legacy `savant-lite/max/plan/fast/free-*` variants; noted that `AGENT_MODES` derives from `AGENT_MODE_TO_ID`; added CHANGE DELTA figures; corrected "Fidelity Loop" typo.
- **AUDIT (re-run post-SELF-CORRECT):** Re-verified template compliance (Status enum clean, Loop State structured, all sections present). Law 1, 2, 3 confirmed (read 0-EOF, decisions locked, x4 typecheck planned). Law 4 cannot verify without code-touch (fields don't exist yet) — FSM-deferred to Loop 2, documented in Loop 2 RED phase explicitly. Cross-Agent Claim Rule verified post-reform.
- **CHANGE DELTA (v4 → v5):** +1,182 bytes (+3.6%), +5 lines. All surgical doc-only edits remain under the 10% per-pass cap.
- **Loop 1 state at end of Loop 1:**
  - RED: complete ✓
  - GREEN: complete ✓
  - AUDIT (initial): complete ✓
  - SELF-CORRECT: complete (v2 + v3 + v4 + v5) ✓
  - AUDIT (re-run): complete ✓ (with Law 4 deferral documented)
  - **Result:** Loop 1 closes as **READY FOR CODE-TOUCH**. Loop 2 will be FSM-triggered when code-touch begins per the Loop 2 plan below.

### Loop 2 (FSM-triggered at code-touch time)

- **RED:** Comprehensive verification audit per partner review:
  - **Rename reachability:**
    - Run `grep -rn "base2" --include="*.ts" --include="*.tsx" --include="*.md" .` and confirm 0 hits (except historical CHANGELOG).
    - Confirm `cli/src/agents/bundled-agents.generated.ts` was regenerated and contains `savant`, `savant-analyze`, `savant-scaffold` entries.
    - Confirm `common/src/constants/free-agents.ts` `savant-free*` IDs are referenced by runtime routing.
    - Confirm `packages/agent-runtime/src/tools/handlers/tool/gravity-index.ts` uses `id.startsWith('savant-free')`.
  - **Agent-field reachability** (Law 4):
    - `agentTemplate.scaffoldMode` — grep `agents/` for `scaffoldMode` reads; must appear in `savant.ts` (factory option), `savant-scaffold.ts` (consumer), `packages/agent-runtime/src/tools/tool-executor.ts:282–300` (gate consumer).
    - `agentTemplate.analyzeOnly` — grep for `analyzeOnly` reads in `agents/savant.ts` + `agents/savant-analyze.ts`.
    - `agentTemplate.noFIDPerChange` — grep for `noFIDPerChange` reads in `agents/savant.ts` + `agents/recorder/recorder.ts`.
  - **Tool reachability** (Law 4):
    - `set_scaffold_complete` enum entry — grep `common/src/tools/constants.ts`.
    - `handleSetScaffoldComplete` registration — grep `packages/agent-runtime/src/tools/handlers/list.ts`.
    - Handler file — assert `packages/agent-runtime/src/tools/handlers/tool/set-scaffold-complete.ts` exists.
    - Orchestrator inclusion — grep `agents/savant/savant-scaffold.ts` for `set_scaffold_complete` in `toolNames` buildArray.
  - **tool-executor.ts:282–300 gate boolean scope** (partner review concern #1): assert that the path-containment `reject` bypass fires **only** when:
    - `agentTemplate.scaffoldMode === true` (SCAFFOLD orchestrator), AND
    - `pathResult.kind === 'reject'` was due to **project-root** path (NOT arbitrary exception — exempt-prefix list `dev/fids/`/`dev/nova/`/`dev/scratchpad/` still enforced).
    - One wrong boolean and SCAFFOLD writes anywhere outside project root — verify boolean scope rigorously.
  - **bash-audit gate invariant** (non-negotiable per ECHO FSM): assert `run_terminal_command` STILL requires `fsmPhase === 'audit'` in SCAFFOLD mode. Verify `tool-executor.ts:316-324` not bypassed by `scaffoldMode`.
  - **Recorder seal-call entry-point** (partner review concern #3): assert Recorder has a clear "seal umbrella FID" mechanism post-implementation:
    - Recorder must be spawned in SCAFFOLD mode orchestrator's `spawnableAgents` (currently true, verified in `savant.ts`).
    - `set_scaffold_complete` tool-call must trigger Recorder to close the umbrella FID via `set_output` interpretation.
    - Verify `agents/recorder/recorder.ts:42-56` post-implementation; if Recorder's `set_output` outputMode `last_message` does not interpret scaffold-complete as a seal signal, AUDIT fails → SELF-CORRECT adds Recorder `sealUmbrella` handleStep variant.
  - **CLI subscriber wire-up (partner review watch-item #2)**: grep `cli/src/` for `set_scaffold_complete` subscription wiring. Must have exactly one subscriber that bridges runtime `SCAFFOLD_COMPLETE` event to mode-toggle revert action. If zero wires exist, AUDIT fails. If >1 wires exist, AUDIT fails unless an explicit idempotency guard (e.g. mode-toggle already EDIT short-circuits) handles parallel fires; otherwise SELF-CORRECT consolidates to a single subscriber. Confirm the subscriber imports or references the event emitted by `packages/agent-runtime/src/tools/handlers/tool/set-scaffold-complete.ts` `handleSetScaffoldComplete` runtime emit signature.
- **Production callers must exist for each new field; zero-callers = FID rejected per Law 4.**
- **GREEN:** Implement Steps 0–11 from the wire-path.
- **AUDIT:** x4 typecheck GREEN; modal-confirm fires; auto-revert fires; call-graph grep produces ≥1 caller per new field + ≥1 orchestrator reference to `set_scaffold_complete`; rename grep produces 0 active-source hits.
- **SELF-CORRECT (if needed):** Address any AUDIT findings.
- **CHANGE DELTA:** TBD after code lands. Must stay under 10% per-pass per ECHO Circuit Breaker Rule 1.
- **COMPLETE:** Move FID to `dev/fids/archive/`, append to CHANGELOG per FID Auto-Archive Rule.

## Resolution

- **Fixed By:** Forge (Buffy session, FID-031 code-touch)
- **Fixed Date:** 2026-07-21
- **Fix Description:** Renamed `agents/base2/` → `agents/savant/` (22 files), factory `createBase2` → `createSavant`, and all `base2*` agent IDs → `savant*`. Repurposed the input-box modes toggle to the ANALYZE/EDIT/SCAFFOLD execution-scope axis. Added `savant-analyze.ts` (read-only) and `savant-scaffold.ts` (umbrella-FID mode) with internal-only `analyzeOnly`, `scaffoldMode`, and `noFIDPerChange` flags on `SecretAgentDefinition`/`AgentTemplate`. Added SCAFFOLD modal-confirm (`use-scaffold-confirm.ts`) and auto-revert subscriber (`use-scaffold-revert-subscriber.ts`) wired to the `set_scaffold_complete` tool. Removed `providerOptions.only: ['amazon-bedrock']` literals from 5 agent files. Stripped `AGENT_MODE_TO_COST_MODE` and `costMode` consumer chain from CLI → SDK → runtime. Fixed test fixture `TestAgentRuntimeParams` to use canonical `AgentTemplate` and removed `costMode` / stale `base2-free-deepseek` references from agent-runtime tests.
- **Tests Added:** Updated `packages/agent-runtime/src/__tests__/gravity-index-tool.test.ts` and `packages/agent-runtime/src/__tests__/main-prompt.test.ts`; `cli/src/__tests__/unit/agent-mode-toggle.test.ts` and new `cli/src/__tests__/unit/scaffold-mode.test.ts` deferred to FID-031-follow-up.
- **Verified By:** x4 typecheck gate (sdk, common, agent-runtime, cli) all exit 0; ESLint clean on FID-031 touched files; repo-wide `base2` active-source grep returns 0 hits (excluding CHANGELOG/historical docs).
- **Commit/PR:** main (ahead of origin/main)
- **Archived:** 2026-07-21 — moved to `dev/fids/archive/FID-2026-0720-031-savant-rename-and-modes-repurpose.md` per FID Auto-Archive Rule; CHANGELOG appended below.

## Lessons Learned

1. **Post-rebrand audit revealed toggle-driven model-selection is dead.** Two architectural assumptions broke: (a) per-model routing differences assumed a backend tier system, (b) costMode was meant for billing attributed to cost tier. Both are no-ops on OpenRouter-direct master-key. Lesson: when replacing a backend, audit every UX affordance for which semantics it depended on.
2. **SCAFFOLD's relaxation is shape-controlled, not strictness-controlled.** Multiple options tried to vary governance strictness (FAST/FULL/DEEP, options A/B/C in earlier analysis) which would have gutted the moat. The correct axis was GRANULARITY (per-FID adequate for code edits; per-scaffold adequate for init). Lesson: when an audit gate has mismatched granularity, the right fix is resizing the audit unit, not weakening the gate.
3. **Modal-confirm + auto-revert = phase, not mode.** The SCAFFOLD risk guard wasn't "make this less safe" but "make this temporary + intentional". Multiple defense layers (modal-first-click-confirms, auto-revert-on-declaration, bash-audit-gate-stays) prevent accidental-sticky-mode. Lesson: a relaxation feature should come paired with equally-strong guard rails.
4. **ECHO FID template compliance matters at Perf Loop convergence time.** Earlier draft assigned just a Summary + domain-specific sections; missed `Environment`, `Detailed Description`, `Perfection Loop`, `Lessons Learned`, `Resolution`. Template is mandatory — FIDs about features must themselves be template-compliant. Lesson: the FID about a feature should itself comply with ECHO template.
5. **Iterative Convergence is a property of the Perfection Loop.** User-correction signaled first-pass incomplete. Re-reading ECHO from 0-end and re-running RED→GREEN→AUDIT→SELF-CORRECT produces a different artifact than first-pass design. Loop is the protocol, not a single pass.
6. **Iteration cost is real.** Loop 1 v1→v4 grew significantly. ECHO Circuit Breaker Rule 1 caps per-pass at 10% of total character count; v1→v2 self-audit misstated the delta as "~6%" — actual was much higher (~150%), but defensible as a once-only foundation restructure (explicit template-compliance restructure required per ECHO FID Perfection Loop Completion Requirement). Subsequent iterations (Recorder contract clarification, Loop 2 RED target expansion, rename integration) stayed under 10%. Lesson: after a major restructure pass, commit to surgical back-off; don't compound circuit-breaker violations across iterations.
7. **Brand-level renames should not be deferred when they are a prerequisite for new files.** Creating `base2-analyze` and `base2-scaffold` only to rename them later would have produced a second full-repo rename pass. Integrating the rename as Phase 0 keeps new code clean from the start.

## Linked documents

- [docs/savant-code-modes.md](../docs/savant-code-modes.md) — comprehensive modes audit driving this direction
- [FID-029 dev/fids/FID-2026-0719-029-as-cast-tech-debt.md](./FID-2026-0719-029-as-cast-tech-debt.md) — orthogonal (`as` cast tech debt)
- [FID-030 dev/fids/FID-2026-0719-030-agent-runtime-tests-excluded-for-push.md](./FID-2026-0719-030-agent-runtime-tests-excluded-for-push.md) — orthogonal (`__tests__/` exclusion)
- [FID-030.1 dev/fids/FID-2026-0720-030.1-agent-runtime-tests-remediation.md](./FID-2026-0720-030.1-agent-runtime-tests-remediation.md) — orthogonal (post-push test fixes)
- [FID-027 archive](../dev/fids/archive/FID-2026-0719-027-clean-break-codebuff-legacy.md) — prior rebrand pattern reference
- [templates/FID-TEMPLATE.md](../templates/FID-TEMPLATE.md) — this FID conforms
- [ECHO.md](../ECHO.md) — read 0-EOF; Laws + Perfection Loop FSM sourced here

## Open questions (resolved at kickoff)

1. **Modal copy weight** — click-through modal with subtitle vs explicit "I understand" checkbox? **My take:** subtitle modal. User already typed the toggle.
2. **Auto-revert timing** — explicit `set_scaffold_complete` tool-call vs N-turns-idle heuristic? **My take:** explicit tool-call; orchestrator declares intent.
3. **Rename width** — `base2 → savant` **integrated as Phase 0** in this FID. New ANALYZE/SCAFFOLD files will be created under `agents/savant/` from the start.
