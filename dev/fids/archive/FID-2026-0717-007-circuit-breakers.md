# FID: Implement Circuit Breakers

**Filename:** `FID-2026-0717-007-circuit-breakers.md`
**ID:** FID-2026-0717-007
**Severity:** high
**Status:** closed
**Created:** 2026-07-17 18:00

---

## Summary

ECHO.md defines 5 circuit breaker rules. Config values exist in `protocol.config.yaml:61-65` but no runtime code enforces them. ARCHITECTURE.md describes `charChangeTotal`, `iterationCount`, `oscillationDetections` fields on AgentState — but they don't exist in the actual type.

## Evidence

- `protocol.config.yaml:61-65` — `max_iterations: 10`, `change_threshold: 0.10`, `convergence_threshold: 0.02`, `convergence_passes: 2`, `oscillation_limit: 3`
- `ARCHITECTURE.md:159-165` — describes circuit breaker state fields
- `common/src/types/session-state.ts:27-64` — AgentState has NO circuit breaker fields

## Proposed Solution

### Steps

1. Add circuit breaker fields to `AgentState` in `session-state.ts`:
   - `iterationCount?: number` — current loop iteration
   - `charChangeTotal?: number` — running character change total
   - `oscillationDetections?: number` — same issue reappearances
   - `lastIssueIds?: string[]` — last 3 issue IDs for oscillation detection

2. Initialize defaults in `getInitialAgentState()`:
   - `iterationCount: 0`, `charChangeTotal: 0`, `oscillationDetections: 0`, `lastIssueIds: []`

3. Enforce in `transition-phase.ts`:
   - On `self_correct→green`: increment `iterationCount`
   - On `audit→complete`: reset circuit breaker state
   - Hard stop: if `iterationCount >= 10`, block `self_correct→green` transition

4. Enforce convergence detection:
   - Track change delta between FID updates
   - If delta < 2% for 2 consecutive passes, recommend ship

5. Enforce oscillation detection:
   - When same issue ID appears 3 times, escalate (return error)

### Verification

- AgentState has circuit breaker fields
- transition-phase.ts enforces iteration limit
- Typecheck passes

### Missed Questions

1. **Should circuit breakers be configurable via protocol.config.yaml?** — Hardcode for now. Config is dead for most fields. Can be made configurable later.
2. **What counts as a "character change"?** — FID document content delta. The Recorder updates FID files. Measure file size before/after. But this requires reading the FID file at each transition — complex. Simpler: count transitions (iterationCount) and trust the agent to report changes.
3. **Should circuit breakers apply to all agents or just the Perfection Loop?** — Just the Perfection Loop. Circuit breakers are FID lifecycle concerns.
4. **What about charChangeTotal — is it per-FID or cumulative?** — Per-FID. Each FID has its own change history. But tracking per-FID requires FID ID in AgentState. Too complex for v1. Start with iterationCount only.
5. **What about convergence detection?** — Requires measuring FID content delta between passes. The FID files are on disk. Can compare file sizes. But this is a prompt-level instruction ("if change delta < 2%, recommend ship"), not a hard runtime check. Keep it advisory.
6. **What about oscillation detection?** — Requires tracking issue IDs across iterations. The FID document contains issue lists. Comparing them across iterations requires parsing FID content. Too complex for v1. Keep advisory.
7. **Should the hard stop (10 iterations) be a block or a warning?** — Block. The agent cannot proceed past 10 iterations. Must escalate to user.
8. **What if the agent is in self_correct and hits the limit?** — Return error message: "Circuit breaker: max iterations (10) reached. Escalating to operator." Force transition to idle.

### AUDIT Phase

| # | Check | Method |
|---|-------|--------|
| 1 | AgentState fields added | Grep `session-state.ts` for `iterationCount` |
| 2 | Defaults initialized | Grep `getInitialAgentState` for `iterationCount: 0` |
| 3 | transition-phase.ts enforces limit | Check `self_correct→green` path for `iterationCount >= 10` guard |
| 4 | Subagent inheritance | Check `createAgentState()` passes circuit breaker fields |
| 5 | Typecheck passes | `bun run --cwd=common typecheck` |

### SELF-CORRECT Phase

**Finding:** The original plan includes `charChangeTotal`, `oscillationDetections`, and `lastIssueIds` — all require FID content parsing which is complex.

**Correction:** Simplify to v1: only `iterationCount` is enforced at runtime. The other circuit breakers (char change, convergence, oscillation) remain advisory in the ECHO protocol prompt. This is realistic — the agent can follow advisory rules via system prompt without runtime enforcement.

**Finding:** The hard stop needs to be in `transition-phase.ts`, but the handler doesn't have access to `iterationCount` — it only has `fsmPhase`.

**Correction:** Add `iterationCount` to the `agentState` parameter type in `transition-phase.ts`. The handler already takes `agentState: { fsmPhase?: FsmPhase }` — extend it to include `iterationCount?: number`.

### COMPLETE Phase

FID converged. Simplified to: add `iterationCount` to AgentState, enforce hard stop at 10 in transition-phase.ts. Advisory circuit breakers remain in ECHO prompt.

## Resolution

- **Fixed By:** Pending
- **Archived:** Pending
