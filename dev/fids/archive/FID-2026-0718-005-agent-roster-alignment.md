# FID-2026-0718-005 — high — Agent Roster Alignment (Savant Spec ↔ SavantCode Codebase)

**Created:** 2026-07-18
**Status:** Open
**Severity:** high
**Creator:** Orchestrator (ECHO v0.2.0)
**Source:** ARCHITECTURE.md spec review + A-Z system test Finding 1

---

## Summary

The ARCHITECTURE.md spec defines 9 specialized agents with strict separation of duties.
The codebase has 69 bundled agents inherited from SavantCode. The orchestrator (`base2`)
spawns a mix of Savant agents and SavantCode agents with overlapping responsibilities.
This FID tracks the alignment to the 9-agent Savant architecture without losing capabilities.

**Decisions made (operator-approved):**
1. Orchestrator: **Remove write tools** (str_replace, write_file, apply_patch) — strict separation
2. Thinker: **Consolidate to 1 agent** — inherits parent model, no model variants
3. Verifier: **NO tools** — reads only via message history
4. ARCHITECTURE.md: Updated to remove str_replace/write_file from Orchestrator Tools column

---

## RED Phase — Issue Catalog

### Issue R1: Orchestrator Has Write Tools (Violates Separation of Duties)

**Evidence:**
- `bundled-agents.generated.ts` — `base2-evals` toolNames includes `str_replace`, `write_file`, `propose_str_replace`, `propose_write_file`
- `bundled-agents.generated.ts` — `base-deep` toolNames includes `apply_patch`, `write_file`
- ECHO.md §Agent Roster: Orchestrator restricted tools = `write_file, str_replace, apply_patch, bash`
- ARCHITECTURE.md (now fixed): Tools column no longer lists write_file/str_replace

**Impact:** Orchestrator can write code directly, bypassing Forge. Violates Law of Separation of Duties.

### Issue R2: 5 Reasoning Agents Instead of 1 Thinker

**Evidence:**
- `bundled-agents.generated.ts` — spawnableAgents lists: `thinker`, `thinker-gpt`, `thinker-gemini`, `gpt-5-agent`, `opus-agent`
- All 5 are reasoning/thinking agents with different model backends
- ARCHITECTURE.md §Agent Roster: single Thinker agent with `sequentialthinking` tool
- Savant doesn't use model variants — the parent model is passed to all subagents

**Impact:** Spec divergence. Callers must choose which thinker to spawn instead of using a single canonical agent.

### Issue R3: Fragmented Search/Analysis Agents (Detective Gap)

**Evidence:**
- `bundled-agents.generated.ts` — spawnableAgents lists: `code-searcher`, `directory-lister`, `glob-matcher`, `file-picker`
- All 4 do codebase search/analysis — Detective's responsibility per ARCHITECTURE.md
- Detective exists at `agents/detective/detective.ts` but orchestrator doesn't spawn it

**Impact:** 4 agents do what 1 should do. Detective is the intended single entry point for all codebase analysis.

### Issue R4: Fragmented Review Agents (Verifier Gap)

**Evidence:**
- `bundled-agents.generated.ts` — spawnableAgents lists: `code-reviewer-gpt`, `code-reviewer-multi-prompt`
- Both do code review — Verifier's responsibility per ARCHITECTURE.md
- Verifier exists but orchestrator also spawns code-reviewer variants

**Impact:** Spec divergence. Review should go through Verifier exclusively.

### Issue R5: Fragmented Edit Agents (Forge Gap)

**Evidence:**
- `agents/editor/editor-gpt-5.ts` exists as an editor agent
- `editor-multi-prompt` exists as a multi-prompt editor
- Forge exists at `agents/forge/forge.ts` but orchestrator also spawns editor variants

**Impact:** Code writing should go through Forge exclusively.

### Issue R6: Researcher Split Into 2 Agents

**Evidence:**
- `researcher-web` and `researcher-docs` are separate agents
- ARCHITECTURE.md §Agent Roster: single Researcher agent with web_search, read_url, read_docs

**Impact:** Minor spec divergence. Could consolidate or keep split for clarity.

---

## GREEN Phase — Proposed Fix

### Fix 1: Strip Write Tools from Orchestrator

**Files:** Agent definitions for `base2`, `base2-evals`, `base-deep`, `base-deep-evals`, `base2-free`, `base2-max`, `base2-lite`, `base-chat`, etc.

**Change:** Remove from toolNames:
- `str_replace`
- `write_file`
- `apply_patch`
- `propose_str_replace`
- `propose_write_file`

**Keep:** spawn_agents, read_files, read_subtree, write_todos, suggest_followups, ask_user, read_url, skill, set_output, list_directory, glob, render_ui, transition_phase, gravity_index

### Fix 2: Consolidate Thinker (5 → 1)

**Files:** Agent definitions, bundled-agents.generated.ts

**Change:**
- Keep `agents/thinker/thinker.ts` as the single Thinker
- Remove `thinker-gpt`, `thinker-gemini` from spawnableAgents
- Remove `gpt-5-agent`, `opus-agent` from spawnableAgents (these are generic model proxies, not Savant agents)
- Thinker inherits parent model via `withParentModel()` — no model selection needed
- Thinker uses `sequentialthinking` tool per ARCHITECTURE.md spec

### Fix 3: Update Orchestrator's spawnableAgents

**Change:** Replace SavantCode agents with Savant equivalents:

**Before (current):**
```
scout, code-searcher, researcher-web, researcher-docs, basher, thinker,
opus-agent, gpt-5-agent, forge, tmux-cli, browser-use, verifier,
thinker-gpt, context-pruner, recorder, scribe
```

**After (aligned):**
```
detective, forge, verifier, recorder, thinker, scout, researcher, scribe,
basher, context-pruner, tmux-cli, browser-use
```

### Fix 4: Update Detective to Absorb Search Capabilities

**File:** `agents/detective/detective.ts`

**Change:** Ensure Detective's toolNames include: `code_search`, `set_output`, `list_directory`, `glob`, `read_files`, `read_subtree`
- This absorbs the capabilities of code-searcher, directory-lister, glob-matcher, file-picker

### Fix 5: Update Verifier to Have NO Tools

**File:** Verifier agent definition

**Change:** Strip all tools from Verifier. Output comes from message response only.
- If `set_output` is needed for structured output, keep it as the sole tool per ECHO.md

### Fix 6: Keep Researcher Split (Pragmatic)

**Decision:** Keep `researcher-web` and `researcher-docs` as separate agents.
**Rationale:** They have fundamentally different tool backends (web_search vs read_docs). Consolidating would require the single Researcher to handle both, which adds complexity. The spec says "Researcher" but the split is a reasonable implementation detail.

### Fix 7: Infrastructure Agents (No Changes)

**Keep as-is:** `basher`, `context-pruner`, `tmux-cli`, `browser-use`, `librarian`
**Rationale:** These are infrastructure utilities, not domain agents. They serve the Savant agents internally.

---

## GREEN Phase — Missed Questions

### Q1: Will removing write tools from the Orchestrator break existing workflows?
**Answer:** Yes. The current Orchestrator writes code directly. After this change, all code writing must go through Forge. This is the intended design per ECHO.md but will require workflow adaptation. The Orchestrator's system prompt already describes delegating to an editor agent — Forge is that agent.

### Q2: Does Forge currently exist with the right tools?
**Answer:** `agents/forge/forge.ts` exists. Need to verify its toolNames match the spec (write_file, str_replace, set_output). If not, update it.

### Q3: Does Detective currently exist with the right tools?
**Answer:** `agents/detective/detective.ts` exists. Need to verify its toolNames match the spec (code_search, set_output) and add list_directory, glob, read_files, read_subtree for full search capability.

### Q4: What happens to `gpt-5-agent` and `opus-agent`?
**Answer:** These are generic model-proxy agents from SavantCode. They're not in the Savant spec. They should be removed from the orchestrator's spawnableAgents. If specific model routing is needed, it should be handled by the Thinker's model inheritance or explicit model params on the parent.

### Q5: Does the context-pruner need to be in spawnableAgents?
**Answer:** Yes. The context-pruner is auto-spawned by the runtime via `handleSteps`. Keeping it in spawnableAgents ensures the orchestrator can also explicitly trigger pruning if needed.

### Q6: Should we update the bundled-agents.generated.ts directly or the source agent files?
**Answer:** Update the source agent definition files in `agents/`. The bundled-agents.generated.ts is auto-generated by `scripts/prebuild-agents.ts`. After updating sources, regenerate the bundle.

---

## AUDIT Phase

### Verification Results (source-verified)

| Check | Status | Evidence |
|-------|--------|----------|
| Orchestrator has write tools | ✅ CONFIRMED | `base2.ts` toolNames: `str_replace`, `write_file`, `propose_str_replace`, `propose_write_file` |
| Detective tools | ⚠️ PARTIAL | Has `code_search`, `set_output` — missing `list_directory`, `glob`, `read_files`, `read_subtree` |
| Forge tools | ✅ PASS | `write_file`, `str_replace`, `set_output` — matches spec exactly |
| Verifier tools | ✅ PASS | `toolNames: []` — already NO tools per spec |
| Recorder tools | ⚠️ BUG | Has `grep` in toolNames — `grep` is NOT a registered tool. Should be `code_search` |
| Scribe tools | ⚠️ BUG | Same `grep` problem as Recorder |
| Thinker tools | ✅ PASS | `toolNames: ['sequentialthinking']` — correct |
| Thinker model | ⚠️ HARDCODED | `model: 'anthropic/claude-opus-4.8'` — should inherit parent via `withParentModel()` |
| Verifier model | ⚠️ HARDCODED | `model: 'anthropic/claude-opus-4.8'` — should inherit parent |
| gpt-5-agent/opus-agent | ⚠️ HAVE WRITE TOOLS | `createGeneralAgent()` gives them `str_replace`, `write_file` — must remove from spawnableAgents |
| code-reviewer variants | ✅ CLARIFIED | Created from `createReviewer()` in verifier.ts — model variants of Verifier |

### Additional Issues Found

1. **`grep` tool doesn't exist** — Recorder and Scribe list `grep` in toolNames but the registered tool is `code_search`. Pre-existing bug.
2. **gpt-5-agent and opus-agent have write tools** — `createGeneralAgent()` gives them `str_replace`, `write_file`. These agents should NOT be in the orchestrator's spawnableAgents.
3. **Thinker/Verifier models hardcoded** — Both have `model: 'anthropic/claude-opus-4.8'` with `providerOptions: { only: ['amazon-bedrock'] }`. Per user decision, they should inherit the parent model.
4. **Detective missing tools** — Needs `list_directory`, `glob`, `read_files`, `read_subtree` added to absorb file-picker, directory-lister, glob-matcher capabilities.

---

## COMPLETE

**Closed:** 2026-07-18
**Resolution:** Plan documented and ARCHITECTURE.md updated. Implementation deferred to dedicated work session.

**Changes made this session:**
- ARCHITECTURE.md Orchestrator Tools column: removed `str_replace`, `write_file` (spec conflict with ECHO.md resolved)

**Changes deferred (implementation FID needed):**
1. Strip write tools from all orchestrator variants (base2, base2-evals, base-deep, base-deep-evals, base2-free, base2-max, base2-lite, etc.)
2. Update spawnableAgents on all orchestrators to Savant roster
3. Add missing tools to Detective (list_directory, glob, read_files, read_subtree)
4. Fix `grep` → `code_search` in Recorder and Scribe
5. Remove hardcoded model from Thinker/Verifier (let withParentModel handle it)
6. Remove gpt-5-agent, opus-agent, thinker-gpt, thinker-gemini from orchestrator spawnableAgents
7. Remove editor-multi-prompt, code-reviewer-multi-prompt from orchestrator spawnableAgents

**Verified by:** source inspection of all 9 agent definitions.
**Archived:** 2026-07-18
