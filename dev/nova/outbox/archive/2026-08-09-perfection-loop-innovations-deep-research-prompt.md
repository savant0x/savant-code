# Deep Research Prompt: Perfection-Loop Optimized Innovations for Savant Ecosystem

**Purpose:** Research GitHub trending projects, extract core ideas, then run them through the Perfection Loop to produce novel, local-first, zero-LLM-call implementations optimized for the Savant ecosystem (Savant Code, Savant Gateway, Savant Inference).

---

## Research Context

**The Savant Ecosystem:**
- **Savant Code:** Terminal-native AI coding agent with 10-agent roster, ECHO Protocol governance, knowledge graph, Code Universe visualization
- **Savant Gateway:** Rust-based API proxy with billing, authentication, rate limiting
- **Savant Inference:** Multi-provider inference router (Together AI, OpenRouter, Cheaper Inference)

**Core constraints:**
- Local-first (works offline via `file://`)
- Zero LLM calls for core features (LLM only at edges for optional enhancement)
- Single HTML file when possible (no framework bloat)
- Deterministic output (same input → same output)
- Self-contained (no CDN, no external dependencies)

**The Perfection Loop (ECHO Protocol):**
1. RED phase: Discover the idea, gather evidence
2. GREEN phase: Implement the minimal viable version
3. AUDIT phase: Verify correctness, test edge cases
4. ADVERSARIAL phase: Refute findings, find weaknesses
5. Iterate until converge

**The goal:** Don't just research the base ideas. Research how they'd be AFTER the Perfection Loop — optimized, hardened, local-first, and integrated into the Savant ecosystem.

---

## Projects to Research

### Tier 1: Direct Integration (Savant Code)

1. **Scopey** — Scope drift detection for coding agents
   - Base: Watches agent sessions, detects drift from request
   - Perfection Loop version: Local scope drift detector that compares agent output against FID intent, injects correction when drift exceeds threshold, all without LLM calls (deterministic comparison)

2. **Skill Recorder** — Record work session → export as skill.md
   - Base: Captures clicks/windows/narration → reconstructs intent
   - Perfection Loop version: Record Hermes session → extract procedure → generate SKILL.md automatically, with verification step that proves the skill works

3. **Ratchet** — Post-implementation quality gate
   - Base: Scans for deps, duplicates, stdlib reimplementations
   - Perfection Loop version: Deterministic code quality scanner that runs after Forge writes code, grades findings by certainty, blocks only definite issues, all local

4. **Soul Advisor** — Model-tier routing
   - Base: Routes routine work to cheap model, risky to powerful
   - Perfection Loop version: Deterministic task classifier (no LLM) that routes based on FID complexity, file count, and dependency depth

5. **Waku Agent** — Memory relevance gate
   - Base: Asks whether turn needs memory before injecting
   - Perfection Loop version: Deterministic relevance scorer that compares turn embedding against memory entries, skips injection when relevance < threshold, all local

### Tier 2: Infrastructure (Savant Gateway)

6. **QM** — Multi-tenant agent isolation
   - Base: Per-person memory, files, credentials, permissions
   - Perfection Loop version: Tenant isolation layer for Savant Code teams — per-team memory, files, permissions, all enforced deterministically

7. **Cloudflare Computer** — Durable object file system
   - Base: Agent file system with SQLite authoritative copy
   - Perfection Loop version: Local SQLite-backed file system for agent workspaces, with conflict resolution and audit trail

8. **Agent ENV** — Micro VM sandboxes
   - Base: Firecracker micro VMs for agent sandboxes
   - Perfection Loop version: Lightweight container isolation for agent workspaces (Docker/WSL2 based, not Firecracker)

9. **Singular** — Offline-first local SQLite with server authority
   - Base: Browser/SQLite persistence with optimistic outbox
   - Perfection Loop version: Local-first data layer for Savant Code — SQLite persistence with sync when online

10. **Bindwidth** — LLM deployment sizing
    - Base: Calculates KV cache, serving capacity, concurrency
    - Perfection Loop version: Deterministic deployment calculator that sizes infrastructure based on model, hardware, and expected load

### Tier 3: Innovation (Savant in General)

11. **AWS Context Ontology** — Business context for agents
    - Base: Scans databases/files, models as knowledge graph
    - Perfection Loop version: Extend Savant's knowledge graph to include business ontology — relationships between people, projects, decisions, all local

12. **Trace File Lineage** — Provenance tracking
    - Base: Answers "which agent/command created this file?"
    - Perfection Loop version: Provenance tracking for all Savant artifacts — track agent, command, data source, timestamp for every output

13. **Humanizer CLI** — Machine prose detection
    - Base: 33 patterns of machine writing with before/after
    - Perfection Loop version: Deterministic prose quality checker that scans docs/CHANGELOG/FIDs for AI-isms, grades severity, suggests minimal fixes

14. **Simple English** — Technical writing standard
    - Base: Short sentences, active voice, consistent terminology
    - Perfection Loop version: Enforced writing standard for Savant documentation — deterministic checks for sentence length, voice, terminology consistency

15. **Codex Security** — App security scanning
    - Base: Finds, validates, fixes vulnerabilities
    - Perfection Loop version: Deterministic security scanner that runs after builds, checks for known vulnerability patterns, all local

---

## Research Questions

For each project, answer:

1. **What's the core mechanism?** (not the marketing — the actual algorithm/approach)
2. **What makes it work without an LLM?** (deterministic rules, heuristics, graph algorithms, etc.)
3. **How would it look after the Perfection Loop?** (optimized, hardened, edge cases handled)
4. **How does it integrate into the Savant ecosystem?** (which component, what interface)
5. **What's the implementation complexity?** (simple/medium/complex, estimated LOC)
6. **What's the user-facing value?** (measurable improvement, not vague benefit)

---

## Output Format

For each innovation, provide:

```markdown
## [Project Name]

**Core Mechanism:** [1-2 sentence description of how it actually works]
**Zero-LLM Implementation:** [How to do it deterministically]
**Perfection Loop Version:** [What it looks like after RED→GREEN→AUDIT→ADVERSARIAL]
**Savant Integration:** [Where it fits in the ecosystem]
**User Value:** [Measurable improvement]
**Implementation:** [Complexity, estimated LOC, key dependencies]
```

Then provide a **Priority Matrix** ranking all 15 innovations by:
- Impact (how much it improves the ecosystem)
- Feasibility (how easy to implement)
- Novelty (how different from existing solutions)

---

## Constraints

- Focus on LOCAL-FIRST, ZERO-LLM implementations
- Single HTML file when possible
- Deterministic output (same input → same output)
- No external dependencies
- Must work offline
- Must integrate with existing Savant architecture

---

## ECHO.md Context

This research is conducted under the ECHO Protocol. All innovations must:
- Pass the Perfection Loop before implementation
- Be audited by Nova (independent third-party)
- Include testable verification criteria
- Be documented in FIDs before implementation

---

*Research prompt written 2026-08-09 by Nova.*
