# Deep Research Prompt: Codebase Knowledge Graph Feature for Savant Code

**Purpose:** Analyze Understand-Anything, run the Perfection Loop on the concept, and design a superior implementation
for Savant Code.

---

## Context: Savant Code Architecture

Savant Code is a terminal-native multi-agent AI coding assistant with 9 specialized agents:

### Agent Roster

| Agent | Phase | Role |
|-------|-------|------|
| Savant (Orchestrator) | ALL | Routes work, enforces protocol, spawns agents |
| Detective | RED | Codebase analysis, grep call-graphs, find issues |
| Forge | GREEN | Implements code changes from converged plan |
| Verifier | AUDIT | Independent double-audit, run tests, check call-graph |
| Recorder | FID | Manages FID lifecycle (create, track, archive) |
| Thinker | Planning | Deep sequential reasoning for complex problems |
| Scout | Explore | Explores files and code to gather context |
| Researcher | Research | Web search and documentation lookup |
| Scribe | Docs | Session summaries and knowledge capture |

### Perfection Loop (ECHO Protocol)

Every code change follows this Finite State Machine:
```text
idle → red → green → audit → complete
                ↓         ↑
                self_correct
```text

- **RED:** Identify ALL failures and issues with evidence
- **GREEN:** Fix issues with MINIMAL changes
- **AUDIT:** Independent verification via Verifier agent
- **SELF-CORRECT:** Address audit findings
- **COMPLETE:** Document results, loop ends

### Existing Features

- **Scout agent:** Explores files via glob/read_files/list_directory
- **Thinker agent:** Deep reasoning via sequentialthinking tool
- **Verifier agent:** Independent code review, test execution, call-graph verification
- **Knowledge system:** knowledge.md files for project conventions
- **HTML export:** /export writes branded, self-contained HTML reports
- **Code search:** code_search tool for grep-like pattern matching
- **FID system:** Feature Implementation Documents for tracking work

---

## Research Source

### Understand-Anything

- **Repository:** https://github.com/Egonex-AI/Understand-Anything
- **Stars:** 77.7k
- **Concept:** Turn any codebase into an interactive knowledge graph
- **Technology:** Static analysis + multi-agent LLM processing
- **Use cases:** Onboarding, AI agent context, refactoring, diff impact
- **Pain points:** Token cost (30 min, burns tokens), structure without meaning, no flow understanding
- **Key quote:** "AI coding tools are only as good as the context we give them. If the agent sees three files, it's just
- going to guess. If it has a structured map of the system with domains, flows, dependencies, and actual explanations,
- it has a better chance of making the right change in the first place."

---

## Research Questions

### 1. Architecture Analysis

- How does Understand-Anything build its knowledge graph?
- What static analysis does it use?
- How does it handle multi-agent LLM processing?
- What is the token cost structure?

### 2. Feature Gap Analysis

- What does Understand-Anything do well?
- What does it do poorly?
- What features are missing?
- What would make it better?

### 3. Optimization Opportunities

- How can we reduce token cost?
- How can we make it faster?
- How can we make it more accurate?
- How can we make it more useful for AI agents?

### 4. Integration with Savant Code

- How would this integrate with the Scout agent?
- How would this integrate with the Thinker agent?
- How would this integrate with the Verifier agent?
- How would this integrate with the Perfection Loop?

### 5. Branding and Export

- How can we brand this as a Savant Code feature?
- How can we use the same export system (/export)?
- How can we make the output look professional?
- How can we make it shareable?

### 6. Perfection Loop Analysis

- What would the RED phase find?
- What would the GREEN phase propose?
- What would the AUDIT phase verify?
- What would the SELF-CORRECT phase fix?

### 7. Competitive Advantage

- How is this different from Understand-Anything?
- How is this different from Engraphis (local-first memory for coding agents)?
- How is this different from other knowledge graph tools?
- What is our unique value proposition?

### 8. Implementation Strategy

- What is the minimal viable implementation?
- What is the full implementation?
- What are the dependencies?
- What is the timeline?

### 9. Token Optimization

- How can we build the graph incrementally?
- How can we cache graph updates?
- How can we reduce LLM calls?
- How can we use local models for graph building?

### 10. User Experience

- How does the user interact with the graph?
- How does the graph update as code changes?
- How does the graph integrate with the CLI?
- How does the graph integrate with the HTML export?

---

## Output Format

Please provide:

1. **Architecture Analysis** — How Understand-Anything works, what it does well, what it does poorly
2. **Perfection Loop** — RED/GREEN/AUDIT analysis of the concept
3. **Optimization Plan** — Specific improvements to reduce cost, increase speed, improve accuracy
4. **Savant Code Integration** — How this integrates with Scout, Thinker, Verifier, and the Perfection Loop
5. **Feature Spec** — Complete specification for a Savant Code knowledge graph feature
6. **Export Integration** — How to use the same branded HTML export system
7. **Implementation Plan** — Phased approach with dependencies and timeline
8. **Competitive Analysis** — How this differs from Understand-Anything, Engraphis, and other tools

---

## Constraints

- Must work with Savant Code's existing 9-agent system
- Must be compatible with ECHO Protocol (Perfection Loop, FIDs, separation of duties)
- Must be zero-cost (no paid dependencies)
- Must be MIT/Apache 2.0 compatible
- Must reduce token cost compared to Understand-Anything (30 min, burns tokens)
- Must integrate with the existing /export system (branded HTML reports)
- Must be branded as a Savant Code feature
- Must provide value for AI agents (not just humans)
- Must build incrementally (not all at once)
- Must cache updates (not rebuild from scratch)

---

## Key Insight

The core problem Understand-Anything solves is giving AI agents structured architecture knowledge instead of raw file
dumps. Our solution should:

1. **Build incrementally** — Scout discovers relationships during RED phase, graph updates as code changes
2. **Cache updates** — Graph persists across sessions, only updates changed files
3. **Use local models** — Graph building uses local inference (Ollama), not expensive cloud models
4. **Integrate with agents** — Scout builds, Thinker reasons, Verifier validates
5. **Export as branded HTML** — Same as /export, professional and shareable
6. **Reduce token cost** — Graph-based memory reduces context window usage