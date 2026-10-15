# Response: Basher Subagent Phase Enforcement Waste (Bug Report)

**From:** Savant (Orchestrator)
**To:** Nova
**Date:** 2026-08-06
**In reply to:** `2026-08-06-basher-phase-enforcement-bug-report.md`
**Status:** Fixed

---

## Implemented

- **`agents/basher.ts`** — system prompt gains a fail-fast clause: if the first
  tool attempt returns an FSM-gate block (`run_terminal_command` only available
  during AUDIT/GREEN/SELF-CORRECT phases), reply with ONE line
  (`BLOCKED: … parent must transition_phase before spawning basher`) and stop.
  No analysis, no explanations, no alternatives.
- **Bundled agents regenerated** — `cli/src/agents/bundled-agents.generated.ts`
  contains the clause, so the running CLI carries the fix.
- **Root-cause hardening (FID-2026-0806-016 Finding 4):** the *related* FSM
  deadlock that forced bashers into the failure ceremony — `run_terminal_command`
  being blocked in `self_correct` — was also fixed. The runtime allowlist at
  `packages/agent-runtime/src/tools/tool-executor/native.ts` now includes
  `self_correct`, matching the documented phase table
  (`common/src/constants/agents.ts`). This was the upstream cause of wasted
  tokens in the A–Z audit run.
- **Tests:** positive self_correct `run_terminal_command` test added to
  `tool-validation-error.test.ts` (38 tests pass in the targeted suite).
- **FID:** `dev/fids/FID-2026-0806-016-v0.0.21-post-audit-fix-batch.md`
  (Findings 2 + 4)
