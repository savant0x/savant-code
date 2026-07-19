# FID-2026-0718-008 — critical — A-Z System Test v2 Findings (7 Issues + Agent Wants)

**Created:** 2026-07-18
**Status:** Open — Perfection Loop in progress
**Severity:** critical (F1 is a runtime crash)
**Creator:** Orchestrator (ECHO v0.2.0)
**Source:** Comprehensive A-Z system test v2 (246 items, 212 PASS / 16 FAIL / 18 CAVEAT)
**Test report:** `docs/reports/test-run.md`

---

## Summary

The A-Z system test v2 (246 items) revealed 7 actionable findings and 4 agent workflow requests. Two findings are genuine code regressions (F1: Scout runtime crash, F2: missing FID path exemption). The remaining 5 are documentation drift, stale references, and mode-dependent behavior. The agent running the test also left 4 workflow improvement requests.

---

## RED Phase — Issue Catalog

### F1: Scout `handleSteps` closure serialization bug (HIGH — runtime crash)

**Evidence:**
- `agents/scout/scout.ts` defines `extractKeywords` at module scope (top of file)
- `handleStepsDefault` and `handleStepsMax` (generator functions) reference `extractKeywords` as a closure
- `cli/scripts/prebuild-agents.ts` serializes `handleSteps` via `.toString()` when generating `bundled-agents.generated.ts`
- At runtime, the bundled agent loads the serialized string, which loses the lexical closure reference to `extractKeywords`
- **Error:** `Error executing handleSteps for agent scout: extractKeywords is not defined`
- **Impact:** Scout is completely non-functional. Every Orchestrator that spawns Scout for context gathering gets a crash. Breaks the Scout → read pipeline (Phase 10 of test).

**Source vs bundled:**
- Source `agents/scout/scout.ts` is correct — defines `extractKeywords` at module scope
- Bundled `cli/src/agents/bundled-agents.generated.ts` serializes `handleSteps` as a string, losing the closure
- The test agent confirmed: "The **source** `agents/scout/scout.ts` is correct... but the **bundled agent** the runtime loads serializes `handleSteps` as a string, losing the `extractKeywords` closure."

### F2: Missing FID path exemption in tool-executor.ts (HIGH — FID lifecycle broken)

**Evidence:**
- CHANGELOG.md entry for FID-2026-0717-001 claims: "FID path exemption in tool-executor.ts — write_file/str_replace now allowed for dev/fids/ paths in any FSM phase"
- Archived FID-2026-0717-001 specifies the fix at tool-executor.ts:338-349
- Actual code in `packages/agent-runtime/src/tools/tool-executor.ts` gate checks: `(agentState.fsmPhase ?? 'idle') !== 'green'` — no path exemption for `dev/fids/`
- **Impact:** The Recorder agent cannot write FID files unless the session is in GREEN phase. This contradicts the FID-Bound Execution model where FIDs should be creatable in any phase.

### F3: Stale agent references in test prompt (MEDIUM)

**Evidence:**
- Test items reference `code-searcher` → renamed to `detective` in FID-006
- Test items reference `code-reviewer-mimo-pro` → deleted in FID-006 (consolidated into `verifier`)
- Test items reference `file-picker` → renamed to `scout` in FID-006

**Impact:** Test prompt has stale references. Not a code bug, but the test prompt needs updating to match the current 9-agent roster.

### F4: ARCHITECTURE.md + ECHO.md stale agent tool tables (MEDIUM)

**Evidence (ARCHITECTURE.md):**
- Lists Scout tools as `spawn_agents` only — actual toolNames: `glob, list_directory, read_files, read_subtree, set_output`
- Lists Detective tools as `code_search, set_output` — may include additional search capabilities

**Evidence (ECHO.md — Nova audit finding 2026-0718):**
- ECHO.md roster table (lines 55-63) was NOT updated when FID-006 changed the agents
- Orchestrator: ECHO.md says `write_file, str_replace, apply_patch, bash` — actual: NO write tools (stripped in FID-001/006)
- Detective: ECHO.md says `write_file, str_replace, bash` — actual: `code_search, set_output` only
- Verifier: ECHO.md says `write_file, str_replace` — actual: `toolNames: []` (zero tools, confirmed in `agents/verifier/verifier.ts:24`)
- Thinker: ECHO.md says `write_file, str_replace, bash` — actual: `sequentialthinking` only
- Scout: ECHO.md says `write, str_replace, bash, spawn` — actual: `glob, list_directory, read_files, read_subtree, set_output`
- Researcher: ECHO.md says `write, str_replace, bash` — actual: `web_search, read_url` only
- Scribe: ECHO.md says `str_replace, bash, spawn` — actual: `read_files, write_file, glob, grep, set_output`
- ECHO.md Separation of Duties table (lines 69-75) CONTRADICTS the roster table in the same file (e.g., line 71 says Verifier "cannot write code" but line 58 gives it write_file/str_replace)

**Impact:** Every agent reads ECHO.md FIRST (boot sequence step 1). Agents operate on a false mental model of their own capabilities. The bootstrap file contradicts itself. Nova flagged this as the same drift class that caused earlier confusion.

### F5: Skills count mismatch (LOW)

**Evidence:**
- `.agents/skills/` contains 7 directories: `coding-csharp`, `coding-go`, `coding-java`, `coding-python`, `coding-rust`, `coding-typescript`, `release-workflow`
- Test expects 11 skills
- 4 skills are preloaded (bundled into the agent system prompt) rather than in `.agents/skills/`
- The `skill` tool reports them as available but they don't have directory entries

**Impact:** Test expectation mismatch. Not a code bug — the preloaded skills are working correctly, they just aren't visible as directories.

### F6: `/plan` command is mode-dependent (LOW)

**Evidence:**
- `/plan` is listed in `FREEBUFF_ONLY_COMMANDS` in `cli/src/commands/command-registry.ts`
- Only available in Freebuff mode, not in Codebuff (Savant) mode
- Test expects `/plan` to be available universally

**Impact:** Mode-dependent behavior. The test prompt should note this is Freebuff-only, or the command should be made available in both modes.

### F7: `set_output` contradiction in Orchestrator (LOW)

**Evidence:**
- `agents/base2/base2.ts` toolNames includes `set_output`
- ECHO.md system prompt says "set_output: YES (but for subagents)"
- Test item 138 confirms `set_output` is in toolNames
- But system prompt guidance contradicts: advises against using it directly

**Impact:** Minor inconsistency. The tool is available but discouraged by prompt guidance. This should be reconciled — either remove from toolNames or update the prompt guidance.

---

### F9: Orchestrator needs write access for operational files (MEDIUM)

**Evidence:**
- Orchestrator has NO write_file/str_replace (stripped in FID-001/006)
- User talks directly to the Orchestrator and asks it to write files
- Every doc/FID/session-summary write requires spawning Forge + GREEN phase — absurd for non-code files
- The agent running the A-Z test flagged this as a workflow blocker

**Impact:** The Orchestrator cannot write to `dev/fids/`, `dev/nova/`, `dev/session-summaries/`, `CHANGELOG.md`, or any `.md` docs without spawning Forge. This breaks the FID lifecycle (Recorder should write FIDs), session documentation, and Nova communication.

**Design Decision — Scratchpad Approach:**

Instead of a path-based allowlist (which grows over time and is hard to reason about), implement a **scratchpad**: a single folder `dev/scratchpad/` where the Orchestrator can write freely without FSM gating.

| Write Target | Orchestrator Allowed? | Requires GREEN? | Rationale |
|---|---|---|---|
| `dev/scratchpad/*` | ✅ Yes (in any phase) | No | Sandbox for quick tasks, notes, experiments |
| `dev/fids/*` | ✅ Yes (in any phase) | No | FID lifecycle is the Orchestrator's job (existing exemption, Fix 2) |
| `dev/nova/*` | ✅ Yes (in any phase) | No | Inter-agent communication (existing exemption) |
| `*.ts`, `*.js`, `*.json` (source code) | ❌ No | Yes, via Forge | Code goes through the Perfection Loop |
| Everything else | ⚠️ Depends | Check agent + phase | Default FSM gating applies |

**Why scratchpad wins over alternatives:**
- Path allowlist → grows over time, hard to reason about
- File-extension gating → `.md` can contain code, easy to circumvent
- Orchestrator exempt from FSM → too broad, no boundary
- **Scratchpad → one folder, one rule, crystal clear boundary**

**The Loop is preserved:**
- Forge still requires GREEN phase to write source code
- Verifier still can't write anything
- The Perfection Loop governs **code implementation**, not **documentation**
- The scratchpad is a sandbox, not a bypass

---

### F10: FSM phase tracking gets stuck — no escape hatches, no auto-reset (HIGH — UX/runtime bug)

**Evidence:**
- `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` line 14-21: `VALID_TRANSITIONS` map has no `green → idle` or `audit → idle` path
- Once in `green`, the only exit is `audit → complete → idle` — if the user asks a question instead of continuing code work, the agent stays stuck in `green`
- `agentState.fsmPhase` is an in-memory mutation (line 98) that persists across the entire conversation — no reset between messages
- `cli/src/state/chat-store.ts` `reset()` (line 649) resets `fsmPhase` to `'idle'` but only in the UI; the runtime `agentState` is separate
- `spawn-agent-utils.ts` line 298: `fsmPhase: parentAgentState.fsmPhase` — subagents inherit the stuck phase
- The user observed: phase stuck in `green` even though no code was written, phase not tracking correctly across multiple cycles

**Root Causes:**
1. **No escape hatches:** `green → idle` and `audit → idle` are not valid transitions — the FSM is a one-way ratchet
2. **No auto-reset:** When a new user message arrives, the phase doesn't reset to `idle`
3. **Runtime/UI disconnect:** The UI resets on `/new` but the runtime `agentState` doesn't
4. **Subagent inheritance:** Stuck phase propagates to all spawned agents

**Impact:** The agent gets permanently stuck in `green` or another non-idle phase. The sidebar shows the wrong phase. Write tools remain gated (or ungated) incorrectly. The user has no way to reset without restarting the CLI.

---

## Agent Workflow Requests (from test executor)

### W1: Gate "Spawn Forge/Verifier" reminder on code-mutation scenarios

The system reminder fires unconditionally even for read-only verification tasks. The agent suggests gating it on actual code-mutation scenarios (GREEN phase or write operation imminent) or softening the language from "You must" to conditional wording.

### W2: `delete_file` tool for cleanup

The agent had to delegate file cleanup through the full FSM cycle (IDLE → GREEN via Forge → write). A `delete_file` tool would simplify cleanup of test artifacts.

### W3: More granular tool permissions for verification tasks

Cross-package typechecks currently require cycling through the full FSM (`idle→red→green→audit`). The agent suggests a dedicated verification tool or limited write permissions for documentation tasks.

### W4: Large string argument ceiling

Inline tool arguments with very large strings hit a practical size limit — JSON truncation causes silent parse errors. The agent adopted a strategy of writing full content in chat messages and delegating verbatim writes to Forge as a workaround.

---

## GREEN Phase — Proposed Fixes

### Fix 1: Scout `extractKeywords` closure serialization (F1)

**Option A (RECOMMENDED): Inline the function into each generator**

Move `extractKeywords` body directly into `handleStepsDefault` and `handleStepsMax` so the serialized `.toString()` contains all dependencies inline. This is the most reliable approach since the prebuild script's serialization mechanism is fundamentally incompatible with module-scope closures.

**Option B: Register `extractKeywords` as a named function on the agent object**

Add `extractKeywords` as a method on the agent definition object so the prebuild script serializes it alongside `handleSteps`. Requires updating `prebuild-agents.ts` to also serialize helper functions.

**Option C: Refactor prebuild to serialize the full module**

Instead of `.toString()`, use a bundler (esbuild/rollup) to produce a self-contained bundle. Most robust but highest effort.

**Decision: Option A** — minimal changes, zero risk of prebuild script regression, self-contained generators.

### Fix 2: FID path exemption in tool-executor.ts (F2)

Add path check to the write_file/str_replace/apply_patch gate:

```typescript
// FID path exemption: allow dev/fids/ writes in any phase
const isFidPath = toolCall.input?.filePath?.startsWith('dev/fids/') 
  || toolCall.input?.path?.startsWith('dev/fids/')
if (isFidPath) {
  // Skip FSM gating — FID lifecycle is phase-independent
  return // or continue to handler
}
```

Place this check before the `fsmPhase !== 'green'` gate at the top of `executeToolCall`.

### Fix 3: Update test prompt stale references (F3)

Replace all occurrences of:
- `code-searcher` → `detective`
- `code-reviewer-mimo-pro` → `verifier`
- `file-picker` → `scout`
- `file-picker-max` → `scout` (or remove if Scout has no max variant)

### Fix 4: Update ARCHITECTURE.md + ECHO.md agent tool tables (F4)

**ARCHITECTURE.md:** Update all 9 agent rows to match actual toolNames in source.

**ECHO.md (Nova finding):** Update the roster table (lines 55-63) to match FID-006 reality:
- Orchestrator: `spawn_agents, read_files, read_subtree, write_todos, suggest_followups, ask_user, read_url, skill, set_output, list_directory, glob, render_ui, transition_phase` (NO write tools)
- Detective: `code_search, set_output` (NO write tools)
- Forge: `write_file, str_replace, set_output` (implementation only)
- Verifier: `*(no tools — reads only via message history)*` (confirmed: `toolNames: []` in verifier.ts:24)
- Recorder: `write_file, read_files, glob, grep, set_output, transition_phase`
- Thinker: `sequentialthinking` only
- Scout: `glob, list_directory, read_files, read_subtree, set_output`
- Researcher: `web_search, read_url` (NO write tools)
- Scribe: `read_files, write_file, glob, grep, set_output`

Also update the Separation of Duties table (lines 69-75) to match — it currently CONTRADICTS the roster table in the same file.

### Fix 5: Document skills count discrepancy (F5)

Add a note to the test prompt that 4 skills are preloaded (not in `.agents/skills/`) and the count of 7 directories is expected.

### Fix 6: Make `/plan` available in both modes (F6)

Either:
- **A:** Remove `/plan` from `FREEBUFF_ONLY_COMMANDS` (make it universal)
- **B:** Update test prompt to note it's Freebuff-only

### Fix 7: Reconcile `set_output` in Orchestrator (F7)

Either:
- **A:** Remove `set_output` from Orchestrator toolNames (consistent with ECHO.md "subagent only")
- **B:** Update ECHO.md system prompt to allow Orchestrator use

### Fix 9: FSM phase tracking — escape hatches + auto-reset (F10)

**Approach:** Two-part fix (Fix 9c removed — redundant after Perfection Loop critique):

**Fix 9a: Add escape hatches to VALID_TRANSITIONS**

File: `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  idle: ['red'],
  red: ['green', 'idle'],       // NEW: abort from red
  green: ['audit', 'idle'],      // NEW: abort from green
  audit: ['self_correct', 'complete', 'idle'],  // NEW: abort from audit
  self_correct: ['green', 'idle'],  // NEW: abort from self_correct
  complete: ['idle'],
}
```

This allows the agent (or the user via prompt) to abort the Perfection Loop at any point and return to `idle`. The abort path is always `→ idle`. The normal path (red → green → audit → complete) is unchanged.

**Fix 9b: Auto-reset phase on new user message**

File: `cli/src/state/chat-store.ts` — In the `setMessages` action or a new `onUserMessage` action, reset `fsmPhase` to `'idle'` when a new user message is added.

```typescript
// In chat-store.ts, add a new action:
onNewUserMessage: () => set((state) => {
  state.fsmPhase = 'idle'
}),
```

File: `cli/src/hooks/use-send-message.ts` or wherever user messages are dispatched — call `useChatStore.getState().onNewUserMessage()` when a new user message is sent.

**Fix 9c: REMOVED** — The SDK creates fresh agentState per run (confirmed by transition-phase.ts line 24: "On restart/resume, phase resets to 'idle'"). The runtime auto-resets. Fix 9b handles the UI. Step prompt hint was redundant.

Also add iterationCount reset on `→ idle`:
```typescript
// After: agentState.fsmPhase = phase as FsmPhase
if (phase === 'idle') {
  agentState.iterationCount = 0
}
```

**Files to change:**
- `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` — add escape hatches + iterationCount reset
- `cli/src/state/chat-store.ts` — add `onNewUserMessage` action that resets fsmPhase
- `cli/src/hooks/use-send-message.ts` — call `onNewUserMessage` when user sends a message

**Security:** The escape hatches only allow `→ idle` transitions. They don't allow skipping phases (e.g., `idle → audit` is still blocked). The normal Perfection Loop path is unchanged. `green → idle` is safe because the Orchestrator doesn't write source code directly — it delegates to Forge.

### Fix 10: Add write_file/str_replace to Orchestrator + Scratchpad (F9)

**Approach:** Scratchpad design — add `write_file` and `str_replace` back to Orchestrator toolNames, add `dev/scratchpad/` as an ungoverned sandbox in the FSM gate with path normalization (security fix from Q8).

**Implementation:**
1. `agents/base2/base2.ts` — Add `write_file`, `str_replace` to Orchestrator toolNames
2. `packages/agent-runtime/src/tools/tool-executor.ts` — Replace the existing FSM write gate with a unified exemption check including path normalization:
   ```typescript
   import { normalize } from 'path'
   
   // ECHO FSM tool gating: block write tools unless phase is 'green' or path is exempt
   if (
     !isDevOverride &&
     toolCall.toolName &&
     (toolCall.toolName === 'write_file' ||
       toolCall.toolName === 'str_replace' ||
       toolCall.toolName === 'apply_patch')
   ) {
     const rawPath = (toolCall.input as any)?.path ?? ''
     const normalizedPath = normalize(rawPath).replace(/\\/g, '/')
     const isExemptPath = normalizedPath.startsWith('dev/fids/') 
       || normalizedPath.startsWith('dev/nova/')
       || normalizedPath.startsWith('dev/scratchpad/')
     
     if (!isExemptPath && (agentState.fsmPhase ?? 'idle') !== 'green') {
       onResponseChunk({
         type: 'error',
         message: `Tool \`${toolName}\` is only available during the GREEN phase. Current phase: ${agentState.fsmPhase}. Call transition_phase to enter GREEN first.`,
       })
       return previousToolCallFinished
     }
   }
   ```
3. Create `dev/scratchpad/` directory with a `.gitkeep`
4. Add `dev/scratchpad/` to `.gitignore` (keep `.gitkeep`)
5. `ECHO.md` — Update roster table: Orchestrator now has `write_file, str_replace` (scratchpad + exempt paths only). Update SoD table: "Orchestrator cannot write source code files (delegated to Forge). Can write to scratchpad, FIDs, and Nova paths."
6. `ARCHITECTURE.md` — Update Orchestrator tools column

**What the scratchpad enables:**
- Quick notes the user asks for
- Working documents / analysis
- Temporary test artifacts
- Experimentation (throwaway code snippets)
- Anything the Orchestrator needs to write without ceremony

**Cleanup policy:** Persistent directory, ephemeral contents (unless user opts in). Add `dev/scratchpad/.gitkeep` so the directory survives `git clone`.

**Security:** Path normalization prevents traversal attacks (e.g., `dev/scratchpad/../../agents/scout/scout.ts` normalizes to `agents/scout/scout.ts` which is NOT exempt).

---

## Missed Questions (Thinker Round 1 — 6 questions surfaced)

### Q1: Does Fix 1A (inline extractKeywords) create unacceptable code duplication?

**Answer:** Yes, it duplicates ~50 lines across two generators. But this is the correct tradeoff:
- The prebuild script's `.toString()` serialization is fundamentally incompatible with module-scope closures
- Modifying `prebuild-agents.ts` to serialize helper functions is a broader change that could affect all 47+ bundled agents
- The duplication is contained within a single file (`agents/scout/scout.ts`) and the function is stable (stop-word list rarely changes)
- **Decision: Accept duplication. Track prebuild refactor as a future FID.**

### Q2: What are the correct input field names for the FID path exemption (Fix 2)?

**Answer:** Looking at tool schemas:
- `write_file` uses `input.path`
- `str_replace` uses `input.path`
- `apply_patch` uses `input.path`
- All three use the same field name `path`.
- The fix should check `(toolCall.input as any)?.path?.startsWith('dev/fids/')` — no need for `filePath` fallback.

### Q3: Is the FID path exemption safe? Can any agent write to dev/fids/?

**Answer:** Yes, it's safe. Only 3 of 9 agents have `write_file` in their toolNames:
- **Forge** — GREEN phase implementation agent (legitimate FID writer)
- **Recorder** — FID lifecycle manager (primary FID writer)
- **Scribe** — session documentation (legitimate FID writer)
The Orchestrator, Detective, Verifier, Thinker, Scout, and Researcher do NOT have `write_file`. The exemption only bypasses FSM phase gating, not tool permission gating.

### Q4: Should W1-W4 (agent workflow requests) be implemented in this FID?

**Answer:** No. W1-W4 are improvement ideas, not bugs. They should be tracked as separate low-priority items:
- W1 (gate reminder): Requires changes to the system prompt injection logic — out of scope
- W2 (delete_file tool): New tool registration + handler — separate FID
- W3 (granular permissions): Architecture decision — needs design discussion
- W4 (large string ceiling): Infrastructure issue — separate FID
- **Decision: Move W1-W4 to "Future Improvements" section, not implemented here.**

### Q5: For F6, should `/plan` be made universal or kept Freebuff-only?

**Answer:** Keep it Freebuff-only (Option B). The `/plan` command is part of the Freebuff product design. Making it universal in Savant mode would require understanding how it interacts with the ECHO Perfection Loop. Update the test prompt to note this is mode-dependent.

### Q6: For F7, should `set_output` be removed from Orchestrator or ECHO.md updated?

**Answer:** Keep `set_output` in Orchestrator toolNames (Option B). The Orchestrator legitimately needs `set_output` for:
- Returning results from orchestration workflows
- Setting output when delegating to subagents that don't have `set_output`
- The ECHO.md "Restricted Tools" column lists tools the agent CANNOT use — `set_output` is NOT in that column, so it's already allowed
- **Decision: Update ECHO.md system prompt to clarify that Orchestrator may use `set_output` directly.**

---

## Thinker Convergence

All 6 missed questions answered. No new issues surfaced. The FID is converged.

**Convergence criteria met:**
- All issues cataloged (7 findings + 4 wants)
- All proposed fixes have clear decisions
- All missed questions answered with robust defaults
- No contradictions or ambiguities remain

---

## Missed Questions (Thinker Round 2 — F9 Scratchpad, 7 questions surfaced)

### Q7: Can the scratchpad be abused to bypass the Perfection Loop?

**Answer:** No. The scratchpad (`dev/scratchpad/`) is not part of the production codebase. Files there are not imported by the runtime. Even if the Orchestrator writes a `.ts` snippet there, it's inert — the runtime doesn't load files from `dev/scratchpad/`. The gate still blocks writes to `agents/`, `src/`, `packages/` unless GREEN phase. The scratchpad is a sandbox for working documents, not a code deployment path.

**Decision: Safe. No changes needed.**

### Q8: Path traversal — can `dev/scratchpad/../../agents/scout/scout.ts` escape the sandbox?

**Answer:** YES — this is a real vulnerability. The naive `startsWith('dev/scratchpad/')` check can be bypassed with `..` path segments. The fix must normalize the path before checking:

```typescript
import { normalize, resolve } from 'path'

const rawPath = (toolCall.input as any)?.path ?? ''
const normalizedPath = normalize(rawPath).replace(/\\/g, '/')
const isExemptPath = normalizedPath.startsWith('dev/fids/') 
  || normalizedPath.startsWith('dev/nova/')
  || normalizedPath.startsWith('dev/scratchpad/')
```

`normalize()` resolves `..` segments, so `dev/scratchpad/../../agents/scout/scout.ts` becomes `agents/scout/scout.ts`, which does NOT start with `dev/scratchpad/`.

**Decision: Add path normalization to the exemption check. This is a security requirement.**

### Q9: Orchestrator with `write_file` + GREEN phase — can it write source code directly?

**Answer:** Yes, it technically can. If the Orchestrator transitions to GREEN phase and has `write_file` in its toolNames, it can write anywhere that's not path-exempted. This is the key design tension.

However, this is acceptable because:
- The Orchestrator's system prompt says "code writing is delegated to Forge"
- The ECHO Protocol enforces this via prompt guidance, not tool gating
- The Orchestrator is the **governance agent** — it *chooses* to delegate
- The FSM gate is a guardrail (blocks writes outside GREEN), not a prison (doesn't force delegation)
- In practice, the Orchestrator will spawn Forge because that's what its instructions say

**Decision: Acceptable risk. The system prompt + ECHO Protocol provide the primary enforcement. The FSM gate provides the secondary enforcement (must be in GREEN). Track as a future FID if we want stricter enforcement (e.g., agent-level path restrictions).**

### Q10: Recorder overlap on FID writes — who owns FID lifecycle?

**Answer:** Both the Orchestrator and Recorder can write to `dev/fids/`. This is fine:
- **Recorder** is a specialized subagent for FID lifecycle management (create, track, archive, CHANGELOG)
- **Orchestrator** writes FIDs when running the Perfection Loop directly (the user talks to the Orchestrator)
- The Recorder is spawned by the Orchestrator when FID management needs delegation
- This mirrors a project manager (Orchestrator) who can write tickets directly or delegate to a tool (Recorder)

**Decision: No conflict. Both can write to `dev/fids/`. Document this in ECHO.md.**

### Q11: Should scratchpad be gitignored?

**Answer:** Yes. The scratchpad is a working area for ephemeral documents, not committed content. Add `dev/scratchpad/` to `.gitignore` but keep `dev/scratchpad/.gitkeep` so the directory exists after clone. Users can un-gitignore specific files if they want to persist them.

**Decision: Add to `.gitkeep` and `.gitignore`. Persistent directory, ephemeral contents (unless user opts in).**

### Q12: Is 'scratchpad' the right name?

**Answer:** Yes. Evaluated alternatives:
- `workspace` — overloaded (VS Code workspace, npm workspace)
- `sandbox` — implies isolation/security, which is true but less intuitive
- `staging` — implies pre-deployment, wrong mental model
- `tmp` — implies auto-deletion, which we don't want
- **`scratchpad`** — clear, intuitive, matches the mental model of "a place to jot things down"

**Decision: Keep `scratchpad`.**

### Q13: Does this change the Separation of Duties table in ECHO.md?

**Answer:** Yes. The current SoD table says Orchestrator "cannot write files or run terminal commands." With scratchpad + exempt paths, the Orchestrator CAN write files — just not source code. The SoD rule needs updating:

**Old:** "The Orchestrator cannot write files or run terminal commands"
**New:** "The Orchestrator cannot write source code files (delegated to Forge). Can write to scratchpad, FIDs, and Nova paths."

**Decision: Update ECHO.md SoD table to reflect the new policy.**

---

## Thinker Round 2 Convergence

All 7 missed questions answered. Key findings:
- **Security fix required:** Path normalization (Q8) — must be implemented
- **SoD update required:** ECHO.md SoD table (Q13) — must be updated
- **Design validated:** Scratchpad is safe (Q7), naming is correct (Q12), Recorder overlap is fine (Q10)

**Convergence criteria met:**
- All 9 issues cataloged (F1-F9)
- All proposed fixes have clear decisions
- All 13 missed questions answered across 2 Thinker rounds
- Path traversal vulnerability identified and fix specified
- SoD table update identified and fix specified
- No contradictions or ambiguities remain

---

## Missed Questions (Thinker Round 3 — F10 FSM Phase Tracking, 5 questions surfaced)

### Q14: Is `green → idle` safe? Could partial writes be left behind?

**Answer:** Yes, partial writes could remain — but this is acceptable. The Orchestrator doesn't write source code directly (it delegates to Forge). If the Orchestrator aborts to idle, Forge's writes are already committed (no rollback mechanism exists). The alternative — being stuck in green forever — is strictly worse. The escape hatch is for the Orchestrator, not Forge.

**Decision: Safe. The escape hatch prevents the worse failure mode (permanent stuck state).**

### Q15: Does the SDK runtime create fresh agentState per run?

**Answer:** YES — confirmed by transition-phase.ts line 24 comment: "FSM phase and iterationCount are session-scoped (in-memory only). On restart/resume, phase resets to 'idle'." The SDK's `run()` creates a new agentState for each user message. So the runtime auto-resets to idle. The bug is purely in the UI (chat-store.fsmPhase not resetting).

**Decision: Fix 9b (UI auto-reset) is sufficient. Fix 9c was redundant — removed.**

### Q16: Should iterationCount reset on `→ idle`?

**Answer:** Yes — for consistency. The SDK creates fresh agentState per run, so iterationCount already resets in the runtime. But adding an explicit reset in the transition handler is a safety net and makes the state machine self-documenting.

**Decision: Add `if (phase === 'idle') agentState.iterationCount = 0` after phase assignment.**

### Q17: Is there a race between UI reset and runtime state?

**Answer:** No. The runtime starts fresh (agentState.fsmPhase = undefined = 'idle'). The UI is stale (shows old phase from previous message). Fix 9b auto-resets the UI on new message. They converge naturally — no race condition.

**Decision: No changes needed beyond Fix 9b.**

### Q18: Any phase where `→ idle` should be BLOCKED?

**Answer:** No. Every phase benefits from an escape hatch. The normal path (red → green → audit → complete) is unchanged. The escape hatch is a safety valve that doesn't affect the happy path.

**Decision: Allow `→ idle` from all phases.**

---

## Thinker Round 3 Convergence

All 5 missed questions answered. Key findings:
- **Fix 9c removed:** SDK auto-resets runtime; Fix 9b handles UI — step prompt hint was redundant
- **iterationCount reset added:** Safety net on `→ idle` transition
- **No race condition:** Runtime and UI converge naturally
- **green → idle is safe:** Orchestrator doesn't write code directly

**Convergence criteria met:**
- All 10 issues cataloged (F1-F10)
- All proposed fixes have clear decisions
- All 18 missed questions answered across 3 Thinker rounds
- No contradictions or ambiguities remain

---

## AUDIT Phase

### Audit Checklist

- [ ] **Fix 1 (Scout):** Typecheck agents/ — zero errors
- [ ] **Fix 1 (Scout):** Regenerate bundled-agents.generated.ts — verify extractKeywords is inlined
- [ ] **Fix 1 (Scout):** Spawn Scout in live session — no crash
- [ ] **Fix 2 (FID exemption):** Typecheck packages/agent-runtime/ — zero errors
- [ ] **Fix 2+8 (Path exemption + scratchpad):** Grep for `dev/fids`, `dev/nova`, `dev/scratchpad` in tool-executor.ts — all confirmed present
- [ ] **Fix 2+8 (Path normalization):** Verify `normalize()` is called before `startsWith()` checks — prevents traversal
- [ ] **Fix 2+8 (Path exemption):** Test: write_file to dev/fids/ in IDLE phase — succeeds
- [ ] **Fix 2+8 (Scratchpad):** Test: write_file to dev/scratchpad/ in IDLE phase — succeeds
- [ ] **Fix 2+8 (Source gate):** Test: write_file to agents/scout/scout.ts in IDLE phase — BLOCKED
- [ ] **Fix 3 (test prompt):** Grep for stale agent names — zero matches
- [ ] **Fix 4 (ARCHITECTURE.md):** Compare agent tool table against source — all 9 match
- [ ] **Fix 4 (ECHO.md SoD):** Verify SoD table says "cannot write source code files" (not "cannot write files")
- [ ] **Fix 5 (skills):** Note added to test prompt
- [ ] **Fix 6 (/plan):** Test prompt updated with mode note
- [ ] **Fix 7 (set_output):** ECHO.md updated, no contradiction
- [ ] **Fix 8 (Orchestrator):** `write_file` and `str_replace` in base2.ts toolNames
- [ ] **Fix 8 (scratchpad):** `dev/scratchpad/.gitkeep` exists, `dev/scratchpad/` in `.gitignore`
- [ ] **Fix 8 (bundled):** Regenerate bundled-agents.generated.ts after base2.ts change
- [ ] **Fix 9 (FSM escape hatches):** VALID_TRANSITIONS includes `idle` from all phases
- [ ] **Fix 9 (iterationCount reset):** iterationCount resets on `→ idle`
- [ ] **Fix 9 (UI auto-reset):** fsmPhase resets to 'idle' when new user message sent
- [ ] **Fix 9 (end-to-end):** Agent transitions to green, user sends new question, phase shows idle

### Verification Commands

```bash
# Typecheck affected packages
bun run --cwd=agents typecheck
bun run --cwd=packages/agent-runtime typecheck
bun run --cwd=cli typecheck

# Regenerate bundled agents
bun run --cwd=cli scripts/prebuild-agents.ts

# Grep verification
grep -n "extractKeywords" cli/src/agents/bundled-agents.generated.ts  # Should find inlined function
grep -n "dev/fids\|dev/nova\|dev/scratchpad" packages/agent-runtime/src/tools/tool-executor.ts  # Should find all 3 exemptions
grep -n "normalize" packages/agent-runtime/src/tools/tool-executor.ts  # Should find path normalization
grep -n "write_file\|str_replace" agents/base2/base2.ts  # Should find write tools in toolNames
grep -rn "code-searcher\|code-reviewer-mimo-pro\|file-picker" dev/test-prompts/  # Should find zero matches
grep -n "cannot write source code" ECHO.md  # Should find updated SoD rule
ls dev/scratchpad/.gitkeep  # Should exist
grep "scratchpad" .gitignore  # Should be present
```

---

## AUDIT Phase

*(Populated after GREEN convergence)*

---

## Future Improvements (Out of Scope)

These items are tracked but NOT implemented in this FID:

- **W1:** Gate "Spawn Forge/Verifier" reminder on code-mutation scenarios
- **W2:** Add `delete_file` tool for cleanup
- **W3:** More granular tool permissions for verification tasks
- **W4:** Large string argument ceiling fix
- **Prebuild refactor:** Serialize helper functions alongside handleSteps to avoid code duplication

---

## Resolution

*(Populated after AUDIT passes)*
