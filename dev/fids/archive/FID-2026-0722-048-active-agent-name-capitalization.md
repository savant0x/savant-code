# FID-2026-0722-048 — Fix Active Agent Name Capitalization

**Filename:** `FID-2026-0722-048-active-agent-name-capitalization.md`
**ID:** FID-2026-0722-048
**Severity:** low
**Status:** closed
**Created:** 2026-07-22
**Author:** Forge

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0722-048`. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

In the right sidebar's **Active Agents** section, the agent name `savant`
appears in lowercase while other agent names are properly capitalized. The
`AgentStack` component renders the raw `id` value (e.g., `savant`) without
normalizing it to a display name. This fix adds a display-name formatter so
`savant` and `main-agent` render as `Savant`, and other kebab-case IDs render
in Title Case.

## Environment

- **OS:** Windows 11 / bash shell
- **Language/Runtime:** TypeScript / Bun / OpenTUI
- **Tool Versions:** OpenTUI 0.2.2, React 19
- **Commit/State:** main after FID-2026-0722-047

## Detailed Description

### Problem

`AgentStack` receives agent names as raw IDs (`savant`, `main-agent`, etc.)
and renders them directly. The `savant` ID appears lowercase, unlike other
agent names that are already capitalized.

### Expected Behavior

The `savant` agent should display as `Savant`. The `main-agent` alias should
also display as `Savant`. Other multi-word IDs (e.g., `savant-free`,
`detective`) should render in Title Case.

### Root Cause

`AgentStack` has no display-name normalization; it trusts callers to pass
presentation-ready strings.

## Impact Assessment

### Affected Components

- `cli/src/components/savant-ui/echo/agent-stack.tsx`

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] Low: visual text formatting only

## Proposed Solution

### Approach

Add a small `formatAgentName(name: string)` helper inside `agent-stack.tsx`.
Special-case `savant` and `main-agent` to return `Savant`. For all other
names, convert kebab-case to Title Case by splitting on `-`, capitalizing
each segment, and joining with spaces.

### Steps

1. Update `cli/src/components/savant-ui/echo/agent-stack.tsx` to format names.
2. Run CLI typecheck and ESLint on the changed file.
3. Code review.

### Verification

- `cd cli && bun run typecheck` passes.
- `cd cli && bun x eslint src/components/savant-ui/echo/agent-stack.tsx --max-warnings 0` passes.
- code-reviewer-kimi approves.

## Perfection Loop

### Loop 1

- **RED:** `savant` appears lowercase in the Active Agents sidebar list.
- **GREEN:** Add a display-name formatter to `AgentStack`.
- **AUDIT:** Typecheck, lint, and code review pass.
- **CHANGE DELTA:** ~1 file, small helper function.

## Resolution

- **Fixed By:** Forge
- **Fixed Date:** 2026-07-22
- **Fix Description:** Added `formatAgentName()` to `AgentStack` so `savant` and `main-agent` render as `Savant` and other kebab-case IDs render in Title Case.
- **Tests Added:** No — visual text formatting only.
- **Verified By:** Typecheck, lint, code-reviewer-kimi.
- **Commit/PR:** 
- **Archived:** 2026-07-22
