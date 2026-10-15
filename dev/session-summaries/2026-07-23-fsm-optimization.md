# Session Summary: 2026-07-23 — FSM Optimization + Workflow Feedback

## Duration

~2 hours

## What We Did

### 1. Test Sandbox (FID-2026-0722-055)

- Created `test-sandbox/` with 3 deliberate bugs to exercise the ECHO workflow
- Fixed implementation bugs where bugs didn't actually cause test failures
- Final result: typecheck 0 errors, 12 pass / 5 fail (all 3 bugs exposed)

### 2. FSM Optimization Prototype

- **Runtime changes** (tool-executor.ts):
  - Write tools (`write_file`, `str_replace`) now allowed in `self_correct` phase
  - `run_terminal_command` now allowed in `green` phase (inline verification)
- **Prompt changes** (agents.ts, savant.ts):
  - Updated FSM Phase Gating with transition map
  - Added "When to Skip RED" guidance (clarified Law 2 tension)
  - Added "Self-Correct Optimization" with Path A (quick) and Path B (complex)

### 3. Self-Audit (FID-2026-0723-003)

Found 5 issues in the prototype:

1. **CRITICAL**: `self_correct → complete` not in VALID_TRANSITIONS (prompt promised but runtime rejected)
2. **HIGH**: FSM diagram stale in ECHO_PROTOCOL_INSTRUCTIONS
3. **HIGH**: Stale inline FSM in savant.ts system prompt
4. **LOW**: Error message naming `SELF-CORRECT` vs `self_correct`
5. **MEDIUM**: "Skipping RED" wording tension with Law 2

### 4. Verifier Found 3 More Issues

1. Stale FSM diagram still showed old flow
2. `self_correct → complete` could bypass double-audit (tool-mediated verification clarification needed)
3. `basher` listed as phase-gated tool but it's actually a spawnable agent

## Key Architecture Insights

### Prompt vs Runtime Layers

| Change type | Takes effect | Needs restart? |
|------------|-------------|----------------|
| Prompt wording | Next conversation | No |
| Tool descriptions | Next conversation | No |
| Phase gating rules (runtime) | After build + restart | Yes |
| FSM transition map (runtime) | After build + restart | Yes |

### FSM Phase Gating Enforcement

- **Prompt layer**: `common/src/constants/agents.ts` (ECHO_PROTOCOL_INSTRUCTIONS)
- **Runtime layer**: `packages/agent-runtime/src/tools/tool-executor.ts` (lines 349-420)
- **Transition validation**: `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` (VALID_TRANSITIONS map)

### Agent Experience Feedback

- ~40% of time was phase transitions and recovery from gating errors
- `self_correct → green` round-trip was the biggest bottleneck (3 transitions per fix)
- Tool gating errors interrupted flow (tried write during AUDIT/self_correct)
- Basher spawn format requirements caused initial failure

## Files Changed

1. `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` — Added `complete` to `self_correct` transitions
2. `packages/agent-runtime/src/tools/tool-executor.ts` — Fixed error message naming, allowed writes in self_correct,
   terminal in green
3. `common/src/constants/agents.ts` — Rewrote FSM Phase Gating with shortcuts
4. `common/src/tools/params/tool/transition-phase.ts` — Updated tool description
5. `agents/savant/savant.ts` — Updated step prompt
6. `dev/fids/FID-2026-0723-003-echo-fsm-optimization-fixes.md` — New FID
7. `test-sandbox/` — New test project (disposable)

## Next Steps

- [ ] Build runtime changes (`bun run build` in relevant workspaces)
- [ ] Test `self_correct → complete` in a fresh session
- [ ] Archive FID-2026-0723-003
- [ ] Clean up `test-sandbox/`
- [ ] Update CHANGELOG.md

## Compliance Notes

- Law 2 tension resolved: RED is for finding EXISTING bugs, not analyzing NEW work
- Double-audit rule clarified: tool-mediated verification (basher/run_terminal_command) is NOT self-reporting
- basher is a spawnable agent, not a phase-gated tool
