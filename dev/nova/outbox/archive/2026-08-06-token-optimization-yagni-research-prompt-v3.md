# Deep Research Prompt: Token Optimization and YAGNI Enforcement for Savant Code

**Purpose:** Analyze ponytail, caveman, and the YAGNI-oneliner concept, run the Perfection Loop on the research, and
design a token optimization system for Savant Code with complete implementation specifications.

---

## Research Sources

### Source 1: Ponytail (97.2k stars)

- **Repository:** https://github.com/DietrichGebert/ponytail
- **Concept:** "Makes your AI agent think like the laziest senior dev in the room. The best code is the code you never
- wrote."
- **Technology:** YAGNI enforcement, lazy development patterns, corner-cut marking
- **Key features:** ponytail: comment markers for deliberate simplifications, /ponytail-debt command for tracking tech
- debt
- **License:** MIT

### Source 2: Caveman (96.4k stars)

- **Repository:** https://github.com/juliusbrussee/caveman
- **Concept:** "why use many token when few token do trick" — Cuts 65% of tokens by talking like caveman
- **Technology:** Token compression, output reduction, terse communication
- **Key features:** 65% token reduction measured average, mode system (compress/think/code), benchmarking harness
- **License:** MIT

### Source 3: YAGNI-Oneliner (Concept)

- **Origin:** Ponytail benchmark arm — bare "write one-liners" prompt
- **Concept:** Extreme YAGNI — write the absolute minimum code possible
- **Key insight:** YAGNI without structure leads to unusable code; YAGNI with structure leads to elegant minimalism

---

## Research Context: ECHO Protocol v0.2.0

**This is the authoritative source for all implementation decisions.**

### YAGNI Definition for Multi-Agent Systems

YAGNI (You Ain't Gonna Need It) in a multi-agent context means:

- **Do not generate code that isn't required by the converged FID**
- **Do not spawn agents that aren't needed for the current phase**
- **Do not read files that aren't in the blast radius**
- **Do not reason about problems that aren't present**
- **Do not document things that are self-evident from the code**

YAGNI is NOT:

- Skipping verification (Law 3 still applies)
- Omitting error handling (Law 14 still applies)
- Reducing code quality (Law 15 still applies)
- Avoiding necessary complexity (the FID defines what's necessary)

### Agent Roster (9 canonical roles)

| # | Agent | Phase | Responsibility | Token Profile |
|---|-------|-------|----------------|---------------|
| 1 | Orchestrator | ALL | Routes work, enforces protocol, spawns agents | System prompt (~2k tokens) + routing logic per turn |
| 2 | Detective | RED | Codebase analysis, grep call-graphs, find issues | File reads + grep output + structured findings |
| 3 | Forge | GREEN | Implementation only — writes code from converged FID | FID context + code generation |
| 4 | Verifier | AUDIT | Independent double-audit, run tests, check call-graph | Changed files + test output + graph evidence |
| 5 | Recorder | FID | Create, track, archive FIDs. Update CHANGELOG. | FID template + structured output |
| 6 | Thinker | Planning | Deep sequential reasoning for complex problems | Sequential thinking steps (variable) |
| 7 | Scout | Explore | Explores files and code to gather context | File reads + glob output |
| 8 | Researcher | Research | Web search and documentation lookup | Web results + documentation |
| 9 | Scribe | Docs | Session summaries and knowledge capture | Session history + structured output |

### Separation of Duties (Non-Negotiable)

- Forge (GREEN) cannot verify its own work — no bash access
- Verifier (AUDIT) cannot write anything — zero tools
- Detective (RED) cannot implement fixes — no write tools
- Recorder controls FID lifecycle exclusively
- Scout/Researcher are read-only

### The 15 Laws

**Laws 1-4 (Immutable Process — ALWAYS enforced):**

1. Read 0-EOF Before Touch
2. Present Before Act
3. Verify Before Proceed
4. Verify Call-Graph Reachability

**Laws 5-15 (Extended Code — enforced when strict_mode: true):**

5. No pseudo-code, TODOs, or placeholders
6. No type safety shortcuts
7. Search for existing code BEFORE creating new
8. Log intent before coding
9. Generate production-grade documentation
10. Update tracking after every feature
11. Follow discovered patterns EXACTLY
12. Never expose sensitive data in logs/errors
13. Utility-first, universal logic
14. All error paths handled
15. Build stays clean

### Perfection Loop FSM

```text
idle → red → green → audit → complete
                ↓         ↑
                self_correct
```text

### Context Compaction (4-layer system)

1. **Layer 1:** Aggressive compaction for old messages (summarize after N turns)
2. **Layer 2:** Summary generation for compacted messages (preserve key decisions)
3. **Layer 3:** Tool output truncation (truncate large outputs, preserve structure)
4. **Layer 4:** Agent-specific context filtering (each agent gets only what it needs)

### Current File Structure

```text
packages/agent-runtime/src/
├── run.ts                          # Main agent loop
├── run-agent-step/                 # Step execution
│   ├── loop-iteration.ts           # Loop logic
│   └── context-tokens.ts          # Token counting
├── context-compactor.ts           # 4-layer compaction
├── tools/
│   ├── tool-executor/              # Tool execution
│   └── handlers/tool/              # Tool handlers
├── util/
│   ├── echo-compliance.ts         # ECHO compliance tracker
│   └── graph-injection.ts         # Knowledge graph injection
└── main-prompt.ts                 # System prompt assembly

agents/
├── savant/savant.ts               # Orchestrator prompt
├── detective/detective.ts         # Detective prompt
├── forge/forge.ts                 # Forge prompt
├── verifier/verifier.ts           # Verifier prompt (zero tools)
├── recorder/recorder.ts           # Recorder prompt
├── thinker/thinker.ts             # Thinker prompt (sequentialthinking only)
├── scout/scout.ts                 # Scout prompt
├── researcher/researcher.ts       # Researcher prompt
└── scribe/scribe.ts               # Scribe prompt
```text

---

## Research Questions

### 1. Architecture Analysis

- How does ponytail enforce YAGNI? What mechanisms does it use?
- How does caveman achieve 65% token reduction? What compression strategies?
- What is the YAGNI-oneliner concept? How does it differ from ponytail?
- What are the strengths and weaknesses of each approach?

### 2. Token Optimization Opportunities

- How can Savant Code reduce token usage without sacrificing quality?
- How can context compaction be improved?
- How can agent communication be more efficient?
- How can the Thinker agent reason more concisely?
- Which agents consume the most tokens? How can they be optimized?

### 3. YAGNI Enforcement

- How can YAGNI be enforced in a multi-agent system?
- How does YAGNI interact with ECHO Laws 5-15?
- How can YAGNI be tracked and measured?
- How can tech debt from YAGNI decisions be managed?
- How does YAGNI interact with the Perfection Loop?

### 4. Integration with ECHO Protocol

- How does YAGNI enforcement fit into the Perfection Loop?
- How does token optimization interact with separation of duties?
- How can YAGNI be verified by the Verifier agent?
- How can token savings be measured and reported?
- How does this affect the 15 Laws?

### 5. Agent-Specific Optimization

- How can the Detective be more efficient in RED phase?
- How can the Thinker reason more concisely?
- How can the Verifier audit more efficiently?
- How can the Scribe document more concisely?
- How can the Orchestrator route more efficiently?

### 6. Context Compaction

- How can context windows be used more efficiently?
- How can irrelevant context be filtered out?
- How can important context be preserved during compaction?
- How can the 4-layer compaction system be improved?
- How does compaction affect agent state?

### 7. Competitive Analysis

- How does this compare to ponytail's approach?
- How does this compare to caveman's approach?
- What is the unique value proposition for Savant Code?
- What are the implementation risks?

### 8. Measurement and Metrics

- How can token usage be measured per agent?
- How can YAGNI compliance be measured?
- How can quality be maintained while reducing tokens?
- How can savings be reported to the user?
- How can metrics be collected without overhead?

### 9. Implementation Strategy

- What is the minimal viable implementation?
- What are the dependencies and risks?
- What is the phased implementation plan?
- How can the feature be tested incrementally?
- Which files need to be created/modified?

### 10. User Experience

- How does token optimization affect response quality?
- How does YAGNI enforcement affect development speed?
- How can savings be communicated to the user?
- How can the system be configured per-project?

---

## Output Format

Please provide:

1. **Architecture Analysis** — How ponytail, caveman, and YAGNI-oneliner work
2. **Perfection Loop** — RED/GREEN/AUDIT analysis of the concept
3. **Token Optimization Plan** — Specific improvements for Savant Code with file paths
4. **YAGNI Enforcement Design** — How to enforce YAGNI in the multi-agent system
5. **ECHO Integration** — How this fits into the Perfection Loop and Laws
6. **Agent Optimization** — How each agent can be more efficient with specific changes
7. **Measurement System** — How to track token usage and YAGNI compliance
8. **Feature Specification** — Complete spec for implementation with file paths
9. **Implementation Plan** — Phased approach with dependencies and file paths
10. **Competitive Analysis** — How this differs from existing approaches

---

## Implementation Requirements

The research output must include:

1. **Exact file paths** for all new files to create
2. **Exact file paths** for all existing files to modify
3. **Interface definitions** for new tools/functions
4. **Schema changes** if any database modifications are needed
5. **Test strategies** for each component
6. **Integration points** with existing ECHO infrastructure
7. **Migration plan** if any breaking changes are required

---

## Constraints

- Must be compatible with ECHO Protocol v0.2.0
- Must respect separation of duties
- Must maintain code quality (YAGNI ≠ lazy)
- Must be measurable (token usage, YAGNI compliance)
- Must not break existing agent workflows
- Must integrate with the 4-layer context compaction
- Must provide user-visible savings
- Must be configurable per-project
- Must include exact file paths for implementation