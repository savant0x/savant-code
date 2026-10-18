# FID: Worktree results use the existing traffic-light panel

**Filename:** `FID-2026-1018-002-worktree-traffic-light-rendering.md`
**ID:** FID-2026-1018-002
**Severity:** low
**Status:** closed
**Created:** 2026-10-18
**Automation level:** 3
**YAGNI-Compliance:** Verified — reuse existing renderer and registry.

## Summary

The operator reports that fid_worktree does not use traffic-light output.
The tool is absent from the CLI renderer registry and takes the generic path.

## Environment

- **OS:** Windows
- **Language/Runtime:** TypeScript, Bun 1.3.14, OpenTUI 0.5.3
- **Tool Versions:** repository-pinned dependencies
- **Commit/State:** abe727a7, clean main before intake

## Detailed Description

### Problem

Worktree lifecycle results lack the established panel chrome.

### Expected Behavior

Loading, JSON results, refusals, empty results and folded results use existing
traffic-light chrome, and remain readable in narrow agent cells.

### Root Cause

`cli/src/components/tools/registry.ts` omits fid_worktree. ToolBranch checks
registry membership and otherwise renders ToolCallItem.

### Evidence

Before repair, `rg -n fid_worktree cli/src/components/tools/registry.ts` had no matches.
The runtime handler uses jsonToolResult. McpResultComponent already handles
structured results, loading and folding without a provider-specific schema.
OutputResultComponent hides loading entirely; it is insufficient for this
state-complete repair. Reuse McpResultComponent through the explicit registry.

## Impact Assessment

### Affected Components

- `cli/src/components/tools/registry.ts`
- `cli/src/components/tools/__tests__/fid-worktree.render.test.tsx`

### Risk Level

- [x] Low: presentation wiring only; no lifecycle mutations change.

## Proposed Solution

### Approach

Register fid_worktree with the existing state-complete structured panel.
Its display name comes from the existing tool metadata. Preserve JSON and copy
paths. No new chrome, dependency, animation or runtime tool behavior.

### Steps

1. Add the registry alias.
2. Exercise ToolBranch through native OpenTUI with loading, list, create,
   merge, dispose, refusal, folding, empty output and narrow width.
3. Run declared gates and mandatory checks; commit, archive and push.

### Verification

`cli/src/components/tools/__tests__/fid-worktree.render.test.tsx` proves the
production rendering path, not only component metadata.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/tools/__tests__/fid-worktree.render.test.tsx
- gate: test cli/src/components/tools/__tests__/mcp-result.render.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:287ec8b2ec75af478e879c418c9e74b3a8d1d915d1080812ae3f6ef25b816e44
- verified: 2026-10-18T19:20:48.677Z
- typecheck cli: exit 0
- test cli/src/components/tools/__tests__/fid-worktree.render.test.tsx: exit 0
- test cli/src/components/tools/__tests__/mcp-result.render.test.tsx: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Registry absence explains fallback; structured JSON exists.
- **GREEN:** Reuse state-complete panel rather than result-only panel.
- **AUDIT:** ToolBranch imports registry and passes loading/folding options.
- **ADVERSARIAL:** Alias must not mistake ok:false for successful execution;
  original refusal fields remain visible, with no invented success badge.
- **CHANGE DELTA:** Initial plan.

### Missed Questions

1. Loading without output? Existing state-complete renderer shows running.
2. Agent branches? Their tools use the same ToolBranch registry.
3. Narrow width? Use the same percentage-width panel, verify native frames.

### Loop 2 — Independent audit and self-correction

Re-read handler, registry and ToolBranch. Their JSON/outputRaw contract is
compatible with unwrapParts. Native test must include refused lifecycle calls.

### Loop 3 — Final convergence

No new abstraction is required. Plan converged before production editing.

### Implementation Evidence

Commit `50f5877f` implements the registry alias and native production-path
regression. Declared receipt: 4/4 gates exit 0. Steps 1–3 implemented, with
normal progress push subject to the mandatory hook chain.

### Code Verification Evidence

The production call chain is ToolBranch → renderToolComponent → registry →
shared structured renderer → TrafficLightPanel. The alias is present in
registry.ts; the native test covers four actions and ok:false refusal.
Focused run: 2 pass, 0 fail, 37 expect calls across worktree and MCP suites.
Root typecheck and SDK build exit 0. tmux is unavailable; no live CLI or
lifecycle acceptance is claimed by a native renderer fixture.

## Resolution

- **Closed Date:** 2026-10-18
- **Commit SHA:** 50f5877f
- **Fix Description:** Worktree results reuse the state-complete structured panel.
- **Tests Added:** Native worktree ToolBranch fixture; 2 related suites pass.
- **Verification Evidence:** 4/4 declared gates exit 0; root typecheck/build pass.
- **Archived:** 2026-10-18

All three implementation steps are complete. No lifecycle semantics changed.

## Lessons Learned

Runtime tool registration does not register its CLI renderer.
