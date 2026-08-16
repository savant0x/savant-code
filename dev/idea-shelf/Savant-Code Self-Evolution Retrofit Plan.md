# **Architectural Synthesis and Retrofit Strategy: Evolving Savant-Code via ECHO-Gated Genetic-Pareto Optimization**

The transition from static agent instructions to self-evolving capabilities represents a critical frontier in compound artificial intelligence systems. Historically, adapting large language models to specialized downstream tasks relied heavily on reinforcement learning techniques, most notably Group Relative Policy Optimization (GRPO)1. While effective for weight-level alignment, reinforcement learning paradigms are notoriously sample-inefficient, often requiring tens of thousands of rollouts to learn new tasks, and they operate on sparse, scalar rewards that provide limited diagnostic information regarding specific failure modes2. The emergence of reflective prompt evolution—treating natural language as the gradient—demonstrates that the interpretable nature of language provides a far richer learning medium1. By analyzing execution traces in plain text, evolutionary algorithms can outperform traditional reinforcement learning methods by significant margins while utilizing exponentially fewer compute resources3.  
Integrating autonomous evolution into enterprise-grade systems introduces severe governance challenges. Unsupervised prompt mutation risks catastrophic forgetting, where an agent overfits to a new problem while degrading performance on previously mastered tasks, and autonomous drift, where the agent's behavior deviates unpredictably from its core mandate7. Savant-Code, operating under the strict, deterministic governance of the ECHO Protocol (v0.2.0), explicitly rejects autonomous drift9. The framework mandates that all functional changes pass through a rigid Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL) and are mechanically enforced by the ECHO Harness Enforcement Layer (EHEL)10.  
This report provides an exhaustive deconstruction of existing self-evolution paradigms, focusing on the Hermes agent ecosystem and the Genetic-Pareto (GEPA) algorithm. It subsequently designs a comprehensive retrofit architecture tailored specifically for Savant-Code. By decoupling the mathematical brilliance of Pareto-based search from the opaque, loosely governed DSPy pipelines used in Hermes, and instead mapping those evolutionary mechanics directly onto Savant-Code’s multi-agent roster and EHEL gates, the system can achieve continuous, measurable skill improvement without compromising deterministic safety.

## **Part I: Deconstruction of the Hermes Agent Ecosystem**

The Hermes Agent Self-Evolution pipeline represents the current state-of-the-art in reflective prompt optimization, operating externally to the core agent to systematically improve skills, tool descriptions, and system prompts11. The architecture is defined by a five-phase roadmap, beginning with skill file mutations and theoretically culminating in the Darwinian evolution of underlying Python execution code11.

### **The GEPA Mechanism and Multi-Objective Search**

At the core of the Hermes optimization engine is the Genetic-Pareto (GEPA) algorithm, a framework that leverages natural language feedback and multi-objective evolutionary search to adapt language models14. Standard automatic prompt optimization algorithms often suffer from local optimum convergence; they identify a prompt configuration that maximizes the mean score across a dataset, only to discover that the resulting prompt excels at one specific edge case while failing broadly across others7. GEPA mitigates this through a Pareto-based selection mechanism that explicitly balances exploration and exploitation while maintaining a diverse pool of candidate instructions7.  
The mechanism relies on a strict segregation of evaluation data. Before optimization begins, the dataset is partitioned into a fixed validation set (![][image1]) and a distinct feedback set (![][image2])7. This isolation prevents overfitting, as prompts are mutated based on the diagnostic signals extracted from the feedback set but are strictly selected based on their performance against the held-out validation set6.  
During operation, GEPA evaluates candidate prompts and identifies the Pareto frontier—the set of all non-dominated prompts. A prompt is considered non-dominated if no other candidate strictly outperforms it across all evaluation metrics in the ![][image1] set without regressing on at least one other metric7. By sampling parent prompts from this frontier using frequency-weighted selection, the algorithm ensures that highly specialized instructions, which may win decisively on specific tasks despite a lower mean score, are preserved and selected for further mutation7.  
Once a parent is selected, the algorithm executes the prompt against a minibatch from the feedback set, collecting Actionable Side Information (ASI)15. This ASI includes raw execution traces, tool call parameters, reasoning logs, and error stack traces2. A reflection model analyzes these traces in natural language to diagnose exact failure points and proposes a targeted mutation to the prompt3. The resulting child prompt must pass a Minibatch Gate (outperforming the parent on the immediate test) and a Pareto Gate (proving it is non-dominated relative to the entire existing archive on the validation set) before it is accepted into the frontier7.

| Feature | Reinforcement Learning (GRPO) | Bayesian Search (MIPROv2) | Reflective Evolution (GEPA) |
| :---- | :---- | :---- | :---- |
| **Optimization Medium** | Model weights (Policy gradients) | Textual instructions & few-shot demos | Textual instructions via natural language |
| **Feedback Signal** | Sparse scalar rewards | Scalar rewards evaluating configurations | Actionable Side Information (ASI) & traces |
| **Sample Efficiency** | Low (\~24,000 rollouts required) | Moderate | High (often \< 1,000 rollouts) |
| **Convergence Risk** | High (Reward hacking) | Moderate (Local optima) | Low (Pareto frontier diversity) |
| **Primary Strength** | Baking behavior into small models | Rapid optimization of static pipelines | Interpretable, high-bandwidth diagnostics |

The empirical results of this approach are highly compelling. Benchmarks indicate that GEPA outperforms GRPO by an average of 6 to 10 percentage points, achieving these results while requiring up to 35 times fewer computational rollouts1. Furthermore, GEPA consistently outperforms MIPROv2, a leading Bayesian prompt optimizer, demonstrating that natural language reflection provides a significantly higher-bandwidth learning signal than scalar reward optimization3.

### **The Skill Primitive and Progressive Disclosure**

The substrate upon which the Hermes evolution engine operates is the SKILL.md file, governed by the open agentskills.io specification16. This standard resolves the fundamental tension in agent architecture between providing extensive domain knowledge and exhausting the LLM context window18. If an agent is fed all operational procedures simultaneously, context degradation and excessive token costs render the system unusable5.  
The specification addresses this through a strict architectural pattern termed "progressive disclosure," which separates discovery metadata from execution logic across a three-tier loading system19.  
The first tier involves Discovery. The specification requires YAML frontmatter containing a name and a description20. The description functions as a routing heuristic, requiring an action verb and explicit trigger phrases dictating exactly when the skill should be activated22. At startup, the agent loads only this frontmatter into the system prompt, consuming roughly 30 to 100 tokens per installed skill, allowing the agent to maintain awareness of dozens of capabilities with negligible overhead18.  
The second tier, Activation, occurs when the routing layer determines that a user's request matches the skill description. Only then is the full Markdown body of the SKILL.md file injected into the active context window17. The standard advises keeping this instructional body focused and concise, generally under 5,000 tokens24.  
The final tier, Execution, involves the dynamic loading of external resources. The specification supports a rigid directory structure surrounding the SKILL.md file, allowing developers to bundle executable code in a scripts/ directory, large reference documents in a references/ directory, and templates in an assets/ directory20. The agent invokes tools to read or execute these files only when the activated instructions explicitly demand it, ensuring context is expended solely on active tasks18. Advanced frontmatter fields further control execution context, including allowed-tools to sandbox execution, disable-model-invocation to require manual user triggering, and context: fork to execute the skill in an isolated subagent27.

### **Safety Vulnerabilities and Governance Gaps**

Despite the theoretical rigor of the GEPA algorithm and the elegance of the agentskills.io standard, the practical implementation in the Hermes ecosystem exhibits severe vulnerabilities regarding safety and deterministic control. The pipeline relies heavily on the DSPy framework, operating externally to the agent and utilizing Python-based assertion gates to validate mutations11.  
This architecture led to a critical failure mode documented in the repository as "ghost improvements" (Issue \#38). Because the DSPy SkillModule wrapped the skill text in an opaque optimization layer, the GEPA engine mutated the module's docstring rather than the underlying Markdown skill body29. The candidate passed all LLM-as-a-judge fitness evaluations and size constraints, appearing as a massive statistical improvement, while the actual output was a disconnected wrapper fragment devoid of semantic utility30. This exposes the fundamental danger of allowing LLM-driven pipelines to evaluate their own structural integrity without mechanical, deterministic verification gates.  
Furthermore, the Hermes safety model relies on post-generation filtering. Constraints such as skill size limits and caching compatibility are evaluated only after the candidate variants are generated11. The final promotion mechanism assumes a traditional software engineering workflow, emitting a GitHub Pull Request for human review11. While suitable for an external research pipeline, this asynchronous, externalized promotion path is entirely incompatible with an integrated, self-contained multi-agent operating system designed to refine its own behaviors at runtime.

## **Part II: Candidate Isolation in Lightweight Evolutionary Systems**

Alternative evolutionary implementations, conceptualized in lightweight frameworks and session-mining utilities, offer critical insights into localized, incremental improvement without the overhead of DSPy. Systems designed to run alongside standard agent workflows rely heavily on SQLite session databases to extract empirical performance data rather than generating synthetic benchmarks13.  
The defining mechanism of these lightweight systems is the continuous aggregation of failure patterns. By monitoring execution logs, these systems identify instances where an agent engaged in repetitive retry loops, selected incorrect tools, or required explicit user correction31. This approach transforms ordinary user interactions into high-fidelity training signals, organically constructing the ![][image2] datasets required for reflection without incurring synthetic generation costs13.  
Crucially, these systems implement strict candidate isolation. Rather than attempting to patch operational skills dynamically, the mutation engine writes candidate artifacts to isolated, hidden directories (e.g., .pi/hermes-self-evolution/)32. The original skill file remains untouched, ensuring immediate operational stability. The candidate files are accompanied by deterministic delta reports highlighting the precise modifications, mandating explicit human review before any changes are merged into the active path32.  
While highly secure, these lightweight systems lack a formal, adversarial evaluation framework. They rely on human operators to identify subtle regressions or logic flaws in the proposed candidates, placing an unsustainable cognitive burden on the user32. The absence of automated, multi-objective Pareto verification means these systems cannot guarantee that a patch addressing one failure mode will not inadvertently degrade performance on another.

## **Part III: The Savant-Code Retrofit Architecture**

Integrating evolutionary self-improvement into Savant-Code requires discarding opaque wrappers and external pipelines. The objective is to extract the mathematical rigor of GEPA—specifically the Pareto dominance evaluation and trace-based reflection—and encode it directly into the deterministic state machine of the ECHO Protocol (v0.2.0)9.  
Savant-Code enforces a strict separation of duties across a 10-agent roster9. Therefore, self-evolution cannot be a monolithic process; it must be deconstructed into discrete phases handled by specialized agents, with all mutations deterministically bounded by the ECHO Harness Enforcement Layer (EHEL) and routed through the Feature Implementation Document (FID) lifecycle.

### **Enhancing the Skill Primitive for Deterministic Evaluation**

Savant-Code currently supports OpenClaw-format skills discovered at startup33. To support robust evolution, the system must fully adopt the agentskills.io standard, extending it to meet EHEL’s rigorous verification requirements.  
The primary architectural shift requires separating the YAML frontmatter from the Markdown instruction body at the parser level20. EHEL will be updated to validate the frontmatter strictly, guaranteeing that the name and description fields exist and that the description adheres to character limits20. Crucially, Savant-Code will mandate the allowed-tools field for all evolvable skills18. This transforms the skill from a suggestion into a strict sandbox; if an active skill attempts to invoke a tool absent from its allowed-tools array, EHEL will deterministically block the execution, ensuring that mutations cannot escalate privileges or execute destructive commands26.  
To support GEPA's ![][image1] validation phase, the directory structure of the skill primitive will be extended to include an evals/ subdirectory. This directory will house deterministic input-output pairs, unit tests, or validation scripts specific to that skill. This ensures that the skill is packaged alongside the exact mathematical benchmarks required to prove its efficacy, moving evaluation away from subjective LLM judgments and toward mechanical verification.

| Architectural Layer | Hermes Implementation | Savant-Code Retrofit Strategy |
| :---- | :---- | :---- |
| **Pipeline Container** | External DSPy framework wrapper | Native ECHO Perfection Loop (FSM) |
| **Skill Schema** | agentskills.io (Loose validation) | agentskills.io \+ Mandatory allowed-tools \+ evals/ |
| **Mutation Engine** | Monolithic prompt generation | SequentialThinkingServer branches via Thinker |
| **Constraint Enforcement** | Post-generation Python asserts | Pre-write EHEL deterministic gating (Levenshtein) |
| **Evaluation Mechanism** | LLM-as-a-judge / Scalar heuristic | Isolated context: fork subagent mechanical tests |
| **Promotion Path** | Asynchronous GitHub Pull Request | FID Archival \+ Human UI Ratification |

### **Mapping GEPA to the ECHO Perfection Loop**

The GEPA evolutionary algorithm aligns seamlessly with the discrete phases of the Savant-Code Perfection Loop. By executing the evolution process as a standard FID lifecycle, the system maintains a perfect audit trail and guarantees separation of duties10.

#### **The RED Phase: Trace Telemetry and Candidate Identification**

The evolution cycle is initiated either via manual command (/evolve \<skill-name\>) or scheduled cadence. The Orchestrator spawns the **Detective** agent, assigning it the task of building the ![][image2] dataset. The Detective utilizes native read tools to scan dev/session-summaries/ and .savant/traces.db9.  
A novel EHEL modification will enable the automatic serialization of tool execution traces. Whenever a user issues a correction during a standard session, EHEL will flag the preceding tool invocation as a negative trace, permanently logging the inputs, outputs, and subsequent correction. The Detective compiles these high-fidelity failure records and authors the RED section of a new FID, documenting exactly where and why the current skill architecture failed10.

#### **The GREEN Phase: Pareto Generation via Sequential Thinking**

The **Thinker** and **Forge** agents assume control. The Thinker analyzes the Detective's Actionable Side Information (ASI). To mimic GEPA's diverse candidate generation, the Thinker leverages the SequentialThinkingServer9. Rather than utilizing the tool for linear logical progression, the Thinker repurposes the branchId parameter to establish distinct evolutionary paths9.  
Branch A may represent a mutation optimized for extreme precision, introducing rigid constraints to the skill body. Branch B may represent a mutation optimized for speed, simplifying the logic. The Thinker maps out these Pareto variants and finalizes the GREEN section of the FID9. The Forge then takes these specifications and authors the candidate SKILL.md files, writing them strictly to an isolated dev/scratchpad/skill-candidates/ directory9.  
To enforce the genetic nature of the algorithm and prevent catastrophic structural collapse, EHEL's existing Levenshtein distance metric will be rigorously applied10. EHEL will intercept the Forge's write\_file calls; if any candidate variant alters more than 10% of the baseline skill's character count, EHEL will mechanically reject the write. This forces the Thinker to propose surgical, incremental mutations, mirroring biological evolution.

#### **The AUDIT Phase: Deterministic Mechanical Verification**

The **Verifier** agent receives the generated candidates. In stark contrast to Hermes, which relies heavily on LLM-based scoring, Savant-Code demands deterministic evidence10. The Verifier does not read the candidates and guess their efficacy. Instead, it instructs the Orchestrator to spawn an isolated subagent utilizing the context: fork parameter, loading the candidate skill in a hermetically sealed environment26.  
This subagent executes the deterministic tests located in the candidate's evals/ directory. EHEL monitors this execution, capturing exact success rates, token consumption metrics, and latency36. EHEL then injects this raw statistical data directly into the Verifier's message history9. The Verifier pastes these hard metrics into the AUDIT section of the FID, fully satisfying Law 3 (Verify Before Proceed) with irrefutable, mechanical proof10.

#### **The ADVERSARIAL Phase: Pareto Dominance Verification**

The **Adversary** agent performs the critical mathematical function of the GEPA algorithm: the Pareto dominance check7. The Adversary reviews the mechanical metrics generated during the AUDIT phase, comparing each candidate against the baseline skill.  
If a candidate is dominated—meaning it performs worse than the baseline across all metrics—the Adversary issues a REFUTED verdict, and the candidate is discarded7. If a candidate expands the Pareto frontier—excelling in a new metric without catastrophic regression elsewhere—the Adversary issues a CONFIRMED verdict7. This architectural decision is vital; shifting the complex dominance logic to the Adversary ensures a meta-verification check, preventing the system from accepting biased or hallucinated improvements10. If no candidates survive, the FSM routes back to SELF-CORRECT10.

#### **The COMPLETE Phase: Human Ratification**

If a candidate survives the ADVERSARIAL phase, the **Recorder** updates the final sections of the FID and prepares it for closure10. At this juncture, Savant-Code enforces its philosophical mandate: human governance over autonomous drift9. The system pauses, presenting the surviving, optimal candidate to the human operator (Spencer) alongside its performance deltas. Upon explicit ratification, the Orchestrator executes a filesystem move, promoting the candidate from the scratchpad to the active .savant/skills/ directory, and the Recorder archives the FID9.

## **Part IV: Feature Implementation Documents**

The following draft FIDs provide the precise architectural blueprints required for the Forge and Verifier to implement the self-evolution subsystem within Savant-Code.

### **Draft FID 1: EHEL Trace Telemetry and Skill Schema Hardening**

# **Title**

FID-2026-0812-001-skill-primitive-and-trace-telemetry

## **Metadata**

* **Filename**: FID-2026-0812-001-skill-primitive-and-trace-telemetry.md  
* **ID**: FID-2026-0812-001  
* **Severity**: High  
* **Status**: analyzed  
* **Created**: 2026-08-12

## **RED Phase (Detective)**

The current Savant-Code runtime lacks the telemetry infrastructure required to build ![][image2] datasets for evolutionary reflection, and the skill parsing logic lacks the deterministic sandboxing required for safe mutation.

* **Evidence 1**: The EHEL post-write scanners in packages/agent-runtime/src/tools/ do not serialize exact JSON inputs/outputs of tool calls to persistent storage, causing critical Actionable Side Information (ASI) to be lost between sessions.  
* **Evidence 2**: The OpenClaw skill parser in common/src/util/ does not enforce the agentskills.io standard's 1024-character limit on the description field, nor does it parse or enforce the allowed-tools security array.  
* **Evidence 3**: There is no structural convention for linking deterministic evaluation datasets (![][image1]) to individual skills.

## **GREEN Phase (Thinker \+ Recorder)**

The solution requires hardening the skill primitive and capturing execution telemetry at the harness level.

> 1. **Schema Hardening**: Update the skill parser utilizing Zod to strictly validate agentskills.io YAML frontmatter. The parser will mandate the name and description fields (enforcing the \<1024 character cap) and require the allowed-tools array for all skills subjected to evolution.  
> 2. **Evaluation Directory**: Extend the skill resolution logic to explicitly map .savant/skills/\<skill-name\>/evals/ as the canonical location for ![][image1] benchmark datasets.  
> 3. **Trace Serializer Integration**: Modify the EHEL tool executor. Upon the completion of any tool call, EHEL will asynchronously serialize the exact tool parameters, the generated output, and the execution latency to a local SQLite store (.savant/traces.db).  
> 4. **Correction Flagging**: Implement a heuristic in the Orchestrator's input handler. If a user prompt contains explicit correction phrasing following a tool output, the preceding entry in traces.db will be flagged as a high-value negative trace, building the ![][image2] corpus.  
> 5. **Tool Gating (Law 1/3 integration)**: Modify EHEL to read the allowed-tools array upon skill activation. If an active skill attempts to invoke a tool outside this array, EHEL will deterministically block execution and return a hard failure receipt to the agent, ensuring mutated skills remain sandboxed.

*Unanswered Questions Addressed*:

* *Q: How is the SQLite trace database prevented from unbounded growth?* A: EHEL will implement a rolling retention policy, retaining only the 2,000 most recent traces, permanently archiving those explicitly flagged by user corrections.

## **AUDIT Phase (Verifier)**

*Pending implementation. Requires execution of bun run test on the updated Zod schemas and SQLite serialization logic. Requires grep verification that allowed-tools is evaluated at the tool execution boundary.*

## **ADVERSARIAL Phase (Adversary)**

*Pending Verifier output.*

## **Resolution**

*Pending.*

### **Draft FID 2: Pareto Candidate Generation via Sequential Thinking**

# **Title**

FID-2026-0812-002-pareto-candidate-generation-engine

## **Metadata**

* **Filename**: FID-2026-0812-002-pareto-candidate-generation-engine.md  
* **ID**: FID-2026-0812-002  
* **Severity**: High  
* **Status**: analyzed  
* **Created**: 2026-08-12

## **RED Phase (Detective)**

To replicate the GEPA evolutionary algorithm natively, the system must maintain a diverse pool of prompt candidates. The current SequentialThinkingServer tracks linear logical progression but lacks the programmatic structure to generate and evaluate parallel, multi-objective variants simultaneously.

* **Evidence 1**: agents/thinker/thinker.ts utilizes the branchId parameter to explore alternative logic, but does not associate distinct output payloads or evaluation metrics with specific branches.  
* **Evidence 2**: Savant-Code has no mechanism to enforce incremental genetic mutation, risking catastrophic structural collapse if the LLM completely rewrites a skill.

## **GREEN Phase (Thinker \+ Recorder)**

The solution requires repurposing the sequential thinking engine to manage the Pareto frontier and utilizing EHEL to constrain the mutation distance.

> 1. **Pareto Branch Extension**: Extend the SequentialThinkingServer state matrix to include candidatePayload and branchMetrics tied explicitly to the branchId.  
> 2. **Reflector Prompting**: Establish a dedicated /evolve instruction set for the Thinker. The Thinker will consume the ASI traces from traces.db (curated by the Detective) and diagnose failure modes in plain text.  
> 3. **Variant Generation**: The Thinker will generate exactly three distinct evolutionary branches per cycle. Each branch will represent a different optimization strategy (e.g., Branch A adds rigid constraints; Branch B simplifies logical flow).  
> 4. **Scratchpad Isolation**: The Forge will implement these candidates by writing them to isolated paths: dev/scratchpad/skill-candidates/\<branchId\>/SKILL.md.  
> 5. **Distance Bounding (EHEL)**: EHEL will intercept the Forge's write\_file and str\_replace tool calls directed at the scratchpad. EHEL will calculate the Levenshtein distance between the baseline skill and the candidate variant. If the character change exceeds 10%, EHEL will block the write, forcing the Thinker to propose incremental, surgical mutations.

*Unanswered Questions Addressed*:

* *Q: Does assigning variant generation to the Thinker and file writing to the Forge violate separation of duties?* A: No. The Thinker performs the analytical reasoning and outputs the exact strings; the Forge executes the implementation, ensuring the logic generator is separated from the filesystem executor.

## **AUDIT Phase (Verifier)**

*Pending implementation. Requires testing of the modified SequentialThinkingServer state persistence and verification of EHEL's 10% Levenshtein block on scratchpad writes.*

## **ADVERSARIAL Phase (Adversary)**

*Pending Verifier output.*

## **Resolution**

*Pending.*

### **Draft FID 3: ECHO-Gated Evolution Loop and Ratification**

# **Title**

FID-2026-0812-003-echo-gated-evolution-fsm

## **Metadata**

* **Filename**: FID-2026-0812-003-echo-gated-evolution-fsm.md  
* **ID**: FID-2026-0812-003  
* **Severity**: Critical  
* **Status**: analyzed  
* **Created**: 2026-08-12

## **RED Phase (Detective)**

The optimization loop requires a strict mathematical gate where candidate skills are evaluated against ![][image1] benchmarks and rejected if they regress. The current Perfection Loop evaluates the implementation of codebase fixes, but lacks a formal FSM path for evaluating the agent's internal instructional architecture against a dataset, and lacks a formal ratification step for promoting internal configurations.

* **Evidence 1**: The AUDIT phase as defined in ECHO.md relies on standard codebase build/test commands but lacks a definition for orchestrating an isolated mechanical evaluation of a SKILL.md file.  
* **Evidence 2**: There is no UI integration or command pathway to pause the FSM at the COMPLETE phase and await human authorization before migrating a file from the scratchpad to the active configuration directory.

## **GREEN Phase (Thinker \+ Recorder)**

The solution requires defining a specialized subset of the Perfection Loop for /evolve commands, shifting Pareto dominance calculations to the Adversary, and implementing a strict human ratification gate.

> 1. **Mechanical Evaluation (AUDIT)**: The Verifier will orchestrate deterministic testing. It will command the Orchestrator to spawn isolated subagents utilizing the context: fork parameter. Each subagent will load one candidate skill and execute the ![][image1] dataset located in the evals/ directory. EHEL will intercept the results, injecting the success rates, token costs, and latency metrics directly into the Verifier's message history to prevent LLM hallucination of test results.  
> 2. **Dominance Calculation (ADVERSARIAL)**: The Adversary will execute the Pareto dominance verification. It will compare the metrics of all candidates against the baseline. Any candidate that regresses across all metrics (is dominated) will be issued a REFUTED verdict. Candidates that expand the Pareto frontier without catastrophic forgetting will receive a CONFIRMED verdict. If all candidates are refuted, the FSM routes back to SELF-CORRECT.  
> 3. **Human Ratification (COMPLETE)**: The Recorder will append the metrics of the winning candidate to the FID. The system will halt, surface a UI prompt displaying the performance deltas, and request explicit authorization from the operator.  
> 4. **Promotion**: Upon receipt of a y confirmation, the Orchestrator will execute the filesystem move, transferring the optimal SKILL.md from the scratchpad to .savant/skills/, and the Recorder will archive the FID.

*Unanswered Questions Addressed*:

* *Q: How is context pollution prevented during the mechanical evaluation?* A: The explicit use of context: fork ensures that the synthetic testing occurs in a hermetically sealed environment, preventing the main session history from being contaminated by trial-and-error executions.

## **AUDIT Phase (Verifier)**

*Pending implementation. Requires simulation of the FSM path and validation of the subagent context isolation during the evaluation phase.*

## **ADVERSARIAL Phase (Adversary)**

*Pending Verifier output.*

## **Resolution**

*Pending.*

#### **Works cited**

> 1. Paper page \- GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning, [https://huggingface.co/papers/2507.19457](https://huggingface.co/papers/2507.19457)  
> 2. GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning \- arXiv, [https://arxiv.org/abs/2507.19457](https://arxiv.org/abs/2507.19457)  
> 3. DSPy GEPA vs MIPROv2: Auto Prompt Optimization 2026 \- Particula Tech, [https://particula.tech/blog/dspy-gepa-vs-miprov2-automatic-prompt-optimization](https://particula.tech/blog/dspy-gepa-vs-miprov2-automatic-prompt-optimization)  
> 4. GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning | Request PDF, [https://www.researchgate.net/publication/394049542\_GEPA\_Reflective\_Prompt\_Evolution\_Can\_Outperform\_Reinforcement\_Learning](https://www.researchgate.net/publication/394049542_GEPA_Reflective_Prompt_Evolution_Can_Outperform_Reinforcement_Learning)  
> 5. Is Fine-Tuning Better Than Prompt Engineering in 2026? \- LLM Stats, [https://llm-stats.com/blog/research/fine-tuning-vs-prompt-engineering-2026](https://llm-stats.com/blog/research/fine-tuning-vs-prompt-engineering-2026)  
> 6. GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning \- OpenReview, [https://openreview.net/forum?id=RQm2KQTM5r](https://openreview.net/forum?id=RQm2KQTM5r)  
> 7. GEPA | DeepEval \- The LLM Evaluation Framework, [https://deepeval.com/docs/prompt-optimization-gepa](https://deepeval.com/docs/prompt-optimization-gepa)  
> 8. Reflection in the Dark: Exposing and Escaping the Black Box in Reflective Prompt Optimization \- ACL Anthology, [https://aclanthology.org/2026.acl-srw.8.pdf](https://aclanthology.org/2026.acl-srw.8.pdf)  
> 9. ARCHITECTURE.md  
> 10. ECHO.md  
> 11. NousResearch/hermes-agent-self-evolution \- GitHub, [https://github.com/NousResearch/hermes-agent-self-evolution](https://github.com/NousResearch/hermes-agent-self-evolution)  
> 12. hermes-agent-self-evolution/README.md at main \- GitHub, [https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/README.md](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/README.md)  
> 13. hermes-agent-self-evolution/PLAN.md at main \- GitHub, [https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md)  
> 14. GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning \- alphaXiv, [https://www.alphaxiv.org/overview/2507.19457](https://www.alphaxiv.org/overview/2507.19457)  
> 15. GEPA: Optimize Anything with LLMs, [https://gepa-ai.github.io/gepa/](https://gepa-ai.github.io/gepa/)  
> 16. SKILL.md: The Agent Skills Format \- mdskills.ai, [https://www.mdskills.ai/specs/skill-md](https://www.mdskills.ai/specs/skill-md)  
> 17. Agent Skills Overview \- Agent Skills, [https://agentskills.io/home](https://agentskills.io/home)  
> 18. What Are Agent Skills and How To Use Them \- Strapi, [https://strapi.io/blog/what-are-agent-skills-and-how-to-use-them](https://strapi.io/blog/what-are-agent-skills-and-how-to-use-them)  
> 19. Agent Skills: A Portable Format for Teaching AI Agents How to Work | Ylang Labs, [https://ylanglabs.com/blogs/agent-skills](https://ylanglabs.com/blogs/agent-skills)  
> 20. How Do You Build Your First Agent Skill? A Complete SKILL.md Anatomy Guide \- Agentman, [https://agentman.ai/blog/build-your-first-agent-skill-skillmd-anatomy](https://agentman.ai/blog/build-your-first-agent-skill-skillmd-anatomy)  
> 21. Agent Skills Guide 2026: Build, Share & Secure | Termdock, [https://www.termdock.com/en/blog/agent-skills-guide](https://www.termdock.com/en/blog/agent-skills-guide)  
> 22. 94% of Published SKILL.md Files Skip the Spec's Two Most Basic Patterns, [https://dev.to/moonrunnerkc/94-of-published-skillmd-files-skip-the-specs-two-most-basic-patterns-oo0](https://dev.to/moonrunnerkc/94-of-published-skillmd-files-skip-the-specs-two-most-basic-patterns-oo0)  
> 23. The SKILL.md Pattern: How to Write AI Agent Skills That Actually Work | by Bibek Poudel, [https://bibek-poudel.medium.com/the-skill-md-pattern-how-to-write-ai-agent-skills-that-actually-work-72a3169dd7ee](https://bibek-poudel.medium.com/the-skill-md-pattern-how-to-write-ai-agent-skills-that-actually-work-72a3169dd7ee)  
> 24. Specification \- Agent Skills, [https://agentskills.io/specification](https://agentskills.io/specification)  
> 25. agentskills.io Documentation \- DocIngest, [https://docingest.com/docs/agentskills.io](https://docingest.com/docs/agentskills.io)  
> 26. Agent Skills: The Open Standard for Teaching AI Agents \- Shiplight AI, [https://www.shiplight.ai/blog/agent-skills](https://www.shiplight.ai/blog/agent-skills)  
> 27. Agent Skills Explained: How SKILL.md Files Work and Why They're Everywhere \- Firecrawl, [https://www.firecrawl.dev/blog/agent-skills](https://www.firecrawl.dev/blog/agent-skills)  
> 28. AI Agent Skills Guide 2026: SKILL.md, Claude Code, Codex & Security \- The Prompt Index, [https://www.thepromptindex.com/how-to-use-ai-agent-skills-the-complete-guide.html](https://www.thepromptindex.com/how-to-use-ai-agent-skills-the-complete-guide.html)  
> 29. Code Audit: Phase 1 Critical Issues — Fitness Signal, Dead Config, Missing Benchmark Gate · Issue \#33 · NousResearch/hermes-agent-self-evolution \- GitHub, [https://github.com/NousResearch/hermes-agent-self-evolution/issues/33](https://github.com/NousResearch/hermes-agent-self-evolution/issues/33)  
> 30. Phase 1 SkillModule architecture prevents GEPA from mutating actual skill content \+ Nous API integration patches · Issue \#38 · NousResearch/hermes-agent-self-evolution \- GitHub, [https://github.com/NousResearch/hermes-agent-self-evolution/issues/38](https://github.com/NousResearch/hermes-agent-self-evolution/issues/38)  
> 31. GitHub \- Yonkoo11/hermes-dojo: Self-improvement system for Hermes Agent. Monitors performance, finds weak skills, fixes them with self-evolution, reports results., [https://github.com/Yonkoo11/hermes-dojo](https://github.com/Yonkoo11/hermes-dojo)  
> 32. kingkillery/pk-pi-hermes-evolve: Pi package inspired by Hermes Agent Self-Evolution with hybrid TypeScript \+ optional Python DSPy/GEPA backends. \- GitHub, [https://github.com/kingkillery/pk-pi-hermes-evolve](https://github.com/kingkillery/pk-pi-hermes-evolve)  
> 33. README.md  
> 34. License to Skill: You come here, to my place, without references, [https://bloom.security/blog/license-to-skill](https://bloom.security/blog/license-to-skill)  
> 35. Scary Agent Skills: Hidden Unicode Instructions in Skills ...And How To Catch Them, [https://embracethered.com/blog/posts/2026/scary-agent-skills/](https://embracethered.com/blog/posts/2026/scary-agent-skills/)  
> 36. AGENTIC CONTEXT ENGINEERING: EVOLVING CON- TEXTS FOR SELF-IMPROVING LANGUAGE MODELS \- ICLR Proceedings, [https://proceedings.iclr.cc/paper\_files/paper/2026/file/8a94ff6f922d995d7d3f4ebf4143e442-Paper-Conference.pdf](https://proceedings.iclr.cc/paper_files/paper/2026/file/8a94ff6f922d995d7d3f4ebf4143e442-Paper-Conference.pdf)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADoAAAAaCAYAAADmF08eAAACyUlEQVR4Xu2XW6hNURiFh5B7OAghURRHSUKKB0I8kFAUSqmjpJBEinjw4EEiUVIu5ZIIuYZcH70pl+LhkFIKTxRyGaMxZ2vtec6xdzqrLO1RX629/rnWmv+c/2VuoK666iqTZpB35FeOj+R9uP5GrpLR8YGy6yj5TqYl94eSy+QTmZzYSqde5BF5SvonNmkgeU5ukm6JrVQaQz6Q86RTYos6AY/R2NJqAZyPa1JDTnL0C5mUGsqkA2g9P6N6kDvkM5mY2EqjnuQ+2s5PaQhphqvzyEpTeVRLfs4iP8k10jWxFa3upGN6829ULT87kIOwo4sSW9HqDVf6dkmXavk5Ae6hR0jnxFa0xsNtr62UqlnV+ucg8hAuRFrdKOXsSbKKLCTn4N3W7ktjyTGyi8wkDWQA2U/Wh7GnydQwXr15GZw+e+G+vZncIm/g54aFsZrnDvi0tgk19vVx8G6l+amdkwPN5CwqnZQzq8mcYNdpSQumDyvElAoX4CKnVvQCLmAryHTyLDx7keyE363rxbD03XnhWtGWT6nhcJ0YFX5vI+syc0vpg6+RnW1/kLfw6umM+xWe+BRkuxSlBdGHlsO7Jntf8pgshSNgbhirInYDbk96Rve1S1oEOagFlSOvyEqyBd5R2fTOu8j6tr57JoyJ0rX6e2GSc3IyrrZ28iVZQp7A52NJE9kdrlv7LWmie9ByQdUN7iFLqcFwNMRaIscViXnH213pautjh+EwvgTvmHLnOhzKa0k/cgVZWEYpPPOTVV1QiCpiTsG7rucVEaonMWwbyYMwtjBpBxXmx8kGsg8OTzmo6rwx3FP4H4ILjQqMdmgEKqWJqg7IMTm8FV6k2eQ2nIeq/NpxvVfvb4KLWeF/HWN+doEdTKXipCavyUV7/jqVxipE0/al8ek9HVj6JPcKkSal1vLHavc/aD5cdLaj5H/Z6qrrH9Vva0yEe6bNoIMAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEwAAAAaCAYAAAAdQLrBAAADcUlEQVR4Xu2YWahNURjH/zJECFGIEqFEJFOKMhUeCE/kwRRelCmRKZEMhZJShnSTIUOSMYlrCK8UXjwgUQpPZOb79Z19zz7L3ufcc697H+7Z//rlWGvvtdb+1vf999pXypQpU6amo/HGO+NPjI/G+9zv78Zlo390QybXEeOHMSZo72lcND4ZI4O+ilV7457x1OgS9KGuxnPjutEm6KtIDTA+GOeMFkFfpCr5NVxb8Zou96ulYUdMBOyLMSLsqETtV7J/RWpr3DQ+G8OCvopTO6Na6f6Fehgv5W/TPoVdNWKc1mFjU1Rt/GuS8du4ouSgLDbOG4+MzkFfueIFdMr4Ks/4rcZPFbeL2ohNv2u8Vfqm10ql/KuZcUAesFlBH+pk3DCWGOuMloXddRKbeFue8Yx/R+l2UY7YeNZKNdRZpfxrqPwMdkjJwRgiP5KklXNdxMZEGf8/x19vbA8by1Gp81c3eRpj+B2CPrTIuCb/KjhqDI71dTc2yL8S5skztVg7B+Q9xmHjkrEq1z5XvobduX7WhDgPUhVn5AGOv4x4ls3yOch8NhorYVwqijF2ygOYZkOJGiTPntC/mGCG3OhPKzlYkdbq310bLi+jXvKAbJMfftPa+YKgnQfBX14on/FUQJTdBOaYfKMJxhT5OCeUXwNj47X9jHHyZGAONgSPpW2OsUZenpwASmqs8Ur5b8dfxhvjtTxbvskXNEr5DEhStFiyIBI7yYLZ+dnGXmOhPCPS2i8Yy7hZ7l8P5Q8Z+hfzVBvzjavye6PMmSrfdF4YbCKir2PuN/7FN/LGXDvUy8vqIh7olgoPs5TcM/lHfVzF2p8oP0bcv+LBQ2QbVMnLCfH2w1bIzGiOJD8miPvkZUxmFauaBhOLfCBfaCT8474KPWWgvFSS2vvKs4YxyFjeyPjXAmOCPPvIBIKGl/ESImDT5KIs8dGJxkx52WE1kZiDNUX+xTyMQ8kSvLI8rL4izXmg8GxGlhyUlx5GTbkQjKR2vAkvo1TwoZNyn1pptDJ2GcuN47nr0eTc/1fI/Y0/CuyQB5X7KPf4HHgjx5Te8nMiAWZOrKlR1FxejquNLYVdNSKILC70wLR2zDc6tvA76udf5mLOuLg2MmwCGz/yxL0LMUbc3OP3Noo4Tjw2zspTPlMJ4V2bjNFhR6ZMmTI1sP4CVL6rsEPwv+IAAAAASUVORK5CYII=>