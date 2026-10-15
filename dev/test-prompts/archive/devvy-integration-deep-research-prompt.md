# Deep Research Prompt — Devvy Integration for Savant-Code

**Created:** 2026-08-18
**Purpose:** Feed to Gemini Deep Research to design a Discord Rich Presence system specifically for Savant-Code
**Method:** Attach this prompt + Savant-Code core files + Devvy repo for context

---

## Prompt (paste into Gemini Deep Research)

Research Topic: Designing a Discord Rich Presence System for Savant-Code (Inspired by Devvy)

I need a comprehensive architectural blueprint for building a Discord Rich Presence system specifically designed for Savant-Code, inspired by the open-source project Devvy (https://github.com/sonawaneutkarsh/devvy). The system should show an operator's current coding activity on Discord without exposing any sensitive information.

## What is Devvy?

Devvy (https://github.com/sonawaneutkarsh/devvy) is a macOS-only Discord Rich Presence app for coding workflows. Key properties:

- **Privacy-conscious**: Shows project name + high-level state + AI model, never shows code/prompts/file contents
- **Supported apps**: VS Code, OpenCode, Command Code
- **Architecture**: Local daemon owns Discord IPC, integrations publish structured state to loopback HTTP endpoint (127.0.0.1:17377), daemon arbitrates and creates one Discord activity
- **States shown**: Thinking, Editing, Planning, Running, Reviewing, Searching, Waiting, Idle
- **Privacy**: Project basename only, no file paths, no prompts, no code, no credentials
- **Install**: Single curl command, handles its own runtime, LaunchAgent for auto-start
- **License**: MIT

## Savant-Code Context (the system we're building on)

Savant-Code is a TypeScript/Bun terminal agent harness governed by the ECHO Protocol v0.2.0. Key properties:

### Agent Activity System
Savant-Code already tracks agent activity via `AgentActivity` kinds in `common/src/types/session-state.ts:110`:
- `idle | thinking | tool | subagent | researching`

These states are already broadcast to the OpenTUI sidebar via the existing activity/heartbeat pipeline.

### Zustand Store Architecture
The main store lives in `cli/src/state/chat-store.ts` — a thin Zustand assembly that re-exports from `cli/src/state/chat-store/`:
- `chat-store/types.ts` — ChatStore type with all state fields
- `chat-store/initial-state.ts` — initial state values
- `chat-store/chat-actions.ts` — action factories (Immer-wrapped)
- `chat-store/sidebar-actions.ts` — sidebar-specific actions

### Current State (v0.0.25)
- UI overhaul shipped (near-black/cyan design, animation engine, Easter egg)
- 5,429+ tests, typecheck ×4, ESLint, lint:md, prettier — all green
- FID queue empty (all 0816 program FIDs closed + archived)
- Release pipeline: release:public (tag → push → GitHub release → npm publish → binary verification)

### Technical Stack
- TypeScript strict, Bun 1.3.14
- OpenTUI 0.5.3 + React (terminal UI)
- Zustand + Immer for state management
- 10-agent roster (Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe, Adversary)
- Perfection Loop FSM: RED → GREEN → AUDIT → ADVERSARIAL → SELF_CORRECT → COMPLETE → IMPLEMENT

### Key Files
- `common/src/types/session-state.ts` — AgentActivity kinds, session state types
- `cli/src/state/chat-store.ts` — Zustand store (thin assembly)
- `cli/src/state/chat-store/types.ts` — ChatStore type
- `cli/src/state/chat-store/initial-state.ts` — initial state
- `agents/savant/savant-strict.ts` — STRICT agent definition
- `ECHO.md` — 15 Laws + Perfection Loop FSM + FID lifecycle
- `AGENTS.md` — Agent roster and tool restrictions

## The Research Question

How do we design a Discord Rich Presence system for Savant-Code that:

1. Shows current coding activity on Discord (project name + phase + model)
2. Respects privacy (no code, prompts, file paths, credentials)
3. Integrates with Savant-Code's existing AgentActivity system
4. Works cross-platform (Windows, macOS, Linux) — not just macOS like Devvy
5. Uses Savant-Code's existing Zustand store infrastructure
6. Is self-contained and zero-config for the operator
7. Can be installed/used without admin privileges

The blueprint should improve on Devvy's design by:
- Cross-platform support (Devvy is macOS-only)
- Tighter integration with Savant-Code's existing activity system
- Showing Perfection Loop phase (RED/GREEN/AUDIT/ADVERSARIAL) as Discord states
- Showing the 10-agent roster activity (which agent is active)
- Respecting Savant-Code's governance (no sensitive data leaks)

## What I Need

1. **Architecture** — How does the presence system sit on top of Savant-Code? New daemon process? In-process? Extension?

2. **State Mapping** — How do Savant-Code's AgentActivity kinds + Perfection Loop phases map to Discord Rich Presence states?

3. **Privacy Model** — What is safe to show? What must never be shown? How do we enforce this mechanically?

4. **Cross-Platform Strategy** — How do we support Windows, macOS, and Linux? Discord IPC differences? Install mechanisms?

5. **Integration Points** — Where in Savant-Code's codebase does the presence publisher hook in? Zustand store subscription? Agent activity pipeline? New module?

6. **Installation** — How does an operator install/configure this? Zero-config? One command? Settings UI?

7. **Discord Integration** — Discord RPC library? Custom IPC? How do we create/update/clear activities?

8. **Failure Modes** — Discord not running? RPC errors? Savant-Code crashed? How do we degrade gracefully?

9. **Implementation Path** — Week 1, Week 2, Week 3. What ships first?

10. **Savant-Code Specifics** — Use actual file paths, actual state types, actual agent roles. No generic architecture — this must be implementable in the savant-code repo.

## Constraints

- Must use Savant-Code's existing AgentActivity system (don't replace it)
- Must be local-first, BYOK, zero cloud dependency
- Must work within the existing TypeScript/Bun stack
- Must respect ECHO governance (no sensitive data exposure)
- Must be cross-platform (Windows, macOS, Linux)
- Must be zero-config or near-zero-config for the operator

## Deliverable

A single comprehensive research document I can use as the architectural blueprint for implementing Discord Rich Presence in Savant-Code. Include diagrams (ASCII), data structures, state mappings, privacy rules, and concrete implementation steps.

---

## Attachments for Gemini Deep Research

When running this prompt, attach the following files for context:

1. This prompt file
2. `README.md` (root)
3. `ARCHITECTURE.md`
4. `ECHO.md`
5. `AGENTS.md`
6. `common/src/types/session-state.ts`
7. `cli/src/state/chat-store.ts` (main Zustand store)
8. `cli/src/state/chat-store/types.ts` (ChatStore type)
9. `cli/src/state/chat-store/initial-state.ts` (initial state)
10. URL: https://github.com/sonawaneutkarsh/devvy (Devvy repo for reference)
