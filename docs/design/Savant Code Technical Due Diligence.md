# **DEEP RESEARCH BRIEF — Retrofitting Munder Difflin Patterns into Savant-Code**

## **1\. Executive Summary**

This technical due diligence evaluation investigates the integration of architectural patterns from the Munder Difflin
(v0.4.5) repository into the Savant-Code (v0.0.27) ecosystem. Munder Difflin operates as an Electron-based multi-agent
harness that wraps independent command-line interfaces via pseudo-terminals (PTYs), establishing a collaborative "hive"
through shared file-system mailboxes and a WebGL-driven visual office floor1. Conversely, Savant-Code maintains a
native end-to-end model loop governed by the ECHO Protocol and enforced via the ECHO Harness Enforcement Layer (EHEL)4.
The analysis concludes that Munder Difflin's implementations for PTY scraping, event shimming, and provider hooks are
fundamentally obsolete within the Savant context2. Savant already possesses execution authority over its agents.
However, Munder Difflin's conceptual patterns regarding asynchronous peer-to-peer messaging, durable task ledgers,
operator mid-run steering, and spatial observability offer substantial architectural value and warrant extraction1.
The integration of Pixi.js visualization into Savant's forthcoming Tauri desktop shell requires critical adaptation due
to severe Linux WebKitGTK limitations8. Furthermore, memory integration must strictly separate Savant's deterministic
codebase knowledge graph from Munder Difflin's episodic experience memory to mitigate prompt injection vectors2. All
adopted user interface elements will be rigorously re-skinned to the immutable savant-cyberpunk design contract,
explicitly rejecting all parodic or non-commercial assets to ensure enterprise licensing compliance4.

### **Mechanism Verdict Table**

| Mechanism | Verdict | Effort | Risk Profile |
| :---- | :---- | :---- | :---- |
| **Fleet Telemetry & Ledger** | **ADOPT-PATTERN** | Small | Low (Observability) |
| **Agent Experience Memory** | **ADAPT** | Large | Medium (Prompt Injection) |
| **Fleet-Floor Visualization** | **ADAPT** | Large | High (Tauri Linux WebGL) |
| **Operator Mid-Run Steering** | **ADOPT-PATTERN** | Medium | Medium (EHEL State) |
| **Webhook/Chat Ingress** | **ADAPT** | Medium | High (Security/Auth) |
| **Task-Ledger Kanban** | **ADOPT-PATTERN** | Small | Low (State Management) |
| **Interaction-Graph Analytics** | **ADOPT-PATTERN** | Medium | Low (Offline Rendering) |
| **Hard-Allowlist Telemetry** | **ADOPT-PATTERN** | Small | Low (Compliance) |

## **2\. Candidate Dossiers**

### **R1: Fleet Telemetry & Durable Cost Ledger**

* **Mapping**: packages/agent-runtime run-state aggregation.
* **Verdict & Rationale**: **ADOPT-PATTERN**. Savant currently calculates per-call costs, but lacks a durable,
  cross-session SQLite ledger to track aggregate spend against long-term budgets1. Adopting Munder Difflin's durable
  ledger pattern ensures budget breakers function deterministically across restarts.
* **Effort**: Small.
* **FID Title**: FID-2026-0822-001-durable-cost-ledger
* **Scope Bound**: Implement a SQLite-backed append-only cost ledger tracking provider, model, tokens, and USD
  estimates per run.
* **Acceptance Criteria**: Ledger updates atomically post-turn; /goal budgets query the ledger for exhaustion limits;
  ZTAP provenance hashes encompass ledger entries.
* **Modules Touched**: packages/agent-runtime, packages/database.
* **DependsOn**: None.

| Risk Domain | Assessment |
| :---- | :---- |
| Security | Low (Local persistence only, no remote exfiltration) |
| Licensing | Low (Clean-room implementation of general ledger concept) |
| Performance | Low (Async SQLite appends add negligible latency) |
| Maintenance | Low (Utilizes existing database adapter) |

### **R2: Agent Experience Memory**

* **Mapping**: packages/agent-runtime context compactor.
* **Verdict & Rationale**: **ADAPT**. Munder Difflin utilizes a Markdown-first "MemPalace" for episodic recall2. This
  must be adapted to coexist alongside Savant's deterministic code-map knowledge graph4. Memory must track
  *experiences* (e.g., historical API failures), not structural codebase topology.
* **Effort**: Large.
* **FID Title**: FID-2026-0822-002-semantic-experience-memory
* **Scope Bound**: Build a reflection-based episodic memory stream for agents, distinct from the Louvain-clustered
  codebase graph, with dynamic local embedding resolution.
* **Acceptance Criteria**: Memory files are written with ZTAP receipts; configuration allows selecting local embedding
  models without hardcoded slugs; retrieval injects context explicitly labeled as \\<untrusted\\_memory\\>.
* **Modules Touched**: packages/agent-runtime, agents/scribe.
* **DependsOn**: FID-2026-0822-001-durable-cost-ledger.

| Risk Domain | Assessment |
| :---- | :---- |
| Security | High (Prompt injection via poisoned episodic memory retrieval) |
| Licensing | Low (Pattern abstraction from MIT source) |
| Performance | Medium (Local embedding generation overhead) |
| Maintenance | Medium (Requires periodic asynchronous condensation) |

### **R3: Cyberpunk Fleet-Floor Visualization**

* **Mapping**: desktop Tauri shell.
* **Verdict & Rationale**: **ADAPT**. The Pixi.js floor metaphor offers excellent spatial observability but carries
  extreme risk in Tauri due to Linux WebKitGTK WebGL performance8. The pattern must be adapted to support a DOM/SVG
  fallback and strictly enforce savant-cyberpunk tokens, dropping all original art.
* **Effort**: Large.
* **FID Title**: FID-2026-0822-003-cyberpunk-fleet-floor-tauri
* **Scope Bound**: Implement a spatial multi-agent visualization dashboard driven by agent-runtime hooks, featuring
  graceful WebGL-to-SVG degradation for WebKitGTK targets.
* **Acceptance Criteria**: Strictly utilizes WCAG-validated cyberpunk tokens (e.g., \\#18faf9 cyan yields 15.59:1
  contrast against \\#050508); zero LimeZu assets; maintains 60fps on Windows/macOS and stable 30fps DOM fallback on
  Linux.
* **Modules Touched**: desktop, packages/design-systems.
* **DependsOn**: None.

| Risk Domain | Assessment |
| :---- | :---- |
| Security | Low (Read-only visual projection) |
| Licensing | High (Must rigorously exclude LimeZu non-commercial assets) |
| Performance | High (WebKitGTK WebGL context loss and frame drops) |
| Maintenance | High (Maintaining parallel WebGL and DOM rendering pathways) |

### **R4: Operator Mid-Run Steering**

* **Mapping**: EHEL enforcement layer.
* **Verdict & Rationale**: **ADOPT-PATTERN**. Munder Difflin's ability to steer, constrain, or stop an agent
  mid-tool-call is superior to Savant's current post-terminal turn terminator4. Integrating asynchronous interrupts
  provides precise operator control.
* **Effort**: Medium.
* **FID Title**: FID-2026-0822-004-operator-mid-run-steering
* **Scope Bound**: Extend the EHEL PreToolUse hook to accept async operator interrupts, queueing steering instructions
  into the model's observation space.
* **Acceptance Criteria**: Operator can pause execution mid-run; steering commands are appended as system-level
  observations; hard-kill leaves the Perfection Loop FSM in a valid, recoverable state.
* **Modules Touched**: packages/agent-runtime, cli.
* **DependsOn**: None.

| Risk Domain | Assessment |
| :---- | :---- |
| Security | Medium (Interrupt handlers must resist state corruption) |
| Licensing | Low (Standard concurrency pattern) |
| Performance | Low (Minimal event loop overhead) |
| Maintenance | High (Complex interaction with the Perfection Loop FSM) |

### **R5: Webhook/Chat Ingress**

* **Mapping**: desktop Session Gateway.
* **Verdict & Rationale**: **ADAPT**. Munder Difflin allows Slack/webhook triggers to spawn ephemeral workers1.
  Exposing Savant's native runtime to external network ingress requires significant security hardening to prevent
  unauthenticated remote code execution.
* **Effort**: Medium.
* **FID Title**: FID-2026-0822-005-secure-webhook-ingress
* **Scope Bound**: Establish a locally authenticated ingress gateway to accept strictly validated JSON payloads
  triggering predefined goal runs.
* **Acceptance Criteria**: Requests require local cryptographic signatures; execution is bounded by EHEL safe mode;
  all external inputs are sanitized to prevent prompt injection.
* **Modules Touched**: desktop, packages/agent-runtime.
* **DependsOn**: FID-2026-0822-004-operator-mid-run-steering.

| Risk Domain | Assessment |
| :---- | :---- |
| Security | High (Unauthorized host execution, remote prompt injection) |
| Licensing | Low (Standard HTTP gateway) |
| Performance | Low (Event-driven, negligible idle load) |
| Maintenance | Medium (Requires maintaining API contract compatibility) |

### **R6: Task-Ledger Kanban**

* **Mapping**: cli OpenTUI and desktop.
* **Verdict & Rationale**: **ADOPT-PATTERN**. Savant's /goal engine utilizes an event-sourced state machine5. Munder
  Difflin's dependency-aware Kanban is a superior visual projection of this exact state, facilitating dependency
  management1.
* **Effort**: Small.
* **FID Title**: FID-2026-0822-006-goal-ledger-kanban
* **Scope Bound**: Build a multi-view Kanban projection layered over the existing /goal state machine, supporting
  visual dependency tracking.
* **Acceptance Criteria**: Modifying a goal via CLI instantly reflects in the Kanban projection; dependency edges
  strictly prevent agent execution until parent nodes reach a complete state.
* **Modules Touched**: cli, desktop.
* **DependsOn**: None.

| Risk Domain | Assessment |
| :---- | :---- |
| Security | Low (Read-only state projection) |
| Licensing | Low (Standard UI paradigm) |
| Performance | Low (Efficient UI rendering) |
| Maintenance | Low (Decoupled from core runtime logic) |

### **R7: Interaction-Graph Analytical View**

* **Mapping**: desktop MemoryGraph tab.
* **Verdict & Rationale**: **ADOPT-PATTERN**. Visualizing agent-to-agent message edges and topic nodes via
  force-directed SVG provides necessary analytical depth complementary to the spatial floor, effectively mapping the
  "hive mind" interactions1.
* **Effort**: Medium.
* **FID Title**: FID-2026-0822-007-agent-interaction-graph
* **Scope Bound**: Implement an offline force-directed interaction graph mapping agent communication frequency and
  topic clustering from the SQLite ledger.
* **Acceptance Criteria**: Graph computes completely offline; utilizes savant-cyberpunk tokens; scales gracefully
  without physics explosion up to 50 concurrent agents.
* **Modules Touched**: desktop.
* **DependsOn**: FID-2026-0822-003-cyberpunk-fleet-floor-tauri.

| Risk Domain | Assessment |
| :---- | :---- |
| Security | Low (Offline rendering, no external data transmission) |
| Licensing | Low (Custom D3/Sigma.js implementation) |
| Performance | Medium (Physics simulation overhead at high node counts) |
| Maintenance | Low (Stable visualization algorithms) |

### **R8: Telemetry Hard-Allowlist Contract**

* **Mapping**: cli telemetry engine.
* **Verdict & Rationale**: **ADOPT-PATTERN**. Munder Difflin's TELEMETRY.md hard-allowlist contract is best-in-class
  for Bring-Your-Own-Key (BYOK) tools, assuring users through code-enforced limits13. Savant currently enables
  analytics by default1; adopting a strict, verifiable allowlist mitigates enterprise friction.
* **Effort**: Small.
* **FID Title**: FID-2026-0822-008-hard-allowlist-telemetry
* **Scope Bound**: Implement an immutable code-level allowlist filtering all outbound telemetry, paired with a
  canonical documentation contract.
* **Acceptance Criteria**: Event emitter drops any property not explicitly mapped in TELEMETRY.md; fork builds
  automatically strip the transmission key to ensure zero upstream transmission.
* **Modules Touched**: cli, sdk.
* **DependsOn**: None.

| Risk Domain | Assessment |
| :---- | :---- |
| Security | Low (Reduces data exfiltration risk) |
| Licensing | Low (Adoption of documentation pattern) |
| Performance | Low (Minimal string filtering overhead) |
| Maintenance | Low (Requires strict PR reviews for telemetry additions) |

## **3\. Architecture-Fit Analysis**

### **Architecture-Fit Triage**

Munder Difflin functions as a supervisory shell encasing autonomous processes it cannot natively control, relying on
node-pty to intercept standard input/output, applying xterm.js rendering, and utilizing Unix domain socket shims to
scrape execution state1. This "wrapper" topology is inherently brittle for a platform that already possesses deep
integration. Savant-Code controls the model execution loop end-to-end via packages/agent-runtime and regulates state
mathematically through the ECHO Harness Enforcement Layer (EHEL)4.
Consequently, Munder Difflin's wrapping implementation is obsolete by construction. Attempting to port PTY scraping or
transcript parsing would regress Savant's architectural integrity, moving from deterministic state management to
probabilistic output parsing. The pattern extraction must focus entirely on runtime-agnostic state management,
visualizing deterministic hook events rather than scraping terminal streams.
When subjected to the required Five Questions constraint:

> 1. *Does it work for all cases?* Native integration via EHEL hooks captures every tool call deterministically,
>    whereas PTY scraping fails if an agent alters its output formatting.
> 2. *Scales to 1000 agents?* Scraping 1000 PTY instances induces severe CPU bottlenecking; subscribing to 1000
>    lightweight event hooks scales logarithmically.
> 3. *Survives hostile input?* EHEL sanitizes inputs mechanically4; terminal scraping is vulnerable to ANSI escape
>    sequence injection.
> 4. *Maintainable in 2 years?* Native hooks are structurally typed and stable.
> 5. *Sets industry standard?* Direct runtime telemetry is the benchmark for observability.

### **Async Agent Messaging**

Munder Difflin relies on a decentralized, git-backed FIPA-lite mailbox system where agents independently read their
memory and drain file-backed inboxes1. Integrating this directly into Savant poses a governance risk. If Savant adopts
peer-to-peer (P2P) messaging, it risks circumventing the ECHO Protocol's strict separation of duties (e.g., allowing a
Forge implementation agent to bypass the Verifier by colluding directly with the Detective)6.
Assessing production precedents reveals that while AutoGen and CAMEL embrace P2P architectures, they suffer from
unbounded conversation loops requiring rigid max\\_consecutive\\_auto\\_reply thresholds and cycle detection
heuristics15. Conversely, frameworks like LangGraph Supervisor enforce a central routing architecture where
communication flows hierarchically18.
Integrating asynchronous mailboxes into Savant requires maintaining the Orchestrator's role as the central supervisor.
We must ADAPT the mailbox pattern to be strictly parent-mediated. To prevent orphan-mail livelocks and ping-pong
failures, the architecture will implement hop caps and enforce ECHO's existing 10-iteration limit on inter-agent
message chains, utilizing wake watchdogs to ensure message delivery without abandoning central authority.

### **Memory-Stack Merge**

Munder Difflin's "MemPalace" utilizes episodic, markdown-first files mined for semantic recall to grant agents
long-term persistence1. This mirrors the reflective architecture proposed in Stanford's Generative Agents research,
where a memory stream synthesizes discrete observations into higher-level, retrievable reflections10.
Savant already operates a Louvain-clustered knowledge-graph mapping the deterministic topology of the codebase4. These
stores serve orthogonal purposes and must remain distinct. Episodic memory handles *agent experiences* (e.g.,
historical API failures, previously attempted architectural designs), whereas the code-map handles structural reality.
Crucially, integrating episodic memory introduces a severe prompt injection vulnerability. If a malicious actor alters
a file to include hostile instructions, and an agent commits that experience to memory, future retrievals could execute
the payload. To neutralize this, retrieval must function as context-injection, strictly sandboxed within
\\<untrusted\\_memory\\> XML tags to prevent malicious payloads from overriding system prompts. Furthermore, every
memory write must be cryptographically signed via the Zero-Trust Agentic Provenance (ZTAP) ledger to ensure
traceability4. Embedding models must resolve dynamically via the active provider configuration, adhering to Savant's
prohibition on hardcoded slugs.

### **Floor Visualization in Tauri**

The translation of a WebGL/Pixi.js visualization into a Tauri desktop shell presents severe cross-platform
discrepancies. While Windows (WebView2) and macOS (WKWebView) handle hardware acceleration gracefully, Linux
deployments relying on WebKitGTK exhibit catastrophic WebGL performance, frequent context loss, and unacceptable memory
bloat8. Operating WebKitGTK has been likened to running "an emulator inside an emulator" for WebGL operations8.
The architectural adaptation requires a graceful degradation pathway. If WebGL context creation fails or WebKitGTK is
detected, the dashboard must seamlessly fall back to a DOM/SVG-based tile renderer, capping updates to 30fps to
preserve system resources.
Furthermore, Munder Difflin's Earthbound/SNES aesthetic directly violates the immutable savant-cyberpunk design
contract2. The visualization must be aggressively re-skinned using strict tokens. Analytical validation of the
cyberpunk palette confirms its viability: utilizing the primary cyan (\\#18faf9) over the \\#050508 background yields
an optimal 15.59:1 WCAG contrast ratio, well above the AAA requirement20. The event schema driving this visualization
must remain minimal, consuming { agentId, role, state, activeTool, timestamp } directly from agent-runtime lifecycle
hooks, avoiding the gimmick of heavy physics calculations where informational clarity is paramount.

### **Safety Parity**

Munder Difflin's "steer → constrain → stop" ladder provides granular, mid-run control over agent execution1. Savant
currently relies on pre-tool EHEL gating and post-terminal turn terminators4.
The residual gap involves mid-tool-call intervention. If an agent initiates a recursive codebase search that begins
consuming excessive tokens, the Savant operator currently cannot inject a steering prompt ("constrain") without
hard-killing the entire process, which subsequently corrupts the Perfection Loop FSM. Best-in-class harnesses implement
asynchronous interrupt signals that gracefully halt the current tool execution, commit the partial state, and inject
the operator's steering instruction into the LLM's subsequent observation window. Savant must adopt this circuit-breaker
ladder natively into the EHEL PreToolUse hooks, integrating it with the /goal durable budget to trigger automatic pauses
upon threshold exhaustion, ensuring graceful degradation rather than catastrophic termination.

## **4\. Research Answers**

### **Telemetry Posture**

Munder Difflin utilizes a hard-allowlist anonymous event set powered by PostHog, explicitly dropping unmapped
properties and disabling collection entirely on fork builds13. This creates a verifiable contract documented in
TELEMETRY.md. Savant-Code currently enables remote analytics by default, which can be toggled via /telemetry disable1.
For BYOK (Bring Your Own Key) developer tools operating on proprietary, highly sensitive codebases, opt-out telemetry
introduces significant friction during enterprise security audits. However, the Savant-Free variant operates on an
ad-supported model4, rendering a complete "don't-collect" stance commercially unviable for the free tier.
The proposed architecture introduces a bifurcated telemetry posture:

> 1. **Universal Contract**: Adopt Munder Difflin's code-enforced, immutable allowlist (TELEMETRY.md mapping) across
>    both products.
> 2. **Paid Tier**: In the paid Savant-Code CLI, transition telemetry to an **Opt-In** model, respecting enterprise
>    expectations of default absolute privacy.
> 3. **Free Tier**: In Savant-Free, maintain the **Opt-Out** posture, but guarantee cryptographic anonymity (e.g.,
>    salting and hashing project paths locally) to protect intellectual property while sustaining the commercial
>    metrics required for the tier.

### **Licensing Landmines**

While the Munder Difflin repository is MIT-licensed, permitting commercial reuse with standard attribution1,
significant legal and compliance landmines exist:

> 1. **LimeZu Tilesets**: The pixel art utilized in Munder Difflin originates from LimeZu's free tier, which strictly
>    prohibits commercial redistribution11. **Confirmation**: No LimeZu art, nor any derivative thereof, may be shipped
>    in Savant-Code or Savant-Free. All visual assets must be procedurally generated or originally authored in-house.
> 2. **IP / Parody Caution**: Munder Difflin acts as an "affectionate parody" of NBC's *The Office* (e.g., the GOD
>    agent is explicitly named "Michael")2. Incorporating these character names, likenesses, or thematic elements into
>    a commercial product invites immediate trademark infringement litigation.
> 3. **Compliance Strategy**: Adherence to the "take patterns, not ports" discipline is paramount. Savant will adopt
>    the spatial dashboard concept but apply its own ECHO agent roster (Orchestrator, Detective, Forge) and the
>    savant-cyberpunk UI tokens. A standard MIT NOTICE file must be appended acknowledging Chaitanya Giri for the
>    underlying architectural patterns.

### **Sequencing**

To integrate these mechanisms without disrupting Savant's open work queue (which currently prioritizes the desktop
Tauri suite and /compact validation)4, the milestones must be sequenced as a dependency-ordered, acyclic graph,
prioritizing non-blocking architectural foundations first. The detailed integration sequence is mapped in the Milestone
Roadmap section below. Unblocking relationships center on establishing the durable SQLite ledger and EHEL steering
modifications before any visual projections can be wired in the Tauri shell.

## **5\. Anti-Goals Confirmation**

The following anti-goals were pre-ruled for rejection. Evidence validates these assertions.

* **A1: Stop-hook block-decision autonomy loops.**
  * **AGREE**. Savant's core lesson that "autonomy is a driver problem" holds true. Reverting to external stop-hooks
    contradicts the native EHEL design, which mathematically gates progression.
* **A2: CLI-wrapping substrate (node-pty, transcript scraping).**
  * **AGREE**. Savant owns its execution loop natively via packages/agent-runtime. Wrapping CLIs is an obsolete
    implementation detail optimized for Munder Difflin's distinct constraints.
* **A3: Electron \\+ node-pty stack.**
  * **AGREE**. Tauri is already confirmed for Savant's desktop shell4, offering a substantially lighter memory
    footprint and a superior security posture by avoiding a bundled Chromium runtime21.
* **A4: Cream/ink pixel design language \\+ retro pixel fonts.**
  * **AGREE**. The savant-cyberpunk UI contract is hash-pinned and immutable. All visual integrations will strictly
    utilize the designated cyan, green, and dark surface tokens.
* **A5: LimeZu tilesets/sprite packs.**
  * **AGREE**. Commercial licensing restrictions make these assets legally radioactive for a paid SDK and CLI
    platform11.
* **A6: Embedded IDE (Monaco).**
  * **AGREE**. Re-implementing a code editor duplicates the operator's existing environment (VS Code, Neovim) and adds
    unnecessary bloat without corresponding utility.
* **A7: The MD knowledge-graph core as an engine.**
  * **AGREE**. Savant's Louvain-clustered deterministic graph4 is vastly superior for structural codebase topology.
    Munder Difflin's memory paradigm is only useful for *episodic* recall.
* **A8: PostHog-cloud analytics as shipped.**
  * **CHALLENGE (with nuance)**. While the exact PostHog integration is rejected in favor of Savant's existing
    systems, the *pattern* of a hard-allowlist contract (R8) is vastly superior to Savant's current implementation and
    should be adopted to refine Savant's telemetry, even if the backend destination differs.
* **A9: Hardcoded model/embedding defaults.**
  * **AGREE**. All models, including those used for semantic memory indexing, must strictly resolve via the operator's
    active UI selection to prevent hidden API spend and enforce deterministic behavior.
* **A10: Voice realtime, hire deep-links, cross-CLI skills browser.**
  * **AGREE**. These represent feature creep completely orthogonal to the mission of an engineering-focused,
    ECHO-compliant AI platform.

## **6\\. Milestone Roadmap**

The implementation roadmap is structured as an acyclic dependency graph, executing the smallest architectural
prerequisites first to ensure zero collision with the open Tauri FIDs and pending quality-ratchet remediations.

**Milestone Alpha: Core Safety & Observability**

1. **FID-2026-0822-008 (Allowlist Telemetry)**: Immediate implementation. Modifies existing CLI logic with zero
   downstream dependencies. Clears enterprise compliance friction immediately.
2. **FID-2026-0822-001 (Cost Ledger)**: Establishes the asynchronous SQLite metrics tracking required by the budget
   breakers.
3. **FID-2026-0822-004 (Mid-Run Steering)**: Hardens EHEL to support async interrupts and budget exhaustion pauses.
   *Collision Check: Integrates cleanly with the paused quality-ratchet remediation by relying entirely on the
   PreToolUse hook.*

**Milestone Beta: Data Projection & State**

4. **FID-2026-0822-006 (Kanban Ledger)**: Maps directly to the existing /goal state machine, structuring the JSON
   representations required for the visual layers.
5. **FID-2026-0822-002 (Semantic Memory)**: Connects ZTAP provenance to episodic reflections, leveraging the SQLite
   infrastructure established in Milestone Alpha.

**Milestone Gamma: Desktop & External Surfaces (High Complexity)**

6. **FID-2026-0822-003 (Fleet-Floor Tauri)**: Tauri integration dependent on Alpha/Beta state engines. *Collision
   Check: Must execute concurrently with the 5 open Tauri desktop FIDs, embedding as a distinct React component. Must
   enforce the SVG fallback for WebKitGTK.*
7. **FID-2026-0822-007 (Interaction Graph)**: Secondary offline visualization layered over the fleet-floor.
8. **FID-2026-0822-005 (Webhook Ingress)**: Final integration; requires absolute stability in Alpha's EHEL steering to
   safely pause and audit malicious external triggers.

## **7\\. Operator Decision Points**

Before authorizing the transition of these recommendations into executing Feature Implementation Documents (FIDs),
the Orchestrator and project maintainers must explicitly rule on the following architectural forks:

> 1. **Linux Visualization Support Paradigm**: Given the severe WebKitGTK WebGL limitations identified in Tauri8, does
>    the maintainer approve the significant engineering overhead of building a parallel DOM/SVG fallback for the
>    Fleet-Floor visualization? Alternatively, should Linux targets receive a purely analytical dashboard (Kanban and
>    Interaction Graph only) devoid of the spatial metaphor to minimize maintenance burden?
> 2. **Telemetry Posture in Savant-Free**: Does the maintainer approve the bifurcated telemetry proposal (Opt-In for
>    the paid CLI, Opt-Out for the ad-supported Savant-Free)? Or must the hard-allowlist enforce a universal Opt-In
>    policy across both tiers, knowingly sacrificing analytics volume necessary for the free tier's commercial
>    viability?
> 3. **Ingress Authentication Model**: For the Webhook/Chat Ingress (FID-2026-0822-005), will Savant rely exclusively
>    on local HMAC validation of incoming payloads, or mandate a cloud-brokered relay (introducing infrastructure
>    dependencies) to bypass complex local firewall configurations and NAT traversal issues?
> 4. **Episodic Memory Pruning Constraints**: As the Semantic Experience Memory scales, what is the approved policy
>    for condensing stale episodic memories? Should the compactor summarize historical episodes automatically in the
>    background, or strictly await an explicit user /compact trigger to prevent unintended context loss?

## **8\\. Source Appendix**

* protocol.config.yaml \[cite: 4\]
* Savant-Code README.md \[cite: 1\]
* AGENTS.md \[cite: 22\]
* ARCHITECTURE.md \[cite: 5\]
* ECHO.md \[cite: 6\]
* Munder Difflin Repository README.md \[cite: 2\]
* Munder Difflin TELEMETRY.md \[cite: 13\]
* Munder Difflin HIVE.md \[cite: 2, 14, 23\]
* LangGraph Multi-Agent Systems Documentation18
* AutoGen Conversation Limits & Cycle Detection15
* Generative Agents: Interactive Simulacra of Human Behavior (Park et al.)10
* Tauri WebGL Performance & Linux WebKitGTK Issues8
* LimeZu Licensing Restrictions11
* Python WCAG Contrast Calculation Output20

### **Works cited**

1. README.md
2. chaitanyagiri/munder-difflin: local multi-agent harness - GitHub (URL [2])
3. munder-difflin: 终端多Agent 编排框架 - 前端面试题与学习路线 (URL [3])
4. protocol.config.yaml
5. ARCHITECTURE.md
6. ECHO.md
7. Munder Difflin: The Open-Source Multi-Agent Harness With 2500+ GitHub Stars (CoddyKit) (URL [7])
8. Deno Desktop - Hacker News (URL [8])
9. MeshBuilder Not Work With Custom Mesh On Ubuntu18 Tauri Webkit - Babylon.js Forum (URL [9])
10. \[2304.03442\] Generative Agents: Interactive Simulacra of Human Behavior - arXiv (URL [10])
11. Modern Interiors - RPG Tileset \[16X16\] by LimeZu - Itch.io comments (URL [11])
12. munder-difflin - AI Agents on GitHub | SkillsLLM (URL [12])
13. TELEMETRY.md - chaitanyagiri/munder-difflin · GitHub (URL [13])
14. ai-company/HIVE.md at main · soybrian/ai-company · GitHub (URL [14])
15. agentchat.conversable\\_agent | AutoGen 0.2 (URL [15])
16. How To Prevent Infinite Loops in Multi-Agent Systems - NeuralTrust AI (URL [16])
17. Terminating Conversations Between Agents | AutoGen 0.2 (URL [17])
18. langgraph\\_supervisor - LangChain Reference (URL [18])
19. Generative Agents: Interactive Simulacra of Human Behavior - alphaXiv (URL [19])
20. unknown\\_url (URL [20])
21. Electron vs Tauri 2026: Bundle Size, RAM, Security and Team Fit — PkgPulse Guides (URL [21])
22. AGENTS.md
23. Optional memory backend: Peon · Issue \\#166 · chaitanyagiri/munder-difflin - GitHub (URL [23])
24. langchain/langgraph-supervisor (JavaScript reference) (URL [24])
25. LangGraph Multi-Agent Swarm - LangChain Reference (URL [25])
26. Generative Agents ... Summary - Portkey (URL [26])
27. Tauri 2.0 stable has just been released - r/rust (URL [27])

Full URLs:

```text
[2] https://github.com/chaitanyagiri/munder-difflin
[3] https://feinterview.poetries.top/ai-monitor/news/chaitanyagiri-munder-difflin
[7] https://www.coddykit.com/pages/blog-detail?id=513014&slug=munder-difflin-the-open-source-multi-agent-harness-with-2-500-github-stars-that-
[8] https://news.ycombinator.com/item?id=48626137
[9] https://forum.babylonjs.com/t/meshbuilder-not-work-with-custom-mesh-on-ubuntu18-tauri-webkit/47800
[10] https://ar5iv.labs.arxiv.org/html/2304.03442
[11] https://limezu.itch.io/moderninteriors/comments?before=263
[12] https://skillsllm.com/skill/munder-difflin
[13] https://github.com/chaitanyagiri/munder-difflin/blob/main/TELEMETRY.md
[14] https://github.com/soybrian/ai-company/blob/main/HIVE.md
[15] https://microsoft.github.io/autogen/0.2/docs/reference/agentchat/conversable_agent/
[16] https://neuraltrust.ai/blog/a2a-loop
[17] https://microsoft.github.io/autogen/0.2/docs/tutorial/chat-termination/
[18] https://reference.langchain.com/python/langgraph-supervisor
[19] https://www.alphaxiv.org/abs/2304.03442
[20] http://docs.google.com/unknown_url
[21] https://www.pkgpulse.com/guides/electron-vs-tauri-2026
[23] https://github.com/chaitanyagiri/munder-difflin/issues/166
[24] https://reference.langchain.com/javascript/langchain-langgraph-supervisor
[25] https://reference.langchain.com/python/langgraph-swarm
[26] https://portkey.ai/blog/generative-agents-interactive-simulacra-of-human-behavior-summary/
[27] https://www.reddit.com/r/rust/comments/1fukj52/tauri_20_stable_has_just_been_released/
```
