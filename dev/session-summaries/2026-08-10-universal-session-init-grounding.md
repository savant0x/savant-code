<!-- markdownlint-disable MD013 -->

# Session Summary: 2026-08-10 — Universal Session-Init Grounding (FID-2026-0810-002)

**Session ID:** 2026-08-10-universal-session-init-grounding
**Duration:** 2026-08-10 (afternoon) — FID-2026-0810-002 implementation + closeout
**Status:** complete

**Governing protocol:** ECHO v0.2.0 harness (`ECHO.md`, `harness.protocol` in
`protocol.config.yaml`). The single-agent document
(`dev/echo-v0.1.2-single-agent.md`) is the protocol of a third-party harness the
operator uses when building outside savant-code; it does not govern this session
and is NOT part of the savant-code product.

---

## Initial State

- **OS:** Windows (win32), bash shell
- **Branch:** `main` (uncommitted working tree; 0.0.23 pending, unreleased)
- **Version:** `0.0.23` (pending — `VERSION` + manifests aligned)
- **Backlog:** zero active FIDs after the earlier 0810-001 closeout; this session
  created and closed FID-2026-0810-002.

## Session Objective

Implement FID-2026-0810-002 (converged across five Perfection-Loop iterations):
make session-init grounding **universal and deterministic** — local-first reads
with an embedded full-file fallback — in every mode, interactive and headless,
SavantFree and full product, and SDK harness sessions; and guarantee the harness
never selects or references the single-agent document.

## What Happened

1. **FID-2026-0810-002** was created as a planning FID with a full Perfection
   Loop (Loops 1–5) capturing: the strict-mode-only gate, the text-only
   end-turn bypass, the npm-install boot crash (absent files), the operator
   decision to bake the grounding set in as primary source with the local-file
   read retained as the ritual, and the operator correction that the
   single-agent document is a third-party harness protocol — completely out of
   scope, never bundled, never referenced by the harness.
2. **Operator granted automation level 3** (2026-08-10); implementation
   proceeded across all six changes:
   - **Change 1 — Embedded harness grounding bundle:** new
     `scripts/generate-protocol-bundle.ts` emits
     `common/src/constants/protocol-bundle.generated.ts` embedding the full
     harness grounding set (`ECHO.md`, `ARCHITECTURE.md`, `protocol.config.yaml`,
     `dev/LEARNINGS.md`, `templates/FID-TEMPLATE.md`); single-agent doc excluded;
     drift check wired into `validate:repository`, root script, and pre-push.
   - **Change 2 — Local-first boot resolution with embedded fallback:**
     `resolveBootContract` falls back to the bundle when harness files are
     absent (no throw); `protocolSource` persisted on main agent state at both
     SDK boot sites; native `read_files` serves grounding-set paths from the
     bundle in embedded mode (synthetic read).
   - **Change 3 — Universal tool-level gate:** session-init gate fires in every
     mode when armed (`gateArmed: Boolean(agentState.protocolFile)`); SDK
     embedders without a contract keep legacy behavior.
   - **Change 4 — Eager enforcement lifecycle:** shared
     `getOrCreateEnforcement(agentState)` factory called at loop start.
   - **Change 5 — First-turn completion gate:** `applyUngroundedCompletionGate`
     in `loop-iteration.ts` on both LLM and programmatic end-turn paths;
     `COMPLETION_GATE_MAX_RETRIES = 3` then session disarm with one-time notice.
   - **Change 6 — Prompt/refresh fixes:** both hard-coded single-agent
     references purged from `protocol-summary.ts`; stale signing instruction
     fixed; system-prompt Session-init paragraph reworded; enforcement test
     fixture switched from the single-agent path to `ECHO.md`.
3. **Verification:** agents bundle regenerated (571,195 B; single-agent sweep
   zero); typecheck × 4 green; full suites green — agent-runtime 769, common
   563, sdk 460, cli 2,938, scripts 21; ESLint `--max-warnings 0`; markdownlint;
   Prettier (generator now emits repo-formatted output — bundle byte-clean);
   `validate:repository` PASS; protocol-bundle + provider-docs drift checks
   clean. Debug scaffolding removed.
4. **Closeout:** FID status → closed with full Resolution + Implementation
   Summary; archived to `dev/fids/archive/`; CHANGELOG entry added under 0.0.23;
   LEARNINGS entry added; this session summary written.

## Key Decisions (operator)

- Grounding is baked in as the primary source; local-file reads remain the
  session ritual and win when present.
- Absent local protocol files → embedded fallback: no crash, no scaffolding.
- Embedded copies are generated from the repo files and drift-checked.
- The single-agent document is NOT part of the product: never bundled, never
  selected by the harness, zero references in harness-injected context.

## Verification Evidence

- `bun run generate:protocol-bundle:check` → clean (drift gate)
- typecheck × 4 (sdk, common, agent-runtime, cli) → exit 0
- Full suites: agent-runtime 769 / common 563 / sdk 460 / cli 2,938 / scripts 21
- ESLint `--max-warnings 0`, markdownlint, Prettier → clean
- `bun run validate:repository` → PASS
- Harness-boundary sweep `single[ _-]?agent` over harness-injected context →
  zero matches (excluded: SDK third-party bridge, `single_agent:` config block,
  dated historical records)

## Files Touched

- New: `scripts/generate-protocol-bundle.ts`,
  `common/src/util/embedded-protocol.ts`,
  `common/src/constants/protocol-bundle.generated.ts` (generated),
  `common/src/util/__tests__/embedded-protocol.test.ts`
- Modified: `common/src/util/boot-contract.ts` + tests,
  `sdk/src/run-state/initial-state.ts`, `sdk/src/run/execution/session-state.ts`,
  `packages/agent-runtime/src/echo/enforcement.ts` + tests,
  `packages/agent-runtime/src/echo/enforcement-state.ts`,
  `packages/agent-runtime/src/echo/protocol-summary.ts`,
  `packages/agent-runtime/src/run-agent-step/loop.ts`,
  `packages/agent-runtime/src/run-agent-step/loop-iteration.ts`,
  `packages/agent-runtime/src/tools/tool-executor/native.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/read-files.ts`,
  `packages/agent-runtime/src/__tests__/loop-agent-steps-part-a.test.ts`,
  `agents/savant/system-prompt.ts`, `.githooks/pre-push`,
  `cli/src/agents/bundled-agents.generated.ts` (regenerated),
  `CHANGELOG.md`, `dev/LEARNINGS.md`,
  `dev/fids/archive/FID-2026-0810-002-universal-session-init-grounding.md`
