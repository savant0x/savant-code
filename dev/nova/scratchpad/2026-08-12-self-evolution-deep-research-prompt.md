# Self-Contained Gemini Deep Research Prompt — Retrofit Hermes Self-Evolution + Skill System into Savant-Code

> Paste this entire prompt into Gemini Deep Research. It is fully self-contained. Gemini must fetch and analyze the repositories itself.

---

## ROLE & TASK

You are a senior AI-systems researcher. Your job: study how the **Hermes agent's self-evolution and skill system** work at the source level, then design how that *idea* can be **retrofitted into Savant-Code** — a TypeScript/Bun multi-agent coding assistant governed by the ECHO Protocol.

Deliver a **research report + draft Feature Implementation Documents (FIDs)** Spencer can run through Savant-Code's Perfection Loop. Do NOT write implementation code. Analysis, architecture, and FID-shaped plans only.

---

## SAVANT-CODE CONTEXT (the target system)

- Savant-Code is a **TypeScript / Bun** monorepo (`strict: true`), built on **ECHO Protocol v0.2.0** (15 Laws + a Perfection Loop FSM: RED → GREEN → AUDIT → ADVERSARIAL).
- **ECHO enforcement (EHEL)** is a deterministic, non-LLM gate that blocks unverified tool calls, scans output, and issues receipts. Any new subsystem MUST be EHEL-compatible.
- **Agent roster** (Orchestrator, Forge, Recorder, Verifier, Adversary, etc.) has separated duties — design new capabilities around this, not a single autonomous mutator.
- **Philosophy:** "We define the market, not follow it." New systems must be *governed* (human-in-loop or ECHO-gated), not autonomous drift.
- **No-signature policy:** FID artifacts carry no `Author:`/`Signed by:` fields in single-agent context.

---

## REPOSITORIES TO STUDY (examples — NOT the target system)

1. **https://github.com/NousResearch/hermes-agent-self-evolution** — "Hermes Forge": evolutionary self-improvement via **DSPy + GEPA** (Genetic-Pareto Prompt Evolution). Optimizes skills, tool descriptions, system prompts, code via API (no GPU). 5-phase plan in `PLAN.md`. Constraints: size/growth/structure limits. Human review only. MIT. Fetch `PLAN.md`, `forge/core/*`, `forge/skills/*`, tests, README.
2. **https://github.com/Shiorangerin/agent-self-evolution** — lighter MIT manual-trigger system. Candidate-based: unapproved candidates never enter context. Incremental collection + throttling + cost caps.
3. **https://github.com/NousResearch/hermes-agent** — the parent agent. Study how it structures skills + skill loading + the skill manager, as a concrete example only.

Recursively read source (not just READMEs). Follow links to GEPA paper, DSPy docs, eval data.

---

## ANALYSIS REQUIREMENTS (per repo)

A. **Mechanism** — trigger (manual/automated/scheduled), candidate generation, scoring, promotion.
B. **Safety/control** — what prevents unbounded/unsafe mutation (human review, constraints, candidate isolation).
C. **Cost model** — token/spend controls, throttling, dataset synthesis.
D. **Evaluation** — how is "better" measured (LLM-as-judge, fitness functions, regression tests).
E. **Skill format** — the skill schema; what a minimal skill needs to support programmatic creation + evolution.
F. **Gaps vs Savant-Code** — what Hermes/Shiorangerin assume (existing skill loader, MD schema, GitHub-PR promotion) that Savant-Code must build first or replace with an ECHO-gated equivalent.

---

## SYNTHESIS REQUIREMENTS

1. **Retrofit proposal** — take the Hermes self-evolution + skill idea and adapt it to Savant-Code:
   - Specify the **skill primitive** if Savant-Code lacks one (schema, loader, registry, promotion path).
   - Keep promotion **ECHO-gated + human-in-loop** (Spencer ratifies).
   - Route creation/audit through the roster (Forge drafts, Recorder files, Verifier/Adversary audit before promotion).
   - Be EHEL-compatible: mutations affecting runtime need a verifiable receipt + regression gate before activation.
   - Borrow Hermes Forge's ideas (DSPy wrapping, GEPA Pareto optimization, constraints, dataset fitness) but adapt to Savant-Code's FID/Perfection-Loop workflow, not GitHub PRs.

   ## IMPROVE
   Use this as a foundation of an idea, we need inspiration, not a 1:1 copy. Provide novel ideas to implement for this feature based on our archatecture 