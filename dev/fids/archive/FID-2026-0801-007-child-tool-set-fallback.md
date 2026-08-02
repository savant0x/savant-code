# FID: Separate Prompt Inheritance from Child Tool Inheritance

**Filename:** `FID-2026-0801-007-child-tool-set-fallback.md`
**ID:** FID-2026-0801-007
**Severity:** critical
**Status:** closed
**Created:** 2026-08-01
**Author:** Buffy (FreeBuff orchestrator) + Nova trace + Detective analysis

---

## Summary

Nova's manual trace found a second-order regression after FID-2026-0801-005:
Thinker prompt inheritance is working, but the Thinker receives an empty model
tool set. The Thinker declares `toolNames: ['sequentialthinking']`, while the
Savant orchestrator's parent tool set does not contain `sequentialthinking`.
The current runtime filters `parentTools` by the child's allowlist, producing
`{}`. The Thinker then attempts its only valid tool and receives an unavailable-
tool rejection.

This is a new bug and is separate from both earlier boundaries:

- FID-2026-0801-005 correctly tightened inherited-tool visibility and executor
  authorization.
- FID-2026-0801-006 correctly suppresses unsupported legacy tool-call markup and
  preserves canonical stream handling.
- This FID owns the missing child-tool fallback when prompt inheritance is
  requested but the parent tool definitions cannot satisfy the child's complete
  allowlist.

The fix must separate **prompt inheritance** from **tool inheritance**. A child
may inherit the parent's system prompt for cache continuity while building its
own complete tool set from `getToolSet()` whenever the parent's tool set does
not contain every tool named by the child. Parent tools must never be passed
unfiltered, and executor authorization must remain unchanged.

## Environment

- **OS:** Windows host (`win32`) with WSL2 available for manual CLI testing
- **Language/Runtime:** TypeScript, Bun 1.3.x
- **Package:** `@savant-code/agent-runtime`
- **UI:** Savant-Code CLI, React/OpenTUI
- **Protocol:** FreeBuff ECHO Protocol `0.1.2-freebuff`
- **Related trace:** `dev/nova/outbox/2026-08-01-fid-006-thinker-sequentialthinking-empty-toolset-bug.md`
- **Related FIDs:** archived FID-2026-0801-005 and FID-2026-0801-006
- **Primary runtime path:** `packages/agent-runtime/src/run-agent-step.ts`
- **Related paths:** `packages/agent-runtime/src/tools/prompts.ts`,
  `packages/agent-runtime/src/tools/filter-tool-set.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`,
  `packages/agent-runtime/src/templates/strings.ts`,
  `packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts`
- **Commit/State:** Existing working tree contains unrelated changes; this FID
  owns only child-tool selection, regression tests, and their verification

## Detailed Description

### Problem

The current `loopAgentSteps` path uses one `useParentTools` decision for two
separate concerns:

1. It tells prompt construction that the child inherits the parent's system
   prompt and should receive the cache-preserving subagent addendum.
2. It selects the model-facing tool definitions by filtering `parentTools`.

The second decision is invalid when a child's allowlist contains a tool absent
from the parent. Nova's trace observed this exact case:

```text
parentTools = Savant orchestrator tools
child toolNames = ['sequentialthinking']
filterToolSet(parentTools, child toolNames) = {}
```

The Thinker is therefore instructed about `sequentialthinking` but receives no
corresponding model tool definition. The executor rejects its attempted call,
and the Thinker cannot perform its only purpose.

### Expected Behavior

- Prompt inheritance and tool inheritance are independent decisions.
- A child with `inheritParentSystemPrompt: true` continues to receive the
  parent's system prompt and cacheable prefix.
- Parent tools are filtered by the child's allowlist whenever the parent fully
  satisfies that allowlist.
- If any child-allowed tool is absent from `parentTools`, the runtime builds the
  child's complete tool set through `getToolSet()` using the child's own
  `toolNames`, custom/MCP definitions, skills, and child agent tools.
- A Thinker receives `sequentialthinking` even though the Savant parent does not
  expose that tool.
- A child with a partially overlapping allowlist receives the complete child set,
  not a partial inherited set.
- A child whose allowlist is empty receives no tools.
- Parent-only tools never reach a child model payload or child state.
- Existing overlapping inherited-tool behavior remains cache-compatible and
  restricted to the child's allowlist.
- The executor's strict authorization remains the final security boundary.

## Root Cause Analysis

### Current implementation

`packages/agent-runtime/src/run-agent-step.ts` currently computes:

```typescript
const useParentTools =
  agentTemplate.inheritParentSystemPrompt && parentTools !== undefined
const inheritedParentTools: ToolSet = parentTools ?? {}

const agentTools = useParentTools
  ? {}
  : await buildAgentToolSet(...)

const tools = useParentTools
  ? filterToolSet(inheritedParentTools, agentTemplate.toolNames)
  : await getToolSet(...)
```

`useParentTools` is appropriate for prompt inheritance, but it is too broad as
the tool-selection condition. When the parent lacks a child tool, filtering is
safe from an authorization perspective but functionally incomplete.

### Required invariant

Let `P` be the keys in `parentTools` and `C` be the child's `toolNames`.

- If prompt inheritance is unavailable, use the child's own tool construction.
- If `C` is empty, the child tool set is empty.
- If `C ⊆ P`, use `filterToolSet(parentTools, C)` to preserve inherited
  definitions and prompt-cache behavior.
- If `C ⊄ P`, use `getToolSet()` for the complete child set. Do not merge an
  incomplete inherited set with ad hoc definitions, and do not pass all parent
  tools.

This subset check must be explicit, typed, and tested. The tool-selection boolean
must not replace the prompt-inheritance boolean without preserving the existing
prompt addendum and cache behavior.

## Evidence

### Nova trace

Nova reported the failure after manually running the FID-006 Thinker regression
prompt:

```text
Thinker has inheritParentSystemPrompt: true.
The parent tool set does not contain sequentialthinking.
filterToolSet(parentTools, ['sequentialthinking']) returns {}.
The Thinker attempts sequentialthinking and receives:
Tool 'sequentialthinking' is not currently available [agent: savant]
```

The trace identifies `run-agent-step.ts` around the current tool-selection branch
as the root cause and explicitly separates prompt inheritance from tool
inheritance.

### Ground-truth source inspection

- `agents/thinker/thinker.ts` declares `toolNames: ['sequentialthinking']`.
- `agents/savant/savant.ts` does not expose `sequentialthinking` in the
  orchestrator tool list.
- `filterToolSet` correctly removes disallowed parent definitions but cannot
  create a definition that is absent from the parent.
- `getToolSet` builds built-in child tools, custom/MCP definitions, and accepts
  child agent tools.
- `buildAgentToolSet` must remain active when the child falls back to its own
  tool construction; otherwise spawnable child tools could disappear.
- Existing prompt-caching tests capture actual model-facing `options.tools` keys
  and already cover restricted overlap and empty allowlists, but do not cover a
  restricted child tool that is absent from the parent.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step.ts`
- `packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts`
- `packages/agent-runtime/src/__tests__/run-agent-step-tools.test.ts` for any
  lower-level tool construction coverage needed
- `packages/agent-runtime/src/tools/prompts.ts` for existing `getToolSet`
  behavior verification only
- `packages/agent-runtime/src/tools/filter-tool-set.ts` for existing allowlist
  behavior verification only
- Thinker runtime behavior and all inherited-prompt children with non-overlap
  or partial-overlap tool sets
- Ordinary and inline spawn paths insofar as they pass parentTools into
  `loopAgentSteps`

### Risk Level

- [x] Critical: the Thinker cannot use its only reasoning tool
- [ ] High: major feature broken with no workaround
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor issue, cosmetic, or edge case

## Proposed Solution

### Approach — GREEN Proposal

1. Preserve `useParentTools` as the prompt-inheritance/cache-context decision so
   inherited children continue receiving the parent system prompt and the
   child-specific capability/tool-format addendum.
2. Add a separate typed tool-selection decision, conceptually
   `useInheritedTools`, which is true only when `useParentTools` is true and
   every child `toolNames` entry exists in `inheritedParentTools`.
3. Keep the empty allowlist safe: no child tools means an empty model payload;
   do not accidentally inherit all parent tools or build unrelated tools.
4. When `useInheritedTools` is false, build `agentTools` through the existing
   `buildAgentToolSet` path and build the complete model-facing tool set through
   `getToolSet()` with the child's allowlist and existing custom/MCP/skills
   callbacks.
5. When `useInheritedTools` is true, retain `filterToolSet` exactly as the
   allowlist boundary. Never pass raw `parentTools` to the child.
6. Keep the executor authorization guard unchanged. A model-visible tool
   definition is not permission; the executor remains authoritative.
7. Add a small reusable subset predicate only if existing utility search proves
   no suitable helper exists. Otherwise keep the logic local and named at the
   tool-selection boundary to avoid unnecessary abstraction.

### Scope Boundary

#### In scope

- Separating prompt-inheritance and tool-selection booleans in
  `loopAgentSteps`.
- Thinker/non-overlap, partial-overlap, full-overlap, empty-list, and custom/MCP
  regression coverage.
- Preserving child agent-tool construction and strict executor authorization.
- Updating the FID/changelog and running required verification.

#### Out of scope

- Reopening or modifying FID-005's `filterToolSet` authorization fix.
- Passing unfiltered parent tools to any child.
- Changing the Thinker declaration or adding `sequentialthinking` to Savant.
- Changing prompt cache protocol or system-prompt inheritance semantics.
- Broadening parser compatibility or changing FID-006's legacy markup filter.
- Adding a third-party package.
- Changing unrelated model routing, UI formatting, or Markdown rendering.

## Five Questions

1. **Will this work for all cases, not only Thinker?**
   - Yes. Full overlap preserves existing filtered inheritance; partial and
     non-overlap children receive complete own tool sets; empty allowlists remain
     empty; custom/MCP and child-agent tools use the existing construction path.
2. **Will it scale to 1000 agents?**
   - Yes. The subset check is linear in the child allowlist and parent tool-key
     count, and tool construction remains the existing per-child path. No global
     mutable state or agent-specific special case is introduced.
3. **Will it survive a hostile attacker?**
   - Yes. Parent tools are never broadened or passed raw. The child allowlist
     controls both inherited filtering and own construction, while executor
     authorization remains unchanged.
4. **Will this be maintainable in two years?**
   - Yes. Prompt inheritance and tool selection have separate named invariants,
     the fallback uses the existing `getToolSet`/`buildAgentToolSet` path, and
     tests assert actual model-facing tool keys and child state definitions.
5. **Does this set an industry-quality standard?**
   - Yes. Prompt cache reuse is treated separately from capability provisioning;
     a child never receives a prompt-described tool without a corresponding
     model-facing definition, and no definition bypasses authorization.

## Perfection Loop

### Loop 1 — RED — COMPLETE

- Read FreeBuff ECHO Protocol `0.1.2-freebuff` from 0-end before drafting.
- Read the canonical FID template and scanned active/archive FIDs; allocated the
  unused `FID-2026-0801-007` identifier.
- Read Nova's full trace report and confirmed the empty-tool-set observation.
- Traced `run-agent-step.ts` from parent prompt/tools through `getToolSet`,
  `buildAgentToolSet`, and `filterToolSet`.
- Confirmed Thinker is restricted to `sequentialthinking`, while Savant does not
  expose that tool.
- Confirmed FID-005 and FID-006 are separate completed boundaries and must not be
  reopened or weakened.
- Catalogued the full-overlap, partial-overlap, non-overlap, empty-list,
  custom/MCP, child-agent-tool, and prompt-cache cases.

### Loop 1 — GREEN — DESIGN-CONVERGED

- Selected a separate `useInheritedTools` decision rather than reusing the
  prompt-inheritance flag.
- Selected the complete child `getToolSet` fallback when the parent tool keys do
  not contain the child's full allowlist.
- Preserved `buildAgentToolSet` whenever the own-tool fallback is selected so
  child agent tools are not silently removed.
- Preserved filtered parent inheritance only for the full-subset case.
- Preserved empty allowlist behavior and strict executor authorization.
- Rejected raw parent-tool pass-through, merging partial parent tools, changing
  Thinker declarations, or adding a new package.

### Loop 1 — AUDIT — COMPLETE

Two independent design audits were run against the FID and current source.

- **Deep architecture audit:** PASS — no corrections required. It confirmed the
  subset invariant handles Thinker non-overlap, partial overlap, full overlap,
  empty allowlists, custom/MCP tools, child-agent tools, undefined `parentTools`,
  prompt caching, and strict executor authorization.
- **Independent code/design review:** REQUEST CHANGES — no critical or high
  findings, but it required the audit verdict to be recorded rather than merely
  asserted and required an executable test matrix covering ordinary and inline
  spawn paths, actual model payload keys, and child-state tool definitions.

The review findings were documentation/test-plan corrections, not a change to
the proposed architecture. The subset invariant remains the required design:
`useInheritedTools` may use filtered parent definitions only when the final
model-facing parent tool keys contain every child-allowed name; otherwise both
model-facing tools and child agent tools use the existing own-tool construction
paths.

### Loop 1 — SELF-CORRECT — COMPLETE

The initial Nova proposal suggested a fallback only when the filtered result was
empty. The FID strengthens this to a complete subset check (`child toolNames ⊆
parent tool keys`) so partial-overlap children cannot receive an incomplete tool
set. The FID also separates prompt inheritance from `agentTools` construction,
which prevents child-agent tools from disappearing under the fallback.

The test requirements are now explicit: regression coverage must exercise both
ordinary and inline spawn handoffs, Thinker non-overlap, partial overlap, full
overlap, empty allowlists, custom/MCP/skill definitions, and child-agent tools.
Each relevant case must inspect both the actual model-facing `options.tools` keys
and `childAgentState.toolDefinitions`; tests must also confirm the executor
allowlist remains unchanged and no raw parent-only tool is exposed.

### Loop 2 — AUDIT — COMPLETE

After the Loop 1 audit findings were applied, an independent post-correction
review re-audited this FID and returned **READY**. It found no critical, high, or
medium issues and confirmed that the FID now honestly records the completed
RED/GREEN/AUDIT/SELF-CORRECT cycle, the explicit ordinary/inline test matrix,
the model-payload and child-state assertions, and the approved implementation boundary.
The Perfection Loop was converged before implementation. After operator approval,
the implementation was independently reviewed and all verification gates passed.

### Change Delta

- Added the typed subset-based `useInheritedTools` decision in
  `run-agent-step.ts`, keeping prompt inheritance independent from capability
  provisioning.
- Added Thinker non-overlap and partial-overlap regression tests asserting both
  model-facing tool payloads and child-state tool definitions.
- No changes were made to executor authorization, the Thinker declaration, or
  the ordinary/inline filtering boundaries.

### Missed Questions

1. **What if only some child tools overlap with the parent?** → Use the complete
   child tool set, not a partial merge; a child allowlist is an all-tools contract.
2. **What if the child has spawnable agents?** → Build `agentTools` from the child
   template whenever own-tool fallback is selected.
3. **What if the child has no tools?** → Produce `{}` and do not inherit parent
   tools by default.
4. **What if custom/MCP definitions are absent from `parentTools`?** → Own-tool
   fallback resolves them through the existing `additionalToolDefinitions` path,
   still filtered by the child's allowlist.
5. **Does prompt inheritance require tool inheritance?** → No. Keep the parent
   system prompt and cacheable prefix independent from capability provisioning.
6. **Could the fallback broaden permissions?** → No. `getToolSet` receives only
   the child's `toolNames`, and the executor remains strict.
7. **Should parent tools be merged with own tools?** → No. Merging risks duplicate
   definitions, inconsistent schemas, and hidden authorization drift.
8. **Could `agentTools` remain `{}` in fallback mode?** → No. That would silently
   remove allowed child-agent tools; it must use the same own-tool decision.
9. **What if `parentTools` is undefined?** → Use own child tool construction and
   preserve normal non-inherited behavior.
10. **What proves this fixed?** → Focused tests must capture actual model payload
    keys and child-state definitions, four workspace typechecks, zero-warning
    lint, format/diff checks, independent review, and a fresh manual Thinker
    trace showing `sequentialthinking` actually executes.

### Code Verification Evidence

- [x] FreeBuff ECHO specification read 0-end.
- [x] FID template read 0-end.
- [x] Nova trace report read 0-end.
- [x] Existing active/archive FIDs scanned; ID 007 confirmed unused.
- [x] Current production call sites and tool-construction helpers inspected.
- [x] Full-overlap, partial-overlap, non-overlap, empty, custom/MCP, and child
      agent-tool cases identified.
- [x] RED/GREEN/AUDIT/SELF-CORRECT design loop converged; the post-correction
      independent re-audit also passed and all findings were recorded in the FID.
- [x] User approval received before implementation.
- [x] Implementation and focused regression tests completed.
- [x] Ordinary and inline spawn filtering paths reviewed; model payload and child
      state definitions are asserted by focused runtime coverage.
- [x] Four workspace typechecks passed: SDK, common, agent-runtime, and CLI.
- [x] Zero-warning focused ESLint, Prettier, and `git diff --check` passed.
- [x] Independent implementation review returned READY with no critical, high,
      or medium findings.
- [ ] Fresh external-provider interactive Thinker trace — not executed; this is
      an evidence limitation, not claimed as a passing behavioral capture.

## Resolution

- **Fixed By:** Buffy, following the approved FID design
- **Fixed Date:** 2026-08-01
- **Fix Description:** Separated prompt inheritance from child-tool provisioning.
  Children use filtered inherited definitions only when the parent contains the
  complete child allowlist; otherwise the existing child tool construction paths
  restore the complete allowed set without passing raw parent tools.
- **Tests Added:** Thinker non-overlap and partial-overlap coverage in
  `packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts`, with
  actual model payload and child-state assertions.
- **Verified By:** Nova design sign-off; 63 focused tests passed; SDK, common,
  agent-runtime, and CLI typechecks passed; focused ESLint, Prettier, `git diff
--check`, and independent implementation review passed.
- **Commit/PR:** Not created
- **Archived:** 2026-08-01 to
  `dev/fids/archive/FID-2026-0801-007-child-tool-set-fallback.md`

## Lessons Learned

1. Prompt inheritance is not capability inheritance.
2. A filtered tool set can be safely restricted yet functionally empty when the
   parent lacks a child's valid tools.
3. Subset invariants are stronger than empty-result checks for capability
   provisioning.
4. Model-visible tools, child state definitions, and executor authorization must
   stay aligned across every spawn path.
5. When restoring a child tool set, preserve child agent tools, custom/MCP tools,
   skills, and prompt-cache behavior together rather than patching one map.
