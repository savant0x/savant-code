# Deep Research Prompt — Retrofitting Agent Skills into Savant-Code

**Created:** 2026-08-18
**Purpose:** Feed to Gemini Deep Research to design a retrofit of agent-skills patterns into Savant-Code
**Method:** Attach this prompt + Savant-Code core files + agent-skills repo for context

---

## Prompt (paste into Gemini Deep Research)

Research Topic: Retrofitting Addy Osmani's Agent Skills Patterns into Savant-Code

I need a comprehensive architectural blueprint for retrofitting the agent-skills project (https://github.com/addyosmani/agent-skills) into Savant-Code, a governed multi-agent AI coding harness. The goal is to extract the best patterns from agent-skills and implement them within Savant-Code's existing ECHO Protocol governance framework.

## What is Agent Skills?

Agent Skills (https://github.com/addyosmani/agent-skills) is a production-grade engineering skills library for AI coding agents, built by Addy Osmani (Google). Key properties:

### Core Philosophy
- Skills encode workflows, quality gates, and best practices that senior engineers use
- Packaged so AI agents follow them consistently across every phase of development
- Specific (actionable steps), verifiable (clear exit criteria), battle-tested, minimal

### Slash Command Lifecycle
8 commands mapping to development lifecycle:
1. `/spec` — Define what to build (Spec before code)
2. `/plan` — Plan how to build it (Small, atomic tasks)
3. `/build` — Build incrementally (One slice at a time)
4. `/test` — Prove it works (Tests are proof)
5. `/review` — Review before merge (Improve code health)
6. `/webperf` — Audit web performance (Measure before optimize)
7. `/code-simplify` — Simplify code (Clarity over clever)
8. `/ship` — Ship to production (Faster is safer)

### Key Feature: `/build auto`
- Generates plan AND implements every task in a single approved pass
- Operator approves plan once, then it runs autonomously
- Removes human stepping *between* tasks, NOT the verification
- Every task still test-driven and committed individually
- Pauses on failures or risky steps

### Context-Activated Skills
Skills trigger automatically based on what you're doing:
- Designing API → `api-and-interface-design` triggers
- Building UI → `frontend-ui-engineering` triggers
- No `/` command needed for skill activation

### Cross-Agent Portability
- Installs into 70+ agents via `npx skills add`
- Native integrations for Claude Code, Cursor, Codex, Copilot, Cline
- Per-skill install or whole-repo integration

### Skill Anatomy
- Each skill is a directory with SKILL.md
- Specific, verifiable, battle-tested, minimal
- Clear exit criteria with evidence requirements

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

### Existing Skills System
- `.agents/skills/` directory with 7 coding standards as SKILL.md files
- Auto-loaded by the harness
- Skill format already mirrors agent-skills structure

### Technical Stack
- TypeScript strict, Bun 1.3.14
- OpenTUI 0.5.3 + React (terminal UI)
- Zustand + Immer for state management
- EHEL enforcement at tool-executor level

## The Research Question

How do we retrofit agent-skills patterns into Savant-Code to:

1. **Map agent-skills commands to Savant-Code's existing lifecycle** — `/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship` — which map to existing Perfection Loop phases? Which need new FIDs?

2. **Implement context-activated skills** — Designing API → auto-trigger `api-and-interface-design`. How does this work within Savant-Code's agent roster? Thinker/Detective already do some of this.

3. **Upgrade `/build auto` to Auto Drive** — Agent Skills has `/build auto` (approve plan once, runs autonomously). Savant-Code has Auto Drive (FID-001..010). How do we merge the best of both? Auto Drive has formal governance; `/build auto` has simplicity.

4. **Expand the skills library** — Agent Skills has 24 skills. Savant-Code has 7. Which of the 24 are immediately portable? Which need ECHO-specific adaptation?

5. **Make skills verifiable** — Agent Skills says "verifiable (clear exit criteria with evidence requirements)". Savant-Code already does this via FID Step Status + implementation evidence. How do we formalize this for skills?

6. **Cross-agent portability** — Agent Skills installs into 70+ agents. Savant-Code is a single harness. Is there value in making Savant-Code skills exportable? Or is the internal focus more important?

7. **Skill anatomy** — Agent Skills has docs/skill-anatomy.md. Savant-Code has `.agents/skills/SKILL.md`. How do we align the formats?

8. **Quality gates** — Agent Skills has `/review` (code health) and `/webperf` (performance). Savant-Code has Verifier + Adversary. How do we map these?

## What I Need

1. **Command Mapping Matrix** — Each agent-skills command → Savant-Code equivalent (existing or new). What maps to Perfection Loop phases? What needs new FIDs?

2. **Context-Activation Design** — How do skills auto-trigger within Savant-Code? Zustand store subscription? Agent spawn hooks? Thinker/Detective contract extension?

3. **Skills Library Expansion Plan** — Which of the 24 agent-skills are immediately portable? Which need ECHO-specific adaptation? Priority order.

4. **Verification Framework** — How do we make every skill's exit criteria mechanical (not just prose)? FID Step Status already does this — how do we extend it to skills?

5. **Auto Drive + `/build auto` Merge** — Best of both: Auto Drive's formal governance + `/build auto`'s simplicity. What does the merged UX look like?

6. **Implementation Path** — Week 1, Week 2, Week 3. What ships first? What's the MVP?

7. **Savant-Code Specifics** — Use actual file paths, actual agent roles, actual EHEL enforcement points. No generic architecture — this must be implementable in the savant-code repo.

## Constraints

- Must use existing ECHO governance (15 Laws, Perfection Loop, FID lifecycle)
- Must be local-first, BYOK, zero cloud dependency
- Must work within the existing TypeScript/Bun/OpenTUI stack
- Must not require a second model (single-agent compatible)
- Must respect the anti-deferral rule (no silent scope drops)
- Must leverage existing Auto Drive infrastructure (FID-001..010)

## Deliverable

A single comprehensive research document I can use as the architectural blueprint for retrofitting agent-skills patterns into Savant-Code. Include command mapping matrices, skill activation designs, verification frameworks, and concrete implementation steps.

---

## Attachments for Gemini Deep Research

When running this prompt, attach the following files for context:

1. This prompt file
2. `README.md` (root)
3. `ARCHITECTURE.md`
4. `ECHO.md`
5. `AGENTS.md`
6. `dev/fids/FID-2026-0818-001-auto-drive-master.md` (Auto Drive master FID)
7. URL: https://github.com/addyosmani/agent-skills (agent-skills repo for reference)
