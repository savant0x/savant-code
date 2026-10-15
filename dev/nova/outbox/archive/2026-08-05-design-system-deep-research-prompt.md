# Deep Research Prompt: Custom Design System for Savant Code

**Purpose:** Synthesize the best design patterns from Hallmark and Impeccable into a custom design system for Savant
Code, then bake it directly into the harness.

---

## Research Sources

### Source 1: Hallmark (Anti-AI-Slop Design Skill)

- **Repository:** https://github.com/Nutlope/hallmark
- **Stars:** 22.1k
- **Focus:** Design generation with anti-slop gates
- **Key concepts:** 20 themes, 4 verbs, 57 slop-test gates, pre-emit self-critique, custom mode for creative intent
- **Made by:** Together AI

### Source 2: Impeccable (Design Language for AI Harnesses)

- **Repository:** https://github.com/pbakaus/impeccable
- **Stars:** 55.9k
- **Focus:** Design language + detection + scaffolding
- **Key concepts:** 59 deterministic rules, AST-aware CSS scaffolder, live mode, detector CLI, composition axes, 14+
- tool support
- **Made by:** Paul Bakaus

---

## Research Questions

### 1. Design Rule Synthesis

- What are the overlapping anti-slop rules between Hallmark (57 gates) and Impeccable (59 rules)?
- Which rules are unique to each system?
- What is the minimal set of rules that covers 90% of AI design slop?

### 2. Architecture Patterns

- How does Hallmark's "macrostructure + theme" approach differ from Impeccable's "composition axes"?
- What is the optimal architecture for a design system that:
  - Generates designs (like Hallmark)
  - Detects slop (like Impeccable)
  - Scaffolds CSS (like Impeccable)
  - Provides live feedback (like Impeccable)

### 3. Integration with Coding Agents

- How do both systems integrate with Claude Code, Cursor, and Codex?
- What is the SKILL.md pattern for design skills?
- How do they handle theme switching and customization?

### 4. Anti-Slop Taxonomy

- What are the most common AI design slop patterns?
- How do both systems detect and prevent them?
- What is the complete taxonomy of AI design slop?

### 5. Design System Architecture

- What is the optimal structure for a design system that can be:
  - Baked into a coding harness (Savant Code)
  - Used as a skill (like Hallmark)
  - Used as a detector (like Impeccable)
  - Used as a scaffolder (like Impeccable)

---

## Output Format

Please provide:

1. **Executive Summary** — 500 words on the optimal design system architecture
2. **Rule Synthesis** — Combined rule set from both systems (deduplicated, prioritized)
3. **Anti-Slop Taxonomy** — Complete taxonomy of AI design slop patterns
4. **Architecture Proposal** — How to bake this into Savant Code's harness
5. **SKILL.md Draft** — Starting point for the design skill
6. **Implementation Plan** — Phased approach to integration

---

## Constraints

- Must work with Savant Code's existing skill system (`.agents/skills/`)
- Must be compatible with ECHO Protocol (verification gates, evidence rules)
- Must be zero-cost (no paid dependencies)
- Must be Apache 2.0 compatible (both source repos are permissive)
- Must generate designs that don't look AI-generated
- Must detect AI design slop in existing code
- Must provide live feedback during design generation

Come up with a system that is better and outperforms both combined. 