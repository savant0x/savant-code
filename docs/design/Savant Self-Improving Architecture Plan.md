<!-- markdownlint-disable MD001 MD013 -->
<!-- MD013 is narrowly disabled for this evidence-heavy research report: long cited prose, wide comparison tables, and the verification appendix are intentionally preserved in source form, per repo convention. -->

# **Architectural Retrofit: Self-Improving Harness and Autonomous Skill Generation within the Savant-Code ECHO Protocol**

The structural evolution of multi-agent coding assistants demands a transition from reactive, human-steered execution to proactive, self-governing capability development. The Savant-Code framework, currently operating under the ECHO Protocol v0.2.0, enforces rigorous software engineering standards through a ten-agent roster, a deterministic Feature Implementation Document (FID) lifecycle, and mechanical verification gates1. While the existing framework ensures that no code is written without convergent verification, it relies entirely on human operators or static prompt directives to expand its capability matrix. The system lacks the architecture to mechanically observe its own tool execution failures, synthesize reusable procedural knowledge, and autonomously generate durable capabilities without human authoring1.  
The integration of a self-improvement loop and an agent-authored skill subsystem requires retrofitting concepts from leading experimental frameworks—namely, the OpenClaw self-improving-agent skill3, the Hermes autonomous skill-building system4, the RangeKing/self-evolving-agent capability ladder5, and the sudokrang/aceforge tool-observation pipeline6. However, integrating these paradigms directly into Savant-Code would violate its fundamental architectural invariants: the prohibition of silent mutations, the strict 16,384-token context tail budget, the zero-trust agentic provenance (ZTAP) layer, and the absolute prohibition of secondary in-process large language models (LLMs)1.  
This report provides a comprehensive, expert-level architectural blueprint for retrofitting a proactive self-improvement harness and a secure, agent-driven skill generation subsystem into Savant-Code. The design strictly maps community demand against the ECHO Protocol's immutable laws, establishing a highly governed, computationally efficient, and verifiable evolution pipeline.

## **3\. Community Feature-Request Research and Ecosystem Demand**

A resilient architecture must be grounded in the verifiable pain points and feature requests of the wider developer community. An analysis of issue trackers, pull requests, community discussions, and derivative repository signals across the Hermes, OpenClaw, AceForge, and RangeKing ecosystems reveals distinct patterns of structural failure in current self-improving agent designs3. The following prioritized matrix synthesizes these ecosystem demands and defines the specific architectural responses required for the Savant-Code retrofit.

| Ecosystem Pain Point / Feature Request | Source Evidence | Signal Strength | Savant-Code Architectural Response |
| :---- | :---- | :---- | :---- |
| **Mechanical Capture Over Prompt Reliance:** Agents frequently fail to log errors because prompts are ignored during context exhaustion. Users demand passive observation of tool failures and corrections without relying on the LLM to remember to write logs. | AceForge observation pipeline6; RangeKing documentation5; OpenClaw failure logs10. | **Critical** (Core motivation for the AceForge and RangeKing derivative frameworks). | Implementation of EHEL fail-open lifecycle hooks (PostToolUseFailure, SessionEnd)1. Triggers mechanical capture into a decoupled storage tier, bypassing prompt compliance entirely. |
| **Immutable and Protected Skills:** Users require domains (e.g., governance, safety constraints, compliance rules) where the agent cannot overwrite, patch, or shadow critical skills during autonomous updates. | Hermes GitHub Issue \#250839. | **Critical** (Enterprise and security compliance blocker). | Integration of an immutable: true YAML frontmatter flag. The skills:check mechanical validator and EHEL pre-write gates reject all mutations to protected files1. |
| **Context Bloat and Forgetting:** Continuous logging of raw traces bloats context windows, degrading model reasoning and forcing premature compaction. Users request "memory decay" and strict context economy. | OpenClaw community reviews12; Hermes progressive disclosure4. | **High** (Common failure state of basic incident logging skills). | A hybrid storage architecture. Raw mechanical traces live in dev/experiences/ (unloaded). Only promoted, canonical rules enter the boot-read dev/LEARNINGS.md, strictly capped at 1,200 lines1. |
| **Autonomous Skill Generation from Traces:** Developers want the agent to synthesize reusable SKILL.md artifacts after navigating complex, multi-step solutions, eliminating the need for manual skill authoring. | Hermes /learn release13; AceForge tool observation6. | **High** (Primary value proposition of the Hermes skill system). | Deployment of the skill\_manage tool restricted to the Scribe agent1. Triggered mechanically at SessionEnd if the session exceeded specific complexity or error-recovery thresholds. |
| **Quality Degradation and Negative Transfer:** Autonomously generated skills often perform worse than human-authored ones due to hallucination or overly specific context (negative transfer). | SkillsBench research (arXiv:2602.12670)15; AceForge validation constraints6. | **Medium** (Emerging academic consensus). | Mandated Double-Audit via the Verifier agent and ZTAP signed provenance receipts8. Skills must pass the offline learnings:check and real repository test suites before activation. |
| **Active Learning Agenda vs. Passive Logging:** Reactive correction is insufficient; users want the agent to identify capability gaps, establish a curriculum, and surface training priorities before executing tasks. | RangeKing's agenda\_review and explicit transfer checks5. | **Medium** (Differentiator from basic logging). | The Orchestrator boots with a curated dev/agenda.md detailing one to three active capability gaps1, aligning proactive improvement with the existing ECHO routing logic. |
| **Security Scanning and Quarantine:** Auto-generated skills present significant prompt-injection vectors, credential exfiltration risks, and behavioral drift if immediately loaded into the runtime. | Hermes security scanner and quarantine model4. | **High** (Critical security necessity). | Agent-authored skills execute in a .quarantine/ directory pending explicit human approval or Adversary audit, building directly on Savant-Code ZTAP provenance8. |

The synthesis of these ecosystem demands indicates a clear trajectory: the community is moving away from passive, prompt-driven incident logging toward active, mechanically enforced, and stringently governed capability evolution. Savant-Code possesses a structural advantage through its ECHO Protocol, FSM-driven Perfection Loop, and EHEL pre-write gates1. The subsequent sections detail how these existing governance mechanisms answer the required architectural responses without compromising the system's foundational invariants.

## **4\. Architectural Decision Records**

The integration of an autonomous skill-authoring layer and a self-improvement loop necessitates resolving several complex architectural questions. Each decision below evaluates the prior art against Savant-Code's strict execution environment, providing a definitive verdict, supporting evidence, confidence rating, and the underlying reasoning for the chosen path.

### **Q1. Capture Layer: Mechanical Triggers Versus Prompt Enforcement**

**Verdict:** The capture layer must utilize fail-open mechanical triggers tied to the EHEL lifecycle hooks (PostToolUseFailure, PostToolUse, SessionEnd), writing structured JSONL records to a decoupled store, thereby entirely eliminating reliance on the agent's prompt compliance. **Evidence:** Savant protocol.config.yaml extensible hooks1; AceForge continuous observation pipeline6; historical failures of prompt-only write requirements1. **Confidence:** High. **Reasoning:** Frameworks like the OpenClaw self-improving-agent skill rely heavily on the LLM recognizing a failure and autonomously deciding to invoke a tool to write an error log to a markdown file3. This approach introduces a high rate of silent failures, particularly when the context window is near exhaustion or the model is heavily focused on task execution. Savant-Code's own history demonstrates that prompt-only write requirements lead to read-without-write stalls1. Therefore, the capture mechanism must be pushed into the infrastructure layer.  
By leveraging the hooks: \[\] array in protocol.config.yaml1, the runtime can intercept events seamlessly. The PostToolUseFailure hook will mechanically capture the tool identifier, the exact argument payload, and the resulting stack trace or exit code, stripping verbose noise (such as expected 404s during broad web searches). Operator-correction capture relies on the PostToolUse hook combined with a mechanical heuristic evaluating the immediate subsequent user input for corrective phrasing (e.g., "no, actually," "that is incorrect"). The captured data is not immediately fed back to the LLM; instead, it is written deterministically as a structured trace record ({"timestamp", "trigger\_type", "context\_hash", "payload"}) to an out-of-band JSONL file. To manage noise, the capture hook utilizes a rapid hash-based deduping algorithm based on the tool name and the first line of the error string. If a signature matches an existing entry within the current session, the hook increments a frequency counter rather than duplicating the payload, effectively implementing the AceForge escalation threshold6 without executing an expensive secondary LLM call.

### **Q2. Experience Storage: Context Economy and the Hybrid Store**

**Verdict:** Implement a hybrid storage architecture where raw, mechanical traces are stored in dev/experiences/raw-traces.jsonl outside the LLM context window, while only fully promoted, canonical rules are permitted entry into the boot-read dev/LEARNINGS.md. **Evidence:** Savant-Code context budget constraints (16,384 tokens)1; OpenClaw memory bloat limitations12. **Confidence:** High. **Reasoning:** A fundamental constraint of the Savant-Code runtime is its sacred context budget. The existing dev/LEARNINGS.md file is boot-read into every session and currently consumes approximately 1,200 lines1. Directly adopting the OpenClaw three-file paradigm (LEARNINGS.md, ERRORS.md, FEATURE\_REQUESTS.md)3 would quickly exceed the 16,384-token recent-tail threshold, triggering aggressive context compaction and destroying the agent's short-term memory7.  
To preserve the token economy, all mechanically captured errors and unverified operator corrections are routed to dev/experiences/raw-traces.jsonl. This file acts as a write-only ledger during active execution and is completely invisible to the Orchestrator, Thinker, and Forge agents2. During the SessionEnd hook, the Scribe agent is spawned with a targeted prompt to review the most recent un-summarized lines of this JSONL file. Any identified FEATURE\_REQUESTS are not stored in a parallel silo; they are routed directly through the existing ECHO governance model, prompting the Scribe to instruct the Recorder agent to generate a new RED-phase FID in dev/fids/1. To ensure long-term stability, an automated compaction script utilizing the PreCompact lifecycle hook purges raw traces older than fourteen days that have not achieved the required frequency threshold for promotion.

### **Q3. Evolution and Promotion: Mapping the Capability Ladder to ECHO**

**Verdict:** Trace recurrences meeting a frequency threshold (![][image1] 3\) trigger the Scribe to formulate a candidate lesson, which is delegated to the Recorder to initiate a standard RED ![][image2] GREEN ![][image2] AUDIT Perfection Loop, requiring explicit operator approval for scope. **Evidence:** RangeKing capability map and learning agenda5; ECHO Protocol Immutable Laws (Law 2: Present Before Act, Law 3: Verify Before Proceed)2. **Confidence:** High. **Reasoning:** The OpenClaw skill auto-promotes lessons after three recurrences1. This behavior violates Savant-Code's strict prohibition against silent mutations (Constraint 2\)1. The framework cannot allow an agent to alter its foundational behavioral rules (LEARNINGS.md) or structural capabilities without an auditable verification trail. Therefore, the recurrence detector acts as an alarm, not an execution mandate.  
When the Scribe analyzes the dev/experiences/ traces at the end of a session and detects a pattern repeating three or more times, it formulates a candidate hypothesis. The Scribe invokes the Recorder agent to document this hypothesis as a RED-phase FID2. The Orchestrator routes this FID through the Perfection Loop. In the GREEN phase, the Thinker evaluates the appropriate promotion target: if the pattern represents a coding standard, it proposes a canonical rule for LEARNINGS.md; if it is a complex, multi-step workflow, it proposes the extraction of a new SKILL.md. RangeKing's concept of a "transfer check"5 is assimilated seamlessly into the Savant-Code AUDIT phase. The Verifier agent must execute the project's native test suite to ensure the proposed lesson or skill does not degrade existing functionality2. Crucially, under Law 2, the operator must approve the scope of the new capability before the Recorder transitions the FID to COMPLETE and the new rule is merged into the boot-read environment2.

### **Q4. Skill-Authoring Subsystem: Retrofitting Hermes Governance**

**Verdict:** Introduce a restricted skill\_manage tool accessible only to the Scribe and Orchestrator. Agent-authored skills must conform to strict formatting standards, pass mechanical validation, and enter a ZTAP-secured .quarantine/ directory, utilizing references/ for progressive disclosure. **Evidence:** Hermes skill\_manage tool and /learn capture path4; Savant ZTAP provenance and SkillFrontmatterSchema1; Hermes Issue \#250839. **Confidence:** High. **Reasoning:** To provide the autonomous skill-building capabilities popularized by Hermes4, Savant-Code must deploy a skill\_manage tool featuring create, patch, and edit schemas. To uphold the separation of duties inherent in the 10-agent roster2, this tool is strictly withheld from the Forge, Verifier, and Detective. Only the Orchestrator (responding to an explicit operator /learn command) and the Scribe (synthesizing workflows at SessionEnd) may execute it.  
To prevent negative transfer and prompt-injection risks4, the generated SKILL.md must pass rigorous mechanical gating. The tool handler executes bun run skills:check internally before allowing the write. This mechanical validator ensures the skill description is ![][image3] 60 characters, enforces standard section ordering (When to Use, Procedure, Pitfalls, Verification), and rejects any hallucinated shell commands. Furthermore, responding to the critical vulnerability identified in Hermes Issue \#250839, the schema enforces an immutable: true flag for core governance files, preventing the agent from overwriting foundational constraints.  
Because agent-created skills represent executed code loaded into future contexts, they mandate a trust boundary. Any skill authored via skill\_manage receives a ZTAP provenance: agent cryptographic signature and is written exclusively to .agents/skills/.quarantine/8. These skills are invisible to the standard formatAvailableSkillsXml loader until an operator executes a skills trust \<name\> CLI command or the Adversary agent clears them through an isolated testing execution. Finally, to protect the context budget, the skill schema mandates the Hermes progressive disclosure model4; core SKILL.md files contain only Level 0 and Level 1 metadata, while bulk procedural data is placed in references/ sub-files, loaded via an updated skill tool only when explicitly queried.

### **Q5. Proactive Layer: The Curated Learning Agenda**

**Verdict:** Proactivity is executed through an end-of-session Scribe review that updates a tightly curated dev/agenda.md file. The Orchestrator consults this agenda at task intake, substituting expensive FTS5 session indexing with high-signal, localized capability surfacing. **Evidence:** RangeKing learning agenda5; Savant Scribe and Orchestrator interaction models1; token optimization paradigms7. **Confidence:** Medium. **Reasoning:** For a software engineering harness, continuous proactivity (e.g., interrupting the user mid-keystroke to suggest a skill) introduces severe operational friction. The optimal temporal window for reflection is the boundary between tasks. Extending the Scribe's SessionEnd contract provides the most non-intrusive mechanism for proactive improvement1.  
While Hermes utilizes SQLite-backed FTS5 semantic search for cross-session recall4, embedding this into Savant-Code introduces significant infrastructural weight and consumes excessive tokens during RAG injections. Instead, the design adopts RangeKing's highly effective "learning agenda" concept5. During SessionEnd, the Scribe distills the session's struggles and the current project phase into a strictly capped 50-line file located at dev/agenda.md. This file maintains one to three high-leverage capabilities or known anti-patterns currently active in the project. At the beginning of the next session, the Orchestrator reads dev/agenda.md. Proactivity in Savant-Code thus manifests as the Orchestrator surfacing a highly relevant past lesson or suggesting a quarantined skill before executing a risky operation, effectively steering the execution trajectory without demanding vast contextual search spaces.

### **Q6. Verification and Anti-Drift of the Meta-Loop**

**Verdict:** The self-improvement loop must rely on usage-evidence-based iteration driven through the ECHO FSM. Offline evolutionary pipelines utilizing DSPy+GEPA are rejected due to token costs and secondary LLM constraints, while EHEL Levenshtein circuit breakers prevent meta-loop oscillation. **Evidence:** Constraint 1 (No second LLM)1; ECHO FSM circuit breakers2; DSPy+GEPA cost analysis ($2-$10 per run)21. **Confidence:** High. **Reasoning:** The hermes-agent-self-evolution repository employs DSPy and Genetic-Pareto Prompt Evolution (GEPA) to iteratively mutate skills, evaluate them against a test suite, and generate pull requests21. While highly effective at optimizing prompt artifacts, this architecture inherently relies on a secondary, offline LLM pipeline executing hundreds of speculative evaluations21. This explicitly violates Savant-Code Constraint 11 and incurs prohibitive token costs ($2-$10 per optimization run)22.  
Savant-Code will achieve similar evolutionary optimization organically through usage-evidence-based improvement. The loop's outputs are verified because they must traverse the ECHO protocol: a new skill must pass the skills:check mechanical validator, and a new behavioral rule must pass learnings:check1. The AUDIT phase of the FID governing the skill's creation forces the Verifier agent to execute the repository's native test suite and paste the exact shell output into the document2.  
To prevent meta-loop oscillation—where the Scribe repeatedly patches a skill back and forth across different sessions based on conflicting user requests—the EHEL leverages its existing Perfection Loop circuit breakers2. The 10% maximum change cap per pass (Levenshtein metric)2 is applied to skill\_manage patches, ensuring gradual evolution rather than total rewrites. Furthermore, the Scribe prompt requires a semantic-preservation check: any proposed skill patch must include an explicit justification demonstrating that it does not violate any canonical rule already established in dev/LEARNINGS.md.

### **Q7. Demand Validation Mapping**

The following details how the architectural design satisfies the community feature requests identified in Section 3, highlighting deliberate deferrals and pre-existing Savant capabilities.

* **Satisfied:**  
  * *Reactive to Capability Evolution:* Met via the Scribe ![][image2] Recorder FID loop, elevating isolated errors into documented capabilities (RangeKing).  
  * *Automatic Skill Creation:* Met via the skill\_manage tool deployed to the Scribe at SessionEnd (Hermes).  
  * *Trust/Safety and Immutable Skills:* Met via the .quarantine/ directory, ZTAP signatures, and the immutable: true mechanical validator check (Hermes Issue \#25083).  
  * *Proving Improvement:* Met via the ECHO AUDIT phase requiring explicit test suite output before closing a skill-generation FID.  
* **Deliberately Deferred:**  
  * *DSPy/GEPA Genetic Evolution:* Excluded due to the strict prohibition on secondary in-process LLMs and excessive token overhead per run. Replaced with organic usage-based evolution.  
  * *FTS5 Cross-Session Recall:* Excluded to preserve the 16,384-token context budget. Replaced with the highly curated, 50-line dev/agenda.md digest.  
* **Already Solved by Savant-Code:**  
  * *Proving code changes pass validation:* Already handled by the Verifier's strict double-audit and Law 3 (Verify Before Proceed)2.  
  * *Skill schema standardization:* Already handled by SkillFrontmatterSchema and the bun run skills:check script1.

### **Q8. Risk Analysis and Comparative Advantage**

The retrofitting of an autonomous learning layer introduces systemic risks that must be mechanically mitigated to clear the "better than prior art" threshold established by the prompt.  
**Context Bloat and Hallucinated Lessons:** The primary failure mode of OpenClaw's self-improving-agent is uncontrolled context bloat12. Savant-Code mitigates this by restricting the raw traces to the unloaded dev/experiences/ JSONL store. The risk of the agent hallucinating false "lessons" from these traces is structurally eliminated by the ECHO FSM: the Verifier agent cannot close a FID without executing real terminal commands and pasting the deterministic output2. Self-reporting of skill efficacy is mechanically blocked.  
**Multi-Agent Race Conditions and File Mutations:** With a 10-agent roster operating concurrently2, multiple agents attempting to write to the experience store simultaneously could cause file corruption. Savant-Code mitigates this through strict separation of duties2. Only the Scribe possesses the skill\_manage tool; only the Recorder can initiate FIDs. Furthermore, the EHEL intercepts and normalizes all Windows path forms, preventing the instantiation of duplicate trace records due to \\ versus / path mismatches1.  
**Why Savant-Code's Design Exceeds the Prior Art:**

> 1. **Mechanical Enforcement vs. Prompt Adherence:** OpenClaw relies on the LLM to remember to invoke logging tools3. Savant-Code captures tool failures deterministically at the EHEL layer8, guaranteeing a 100% capture rate regardless of the LLM's attention degradation.  
> 2. **Verification and Governance:** Hermes allows agents to blindly patch skills in place, risking negative transfer9. Savant-Code routes every skill creation through the ZTAP .quarantine/ directory and the RED ![][image2] GREEN ![][image2] AUDIT Perfection Loop2, ensuring no capability enters the system without a cryptographic receipt and human authorization.  
> 3. **Context Economy:** Rather than utilizing expensive FTS5 RAG injections4, Savant-Code maintains a strict token budget through the Scribe's highly curated dev/agenda.md, surfacing only high-leverage capabilities precisely when the Orchestrator initiates a session1.

## **5\. Converged Architecture: Phased Implementation Plan**

The architectural verdicts resolve into a deterministic, four-phase rollout plan. This execution strategy aligns with the existing TypeScript/Bun monorepo structure, ensuring robust testing and minimal disruption to the active v0.2.0 runtime.

### **Phase 1: Capture and Record (v1 "Baseline")**

**Objective:** Establish the passive mechanical observation layer without altering agent behavior or polluting the context window.

* **Modules Touched:** packages/agent-runtime/src/echo/lifecycle-hooks.ts, common/src/types/experience.ts.  
* **Implementation:**  
  * Define the ExperienceRecordSchema (JSONL).  
  * Wire the PostToolUseFailure hook to capture tool arguments and stack traces deterministically.  
  * Wire a PreCompact hook to execute scripts/experiences-dedup.ts, utilizing a fast hashing algorithm sha256(tool\_name \+ truncated\_error) to group identical traces.  
  * Write records to dev/experiences/raw-traces.jsonl.  
* **Gates:** bun run typecheck across all 12 workspaces; execution of bun test packages/agent-runtime.  
* **Honest Boundary:** Operator live smoke-test required to confirm that the fail-open hook architecture does not interrupt standard HYBRID mode execution during expected failures (e.g., initial 404s on web searches).

### **Phase 2: Skill-Authoring Subsystem (v1 "Capability")**

**Objective:** Deploy the autonomous generation of procedural knowledge, heavily restricted by ZTAP and quarantine.

* **Modules Touched:** packages/agent-runtime/src/tools/handlers/tool/skill\_manage.ts, agents/scribe/scribe.ts, agents/savant/savant.ts.  
* **Implementation:**  
  * Implement the skill\_manage tool with create and patch endpoints.  
  * Assign the tool exclusively to the Scribe and Orchestrator.  
  * Embed SkillFrontmatterSchema validation directly into the tool handler to reject mutations lacking the required Verification block or exceeding 60 characters in the description.  
  * Enforce ZTAP provenance. All skill\_manage outputs are cryptographically signed and routed to .agents/skills/.quarantine/.  
* **Gates:** bun x eslint . \--max-warnings 0, execution of bun run skills:check.  
* **Honest Boundary:** The runtime strictly isolates .quarantine/ files from formatAvailableSkillsXml. An operator must execute the CLI command skills trust \<skill-name\> to migrate the file into active discovery.

### **Phase 3: Proactive Evolution (v2 "Agenda")**

**Objective:** Connect the raw observation traces to permanent behavioral changes using the ECHO Perfection Loop.

* **Modules Touched:** agents/scribe/scribe.ts, agents/recorder/recorder.ts, dev/agenda.md.  
* **Implementation:**  
  * Extend the SessionEnd hook to invoke the Scribe.  
  * The Scribe parses dev/experiences/raw-traces.jsonl for items with a frequency ![][image1] 3\.  
  * The Scribe updates dev/agenda.md (capped at 50 lines) with immediate capability gaps.  
  * The Scribe invokes the spawn\_agents tool to spin up the Recorder, passing the payload required to generate a RED phase FID documenting the recurring error.  
  * The FID traverses the standard ECHO loop, eventually arriving at the Forge for code implementation or the Scribe for LEARNINGS.md updates.  
* **Gates:** bun run learnings:check, bun run fid:verify \--check.  
* **Honest Boundary:** Law 2 enforcement. The operator must approve the scope of the generated FID before the Thinker initiates the GREEN phase.

### **Phase 4: Usage-Evidence Improvement Ritual (v2/v3 "Evolution")**

**Objective:** Establish a deterministic, zero-cost, operator-run ritual for skill refinement, bypassing the need for an offline DSPy/GEPA pipeline.

* **Modules Touched:** scripts/evolve-skills.ts (New).  
* **Implementation:**  
  * Develop a manual script executed by the operator during maintenance windows.  
  * The script aggregates trace data associated with a specific .agents/skills/ file and executes the standard configured LLM provider against the repository's test suite.  
  * The script outputs a candidate git patch and an accompanying FID detailing the proposed skill refinement. It never commits or mutates files directly.  
* **Gates:** Semantic-preservation diff analysis, native test suite execution.  
* **Honest Boundary:** Human pull-request review is the absolute hard boundary before the evolved skill replaces the existing artifact.

## **Risk Matrix**

| Risk Vector | Likelihood | Impact | Mitigation Strategy |
| :---- | :---- | :---- | :---- |
| **Context Bloat Over Time** | High | High | Strict physical decoupling. dev/experiences/ is un-indexed and never loaded into context. dev/agenda.md is hard-capped at 50 lines. The boot-read dev/LEARNINGS.md remains gated by human/Adversary approval1. |
| **Agent Hallucinated Lessons** | Medium | High | Structural prohibition of self-reporting. The Verifier agent must execute terminal commands and paste exact output into the FID AUDIT phase2. FIDs lacking stdout evidence are mechanically rejected by fid:verify. |
| **Prompt-Injection via Authored Skills** | Medium | Critical | All agent-authored skills land in .quarantine/. ZTAP provenance tracks the origin node. The EHEL skill\_manage gate blocks writes containing restricted CLI commands or undefined execution environments8. |
| **Multi-Agent Race Conditions** | Low | Medium | Strict separation of duties2. Only the Scribe holds the skill\_manage tool. Only the Recorder holds FID creation tools. The EHEL synchronizes file locks across subagent processes. |
| **Quality Ceilings Breached** | Low | Medium | Agent-authored files are subjected to the same protocol.config.yaml limits (e.g., 300 lines/file, max complexity 10\)1. The skills:check utility enforces this synchronously during the write\_file operation. |

## **6-Month Horizon Note**

The mechanical capture layer and the hybrid storage model are highly resilient architectural choices that will scale cleanly as the repository expands over the next six months. The adoption of the references/ directory pattern for progressive disclosure will likely become the standard operational paradigm for all Savant-Code data loading.  
However, the deduplication heuristic (relying on exact hashing of tool names and truncated error strings) will likely require a revisit. As the volume of traces increases over extended use, syntactically distinct but semantically identical errors will bypass the hash check. The framework should anticipate replacing this string-matching logic with a lightweight semantic similarity vector search (potentially leveraging a local sqlite-vss instance tied to packages/database/) to cluster related capability gaps more effectively.

## **Open Questions**

Before initiating Phase 1 development, the following operational questions require explicit resolution:

> 1. **Token Cost Allocation:** The Scribe's SessionEnd task-review process operates as a background synthesis task. Does this consume tokens from the operator's primary configured API key, and if so, what is the maximum permissible token expenditure threshold for this hidden background process?  
> 2. **Adversary Override Capacity:** In STRICT execution mode, does the Adversary agent possess the authority to independently audit and clear a skill from the .quarantine/ directory, or is a human operator explicitly required to invoke the skills trust CLI command for absolute security compliance?  
> 3. **Skill Depreciation Mechanics:** If an agent-authored skill is promoted to the active directory but remains uninvoked by the Orchestrator over a 30-day rolling window, should the Scribe mechanically execute a delete action during SessionEnd to recover the context budget, or should it merely demote the skill back to .quarantine/?

#### **Works cited**

> 1. AGENTS.md  
> 2. ECHO.md  
> 3. self-improvement | Skills Marketplace \- LobeHub, [https://lobehub.com/skills/openclaw-skills-self-improving-agent-1-0-2](https://lobehub.com/skills/openclaw-skills-self-improving-agent-1-0-2)  
> 4. hermes-agent/website/docs/user-guide/features/skills.md at main \- GitHub, [https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/skills.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/skills.md)  
> 5. RangeKing/self-evolving-agent: An OpenClaw skill that upgrades self-improving agents from reactive error logging to goal-driven capability evolution with curriculum, evaluation, transfer, and promotion. \- GitHub, [https://github.com/RangeKing/self-evolving-agent](https://github.com/RangeKing/self-evolving-agent)  
> 6. GitHub \- sudokrang/aceforge: Self-evolving skill engine for OpenClaw agents. Observes tool usage, crystallizes patterns into auditable SKILL.md files through a dual-model LLM pipeline, and continuously validates with 23 adversarial mutations. Research-grounded. Human-approved. Nothing auto-deploys., [https://github.com/sudokrang/aceforge](https://github.com/sudokrang/aceforge)  
> 7. protocol.config.yaml  
> 8. README.md  
> 9. Immutable/protected skills \- prevent agent from modifying critical skills without user approval · Issue \#25083 · NousResearch/hermes-agent \- GitHub, [https://github.com/NousResearch/hermes-agent/issues/25083](https://github.com/NousResearch/hermes-agent/issues/25083)  
> 10. \[Feature\]: Self-Improving Agent \- \`.learnings/\` Directory and Auto-Reflection · Issue \#575 · agentscope-ai/QwenPaw \- GitHub, [https://github.com/agentscope-ai/QwenPaw/issues/575](https://github.com/agentscope-ai/QwenPaw/issues/575)  
> 11. ARCHITECTURE.md  
> 12. 8 Best OpenClaw Skills for AI Chatbot Development \- Fastio, [https://fast.io/resources/best-openclaw-skills-ai-chatbot-development/](https://fast.io/resources/best-openclaw-skills-ai-chatbot-development/)  
> 13. Nous Research Adds /learn to Hermes Agent's Skills System, Capturing Workflows as Slash Commands Without Hand-Writing SKILL.md \- MarkTechPost, [https://www.marktechpost.com/2026/06/24/nous-research-adds-learn-to-hermes-agents-skills-system-capturing-workflows-as-slash-commands-without-hand-writing-skill-md/](https://www.marktechpost.com/2026/06/24/nous-research-adds-learn-to-hermes-agents-skills-system-capturing-workflows-as-slash-commands-without-hand-writing-skill-md/)  
> 14. 8 Self-Evolving Skills Hermes Agent Writes on Its Own \- Security Boulevard, [https://securityboulevard.com/2026/06/8-self-evolving-skills-hermes-agent-writes-on-its-own/](https://securityboulevard.com/2026/06/8-self-evolving-skills-hermes-agent-writes-on-its-own/)  
> 15. When Tool-Backed Skill Retrieval Fails:Source-Style Collapse in Executable Capability Retrieval \- arXiv, [https://arxiv.org/html/2608.16502v1](https://arxiv.org/html/2608.16502v1)  
> 16. SkillGenBench: Why Generating Skills Is Harder Than Using Them (with live demo), [https://medium.com/@visrow/skillgenbench-why-generating-skills-is-harder-than-using-them-with-live-demo-5de3a1613b96](https://medium.com/@visrow/skillgenbench-why-generating-skills-is-harder-than-using-them-with-live-demo-5de3a1613b96)  
> 17. self-evolving-agent/README.zh-CN.md at main \- GitHub, [https://github.com/RangeKing/self-evolving-agent/blob/main/README.zh-CN.md](https://github.com/RangeKing/self-evolving-agent/blob/main/README.zh-CN.md)  
> 18. Self Improving Agent OpenClaw Skill \- Auto Refinement, [https://openclawvps.io/skills/self-improving-agent](https://openclawvps.io/skills/self-improving-agent)  
> 19. Proactive Self-Improving Agent skill for OpenClaw \- combines context protection (WAL/Buffer) with structured learning and safe evolution \- GitHub, [https://github.com/yanhongxi-openclaw/proactive-self-improving-agent](https://github.com/yanhongxi-openclaw/proactive-self-improving-agent)  
> 20. Hermes Agent: Persistent Memory, Dynamic Skills, and Self-Improvement \- Better Stack, [https://betterstack.com/community/guides/ai/hermes-agent/](https://betterstack.com/community/guides/ai/hermes-agent/)  
> 21. hermes-agent-self-evolution/README.md at main \- GitHub, [https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/README.md](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/README.md)  
> 22. NousResearch/hermes-agent-self-evolution \- GitHub, [https://github.com/NousResearch/hermes-agent-self-evolution](https://github.com/NousResearch/hermes-agent-self-evolution)  
> 23. hermes-agent-self-evolution \- AI Agents on GitHub (5.1k ) | SkillsLLM, [https://skillsllm.com/skill/hermes-agent-self-evolution](https://skillsllm.com/skill/hermes-agent-self-evolution)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAZCAYAAAA4/K6pAAAAs0lEQVR4XmNgGAVUA45AfAKII4CYFU2OaMAJxElAfAGIk4GYG1WaeAByAcglZ4C4Boj5UKWJB8xA7ATEh4G4G4iFUaWJB4xAbA7E+4F4ChBLokoTD9iBuA6InwCxCpocXoAcuPkMJAQuSCFIwzkGEqMXFOqg0AelC38GSGASBUCBAwokUGBZMZCgEQR8gHgjEOsxQEJ9CAJQCIszQMKBEBZjwBI+BkA8i0jcy0BBahwFWAAAAPsZXQQqB9UAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAdklEQVR4XmNgGAWjYMABBxCnATEPugQlgBGIW4HYGF2CUgAysBeIWdAlKAEg1xYAcRyUjRUIALEkiVgOiOcD8WQg5mOgEjAB4tVALIMuQS4QBuLFQCyPLkEJyALiCHRBSgAonU4FYml0CUoAKLZ5ofQoGAX0AAA5bAi7Yfn2hgAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAZCAYAAAA4/K6pAAAAp0lEQVR4XmNgGAV0BXxAXAPEh4BYGU0OLxAG4m4gPgzETkDMjCqNGygC8VwGiI3mQMyIKo0bqAPxaijWYiBSI0gRyJbtDBBbQbaTBPyB+BMQBzEQaSM2QHZgoQNYdJ1ggLiMbIO4gTgfiM8BcRwQc6JKEw9YgTiCAWIQyECQwWQBkFdAXtoBxCpocoMAgPwpDsSSRGAxBiwxYwDEs4jEvQwQg0YBtQAARkwZc7R7oCEAAAAASUVORK5CYII=>