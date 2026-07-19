# FID-2026-0718-006 — Agent Roster Alignment — COMPLETE

**Closed:** 2026-07-18
**Status:** ✅ Archived to `dev/fids/archive/`

---

## Summary

Aligned the 69-agent SavantCode codebase to the 9-agent Savant architecture per ARCHITECTURE.md spec. 13 fixes across 24 files through the full Perfection Loop (RED → GREEN → AUDIT → SELF-CORRECT → RE-AUDIT → COMPLETE).

## Key Changes

| Fix | What | Files |
|-----|------|-------|
| 1 | Strip write tools from Orchestrator | base2.ts, base-deep.ts |
| 2 | Update spawnableAgents to Savant roster | base2.ts, base-deep.ts |
| 3 | Add search tools to Detective | detective.ts |
| 4 | Fix grep → code_search | recorder.ts, scribe.ts |
| 5-6 | Remove providerOptions from Thinker/Verifier | thinker.ts, verifier.ts |
| 7 | Update FREE_MODE_AGENT_MODELS | free-agents.ts |
| 8 | Rewrite all system prompts | base2.ts, base-deep.ts |
| 9 | Update ECHO_PROTOCOL_INSTRUCTIONS to v0.2.0 | common/constants/agents.ts |
| 10 | withParentModel() inherits providerOptions | spawn-agent-utils.ts |
| 11 | Fix Scout to delegate to Detective | scout.ts |
| 12 | Fix context-pruner sentAt type error | context-pruner.ts |
| 13 | Delete 20+ absorbed SavantCode agent files | general-agent/, reviewer/*, etc. |

## Verification

- **Typecheck:** agents/ ✅ zero errors, common/ ✅, agent-runtime/ ✅
- **Code review:** approved after 3 corrections (dead code removal, prompt fix, Scout delegation)
- **Pre-existing bugs fixed:** grep→code_search, sentAt type error, ECHO version mismatch

## Operator Decisions

1. **Strict separation** — Orchestrator loses all write tools
2. **Single Thinker** — inherits parent model, no model variants
3. **Verifier has NO tools** — reads only via message history
4. **Pure merge** — all SavantCode capabilities absorbed into Savant agents
5. **Free-mode infrastructure preserved** — for future free version buildout

## Files Deleted

- `agents/general-agent/` (gpt-5-agent, opus-agent)
- `agents/editor/editor-gpt-5.ts`
- `agents/reviewer/` (10 reviewer variants + multi-prompt)
- `agents/thinker/best-of-n/` (4 files)
- `agents/file-explorer/code-searcher.ts`, `file-picker-max.ts`, `file-lister.ts`, `file-lister-max.ts`
- `agents/__tests__/file-picker.test.ts`
- `agents/e2e/file-explorer.e2e.test.ts`

## Next Steps (for Orchestrator)

1. Run bundled-agents regeneration to verify clean output
2. Run full E2E test suite
3. Consider FID for Scout/file-lister delegation quality improvement
