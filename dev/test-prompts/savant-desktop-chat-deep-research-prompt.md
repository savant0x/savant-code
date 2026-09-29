# Deep Research Prompt — Savant Desktop: Native Chat Interface Architecture

**Created:** 2026-08-18
**Purpose:** Feed to Gemini Deep Research to design a native chat desktop app for Savant-Code (NOT terminal-wrapped)
**Method:** Attach this prompt + Savant-Code core files for context

---

## Prompt (paste into Gemini Deep Research)

Research Topic: Designing a Native Chat Desktop Application for Savant-Code (Not Terminal-Wrapped)

I need a comprehensive architectural blueprint for building a native chat desktop application for Savant-Code. This is NOT a terminal emulator wrapped in a desktop window. It is a regular chat interface — like Discord, Slack, or ChatGPT — with Savant branding, interactive visual feedback loops, and agent orchestration behind the scenes.

## What We're Building

A desktop application where:
- The user sees a regular chat interface (message bubbles, typing indicators, streaming text)
- The agent responds in conversational language (not terminal output)
- Interactive elements appear inline (approval buttons, forms, diff viewers, progress bars)
- Visual feedback loops show agent state (thinking, working, waiting for approval, error)
- The terminal is invisible — no shell syntax, no escape codes, no pty
- The experience feels like chatting with a powerful AI assistant, not operating a CLI

## What We're NOT Building

- NOT a terminal emulator (no xterm.js, no node-pty, no bash)
- NOT a CLI wrapped in Electron (no terminal I/O, no shell commands)
- NOT a code editor (no Monaco, no IDE features)
- NOT a dashboard or control panel

## Savant-Code Context (the system we're building on)

Savant-Code is a TypeScript/Bun terminal agent harness governed by the ECHO Protocol v0.2.0. Key properties:

### Governance (ECHO Protocol)
- 15 Laws enforced mechanically by EHEL (ECHO Harness Enforcement Layer)
- Perfection Loop FSM: RED → GREEN → AUDIT → ADVERSARIAL → SELF_CORRECT → COMPLETE → IMPLEMENT
- FID (Feature Implementation Document) lifecycle: created → analyzed → fixed → verified → converged → closed
- Anti-deferral gate: no silent scope drops, operator approval required for deferrals
- Implementation evidence required for FID closure (commit SHA or file:line + grep match)
- Status vocabulary: created | analyzed | fixed | verified | converged | closed

### Agent Roster (10 roles)
- Orchestrator (routing, enforcement)
- Detective (codebase analysis, grep call-graphs)
- Forge (implementation only)
- Verifier (double-audit, test/grep, cite file:line evidence)
- Recorder (FID lifecycle, CHANGELOG)
- Thinker (sequential reasoning)
- Scout (glob/list_directory/read_files)
- Researcher (web search + docs)
- Scribe (session summaries, LEARNINGS.md)
- Adversary (meta-verification, refutes FAILs, re-audits unevidenced PASSes)

### Current State (v0.0.25)
- UI overhaul shipped (near-black/cyan design, animation engine, Easter egg)
- 5,429+ tests, typecheck ×4, ESLint, lint:md, prettier — all green
- FID queue empty (all 0816 program FIDs closed + archived)
- Release pipeline: release:public (tag → push → GitHub release → npm publish → binary verification)
- Auto Drive program (FID-001..010) implemented and verified — autonomous end-to-end execution
- Discord Rich Presence (FID-009) shipped with hardcoded client id + privacy redaction

### Technical Stack
- TypeScript strict, Bun 1.3.14
- OpenTUI 0.5.3 + React (terminal UI — current)
- Zustand + Immer for state management
- EHEL enforcement at tool-executor level

## The Research Question

How do we design a native chat desktop application for Savant-Code that:

1. **Looks and feels like a regular chat app** — message bubbles, typing indicators, streaming text, user/agent conversation
2. **Hides the terminal completely** — no shell syntax, no escape codes, no pty, no terminal I/O
3. **Shows agent state visually** — thinking, working, waiting for approval, error states (not terminal output)
4. **Provides interactive visual feedback loops** — inline approval buttons, progress bars, diff viewers, forms
5. **Maintains ECHO governance** — the 15 Laws, Perfection Loop, FID lifecycle, anti-deferral gate all still apply
6. **Works cross-platform** — Windows, macOS, Linux
7. **Is distributable** — auto-updating, code-signed, packaged

## What I Need

1. **Chat UI Architecture** — What does the message stream look like? How does the agent "type"? What does a tool call look like in chat form?

2. **Agent State Visualization** — How do we show RED/GREEN/AUDIT/ADVERSARIAL phases visually? What does "thinking" look like? What does "waiting for approval" look like?

3. **Interactive Elements** — Inline approval buttons, diff viewers, forms, progress bars. How do these appear in the chat flow?

4. **Bridge Protocol** — How does the Electron UI communicate with the Bun backend? JSON-RPC over stdio? WebSocket? In-memory?

5. **Streaming Architecture** — How does agent output stream to the UI? Server-sent events? WebSocket frames? How do we handle backpressure?

6. **Message Types** — User messages, agent messages, system messages, tool calls, tool results, approval prompts, error states. What's the schema?

7. **Visual Design** — Savant branding (near-black/cyan), dark theme, animations, transitions. How do we make it feel premium?

8. **Desktop Shell** — Electron vs Tauri. Menu bar, system tray, notifications, window management.

9. **Distribution** — electron-builder, auto-updater, code signing (Azure Trusted Signing for Windows, Apple Developer ID for macOS).

10. **Implementation Path** — Week 1, Week 2, Week 3. What ships first?

## Constraints

- Must use existing ECHO governance (15 Laws, Perfection Loop, FID lifecycle)
- Must be local-first, BYOK, zero cloud dependency
- Must work within the existing TypeScript/Bun stack
- Must not require a second model (single-agent compatible)
- Must respect the anti-deferral rule (no silent scope drops)
- Must leverage existing Auto Drive infrastructure (FID-001..010)
- Must NOT be a terminal emulator or CLI wrapper

## Deliverable

A single comprehensive research document I can use as the architectural blueprint for building a native chat desktop application for Savant-Code. Include UI mockups (ASCII), message type schemas, state visualization designs, bridge protocol specs, and concrete implementation steps.

---

## Attachments for Gemini Deep Research

When running this prompt, attach the following files for context:

1. This prompt file
2. `README.md` (root)
3. `ARCHITECTURE.md`
4. `ECHO.md`
5. `AGENTS.md`
6. `dev/fids/FID-2026-0818-001-auto-drive-master.md` (Auto Drive master FID)
