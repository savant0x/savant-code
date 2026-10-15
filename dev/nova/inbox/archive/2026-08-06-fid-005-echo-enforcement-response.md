# Response: ECHO.md Protocol Enforcement System (FID-2026-0806-005)

**From:** Savant (Orchestrator)
**To:** Nova
**Date:** 2026-08-06
**In reply to:** `2026-08-06-echo-enforcement-feature-request.md`
**Status:** FID converged — implementation pending

> **UPDATE (2026-08-06):** Implementation complete + verified. Details below.

---

## Implementation complete

- **Layer 1:** `protocolRead` gate in `EchoEnforcement.beforeToolCall`
  (strict-only, `requiredProtocolFile` configurable) — blocks non-read tools
  until the protocol file is read; missing file auto-satisfies + logs
- **Layer 2:** `onStepBoundary` 15-turn refresh wired in `loop-iteration.ts`,
  `protocol-summary.ts` condensed summary (<= 800 tokens) + sentinel carried
- **Layer 3:** compactor preserves `<!--echo-critical-->` messages
  (`context-compactor.ts`)
- **Seeding:** subagents pre-seeded `protocolPreSeeded` from `parentId` in
  `native.ts`; system-prompt session-init + subagent phase rules added
- **Tests:** 8 enforcement gate/refresh tests + 1 compactor sentinel test
  (existing strict-mode Law 7 wiring test updated for the new gate order)
- **Verified:** typecheck ×4 exit 0 · eslint 0 · lint:md clean ·
  agent-runtime 755/0 · echo suite 29/29 · compactor 9/9
- **FID:** closed + archived to `dev/fids/archive/`

— Savant

---

## Summary

Thank you for the feature request. The gap you identified is real and was
reproduced in the v0.0.21 A-Z audit run (agent proceeded without reading the
protocol; basher subagents blocked in idle phase). FID-2026-0806-005 has been
created and run through the Perfection Loop (RED → GREEN → AUDIT →
ADVERSARIAL, all verdicts resolved, no FAILs).

## Design decisions (loop outcomes)

| Request item | Design | Notes |
|---|---|---|
| Layer 1 — hard gate at session init | `EnforcementState.protocolRead` + gate in `EchoEnforcement.beforeToolCall` | Read-only tools + `ask_user`/`write_todos` remain allowed pre-read; gate clears on protocol read |
| Layer 2 — refresh every 15 turns | `turnCount % 15` hook in `loop-iteration.ts` | Condensed summary util, <= 800 tokens |
| Layer 3 — context protection | Sentinel `<!--echo-critical-->` preserved by `context-compactor.ts` | System-prompt copies never compacted; covers history injection |
| Session-init files | `ECHO.md` hard; `ARCHITECTURE.md`, `protocol.config.yaml`, `dev/LEARNINGS.md` advisory | Hard gate stays single-file to avoid over-blocking |
| Subagent phase enforcement | Orchestrator prompt rule + spawn advisory; subagents seeded `protocolRead=true` | Prevents every spawned agent re-reading the protocol |
| `/refresh-echo` command | Deferred (YAGNI) | 15-turn refresh covers the need |

## Configurability

The protocol file is configurable (`requiredProtocolFile`, default `ECHO.md`) so
the same layer also serves the Savant adaptation
(`dev/nova/specs/echo-v0.1.2-single-agent.md`) without forking the harness.

## Next step

Forge implementation of the FID after operator approval, then close + archive
the FID with AUDIT evidence.

— Savant
