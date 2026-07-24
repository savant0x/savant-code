# FID-2026-0722-049 — Fix Agent Stack Storing displayName as id

**Filename:** `dev/fids/FID-2026-0722-049-agent-stack-id-vs-displayname.md`
**ID:** FID-2026-0722-049
**Severity:** low
**Status:** closed / archived
**Created:** 2026-07-22
**Author:** Forge

---

## Summary

The Active Agents sidebar list shows verbose subagent display names such as
"Savant the ..." because `use-send-message.ts` stores the subagent's
`displayName` as the stack entry `id`. This also breaks matching in
`onSubagentFinish`, since it tries to match `agentId` against the stored
`displayName`. The fix stores the short `agentId` (e.g., `savant`,
`detective`) instead, which `AgentStack.formatAgentName` then renders cleanly
as `Savant`, `Detective`, etc.

## Environment

- **OS:** Windows 11 / bash shell
- **Language/Runtime:** TypeScript / Bun / OpenTUI
- **Tool Versions:** OpenTUI 0.2.2, React 19
- **Commit/State:** main after FID-2026-0722-048

## Detailed Description

### Problem

In `cli/src/hooks/use-send-message.ts`:

```ts
onSubagentStart: (agentId: string, displayName: string) => {
  const current = useChatStore.getState().agentStack
  useChatStore.getState().updateAgentStack([
    ...current,
    { id: displayName, isActive: true },
  ])
},
onSubagentFinish: (agentId: string) => {
  const current = useChatStore.getState().agentStack
  useChatStore.getState().updateAgentStack(
    current.map((a) =>
      a.id === agentId ? { ...a, isActive: false } : a,
    ),
  )
},
```

- `id` is set to `displayName` (e.g., "Savant the DeepSeek Free Orchestrator").
- `onSubagentFinish` searches for `a.id === agentId`, which never matches because
  `id` is the long display name while `agentId` is the short agent ID.
- The sidebar therefore shows long, awkward names and leaves stale active entries.

### Expected Behavior

- Store the short `agentId` in the stack entry.
- Render it with `AgentStack.formatAgentName` for clean display names.
- `onSubagentFinish` correctly marks the matching entry inactive.

### Root Cause

The wiring code confused the human-readable `displayName` with the stable
machine `agentId`. The sidebar's `AgentStack` component is a technical
surface that should display agent IDs, not long marketing names.

## Impact Assessment

### Affected Components

- `cli/src/hooks/use-send-message.ts`
- `cli/src/components/savant-ui/echo/agent-stack.tsx` (formatting already added)

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] Low: changes only the stored id value and matching logic

## Proposed Solution

### Approach

In `use-send-message.ts`, change the `onSubagentStart` handler to store
`{ id: agentId, isActive: true }` instead of `{ id: displayName, isActive: true }`.
Leave `onSubagentFinish` unchanged; with the corrected `id`, the match now
works.

### Steps

1. Update `cli/src/hooks/use-send-message.ts`.
2. Run CLI typecheck and ESLint.
3. Code review.

### Verification

- `cd cli && bun run typecheck` passes.
- `cd cli && bun x eslint src/hooks/use-send-message.ts --max-warnings 0` passes.
- code-reviewer-kimi approves.

## Perfection Loop

### Loop 1

- **RED:** Subagent stack entries use `displayName` as `id`, causing verbose
  sidebar text and broken finish matching.
- **GREEN:** Store `agentId` instead of `displayName`.
- **AUDIT:** Typecheck, lint, and code review pass.
- **CHANGE DELTA:** ~1 line change.

## Resolution

- **Fixed By:** Forge
- **Fixed Date:** 2026-07-22
- **Fix Description:** Changed `use-send-message.ts` `onSubagentStart` to store `id: agentId` instead of `id: displayName`, so the sidebar renders short formatted names and finish matching works.
- **Tests Added:** No — existing runtime behavior unchanged.
- **Verified By:** Typecheck, lint, code-reviewer-kimi.
- **Commit/PR:** 
- **Archived:** 2026-07-22
