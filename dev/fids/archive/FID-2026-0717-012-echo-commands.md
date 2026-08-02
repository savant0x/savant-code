# FID: ECHO Slash Commands

**Filename:** `FID-2026-0717-012-echo-commands.md`
**ID:** FID-2026-0717-012
**Severity:** medium
**Status:** closed
**Created:** 2026-0717 18:00
**Author:** Pending

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed`; Original ID: `FID-2026-0717-012`. Backfilled fields: Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

No ECHO-specific slash commands exist. The CLI has 22+ commands but none for FID management, phase transitions, or Perfection Loop control.

## Evidence

- `cli/src/data/slash-commands.ts` — 22 commands, none ECHO-related
- `cli/src/commands/command-registry.ts` — no FID/phase commands

## Proposed Solution

### Steps

1. `/fids` — List open FIDs with status and phase
2. `/fid <id>` — Show FID details
3. `/phase` — Show current FSM phase and allowed transitions
4. `/phase <target>` — Transition FSM phase (wraps transition_phase tool)
5. `/strict` — Toggle strict_mode on/off

### Verification

- Commands registered and functional
- Typecheck passes

### Missed Questions

1. **Should these be agent-driven or direct?** — Direct. The user should be able to check FIDs and phase without asking the agent. These are CLI commands, not agent tools.
2. **Should `/phase` require confirmation?** — Yes for transitions (e.g., `/phase green`). No for viewing (`/phase` alone shows current state).
3. **How does `/fids` find FID files?** — `fs.readdirSync('dev/fids/')` filtered to `FID-*.md`. Parse each file's frontmatter for status/phase.
4. **How does `/fid <id>` find a specific FID?** — Match by ID prefix. E.g., `/fid 006` matches `FID-2026-0717-006-*.md`.
5. **How does `/phase <target>` transition?** — Call the `transition_phase` tool handler directly. The CLI has access to `agentState` and can invoke the handler.
6. **Should `/strict` toggle or set?** — Toggle. `/strict` flips between true and false. Shows current state after toggle.
7. **What about `/perfection-loop`?** — Too complex for v1. The agent runs the Perfection Loop via system prompt instructions. A slash command would need to orchestrate multiple agent spawns. Defer.
8. **Should commands show help text?** — Yes. `/fids --help` shows usage. Standard CLI pattern.

### AUDIT Phase

| # | Check | Method |
|---|-------|--------|
| 1 | Slash command system exists | `cli/src/data/slash-commands.ts` defines commands |
| 2 | Command registry exists | `cli/src/commands/command-registry.ts` registers handlers |
| 3 | FID files parseable | Frontmatter contains status/phase |
| 4 | transition-phase handler callable | `handleTransitionPhase` is exported |

### SELF-CORRECT Phase

**Finding:** `/phase <target>` needs access to `agentState` which is in the runtime, not the CLI. The CLI communicates with the runtime via messages.

**Correction:** Instead of calling the handler directly, `/phase green` sends a message to the agent: "Transition FSM to GREEN phase." The agent then calls `transition_phase` tool. This is agent-driven, not direct. But the user asked for direct commands.

**Alternative:** Add a new CLI command that directly mutates `agentState.fsmPhase` without going through the agent. This is possible since the CLI has access to the runtime state.

**Decision:** Go with direct mutation for `/phase`. The CLI already has access to `agentState` via the runtime. No need to route through the agent.

**Finding:** `/fids` needs to read and parse FID files. This is filesystem I/O in a command handler.

**Correction:** Acceptable. The command handler runs synchronously. `readdirSync` + `readFileSync` are fast for a small directory.

### COMPLETE Phase

FID converged. 5 commands: `/fids`, `/fid <id>`, `/phase`, `/phase <target>`, `/strict`. All direct (not agent-driven). `/fids` reads from filesystem. `/phase` mutates agentState directly.

## Resolution

- **Fixed By:** Pending
- **Archived:** Pending
