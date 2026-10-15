# Deep Research Prompt: Lum1104 Agent Skills Ecosystem

**Purpose:** Analyze Lum1104's entire agent skills ecosystem, run the Perfection Loop on the concepts, and design integration plans for Savant Code's ECHO agents.

---

## Research Sources (All Repos)

### Core Skills (Original)
1. **video-to-skill** — https://github.com/Lum1104/video-to-skill
   - Turn videos and courses into evidence-grounded Agent Skills
   - Python, multimodal AI, evidence grounding
   - The tool that generated ambitious-ai-startup-playbook

2. **auto-debug** — https://github.com/Lum1104/auto-debug
   - Runtime inspection for coding agents
   - Let agents inspect runtime, not guess from source

3. **prove-me-wrong** — https://github.com/Lum1104/prove-me-wrong
   - Hypothesis testing for agents
   - Make agents ask "What would prove me wrong?"

4. **bet-on-it** — https://github.com/Lum1104/bet-on-it
   - Prediction before action
   - Make agents bet on the result before changing code

5. **no-vibes** — https://github.com/Lum1104/no-vibes
   - Proof-based verification
   - Make agents prove it's done, not just say it is

6. **red-button** — https://github.com/Lum1104/red-button
   - Risk management for agents
   - Add a red button for risky changes

7. **archaeologist** — https://github.com/Lum1104/archaeologist
   - Understand why old code exists
   - Make agents dig up why code exists

8. **uni-code** — https://github.com/Lum1104/uni-code
   - Switch between Claude Code, Codex, and beyond
   - Every agent's sessions in one searchable place, served over MCP

### Forks/Reference
9. **code-review-graph** — https://github.com/Lum1104/code-review-graph
   - Local-first code intelligence graph for MCP and CLI
   - Forked from tirth8205/code-review-graph

10. **ambitious-ai-startup-playbook** — https://github.com/Lum1104/ambitious-ai-startup-playbook
    - Evidence-grounded AI founder coach
    - Generated from Sam Altman's Startup School interview

---

## Research Context: ECHO Protocol v0.2.0

**Protocol:** ECHO Protocol v0.2.0 — Savant Agent Bootstrap
**Purpose:** Engineering governance for multi-agent coding

### Agent Roster (10 canonical roles)
| # | Agent | Phase | Responsibility |
|---|-------|-------|----------------|
| 1 | Orchestrator | ALL | Routes work, enforces protocol, spawns agents |
| 2 | Detective | RED | Codebase analysis, grep call-graphs, find issues |
| 3 | Forge | GREEN | Implementation only — writes code from converged FID |
| 4 | Verifier | AUDIT | Independent double-audit, run tests, check call-graph |
| 5 | Adversary | ADVERSARIAL | Refutes Verifier findings, re-audits unevidenced PASSes |
| 6 | Recorder | FID | Create, track, archive FIDs. Update CHANGELOG. |
| 7 | Thinker | Planning | Deep sequential reasoning for complex problems |
| 8 | Scout | Explore | Explores files and code to gather context |
| 9 | Researcher | Research | Web search and documentation lookup |
| 10 | Scribe | Docs | Session summaries and knowledge capture |

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

---

## Research Questions

### 1. Ecosystem Analysis
- How do these 10 repos relate to each other?
- What common patterns exist across the skills?
- How do they address the same problems ECHO solves?
- What is the architecture of the skill system?

### 2. Agent Mapping
- Which skills map to which ECHO agents?
- How can these patterns enhance agent behavior?
- What gaps exist in the current ECHO implementation?

### 3. Evidence Grounding
- How does video-to-skill ground decisions in evidence?
- How can this approach improve FID documentation?
- How can it enhance audit trails?

### 4. Hypothesis Testing
- How does prove-me-wrong work?
- How can this enhance the Adversary agent?
- How can it improve verification quality?

### 5. Prediction Before Action
- How does bet-on-it work?
- How can this enhance the Verifier agent?
- How can it reduce implementation errors?

### 6. Proof-Based Verification
- How does no-vibes work?
- How can this enhance EHEL enforcement?
- How can it improve completion criteria?

### 7. Risk Management
- How does red-button work?
- How can this enhance safety checks?
- How can it prevent risky changes?

### 8. Archaeological Analysis
- How does archaeologist work?
- How can this enhance the Detective agent?
- How can it improve legacy code understanding?

### 9. Runtime Inspection
- How does auto-debug work?
- How can this enhance debugging capabilities?
- How can it improve error diagnosis?

### 10. Multi-Agent Session Management
- How does uni-code work?
- How can this improve agent session continuity?
- How can it enhance MCP integration?

### 11. Skill Generation
- How does video-to-skill work?
- How can this automate skill creation?
- How can it scale knowledge capture?

### 12. Code Intelligence
- How does code-review-graph work?
- How can this enhance the knowledge graph?
- How can it improve code understanding?

### 13. Integration Strategy
- What is the minimal viable integration?
- What are the dependencies and risks?
- What is the phased implementation plan?

---

## Output Format

Please provide:

1. **Ecosystem Analysis** — How all 10 repos relate to each other
2. **Perfection Loop** — RED/GREEN/AUDIT analysis of each concept
3. **Agent Mapping** — Which skills map to which ECHO agents
4. **Evidence Grounding** — How to improve FID documentation
5. **Hypothesis Testing** — How to enhance the Adversary agent
6. **Prediction Before Action** — How to enhance the Verifier agent
7. **Proof-Based Verification** — How to enhance EHEL enforcement
8. **Risk Management** — How to enhance safety checks
9. **Archaeological Analysis** — How to enhance the Detective agent
10. **Runtime Inspection** — How to enhance debugging
11. **Multi-Agent Sessions** — How to improve session continuity
12. **Skill Generation** — How to automate skill creation
13. **Code Intelligence** — How to enhance the knowledge graph
14. **Feature Specifications** — Complete specs for each integration
15. **Implementation Plan** — Phased approach with dependencies
16. **Competitive Analysis** — How this differs from existing approaches

---

## Constraints

- Must be compatible with ECHO Protocol v0.2.0
- Must respect separation of duties
- Must maintain evidence-grounded approach
- Must be measurable (agent behavior improvement)
- Must not break existing agent workflows
- Must integrate with the existing skill system
- Must provide user-visible value
- Must be configurable per-project
- All source repos are MIT licensed
