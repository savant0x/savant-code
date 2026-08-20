# Deep Research Prompt — Auto Drive Architecture for Savant-Code

**Created:** 2026-08-17
**Purpose:** Feed to Gemini Deep Research to generate an Auto Drive architecture blueprint
**Method:** Attach this prompt + Savant-Code core files + Every Code repo for context

---

## Prompt (paste into Gemini Deep Research)

Research Topic: Architecting "Auto Drive" — Autonomous End-to-End Agent Execution on a Governed Harness

I need a comprehensive architectural blueprint for building an "Auto Drive" system on top of Savant-Code, a governed multi-agent AI coding harness. The system should allow an operator to describe only an end goal (not a plan), and the agent should autonomously decompose, plan, implement, verify, and ship — while enforcing quality rules mechanically.

### The Vision

The dream: a coder describes an idea in one sentence. The agent takes that idea and fully builds it — no plan, no step-by-step instructions, no human-in-the-loop at every phase. The harness's governance layer ensures quality: no broken builds, no silent deferrals, no unverified closures. The agent plans, executes, and ships. The operator reviews the result.

### Savant-Code Context (the harness we're building on)

Savant-Code is a TypeScript/Bun terminal agent harness governed by the ECHO Protocol v0.2.0. Key properties:

**Governance**
- 15 Laws enforced mechanically by EHEL (ECHO Harness Enforcement Layer)
- Perfection Loop FSM: RED → GREEN → AUDIT → ADVERSARIAL → SELF_CORRECT → COMPLETE → IMPLEMENT
- FID (Feature Implementation Document) lifecycle: created → analyzed → fixed → verified → converged → closed
- Anti-deferral gate: no silent scope drops, operator approval required for deferrals
- Implementation evidence required for FID closure (commit SHA or file:line + grep match)
- Status vocabulary: created | analyzed | fixed | verified | converged | closed

**Agent Roster (10 roles)**
- Orchestrator (routing, enforcement)
- Detective (codebase analysis, grep call-graphs)
- Forge (implementation only)
- Verifier (double-audit, test/grep, cite file:line evidence)
- Recorder (FID lifecycle, CHANGELOG)
- Thinker (sequential reasoning)
- Scount (glob/list_directory/read_files)
- Researcher (web search + docs)
- Scribe (session summaries, LEARNINGS.md)
- Adversary (meta-verification, refutes FAILs, re-audiences unevidenced PASSes)

**Technical Stack**
- TypeScript strict, Bun 1.3.14
- OpenTUI 0.5.3 + React (terminal UI)
- EHEL enforcement at tool-executor level
- Single-agent mode: dev/echo-v0.1.2-single-agent.md
- Hybrid mode: ECHO.md (10-agent harness)

**Current State**
- v0.0.25 shipped (UI overhaul, animation engine, Easter egg, governance hardening)
- 5,429+ tests, typecheck ×4, ESLint, lint:md, prettier — all green
- FID queue empty (all 0816 program FIDs closed + archived)
- Release pipeline: release:public (tag → push → GitHub release → npm publish → binary verification)

### Reference: Every Code (https://github.com/just-every/code)

Every Code is a community fork of OpenAI's Codex CLI. Key features relevant to this research:

- **Auto Drive orchestration** — Multi-agent automation that self-heals and ships complete tasks
- **Auto Review** — Background ghost-commit watcher that runs reviews in a separate worktree whenever a turn changes code; reports issues + ready-to-apply fixes without blocking the main thread
- **Browser Integration** — CDP support, headless browsing, screenshots captured inline
- **Multi-agent commands** — /plan, /code, /solve coordinate multiple CLI agents
- **Reasoning control** — medium | high | xhigh reasoning effort levels
- **Long-session stability** — Auto Drive and Auto Review decoupled so background reviews don't block command flow
- **Bounded state** — Core state maps have hard caps with bounded drop/trim behavior
- **Quality-first focus** — "Did we verify it works" over "Can the model write this file"

### The Research Question

How do we architect an "Auto Drive" system on top of Savant-Code that:

1. Accepts a one-sentence end goal from the operator
2. Autonomously decomposes the goal into a plan (using Thinker + Detective)
3. Executes the plan phase-by-phase (using Forge + Verifier + Adversary)
4. Enforces quality mechanically (EHEL laws, anti-deferral, implementation evidence)
5. Self-heals when verification fails (Perfection Loop FSM)
6. Ships a complete, verified result without human intervention at each step

The blueprint must leverage Savant-Code's existing governance (don't replace ECHO — extend it) and draw inspiration from Every Code's Auto Drive, Auto Review, and long-session stability patterns.

### What I Need

1. **Architecture** — How does Auto Drive sit on top of the Perfection Loop? New FSM state? New agent role? Extension of Orchestrator?

2. **Decomposition Engine** — How does the agent turn "build me a social network" into a phased plan without human input? Thinker + Detective interaction pattern.

3. **Phase Execution** — How does each phase flow through RED → GREEN → AUDIT → ADVERSARIAL → IMPLEMENT while maintaining quality?

4. **Self-Healing** — When Verifier fails or Adversary refutes, how does the agent loop back without human intervention? SELF_CORRECT → back to GREEN? Back to RED?

5. **Bounded State** — How do we prevent context collapse during long Auto Drive sessions? Bounded history, bounded agent caches, bounded prompt/agent/runtime state.

6. **Background Review** — How do we implement Auto Review as a non-blocking background process (like Every Code's ghost-commit watcher)?

7. **Completion Criteria** — How does the agent know it's done? When does Auto Drive hand control back to the operator?

8. **Failure Modes** — What can go wrong? Infinite loops, scope creep, quality degradation, context exhaustion. How do we guard against each?

9. **Implementation Path** — Week 1, Week 2, Week 3. What ships first? What's the MVP?

10. **Savant-Code Specifics** — Use actual file paths, actual agent roles, actual EHEL enforcement points. No generic architecture — this must be implementable in the savant-code repo.

### Constraints

- Must use existing ECHO governance (15 Laws, Perfection Loop, FID lifecycle)
- Must be local-first, BYOK, zero cloud dependency
- Must work within the existing TypeScript/Bun/OpenTUI stack
- Must not require a second model (single-agent compatible)
- Must respect the anti-deferral rule (no silent scope drops)

### Deliverable

A single comprehensive research document I can use as the architectural blueprint for implementing Auto Drive in Savant-Code. Include diagrams (ASCII), data structures, FSM transitions, and concrete implementation steps.

---

## Attachments for Gemini Deep Research

When running this prompt, attach the following files for context:

1. This prompt file
2. `README.md` (root)
3. `ARCHITECTURE.md`
4. `ECHO.md`
5. `AGENTS.md`
6. `dev/echo-v0.1.2-single-agent.md`
7. `CHANGELOG.md` (first 100 lines for current state)
8. URL: https://github.com/just-every/code (Every Code repo for Auto Drive reference)
