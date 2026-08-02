# FID: FID-Bound Execution Enforcement

**Filename:** `FID-2026-0717-009-fid-bound-enforcement.md`
**ID:** FID-2026-0717-009
**Severity:** high
**Status:** closed
**Created:** 2026-07-17 18:00
**Author:** Pending

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed`; Original ID: `FID-2026-0717-009`. Backfilled fields: Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

ECHO requires FID-Bound Execution: code is NEVER written until the FID converges to COMPLETE. Currently, the FSM allows `idle → red → green` without any FID being created. The tool gating only checks phase, not FID status.

## Evidence

- ECHO.md:289-306 — FID-Bound Execution spec
- `tool-executor.ts:339-362` — checks `fsmPhase === 'green'` but not FID status
- `transition-phase.ts:10-17` — `VALID_TRANSITIONS` allows `idle→red→green` without FID

## Proposed Solution

### Steps

1. Add FID existence check to `transition-phase.ts`: before allowing `red→green`, verify at least one FID exists in `dev/fids/` with status not `closed`
2. Add FID status check: before allowing code writes in GREEN, verify a FID with `perfection_loop_phase: 'complete'` exists
3. This is a prompt-level + transition-level enforcement, not a hard block (agent can still create FIDs quickly)

### What we're NOT doing

- Not blocking tool calls based on FID status (too complex, would require FID state in AgentState)
- Not auto-creating FIDs (agent-driven per ECHO)

### Verification

- transition-phase.ts checks for open FIDs before red→green
- Typecheck passes

### Missed Questions

1. **What if the user explicitly says "skip the FID"?** — They can. ECHO's termination criteria allow "User explicitly requests to ship" → skip to COMPLETE. The enforcement is a check, not a hard block. The agent can override with user approval.
2. **Should this check be in transition-phase.ts or tool-executor.ts?** — transition-phase.ts. It's a phase transition guard, not a tool gate.
3. **How to check for open FIDs?** — `fs.readdirSync('dev/fids/')` and check for files matching `FID-*.md` that are not in `archive/`. Or query the DB `fid_documents` table for status != 'closed'.
4. **What if dev/fids/ doesn't exist?** — No FIDs = no enforcement. Agent can proceed freely. This is the "no FID created yet" case — the check only blocks `red→green`, not `idle→red`.
5. **Should the check be on `red→green` or `idle→green`?** — `red→green`. The RED phase is where issues are discovered and FIDs are created. By the time the agent wants to transition to GREEN, a FID should exist.
6. **What about `self_correct→green`?** — No FID check needed. The FID already exists from the first iteration.
7. **Should the check verify FID status is COMPLETE?** — No. That's too strict for v1. Just check that a FID exists. The Perfection Loop prompt instructs the agent to complete the FID before GREEN. Trust the prompt.
8. **What if the agent creates a FID and immediately transitions to GREEN?** — That's fine. The FID exists. The agent is following the protocol. The enforcement is "at least one FID must exist," not "FID must be fully complete."

### AUDIT Phase

| # | Check | Method |
|---|-------|--------|
| 1 | FID files are in `dev/fids/` | Directory exists with `.gitkeep` |
| 2 | FID naming convention | `FID-*.md` pattern |
| 3 | transition-phase.ts has access to filesystem | Can import `fs` module |
| 4 | Check doesn't break existing flow | Only applies to `red→green`, not other transitions |

### SELF-CORRECT Phase

**Finding:** Reading the filesystem in `transition-phase.ts` adds I/O to a tool handler. This is unusual — tool handlers should be lightweight.

**Correction:** Acceptable. The check is a single `readdirSync` call, fast enough for a tool handler. Alternative: cache the FID list in AgentState, but that adds complexity.

**Finding:** The check only verifies FID existence, not that the FID is in the right state (RED, GREEN, AUDIT, etc.).

**Correction:** For v1, existence is sufficient. The Perfection Loop prompt instructs the agent on proper FID lifecycle. Runtime enforcement is a safety net, not a complete state machine.

### COMPLETE Phase

FID converged. Simple check: on `red→green` transition, verify `dev/fids/` has at least one `FID-*.md` file. If not, reject transition with message.

## Resolution

- **Fixed By:** Pending
- **Archived:** Pending
