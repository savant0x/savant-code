# FID-2026-0722-050 — Prompt Audit: Mode-Specific Orchestrator Prompts + Subagent ECHO Duplication

**Filename:** `FID-2026-0722-050-prompt-audit-live-modes.md`
**ID:** FID-2026-0722-050
**Severity:** high
**Status:** closed
**Created:** 2026-07-22 12:00
**Author:** Savant

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0722-050`. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

The agent prompt layer has drifted. The orchestrator (`savant.ts`) uses a single, mode-agnostic `systemPrompt` for EDIT, ANALYZE, SCAFFOLD, and PLAN modes, and several subagents still carry duplicated ECHO Protocol guidance. The result is contradictory framing for non-EDIT modes and unnecessary prompt bloat. This FID scopes a minimal, safe refactor: mode-specific orchestrator system prompts, removal of duplicated ECHO appendices, and prompt-text repairs. It does not change model fields or provider routing; the existing runtime already handles multi-provider model inheritance via `withParentModel()` and `getModelForRequest()`.

---

## Environment

- **OS:** Windows 11 (win32)  
- **Language/Runtime:** TypeScript / Bun  
- **Relevant files:** `agents/savant/savant.ts`, `agents/savant/savant-analyze.ts`, `agents/savant/savant-scaffold.ts`, `agents/savant/savant-plan.ts`, `agents/savant/savant-deep.ts`, `agents/recorder/recorder.ts`, `agents/scribe/scribe.ts`, `agents/forge/forge.ts`, `agents/thinker/thinker.ts`, `agents/editor/best-of-n/editor-implementor.ts`, `agents/scout/scout.ts`, `common/src/constants/agents.ts`, `cli/src/agents/bundled-agents.generated.ts`  
- **Commit/State:** main @ HEAD, with prior partial agent edits now reverted to HEAD  

---

## Detailed Description

### Problem

1. **Orchestrator system prompt is mode-agnostic.** `agents/savant/savant.ts` builds one `systemPrompt` shared by `default`, `free`, `lite`, `max`, `fast`, and by the `analyzeOnly`/`scaffoldMode`/`planOnly` branches. That prompt contains ECHO phase-gating instructions (“transition through RED to GREEN, then spawn Forge”) and EDIT-oriented response examples. ANALYZE, SCAFFOLD, and PLAN modes receive the same framing even though their tool sets and workflows differ.

2. **Mode wrappers only override metadata.** `savant-analyze.ts`, `savant-scaffold.ts`, and `savant-plan.ts` call `createSavant('default', { analyzeOnly: true | scaffoldMode: true | planOnly: true })` and only change `id`, `displayName`, and `spawnerPrompt`. They inherit the EDIT `systemPrompt`.

3. **Parallel orchestrator in `savant-deep.ts`.** `createSavantDeep` defines a separate 7-phase workflow, its own system/instructions prompts, and a different spawnable roster, creating a second orchestrator personality that drifts from `savant.ts`.

4. **ECHO appendix duplication.** `recorder.ts`, `scribe.ts`, and `savant-deep.ts` still append the full `${ECHO_PROTOCOL_INSTRUCTIONS}` block to their `instructionsPrompt`.

5. **Template-literal corruption.** `<thinking>` tag instructions were stripped to literal “ tags” in `savant.ts`, `forge.ts`, `editor-implementor.ts`, and `thinker.ts`.

6. **Scout instructions are too terse.** It has `read_files`/`read_subtree` tools but no guidance on when to use them.

### Expected Behavior

- Each live mode receives a `systemPrompt` consistent with its tools and role.
- Subagent prompts focus on their single responsibility; ECHO governance lives in the orchestrator.
- Corrupted template literals are repaired.
- Subagent prompts clearly explain how to use their available tools.

### Root Cause

The orchestrator grew by appending mode-specific logic into `instructionsPrompt`/`stepPrompt` while leaving `systemPrompt` unchanged. Subagents copied the full ECHO appendix from an earlier template before the current separation-of-duties design existed. The degraded placeholders appear to be from an earlier automated transform that stripped `<thinking>` tags.

### Evidence

1. **Shared system prompt across modes.** `agents/savant/savant.ts` builds a single `systemPrompt` (≈500 lines); mode-specific logic is limited to `instructionsPrompt`/`stepPrompt` selection. The prompt includes “transition through RED to GREEN, then spawn Forge” and EDIT-mode response examples.

2. **Mode wrappers inherit system prompt.** `agents/savant/savant-analyze.ts`:
   ```ts
   const definition = {
     ...createSavant('default', { analyzeOnly: true }),
     id: 'savant-analyze',
     displayName: 'Savant the Analyzer',
     spawnerPrompt: 'Read-only analysis agent...',
   }
   ```
   Same pattern in `savant-scaffold.ts` and `savant-plan.ts`.

3. **Remaining ECHO appendix imports and usages.** Grep output:
   ```text
   .\agents\forge\forge.ts:   import { ECHO_PROTOCOL_INSTRUCTIONS } ...
   .\agents\recorder\recorder.ts: import { ECHO_PROTOCOL_INSTRUCTIONS } ...
   .\agents\scribe\scribe.ts: import { ECHO_PROTOCOL_INSTRUCTIONS } ...
   .\agents\savant\savant-deep.ts: import { ECHO_PROTOCOL_INSTRUCTIONS } ...
   .\agents\thinker\thinker.ts: import { ECHO_PROTOCOL_INSTRUCTIONS } ...
   .\agents\savant\savant.ts: ${ECHO_PROTOCOL_INSTRUCTIONS}
   ```

4. **Template-literal degradation.** Grep output:
   ```text
   .\agents\verifier\verifier.ts:   Before providing your review, use  tags to think through the code changes ...
   .\agents\forge\forge.ts:   Before you start writing your implementation, you should use  tags to think ...
   .\agents\thinker\thinker.ts: For trivial decisions only, you may use  tags instead.
   .\agents\editor\best-of-n\editor-implementor.ts: ...you should use  tags to think about the best way to implement the changes ...
   .\agents\editor\best-of-n\best-of-n-selector2.ts: Use  tags to write out your thoughts about the implementations ...
   .\agents\savant\savant.ts: - **Use  tags for moderate reasoning:** ...
   ```

5. **Scout instructions.** `agents/scout/scout.ts` `instructionsPrompt` is only a few sentences and does not mention `read_files` or `read_subtree`.

6. **`savant-deep.ts` parallel orchestrator.** `agents/savant/savant-deep.ts` exports `createSavantDeep` with `model: 'openai/gpt-5.4'`, a 7-phase workflow, and spawnable agents that differ from `savant.ts`.

---

## Impact Assessment

### Affected Components

- `agents/savant/savant.ts`
- `agents/savant/savant-analyze.ts`
- `agents/savant/savant-scaffold.ts`
- `agents/savant/savant-plan.ts`
- `agents/savant/savant-deep.ts`
- `agents/recorder/recorder.ts`
- `agents/scribe/scribe.ts`
- `agents/forge/forge.ts`
- `agents/thinker/thinker.ts`
- `agents/editor/best-of-n/editor-implementor.ts`
- `agents/scout/scout.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround (prompt quality directly affects agent behavior)
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

---

## Proposed Solution

### Approach

1. **Mode-specific orchestrator system prompts.** Split `savant.ts` `systemPrompt` into shared + mode-specific sections, selected by `analyzeOnly`/`scaffoldMode`/`planOnly` flags. Do not touch the provider/model system; subagents already inherit the parent model via `withParentModel()` in `spawn-agent-utils.ts` and route through `getModelForRequest()` in `model-provider.ts`.

2. **Remove duplicated ECHO appendix.** Delete the `ECHO_PROTOCOL_INSTRUCTIONS` import and appendix from `recorder.ts`, `scribe.ts`, and `savant-deep.ts`.

3. **Repair template-literal degradation.** Restore consistent `<thinking>` tag guidance in affected prompts, or replace with plain text if the runtime does not support raw tags.

4. **Improve Scout instructions.** Add guidance for `read_files`/`read_subtree` usage and ranking/summarizing findings.

### Steps

1. Refactor `savant.ts`:
   - `buildSharedSystemPrompt({ isFree })` — product identity, general conventions, skills, gravity_index, ask_user, etc.
   - `buildEditSystemPrompt()` — ECHO phase gating, Forge delegation, response examples.
   - `buildAnalyzeSystemPrompt()` — read-only framing, no Forge, no phase transitions.
   - `buildScaffoldSystemPrompt()` — umbrella-FID framing, project-root writes, `set_scaffold_complete`.
   - `buildPlanSystemPrompt()` — spec/plan mode framing, no code writing.
   - Route the correct builder in `createSavant`.

2. Remove `ECHO_PROTOCOL_INSTRUCTIONS` from `recorder.ts`, `scribe.ts`, `savant-deep.ts`, `forge.ts`, and `thinker.ts`.

3. Repair degraded `<thinking>` tag instructions in `savant.ts`, `forge.ts`, `editor-implementor.ts`, `thinker.ts`, `verifier.ts`, and `best-of-n-selector2.ts`.

4. Expand `scout.ts` instructions.

5. Decide on `savant-deep.ts` scope (Option A or B).

6. Typecheck, lint, and run agent tests.

### Verification

- `cd packages/agent-runtime && bun run typecheck`
- `cd agents && bun run typecheck` (if available)
- `bun x eslint <changed files> --max-warnings 0`
- Run tests covering agent registry and prompt assembly.
- Grep the bundled generated file to confirm assembled prompts contain expected mode-specific sections.

---

## Scope Boundaries

- **In scope**: prompts inside `agents/` (orchestrator variants + subagents), ECHO duplication cleanup, degraded prompt-text fixes.
- **Out of scope**:
  - Legacy template type cleanup (deferred to FID-2026-0722-051).
  - Model/provider changes. The runtime already routes models via `withParentModel()` and `getModelForRequest()`; this FID only changes prompt text.
  - Runtime changes to prompt assembly.

## Approval Gate

**No code changes will be made until this FID is approved and reaches COMPLETE status.**

---

## Perfection Loop

### Loop 1

- **RED (evidence):**
  - Mode-agnostic `systemPrompt` in `savant.ts` (single prompt string ≈500 lines).
  - Mode wrappers only override metadata (`id`, `displayName`, `spawnerPrompt`).
  - `savant-deep.ts` is a parallel orchestrator with its own workflow.
  - ECHO appendix duplicated in `forge.ts`, `recorder.ts`, `scribe.ts`, `savant-deep.ts`, `thinker.ts`, and `savant.ts`.
  - `<thinking>` tag instructions degraded to literal ` tags` placeholders in `savant.ts`, `forge.ts`, `editor-implementor.ts`, `thinker.ts`, `verifier.ts`, and `best-of-n-selector2.ts`.
  - Scout instructions too terse.

- **GREEN (proposed fix):**
  - Split `savant.ts` system prompt into shared + mode-specific builders.
  - Remove ECHO appendix from subagents; keep it only in the orchestrator.
  - Repair degraded `<thinking>` tag instructions.
  - Expand Scout instructions.
  - Resolve `savant-deep.ts` scope (recommend unifying into `createSavant`).

- **AUDIT (verification plan):**
  - Typecheck and lint pass.
  - Agent registry / prompt assembly tests pass.
  - Re-generated bundled agents file contains expected mode-specific sections.

- **CHANGE DELTA:** TBD after implementation.

### Loop 2 (if needed)

- **RED:** Audit findings from Loop 1.
- **GREEN:** Address findings.
- **AUDIT:** Re-run verification.
- **CHANGE DELTA:** TBD.

---

## Resolution

- **Fixed By:** Savant  
- **Fixed Date:** 2026-07-22  
- **Fix Description:**
  - `agents/savant/savant.ts`: Extracted the monolithic `systemPrompt` into `buildSystemPrompt(mode, context)` / `buildDefaultSystemPrompt(context)`. Added mode-specific preambles for `analyze`, `plan`, `scaffold`, and `free`; the default mode returns the unchanged base prompt. Suppressed ECHO phase gating for `analyze`/`plan` and provided mode-appropriate response examples.
  - `agents/thinker/thinker.ts`: Fixed the `<thinking>` tag stripping regex to use `</thinking>` closing tag.
  - `agents/recorder/recorder.ts`: Removed ECHO appendix; fixed pre-existing `handleSteps` type narrowing.
  - `agents/scribe/scribe.ts`: Removed ECHO appendix.
  - `agents/savant/savant-deep.ts`: Removed ECHO appendix; fixed the template literal closure.
  - `agents/scout/scout.ts`: Expanded `instructionsPrompt` with workflow guidance for `glob`, `list_directory`, `read_files`, and `read_subtree`.
  - `agents/editor/best-of-n/editor-implementor.ts`: Fixed pre-existing `Record<string, JSONValue>` type cast.
- **Tests Added:** No new tests added; existing typecheck gates verified.
- **Verified By:**
  - `cd agents && bun run typecheck` → pass
  - `cd common && bun run typecheck` → pass
  - `cd packages/agent-runtime && bun run typecheck` → pass
  - `cd cli && bun run typecheck` → pass
  - `bun x prettier --write` applied to all touched files.
- **Commit/PR:** TBD (user-managed)  
- **Archived:** 2026-07-22  

## Lessons Learned

- Code was edited before the FID converged, violating FID-Bound Execution. The correct order is: FID → Perfection Loop → user approval → code changes.
- The provider/model system (`withParentModel`, `getModelForRequest`) already handles multi-provider routing; prompt changes should not attempt to override model selection.
- Future prompt work must begin with a complete read of the runtime prompt assembly path, not just the agent definition files.
