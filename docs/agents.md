<!-- markdownlint-disable MD013 -->
# Agent Roster

**10 specialized agents. Each with a distinct role. Each with restricted tools.**

Savant Code doesn't use a single model guessing at your code. It deploys a team of specialized agents where each one has a specific role and limited permissions. This isn't just organization — it's security. No agent can do more damage than its role allows.

---

## The 10 Agents

### Savant (Orchestrator)

**Phase:** ALL
**Role:** Routes work, enforces protocol, spawns agents

The Orchestrator is the central coordinator. It receives user requests, assesses complexity, and decides which agents to spawn. It enforces the ECHO Protocol and routes work through the appropriate workflow; complex changes use the Perfection Loop.

**Capabilities:**

- Spawns all other agents
- Manages FSM transitions
- Enforces tool permissions
- Present before act (Law 2)

---

### Detective (RED Phase)

**Phase:** RED
**Role:** Discovers bugs and issues with evidence before code is written

The Detective runs code search queries across the codebase to find evidence of problems. It catalogs findings with file paths, line numbers, and grep output.

**Capabilities:**

- Read-only access to codebase
- Grep call-graphs
- Knowledge-graph queries — `query_blast_radius`, `query_node_edges`,
  `query_domain_clusters` (FID-2026-0806-002)
- Catalog evidence with file paths
- Cannot write code

**Why read-only:** If the Detective could write code, it might "fix" issues instead of reporting them. The separation ensures honest discovery.

---

### Forge (GREEN Phase)

**Phase:** GREEN
**Role:** Implements code changes from a converged plan

The Forge writes code based on the converged FID specification. It follows the plan exactly and cannot deviate.

**Capabilities:**

- Write access to codebase
- Implement changes per FID spec
- Cannot run tests
- Cannot verify its own work

**Why no test access:** If Forge could run tests, it might "fix" issues silently instead of reporting them. The Verifier handles verification independently.

---

### Verifier (AUDIT Phase)

**Phase:** AUDIT
**Role:** Independent double-audit after implementation

The Verifier independently audits the implementation. It checks type safety, error handling, call-graph reachability, and pattern compliance.

**Capabilities:**

- Read-only access (zero tools by contract — reads via message history)
- Check call-graph reachability (harness-computed evidence is injected into
  its message history)
- Requests test runs through the Orchestrator
- Cannot write code

**Why read-only:** The Verifier is completely read-only — `toolNames: []`.
It cannot modify anything it's reviewing. This is the strongest possible
audit position.

---

### Thinker (Planning Phase)

**Phase:** Planning
**Role:** Deep sequential reasoning for complex problems

The Thinker uses the `sequentialthinking` tool to reason through complex problems. It accumulates typed reasoning steps and converges to a non-null final artifact.

**Capabilities:**

- Sequential thinking tool
- Deep reasoning
- Cannot write code
- Cannot run tests

**Why no code access:** If the Thinker could write code, it might implement its reasoning instead of just reasoning. The separation ensures pure analysis.

---

### Scout (Explore Phase)

**Phase:** Explore
**Role:** Explores codebases to gather context

The Scout uses file system tools to explore the codebase and gather context for other agents.

**Capabilities:**

- Glob patterns
- List directories
- Read files and subtrees
- Knowledge-graph queries — `query_blast_radius`, `query_node_edges`,
  `query_domain_clusters` (FID-2026-0806-002)
- Cannot write code

**Why read-only:** If the Scout could write code, it might "fix" things it finds while exploring. The separation ensures honest exploration.

---

### Researcher (Research Phase)

**Phase:** Research
**Role:** Web search, scholarly literature, and documentation lookup

The Researcher gathers external knowledge through web search, scholarly literature,
and documentation lookup. Its web persona uses the public Scholars Reading List
MCP service to search papers, fetch records, find similar papers, and explore
shared citation neighbourhoods. It verifies paper citations against fetched
records and falls back to web research when the literature service is unavailable.

**Capabilities:**

- Web search
- Scholarly literature search and paper lookup through `scholars-search` MCP
- Documentation lookup
- Deep research tool
- Cannot write code

**Why no code access:** If the Researcher could write code, it might implement what it finds instead of just reporting. The separation ensures honest research.

---

### Recorder (FID Lifecycle)

**Phase:** FID
**Role:** Manages FID creation, tracking, and archiving

The Recorder manages the FID lifecycle: creation, tracking, archiving, and CHANGELOG updates.

**Capabilities:**

- Write FID documents
- Update CHANGELOG
- Archive completed FIDs
- Cannot use str_replace

**Why no str_replace:** If the Recorder could use str_replace, it might corrupt FIDs with partial updates. The separation ensures complete file writes.

---

### Scribe (Documentation Phase)

**Phase:** Documentation
**Role:** Session summaries and knowledge capture

The Scribe captures session summaries, updates LESSONS.md, and writes knowledge files.

**Capabilities:**

- Write session summaries
- Update LESSONS.md
- Write knowledge files
- Cannot use str_replace

**Why no str_replace:** Same as Recorder — prevents partial updates that could corrupt documentation.

---

### Adversary (ADVERSARIAL Phase)

**Phase:** ADVERSARIAL
**Role:** Meta-verification — audits the Verifier (FID-2026-0805-004)

The Adversary is a fresh, read-only agent that runs after AUDIT. It refutes every
Verifier FAIL (CONFIRMED / REFUTED / ADJUSTED with basis), re-audits every
unevidenced PASS, resolves every `file:line` citation against the code, re-rates
severities, splits half-provable claims, and checks for omission. Its verdicts
override the Verifier's.

**Capabilities:**

- Read files and search the codebase (read-only)
- Resolve and refute citations
- Re-rate severity of findings
- Cannot write code, cannot edit, cannot run bash

**Why no write tools:** The Adversary must audit with its own evidence, never by
changing the code it is auditing.

---

## Permission Matrix

| Agent | Can Write Code | Can Run Tests | Can Spawn Others |
|-------|:-:|:-:|:-:|
| **Savant** | ✅ | ✅ | ✅ |
| **Detective** | ❌ | ❌ | ❌ |
| **Forge** | ✅ | ❌ | ❌ |
| **Verifier** | ❌ | ❌ (requests via Orchestrator) | ❌ |
| **Thinker** | ❌ | ❌ | ❌ |
| **Scout** | ❌ | ❌ | ❌ |
| **Researcher** | ❌ | ❌ | ❌ |
| **Recorder** | ✅ (FIDs only) | ❌ | ❌ |
| **Scribe** | ✅ (docs only) | ❌ | ❌ |
| **Adversary** | ❌ | ❌ | ❌ |

---

## The Key Insight

**No single agent can both write code AND verify it.**

- The implementer (Forge) has no test access
- The auditor (Verifier) has no write access
- The meta-auditor (Adversary) audits the auditor — read-only, verdicts override
- The reasoner (Thinker) has no code access

This structural constraint makes it impossible for an agent to convince itself its own code is correct.

---

## Learn More

- [ECHO Protocol](echo-protocol.md) — The governance system
- [Features](features.md) — Key features of Savant Code
- [GitHub](https://github.com/savant0x/savant-code) — Source code
