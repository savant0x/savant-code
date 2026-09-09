<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# **Architectural Blueprint: Retrofitting Agent-Skills into Savant-Code**

The integration of Addy Osmani’s production-grade agent-skills framework into the Savant-Code multi-agent AI coding harness represents a convergence of two powerful paradigms: human-engineered process heuristics and strict, mechanically governed state machine execution. The agent-skills repository, widely recognized for providing 24 battle-tested workflows, utilizes structured anti-rationalization tables, explicit verification requirements, and progressive disclosure to force AI agents to mimic the rigorous behaviors of senior software engineers1. Conversely, Savant-Code is built upon a rigid, deterministic foundation governed by the ECHO Protocol v0.2.0, employing a 10-agent roster regulated by an immutable 15-law framework known as the ECHO Harness Enforcement Layer (EHEL)4. Within Savant-Code, code implementation is absolutely prevented prior to the convergence of a Feature Implementation Document (FID)4.  
This comprehensive research report serves as the definitive architectural blueprint for retrofitting the Agent Skills ecosystem into the Savant-Code repository. The analysis maps the slash command lifecycle to the ECHO Perfection Loop, details the context-activation design utilizing the existing Zustand state management and Thinker/Detective contracts, merges the frictionless /build auto workflow with Savant-Code's Auto Drive (FID-001..010) infrastructure, and formalizes a framework to translate prose-based skill verification into strict EHEL mechanical gates. Furthermore, it details the disposition of all 24 skills, outlining adaptation strategies to ensure full alignment with the United States-based Savant-Code project structure.

## **Command Mapping Matrix and Perfection Loop Alignment**

The agent-skills framework defines eight core slash commands mapping to the Software Development Life Cycle (SDLC): /spec, /plan, /build, /test, /review, /webperf, /code-simplify, and /ship2. Savant-Code, however, does not operate on a simple linear SDLC; it relies on a rigid Finite State Machine (FSM) known as the Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL → SELF\_CORRECT → COMPLETE → IMPLEMENT), paired with existing CLI commands such as /interview, /goal, /auto-drive, and /verify4.  
To merge these models without violating ECHO Law 2 (Present Before Act) or the FID-Bound Execution mandate, the eight Agent Skills commands must be implemented either as aliases to existing Savant-Code CLI commands or as explicit new macros that orchestrate FSM phase transitions. The architectural challenge lies in ensuring that invoking an agent-skills command does not bypass the mandatory FID documentation phase.

### **Execution Scope and Macro Mapping**

The following matrix establishes the exact relationship between the Agent Skills commands, the Savant-Code commands residing in cli/src/commands/command-registry.ts7, and the corresponding phase within the Perfection Loop FSM.

| Agent Skills Command | Savant-Code Equivalent / Alias | Perfection Loop Phase Mapping | Required FID / Infrastructure Action |
| :---- | :---- | :---- | :---- |
| /spec | /interview (existing) | Pre-Loop / RED | Spawns the Thinker to execute the spec-driven-development8 and interview-me9 skills. The Recorder subsequently drafts the master FID based on the resulting specification. |
| /plan | /plan (new macro) | RED → GREEN | Executes planning-and-task-breakdown10. The Thinker analyzes the master spec, and the Recorder is mechanically forced to decompose it into child FIDs7, setting statuses to created. |
| /build | /build (new macro) | GREEN → IMPLEMENT | Delegates implementation to the Forge agent (or Orchestrator in Hybrid mode) utilizing incremental-implementation11. EHEL enforces Law 1 (Read 0-EOF) compliance before any file writes4. |
| /test | /verify (extended) | IMPLEMENT → AUDIT | Invokes the Verifier agent utilizing test-driven-development11. Mechanically backed by Law 3 (Verify Before Proceed), ensuring no broken builds are permitted4. |
| /review | /review (existing) | AUDIT → ADVERSARIAL | Orchestrates the code-review-and-quality skill12. The Verifier conducts the primary audit, followed by the Adversary conducting a meta-audit to refute or confirm findings4. |
| /webperf | /webperf (new command) | AUDIT (Specialist) | Injects performance-optimization14 into the Verifier agent's context. Triggers Core Web Vitals checks. Requires the configuration of a web-performance-auditor persona15. |
| /code-simplify | /code-simplify (new macro) | SELF\_CORRECT | Routes evaluation to the Forge via the Thinker using code-simplification16. Enforces Chesterton’s Fence, demanding the agent explicitly state a code block's purpose before permitting its removal17. |
| /ship | /export \+ release:public | COMPLETE | Executes shipping-and-launch18. Mechanically ensures zero open FIDs remain in the queue7 before allowing the pipeline release script to trigger. |

### **Phase Alignment Analysis and Friction Resolution**

A significant friction point between the two systems is the definition and execution of the "Build" phase. In the native Agent Skills environment, /build often assumes the agent possesses the autonomy to write code directly following a plan formulation2. However, the ECHO Protocol dictates that code cannot be written until the corresponding FID reaches the COMPLETE phase, transitioning execution to the Forge agent4.  
Therefore, invoking /build in Savant-Code's STRICT mode must operate as a high-level orchestrator directive. It must rapidly cycle the active child FID through the GREEN, AUDIT, and ADVERSARIAL phases, ensuring all documentation and theoretical verification is sound. Only upon reaching COMPLETE will the system allow the Forge to invoke the write\_file or apply\_patch tools defined in packages/agent-runtime/src/tools/13. Conversely, in HYBRID mode, where the Orchestrator assumes direct implementation duties4, the /build command aligns more closely with native agent-skills behavior, though it remains rigorously bounded by the EHEL compliance layer5. This ensures the agent cannot silently drop scope, adhering to the anti-deferral mandate.

## **Context-Activation Design**

Agent Skills are designed to activate contextually and seamlessly; for instance, the system identifying API work dynamically loads api-and-interface-design, while the detection of UI work loads frontend-ui-engineering6. Savant-Code must achieve this fluid contextual activation without ballooning the LLM context window, thereby adhering to the "progressive disclosure" philosophy championed by the skills architecture3.

### **Zustand State and Activity Subscription**

Savant-Code manages application state via Zustand and Immer within the cli/src/state/ directory, which actively tracks AgentActivity states (idle | thinking | tool | subagent | researching)7. Context activation will be implemented as a specialized Zustand store subscriber termed the SkillActivationManager.  
The SkillActivationManager listens to the RunState and observes the specific toolName being executed by the tool-executor.ts layer5. Rather than relying on a separate router agent—which violates the orchestration patterns defined in both repositories21—the framework will port the using-agent-skills meta-skill22 directly into the Orchestrator's base system prompt. This acts as a localized decision tree. When the Orchestrator detects a specific domain context, it triggers a newly introduced, non-destructive tool: load\_skill({ skillName: string }).  
The integration deeply leverages the existing Thinker and Detective contracts to facilitate this activation. During the RED phase, the Detective agent relies on query\_blast\_radius and query\_node\_edges via the deterministic codebase knowledge graph located in packages/knowledge-graph/13. If the knowledge graph returns nodes identified as DOM elements, React components, or CSS modules, the Detective mechanically signals the Orchestrator to execute load\_skill({ skillName: 'frontend-ui-engineering' })19.  
Similarly, during the GREEN phase, the Thinker utilizes the sequentialthinking tool for sequential reasoning4. A lifecycle hook will be integrated into the SequentialThinkingServer instance inside packages/agent-runtime/src/tools/. This hook evaluates the active FSM phase against the using-agent-skills routing logic22. If the Thinker is generating tasks and determining dependency orders, it requests planning-and-task-breakdown10 to be dynamically appended to its context window.

### **Dynamic Context Injection and Pruning**

To prevent catastrophic context bloat over long sessions, skills will not permanently reside in the system prompt. Instead, Savant-Code's existing context compaction engine—a 4-layer progressive auto-compaction system ranging from L0 (summarize old turns) to L3 (aggressive reduction)—will exclusively manage skill lifecycles5.  
When a skill is triggered, the AgentRuntime injects the SKILL.md frontmatter and the designated "Core Process" into a temporary \<active\_skill\> XML tag at the boundary of the current message turn. Once the perfection loop transitions to a subsequent phase (e.g., advancing from GREEN to AUDIT), the L2 auto-compactor, which handles stale context pruning, automatically strips the previous phase's skill instructions (e.g., incremental-implementation) and loads the appropriate audit-focused skill (e.g., test-driven-development or code-review-and-quality)5. This ensures the active agent only possesses the precise workflows required for the immediate task, strictly enforcing the separation of duties.

## **Skills Library Expansion Plan**

The agent-skills repository contains 24 distinct workflows designed to cover every facet of the engineering lifecycle23. Savant-Code currently auto-loads a minimal set of 7 coding standards as SKILL.md files from the .agents/skills/ directory24. The integration requires a systematic classification of the 24 external skills into three defined categories: Immediately Portable, ECHO-Adaptation Required, and Subsumed by Harness.

### **Comprehensive Skill Classification Matrix**

The following table provides the architectural disposition for all 24 skills from the external repository, mapping them to their intended utilization within Savant-Code.

| Skill Name | SDLC Phase | Classification | Savant-Code Target / Disposition |
| :---- | :---- | :---- | :---- |
| using-agent-skills | Meta | ECHO-Adaptation | Integrated into Orchestrator prompt; acts as the primary routing tree22. |
| interview-me | Define | Immediately Portable | Enhances /interview command. Enforces the 95% confidence stop mechanic9. |
| idea-refine | Define | Immediately Portable | Enhances Thinker's sequentialthinking loop with divergent/convergent logic25. |
| spec-driven-development | Define | Immediately Portable | Defines the master FID schema generation during the RED phase8. |
| planning-and-task-breakdown | Plan | Immediately Portable | Dictates Recorder behavior when generating the child FID backlog10. |
| incremental-implementation | Build | Immediately Portable | Core implementation instruction set for the Forge agent11. |
| test-driven-development | Build | Immediately Portable | Enforces Red-Green-Refactor for the Verifier and Forge agents11. |
| context-engineering | Build | Subsumed | Deprecated. Superseded by Savant-Code's L0-L3 auto-compaction and graph5. |
| source-driven-development | Build | ECHO-Adaptation | Assigned to Researcher agent to ground decisions via deep\_research13. |
| doubt-driven-development | Build | ECHO-Adaptation | Merged into the Adversary agent for ADVERSARIAL phase meta-reviews27. |
| frontend-ui-engineering | Build | Immediately Portable | Auto-loads when the knowledge graph detects UI/DOM manipulation19. |
| api-and-interface-design | Build | Immediately Portable | Enforces Hyrum's Law for Orchestrator during interface construction17. |
| browser-testing-with-devtools | Verify | ECHO-Adaptation | Connects to browser-use helper tool library in agents/browser-use/13. |
| debugging-and-error-recovery | Verify | ECHO-Adaptation | Triggers Detective's code\_search tool upon Verifier test failures13. |
| code-review-and-quality | Review | ECHO-Adaptation | Bifurcated between Verifier (correctness) and Adversary (architecture)4. |
| code-simplification | Review | Immediately Portable | Triggers Forge via Thinker evaluation; enforces Chesterton’s Fence16. |
| security-and-hardening | Review | Immediately Portable | Auto-loads for authentication or data-storage modifications3. |
| performance-optimization | Review | Immediately Portable | Powers the /webperf command during the AUDIT phase14. |
| git-workflow-and-versioning | Ship | Subsumed | Deprecated. Superseded by Zero-Trust Agentic Provenance (ZTAP) receipts5. |
| ci-cd-and-automation | Ship | Immediately Portable | Dictates the construction of deployment pipelines and feature flags23. |
| deprecation-and-migration | Ship | Immediately Portable | Manages code-as-liability removal during the SELF\_CORRECT phase17. |
| documentation-and-adrs | Ship | Immediately Portable | Guides the Scribe agent when writing LESSONS.md and session summaries13. |
| observability-and-instrumentation | Ship | Immediately Portable | Enforces structured logging requirements during the GREEN phase30. |
| shipping-and-launch | Ship | Immediately Portable | Final completeness check before triggering release:public pipeline18. |

### **ECHO-Adaptation Rationale and Execution**

The immediately portable skills require zero modification as they represent universally applicable engineering heuristics. However, the ECHO-Adaptation category demands specific structural realignments to respect the separation of duties mandated by the 10-agent roster4.  
The code-review-and-quality skill originally conducts a monolithic five-axis code review12. In Savant-Code, this process must be bifurcated to maintain the integrity of the Double Audit law. The Verifier agent executes the correctness, testing, and performance axes based on mechanical tool output4. The Adversary agent subsequently receives the Verifier's output and executes the readability and architecture axes, re-rating severities to satisfy the meta-verification mandate and overriding the Verifier where necessary (FID-2026-0805-004)4.  
Furthermore, the doubt-driven-development skill dictates that a fresh-context reviewer must rigorously challenge assumptions using a CLAIM → EXTRACT → DOUBT → RECONCILE workflow27. This perfectly describes the exact mandate of the Savant-Code Adversary agent. Therefore, the core tenets of doubt-driven-development will not merely be loaded as a temporary skill, but rather permanently integrated into the core system prompt override for the Adversary agent (agents/adversary/adversary.ts), executing automatically during every ADVERSARIAL phase4.  
The source-driven-development skill, which requires grounding framework decisions in official documentation rather than LLM training weights26, aligns perfectly with the Researcher agent. This skill will be hard-bound to the Researcher, directing its deep\_research and web\_search tools to fetch canonical documentation and inject citations before the Thinker is permitted to finalize the GREEN phase13.  
Finally, the git-workflow-and-versioning skill31 is fully subsumed by Savant-Code's Zero-Trust Agentic Provenance (ZTAP) feature. ZTAP optionally generates hash-only, per-role Ed25519-signed write receipts at the native write boundary, ensuring append-only session ledgers5. The markdown-based guidance of the skill is rendered obsolete by this cryptographic, harness-level enforcement.

## **Verification Framework: Making Criteria Mechanical**

The core philosophy of Agent Skills emphasizes that "verification is non-negotiable," utilizing anti-rationalization tables to actively prevent LLMs from skipping critical quality steps3. However, within the native agent-skills repository, this verification is primarily prose-based, relying on the model's self-discipline to follow the text. Savant-Code operates differently; its ECHO Harness Enforcement Layer (EHEL) enforces laws mechanically at the tool-executor level (e.g., physically blocking a write\_file execution if the target file was not previously read 0-EOF)4.  
To bridge the gap between prose heuristics and mechanical enforcement, the architecture must extend the FID Step Status engine, specifically scripts/fid-ledger.ts and fid-validator.ts7.

### **The AISOP Companion File Implementation**

The architectural solution leverages the proposed workflow.aisop.json (AI Standard Operating Procedure) companion file format designed for complex skills32. For every SKILL.md imported into Savant-Code, a corresponding SKILL.aisop.json will be generated and continuously evaluated.  
During the Savant-Code boot sequence (ECHO.md Step 1), the harness scans the .agents/skills/ directory4. If an active skill is detected, its .aisop.json definitions are parsed and dynamically registered into EHEL's active rule matrix. This JSON file translates prose into strict, executable criteria. For example, in the test-driven-development skill, the prose requirement "tests pass" is mechanically translated into a rule dictating that the run\_terminal\_command tool must execute the commands.test script defined in protocol.config.yaml and receive a 0 exit code before the state machine can advance4.  
Savant-Code FIDs utilize rigid metadata statuses (created | analyzed | fixed | verified | closed)4. EHEL intercepts the transition from fixed to verified. The fid-validator.ts7 cross-references the active skills in the context window. If the frontend-ui-engineering skill is active, the validator mechanically checks the session trace to determine if the wcag browser-use DOM-walk scan5 has been successfully executed. If the artifact is absent, the FID transition is hard-blocked, and the Orchestrator receives a PreToolUseFailure lifecycle hook response5.

### **Mechanical Anti-Rationalization via EHEL Hooks**

The highly effective anti-rationalization tables provided in Agent Skills (e.g., when the agent claims "I'll write tests later", the rebuttal is "Write the failing test first")17 will be injected directly into the PostToolUseFailure lifecycle hook defined in protocol.config.yaml5.  
When EHEL mechanically blocks a tool execution due to missing verification, the error message returned to the LLM will not be a generic system error. Instead, it will dynamically query the .aisop.json file, match the failure context, and directly quote the corresponding counter-argument from the skill's anti-rationalization table. This provides immediate, context-aware corrective steering, preventing the model from entering a hallucination loop or attempting to bypass the established gate.

## **Auto Drive \+ /build auto Convergence**

Agent Skills introduces the highly efficient /build auto command, a workflow that generates a comprehensive plan and implements every task in a single approved pass. It removes human stepping *between* tasks while maintaining individual test-driven commits, gracefully pausing only on failures or high-risk steps3. Concurrently, Savant-Code features "Auto Drive" (FID-001..010), an autonomous execution engine that mandates a strict pre-build plan confirmation, drafts a concrete FID backlog, and operates a supervisor loop invoking transition\_phase until the queue is clear7.  
The architectural objective is to merge the frictionless user experience of /build auto with the strict, immutable governance of Auto Drive, resulting in a single, uncompromised autonomous pipeline.

### **The Merged Workflow Execution Architecture**

The merged autonomous engine executes through a rigorously defined five-stage pipeline, managed by the durable budgeted goal engine located in packages/agent-runtime/src/run-agent-step/goal-engine.ts7.

> 1. **Stage 0: CLARITY (/interview)** When the operator inputs /auto-drive \<goal\> (or utilizes /build auto as a registered alias), the system evaluates the prompt's clarity. If the request is underspecified, the system automatically invokes the interview-me skill7, forcing the agent to extract the user's actual intent before generating code.  
> 2. **Stage 1: PLAN (Law 2 Compliance)** The Thinker utilizes the planning-and-task-breakdown skill to draft the Master FID, which serves as the pre-build plan7. The OpenTUI renders this plan for review. **The operator approves this plan exactly once.** This single, upfront confirmation satisfies ECHO Law 2 (Present Before Act) for the entirety of the autonomous operation, establishing the authorized scope4.  
> 3. **Stage 2: DECOMPOSE (Queue Generation)** Following approval, the Recorder agent mechanically decomposes the master plan into a backlog of Child FIDs (dev/fids/FID-YYYY-MMDD-NNN-task.md). This process ensures that dependency graphs are established and validated by scripts/fid-ledger.ts, preventing execution out of sequence7.  
> 4. **Stage 3: DRIVE (The Supervisor Loop)** The durable budgeted goal engine iterates over the generated FID queue7. For each individual FID, it autonomously executes the strict Perfection Loop. It triggers incremental-implementation for the Forge agent during the GREEN phase11, and subsequently triggers test-driven-development and code-review-and-quality for the Verifier during the AUDIT phase12.  
> 5. **Stage 4: RISK DETECTION AND UX (The Pause Mechanic)** The native /build auto command is designed to pause on failures or risky steps6. To implement this within Savant-Code, the self-healing ladder (Child FID-2026-0818-005 in the Auto Drive master plan) will be updated7. If a step fails the Verifier audit three consecutive times, or if the query\_blast\_radius tool13 indicates a destructive change extending outside the pre-approved master scope, the supervisor loop transitions its state from active to paused. The OpenTUI will then present a localized diff and a reasoning stream to the operator, requiring manual intervention to either resume, adjust the code, or cancel the operation entirely5.  
> 6. **Stage 5: CERTIFY** Once all child FIDs in the queue successfully reach the closed and archived status, the system executes the /verify macro across the entire workspace and exports the final artifact log7, concluding the autonomous run.

This fusion preserves the strict, verifiable ledger required by Savant-Code's zero-trust architecture while eliminating the tedious manual transition approvals that /build auto correctly identifies as workflow anti-patterns in long-running sessions.

## **Cross-Agent Portability and Skill Anatomy**

The Agent Skills library leverages a standardized SKILL.md format, purposefully designed to be highly portable and easily installed across 70+ diverse agents via the npx skills add addyosmani/agent-skills command2. Savant-Code currently maintains its own .agents/skills/SKILL.md directory24.  
To ensure Savant-Code remains fully compatible with the broader open-source ecosystem while retaining its strict internal governance, a dual-layer compilation approach is required, balancing ingress portability with egress standardization.

### **Anatomy Alignment and the Dual-Layer Compiler**

The standard Agent Skills format dictates specific YAML frontmatter (including name and description), alongside standard sections such as "Overview", "When to Use", "Core Process", "Red Flags", and "Verification"33. Savant-Code will natively support this exact schema without introducing proprietary markdown extensions, ensuring seamless visual parsing.

* **Ingress (Importing to Savant-Code):** Savant-Code users are encouraged to execute npx skills add addyosmani/agent-skills directly within their workspace6. A newly engineered CLI lifecycle hook in Savant-Code, termed savant-compile, will execute automatically upon detecting file changes within .agents/skills/. This compiler parses the standard SKILL.md, extracts the qualitative "Verification" checklists, and programmatically generates the aforementioned workflow.aisop.json32 to feed the EHEL validator. This allows Savant-Code to import community-driven skills and instantly apply mechanical, project-specific governance to them without manual translation.  
* **Egress (Exporting from Savant-Code):** There is immense value in making internal Savant-Code workflows exportable to the wider community. Any custom skill defined inside Savant-Code will strictly adhere to the standardized SKILL.md anatomy33. Savant-Code specific tools (e.g., query\_blast\_radius) will be deliberately abstracted in the markdown prose as general concepts (e.g., "Assess impact radius"). This allows the skill to remain fundamentally useful if exported to a basic Claude Code or Cursor environment, while simultaneously triggering the highly specific native tools when operating inside the Savant-Code harness.

## **Quality Gates Mapping: Verifier and Adversary Dynamics**

Agent Skills establishes rigorous quality gates primarily through the /review command (focused on code health and readability) and the /webperf command (focused on Core Web Vitals and optimization)2. Within the Savant-Code architecture, these responsibilities are strictly divided between the Verifier and the Adversary to satisfy the separation of duties4.  
When a FID enters the AUDIT phase, the Verifier assumes responsibility for the mechanical aspects of /review and /webperf. By dynamically loading test-driven-development and performance-optimization, the Verifier executes build scripts, runs test suites, and checks basic bundle sizes. It relies entirely on output injected by EHEL into the message history; it possesses zero write or bash tools of its own, preventing hallucinated success claims4.  
Upon completion of the AUDIT phase, the FID transitions to the ADVERSARIAL phase, invoking the Adversary agent4. The Adversary serves as the meta-verification layer, heavily utilizing the newly integrated doubt-driven-development skill27. The Adversary reviews the Verifier's findings, assessing the more subjective axes of /review such as architectural alignment and readability. If the Verifier issues a FAIL based on a hallucinated test interpretation, the Adversary refutes it; if the Verifier issues a PASS without sufficient evidence, the Adversary re-audits it. The Adversary's verdicts override the Verifier's, and only a clean ADVERSARIAL pass allows the FID to reach the COMPLETE status4.

## **Implementation Path**

The architectural retrofit is scoped for a rapid, three-week implementation cycle, culminating in a fully integrated, mechanically governed skills framework that leverages the best of both repositories.

### **Week 1: Core Parsing and Meta-Routing (MVP)**

The objective of the first week is to establish the fundamental context-activation layer and integrate the highest-priority, immediately portable skills.

* Execute npx skills add addyosmani/agent-skills to populate the workspace's .agents/skills/ directory6.  
* Update cli/src/commands/command-registry.ts7 to map the 8 primary slash commands (/spec, /plan, /build, /test, /review, /webperf, /code-simplify, /ship) to their corresponding Savant-Code macros and aliases.  
* Develop the SkillActivationManager inside cli/src/state/ to subscribe to the AgentActivity stream5.  
* Port the using-agent-skills decision tree22 directly into the Orchestrator's system prompt to enable dynamic skill loading via the established context-engineering paradigm23.

### **Week 2: ECHO Enforcement Binding**

The second week focuses on the translation of prose-based verification into strict EHEL mechanical gates.

* Develop the savant-compile script to generate workflow.aisop.json companion files32 dynamically from the SKILL.md "Verification" and "Anti-rationalization" tables33.  
* Update packages/agent-runtime/src/echo/fid-validator.ts7 to actively consume the .aisop.json rules during FID step transitions (specifically the gate from fixed to verified).  
* Inject the core mechanics of the doubt-driven-development skill28 directly into the Adversary agent's base prompt located in agents/adversary/adversary.ts.  
* Assign the source-driven-development26 documentation grounding rules to the Researcher agent to govern deep\_research execution13.

### **Week 3: Auto Drive Convergence and Final Polish**

The final week finalizes the autonomous supervisor loop, ensuring total compliance with Zero-Trust Agentic Provenance (ZTAP).

* Update cli/src/commands/goal.ts and the run-agent-step/goal-driver.ts module7 to execute the merged Auto Drive \+ /build auto state machine logic.  
* Implement the UI pause/resume trigger within OpenTUI to handle instances where test-driven-development or incremental-implementation fails verification repeatedly, activating the self-healing ladder block7.  
* Run the comprehensive harness A–Z live-test prompt (dev/test-prompts/az-v0.0.25-harness-live-test.md)5 to guarantee the new skills implementation does not interfere with the generation of ZTAP signed cryptographic receipts5.

The retrofitting of Addy Osmani’s agent-skills into Savant-Code bridges the critical gap between high-level engineering methodologies and strict, mechanical state-machine execution. By mapping the slash command lifecycle directly to the ECHO Perfection Loop, contextually activating specialized skills via Zustand state tracking, and parsing qualitative verification checklists into executable EHEL rules, Savant-Code successfully leverages the open-source community's finest practices without compromising its non-negotiable 15-law governance model. The convergence of /build auto with Auto Drive yields a system requiring only a single, upfront approval before executing highly complex development cycles autonomously, ensuring that code is never written without a specification, never implemented without verification, and never merged without rigorous adversarial review.

#### **Works cited**

> 1. GitHub \- addyosmani/agent-skills: Production-grade... \- daily.dev, [https://daily.dev/posts/0xnq9ma01](https://daily.dev/posts/0xnq9ma01)  
> 2. agent-skills \- production-grade engineering skills for AI coding agents, [https://skills.addy.ie/](https://skills.addy.ie/)  
> 3. addyosmani/agent-skills: Production-grade engineering skills for AI coding agents. \- GitHub, [https://github.com/addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)  
> 4. ECHO.md  
> 5. README.md  
> 6. agent-skills \- AI Agents on GitHub (85.3k ) | SkillsLLM, [https://skillsllm.com/skill/addyosmani-agent-skills](https://skillsllm.com/skill/addyosmani-agent-skills)  
> 7. FID-2026-0818-001-auto-drive-master.md  
> 8. spec-driven-development \- agent-skills \- Addy Osmani, [https://skills.addy.ie/skills/spec-driven-development/](https://skills.addy.ie/skills/spec-driven-development/)  
> 9. agent-skills/skills/interview-me/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/interview-me/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/interview-me/SKILL.md)  
> 10. agent-skills/skills/planning-and-task-breakdown/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/planning-and-task-breakdown/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/planning-and-task-breakdown/SKILL.md)  
> 11. incremental-implementation \- agent-skills \- Addy Osmani, [https://skills.addy.ie/skills/incremental-implementation/](https://skills.addy.ie/skills/incremental-implementation/)  
> 12. code-review-and-quality \- agent-skills \- Addy Osmani, [https://skills.addy.ie/skills/code-review-and-quality/](https://skills.addy.ie/skills/code-review-and-quality/)  
> 13. ARCHITECTURE.md  
> 14. performance-optimization \- agent-skills \- Addy Osmani, [https://skills.addy.ie/skills/performance-optimization/](https://skills.addy.ie/skills/performance-optimization/)  
> 15. agent-skills/docs/getting-started.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/docs/getting-started.md](https://github.com/addyosmani/agent-skills/blob/main/docs/getting-started.md)  
> 16. agent-skills/skills/code-simplification/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/code-simplification/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/code-simplification/SKILL.md)  
> 17. Agent Skills \- AddyOsmani.com, [https://addyosmani.com/blog/agent-skills/](https://addyosmani.com/blog/agent-skills/)  
> 18. agent-skills/skills/shipping-and-launch/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/shipping-and-launch/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/shipping-and-launch/SKILL.md)  
> 19. frontend-ui-engineering \- agent-skills \- Addy Osmani, [https://skills.addy.ie/skills/frontend-ui-engineering/](https://skills.addy.ie/skills/frontend-ui-engineering/)  
> 20. Agent Skills | AI Native Landscape \- Jimmy Song, [https://landscape.jimmysong.io/projects/addyosmani-agent-skills/](https://landscape.jimmysong.io/projects/addyosmani-agent-skills/)  
> 21. agent-skills/AGENTS.md at main · addyosmani/agent-skills \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/AGENTS.md](https://github.com/addyosmani/agent-skills/blob/main/AGENTS.md)  
> 22. agent-skills/skills/using-agent-skills/SKILL.md at main · addyosmani/agent-skills \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/using-agent-skills/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/using-agent-skills/SKILL.md)  
> 23. Skills catalog \- agent-skills \- Addy Osmani, [https://skills.addy.ie/skills/](https://skills.addy.ie/skills/)  
> 24. AGENTS.md  
> 25. agent-skills/skills/idea-refine/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/idea-refine/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/idea-refine/SKILL.md)  
> 26. agent-skills/skills/source-driven-development/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/source-driven-development/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/source-driven-development/SKILL.md)  
> 27. doubt-driven-development \- agent-skills \- Addy Osmani, [https://skills.addy.ie/skills/doubt-driven-development/](https://skills.addy.ie/skills/doubt-driven-development/)  
> 28. agent-skills/skills/doubt-driven-development/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/doubt-driven-development/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/doubt-driven-development/SKILL.md)  
> 29. agent-skills/skills/documentation-and-adrs/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/documentation-and-adrs/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/documentation-and-adrs/SKILL.md)  
> 30. agent-skills/skills/observability-and-instrumentation/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/observability-and-instrumentation/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/observability-and-instrumentation/SKILL.md)  
> 31. agent-skills/skills/git-workflow-and-versioning/SKILL.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/skills/git-workflow-and-versioning/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/git-workflow-and-versioning/SKILL.md)  
> 32. Add optional machine-readable workflow companion specs for complex gated skills \- GitHub, [https://github.com/addyosmani/agent-skills/issues/309](https://github.com/addyosmani/agent-skills/issues/309)  
> 33. agent-skills/docs/skill-anatomy.md at main \- GitHub, [https://github.com/addyosmani/agent-skills/blob/main/docs/skill-anatomy.md](https://github.com/addyosmani/agent-skills/blob/main/docs/skill-anatomy.md)