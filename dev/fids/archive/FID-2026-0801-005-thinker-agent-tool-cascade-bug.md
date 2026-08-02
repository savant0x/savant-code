# FID-2026-0801-005: Thinker Agent Tool Cascade Bug

## Metadata

- **Filename:** `FID-2026-0801-005-thinker-agent-tool-cascade-bug.md`
- **ID:** FID-2026-0801-005
- **Severity:** critical
- **Status:** closed
- **Created:** 2026-08-01
- **Author:** Savant (orchestrator) + Detective (analysis)

---

## Summary

When a child agent inherits the parent system prompt and parent tool context, the child must not be shown or retain tool definitions that its own `toolNames` allowlist does not authorize. The Thinker is the clearest failure case: it inherits the parent prompt, has `toolNames: ['sequentialthinking']`, and is validated by the executor against that restricted allowlist. The original investigation correctly identified the authorization mismatch, but current code inspection shows that `run-agent-step.ts` already filters the model-facing `ToolSet` in one path. The remaining risk is that unfiltered parent tools are still handed into child state through the inline-spawn path, and the standard spawn handoff remains unfiltered until the child runtime boundary. This FID therefore owns a consistent inherited-tool boundary across all spawn paths, plus regression tests that inspect the actual model-facing tool definitions—not only instruction text.

Implementation was approved by the user on 2026-08-01 and completed under the converged FID.

## Environment

- **Package:** `@savant-code/agent-runtime`
- **OS:** Windows host with Bun runtime
- **Language/Runtime:** TypeScript, Bun, AI SDK `ToolSet`
- **Relevant agents:** Thinker, Forge, Verifier, Recorder, Scribe, Context Pruner, editor helpers, and inline subagents
- **Relevant files:**
  - `packages/agent-runtime/src/run-agent-step.ts`
  - `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts`
  - `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`
  - `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts`
  - `packages/agent-runtime/src/templates/strings.ts`
  - `packages/agent-runtime/src/tools/prompts.ts`
  - `packages/agent-runtime/src/tools/tool-executor.ts`
  - `packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts`
  - `agents/thinker/thinker.ts`
- **Current state:** The approved implementation is present and verified. `packages/agent-runtime/src/tools/filter-tool-set.ts` is used at the final model boundary and both ordinary and inline spawn handoffs.

## Detailed Description

### Problem

A child agent may inherit the parent system prompt and parent tool context while having a narrower `toolNames` allowlist. The executor correctly rejects unauthorized tool calls, but if the model-facing tool payload or child state contains parent-only tools, the model can attempt them first. Each rejection is returned as an error and may trigger another model step, creating a cascade of rejected calls, wasted tokens, and degraded output.

The original FID stated that the full parent tool set was always passed directly to the LLM. Ground-truth inspection corrected that claim: the current `run-agent-step.ts` branch already applies an inline `Object.entries(parentTools).filter(...)` when constructing the `tools` payload. That existing filter is not sufficient evidence of complete safety because:

1. The inline spawn handler copies the full parent tool map into `childAgentState.toolDefinitions`.
2. The ordinary `spawn_agents` handler forwards the parent map without filtering and relies on the later runtime boundary.
3. Existing tests verify inherited prompt text but do not capture and assert the actual tool keys sent to the child model.
4. Inherited parent system text can contain parent-oriented tool instructions; the child-specific instruction addendum must remain authoritative without destroying prompt-caching behavior.

### Expected Behavior

For every spawned child:

1. The model-facing `ToolSet` contains only tools named in the child template’s `toolNames` allowlist.
2. Child `AgentState.toolDefinitions` contains the same filtered set whenever it is initialized or shared.
3. The executor’s existing authorization check remains authoritative and unchanged unless verification proves an additional error-message correction is necessary.
4. A Thinker with `toolNames: ['sequentialthinking']` sees and can call only `sequentialthinking`; it must not see or attempt `spawn_agents`, `skill`, `read_files`, `write_file`, `suggest_followups`, or any other parent-only tool.
5. Agents that intentionally inherit tools retain every explicitly allowed inherited tool.
6. An empty child allowlist produces an empty child tool set, not the parent’s full set.
7. Prompt-caching behavior remains intact: the shared parent prompt is preserved, while the child-specific capability boundary clearly states the tools actually available to the child.

### Root Cause

The system has multiple tool handoff surfaces with different ownership:

- `run-agent-step.ts` owns the final model-facing `ToolSet`.
- `spawn-agents.ts` owns ordinary child creation and forwards `parentTools`.
- `spawn-agent-inline.ts` creates an inline child state and currently copies parent tools into `toolDefinitions`.
- `tool-executor.ts` authorizes calls from `agentTemplate.toolNames` after generation.

The authorization allowlist and inherited tool definitions are therefore not enforced by one shared boundary across all paths.

### Evidence

Ground-truth source inspection produced the following evidence:

```text
filterToolSet is now the shared typed allowlist helper. The final model boundary, ordinary spawn handoff, and inline spawn handoff all filter parent tools against the effective child template's `toolNames`.

The inline path filters both `childAgentState.toolDefinitions` and the `parentTools` passed to `executeSubagent`.

The Thinker definition remains unchanged and confirms:

inheritParentSystemPrompt: true
includeMessageHistory: true
spawnableAgents: []
toolNames: ['sequentialthinking']

The focused regression captures actual `options.tools` keys and verifies restricted and empty allowlists.
```

## Impact Assessment

### Affected Components

- Thinker reasoning subagent
- Any agent with `inheritParentSystemPrompt: true` and a restricted `toolNames` list
- Ordinary `spawn_agents` handoff
- Inline subagent handoff
- Prompt-caching and inherited-instruction behavior
- Agent runtime token usage and user-visible error output

### Risk Level

- [x] Critical: the model can repeatedly attempt unauthorized tools, causing broken subagent behavior and token waste
- [ ] High: major feature broken with no workaround
- [ ] Medium: feature degraded with workaround
- [ ] Low: minor issue

### Five Questions

1. **All cases:** The design covers ordinary spawn, inline spawn, empty allowlists, restricted Thinker tools, and agents that intentionally inherit a subset of parent tools.
2. **1000 agents:** A pure allowlist filter is O(n) in the parent tool count and has no agent-count-specific state, so it scales with the existing runtime model.
3. **Hostile attacker:** Hiding tools is not the security boundary. The existing executor authorization remains in place and must not be weakened; the filter reduces model confusion and token waste.
4. **Two-year maintainability:** One reusable filter helper avoids duplicate `Object.entries(...).filter(...)` logic and makes future handoff paths auditable.
5. **Industry standard:** The model-visible capability set and executor authorization should be identical by construction and tested at the API boundary.

## Proposed Solution

### Approach — GREEN Proposal

1. Keep the existing executor allowlist as the final authorization gate.
2. Use the preserved `filter-tool-set.ts` helper as the single reusable implementation for filtering a `ToolSet` by `agentTemplate.toolNames`.
3. Apply that helper at the final model-facing inherited-tool construction in `run-agent-step.ts`, replacing the local duplicate filter.
4. Filter ordinary `spawn_agents` parent-tool handoff before passing it to `executeSubagent`.
5. Filter inline child `toolDefinitions` and the inline `parentTools` handoff using the child’s effective template allowlist. The inline template’s forced inheritance behavior must be accounted for explicitly.
6. Preserve the child-specific `instructionsPrompt` capability addendum. It must state the effective filtered tools and warn that tools mentioned in the inherited parent prompt are not available unless listed there.
7. Do not change the Thinker’s `toolNames`; `sequentialthinking` remains its only intended tool.
8. Do not broaden executor permissions to accommodate inherited parent tools.
9. Do not silently remove prompt caching. If tests demonstrate that inherited parent tool prose remains actionable despite the capability addendum, add a narrowly scoped prompt-sanitization design in a follow-up FID or revise this FID before implementation; do not guess at cache semantics.

### Scope Boundary

In scope:

- Shared ToolSet filtering helper
- Ordinary and inline child handoff filtering
- Model-facing tool-key regression tests
- Empty-list and restricted-list behavior
- Verification of inherited instruction precedence

Out of scope unless the implementation audit proves necessary:

- Changing executor authorization semantics
- Changing Thinker model or tool declarations
- Rewriting the entire inherited system-prompt cache architecture
- Changing unrelated tool error wording
- Changing non-inherited agent tool construction

### Steps After Approval

1. Wire `filterToolSet` into `run-agent-step.ts`.
2. Wire the same helper into `spawn-agents.ts` and `spawn-agent-inline.ts` at child handoff/state construction.
3. Extend `prompt-caching-subagents.test.ts` to capture the actual `tools` keys passed to the LLM and assert:
   - `read_files` and `code_search` survive when allowed;
   - `write_file` is absent when not allowed;
   - an empty allowlist yields no tools;
   - the Thinker-shaped allowlist exposes only `sequentialthinking`.
4. Add a focused helper unit test if the repository’s test conventions support isolated utility tests; otherwise keep coverage through runtime integration tests.
5. Verify production call-graph reachability for every helper caller.
6. Run implementation typechecks, focused tests, lint, format, and the four required workspace typechecks.
7. Perform an independent implementation audit and, if available, a controlled Thinker spawn/runtime capture showing no rejected parent-tool cascade.

### Verification Plan

Static verification:

- `cd packages/agent-runtime && bun run typecheck`
- `cd common && bun run typecheck`
- `cd sdk && bun run typecheck`
- `cd cli && bun run typecheck`
- Focused agent-runtime tests for prompt caching, spawn permissions, and tool validation
- ESLint with zero warnings on changed files
- Prettier check and `git diff --check`
- Call-graph search confirms the helper is used at all approved handoff boundaries

Behavioral verification:

- Capture `Object.keys(options.tools ?? {})` in the prompt-caching test.
- Assert no forbidden parent tool reaches the child model payload.
- Assert executor rejection behavior remains unchanged for a deliberately forged unauthorized call.
- Run a controlled Thinker-shaped child path and verify no `Tool X is not currently available` cascade occurs before `sequentialthinking` is available.

## Perfection Loop

### Loop 1 — RED — COMPLETE

- Identified the critical mismatch between inherited parent context, child `toolNames`, and executor authorization.
- Cataloged the affected runtime files and Thinker definition.
- Corrected the initial diagnosis using ground-truth inspection: the model-facing `run-agent-step.ts` branch already filters `parentTools`; the unresolved issue is inconsistent filtering and insufficient boundary-level tests across spawn paths.
- Verified all known inherited-prompt agents by call-graph search, including Thinker, Forge, Verifier, Recorder, Scribe, Context Pruner, and editor helpers.

### Loop 1 — GREEN — COMPLETE

- Added the shared typed `filterToolSet` helper.
- Applied filtering at the final model-facing boundary, ordinary spawn handoff, and inline spawn/state handoff.
- Preserved executor authorization as the final security boundary.
- Preserved prompt-caching behavior and child capability instructions.
- Added restricted and empty-allowlist regression coverage.

### Loop 1 — AUDIT — COMPLETE

Independent implementation review found no critical or high-severity issues. The audit confirmed:

- `filterToolSet` requires a concrete `ToolSet`; it has no undefined fallback.
- All three production call sites are reachable by grep.
- The executor authorization guard remains unchanged and strict.
- The inline child state and delegated runtime receive the same filtered set.
- The integration test captures actual model-facing tool keys and verifies forbidden tools are absent.
- The empty child allowlist produces an empty model payload and empty child state definitions.

### Loop 1 — SELF-CORRECT — COMPLETE

Post-approval verification corrected three issues before closure: removed the helper's optional/undefined input path, replaced the test's unsafe ToolSet cast with concrete Zod-backed AI SDK definitions, and isolated the empty-allowlist fixture instead of mutating the restricted fixture.

### Loop 1 — COMPLETE

The FID is implemented, independently reviewed, verified, closed, and ready for archival.

## Missed Questions

1. **Is the original reported model-facing leak still present?**
   - No, not in the current `run-agent-step.ts` branch; it already filters. The FID now treats that as a regression invariant rather than an unimplemented assumption.
2. **Can child state still carry forbidden tools even when the API payload is filtered?**
   - Yes. Inline spawn copies the full parent map into `toolDefinitions`; this is explicitly in scope.
3. **Should the executor accept inherited tools to avoid errors?**
   - No. Executor authorization must remain strict. The model must be shown only what it can use.
4. **What happens when `toolNames` is empty?**
   - The filtered set must be `{}`; inheriting the parent set by default is forbidden.
5. **What if a parent tool is named in inherited prose?**
   - The child capability addendum must be authoritative and the behavioral test must confirm the model-facing capability boundary. Any remaining actionable leakage triggers FID self-correction before implementation expands.
6. **Does inline inheritance alter the child allowlist?**
   - The effective inline template must be treated as the child authority. Forcing inheritance must not imply permission to inherit every tool.
7. **Is the new helper itself wired?**
   - Yes. It is called by `run-agent-step.ts`, `spawn-agents.ts`, and `spawn-agent-inline.ts`, confirmed by call-graph grep.
8. **Can this scale without duplicate filters?**
   - Yes, by using one reusable helper at every parent-to-child ToolSet boundary.

## Code Verification Evidence

- [x] Referenced production files exist in the codebase
- [x] Shared typed filter is wired at all three approved production boundaries
- [x] Thinker definition remains restricted to `sequentialthinking`
- [x] Focused inherited-tool suite: 68 passed, 0 failed; 171 expect calls
- [x] `packages/agent-runtime` typecheck passed
- [x] `sdk`, `common`, `packages/agent-runtime`, and `cli` typechecks passed
- [x] ESLint passed with zero warnings on changed files
- [x] Prettier check passed
- [x] `git diff --check` passed
- [x] Call-graph grep confirmed all `filterToolSet` callers
- [x] Independent implementation review found no critical/high issues

## Resolution

- **Fixed By:** Savant orchestrator
- **Fixed Date:** 2026-08-01
- **Fix Description:** Added a concrete `ToolSet` allowlist helper and applied it to the final model-facing inherited-tool boundary, ordinary spawn handoff, inline spawn handoff, and inline child state. Added runtime regression coverage for restricted and empty child allowlists without weakening executor authorization.
- **Tests Added:** Yes — actual child model tool-key capture plus restricted/empty allowlist assertions in `prompt-caching-subagents.test.ts`.
- **Verified By:** Focused runtime tests, four workspace typechecks, zero-warning ESLint, Prettier, diff check, call-graph audit, independent implementation review, and Nova third-party audit.
- **Commit/PR:** Not created
- **Archived:** 2026-08-01 (moved to `dev/fids/archive/`)

## Nova Independent Sign-Off

- **Response:** `dev/nova/inbox/2026-08-01-fid-005-thinker-tool-cascade-nova-signoff-response.md`
- **Date:** 2026-08-01
- **Auditor:** Nova / independent third-party ECHO auditor
- **Verdict:** **PASS**
- **Independent post-implementation sign-off:** **YES**
- **Critical/high blockers:** None
- **Additional corrections required:** None
- **Evidence verified:** Strict `ToolSet` typing; filtering at final model, ordinary-spawn, and inline-spawn boundaries; unchanged Thinker allowlist and executor authorization; 68 focused tests / 0 failures / 171 expectations; all four workspace typechecks; zero-warning ESLint; Prettier; diff check; and three reachable production callers.
- **Authority boundary:** Nova’s sign-off is independent audit evidence and does not authorize new coding or replace operator authority.

## Lessons Learned

1. Model-visible tool definitions and executor authorization must be treated as one capability contract.
2. A passing local filter is not enough; every child state and handoff path needs the same invariant.
3. Tests must capture the actual LLM tool payload, not only prompt prose.
4. Inherited prompt caching must be preserved deliberately and verified behaviorally.
5. FID metadata must be corrected when current source contradicts the original RED claim.
6. Complex changes must not be coded before the FID is converged and approved.
