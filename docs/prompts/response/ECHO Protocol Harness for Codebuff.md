# **Architectural Blueprint for ECHO Protocol Runtime Enforcement in Codebuff**

The paradigm of autonomous code generation is undergoing a fundamental structural transition. Historically, frameworks have relied upon prompt engineering—a practice of providing strong suggestions to Large Language Models (LLMs) in the hope of eliciting compliant behavior. However, as agentic workflows grow in complexity, prompt-driven adherence degrades due to context window saturation, attention mechanism drift, and the inherent probabilistic nature of generative models. This necessitates the creation of an "agent harness," an active constraint structure that wraps around the execution environment to physically gate and redirect the agent's operations, as opposed to a passive "agent runtime" that merely hosts execution capabilities.1  
The integration of the ECHO Protocol (v0.1.2) into the Codebuff AI coding agent framework represents a shift from heuristic guidance to deterministic, protocol-bound engineering. Codebuff provides a robust runtime environment powered by the Bun execution engine, offering a terminal user interface (TUI), native multi-agent orchestration, and a sequential loop execution architecture.3 However, the default "Buffy" persona operates without strict phased gating.3 Replacing "Buffy" with the protocol-bound "Savant" persona requires engineering a comprehensive runtime enforcement harness. This harness must programmatically enforce the protocol's 15 Laws, the Perfection Loop Finite State Machine (FSM), string-distance circuit breakers, Feature Implementation Document (FID) lifecycles, and an uncompromising boot sequence. This blueprint details the requisite architectural modifications across the Codebuff monorepo to guarantee absolute runtime compliance.

## **Baseline Architecture and the Limitations of the Existing Runtime**

To construct a binding harness, one must first dissect the target runtime environment. The Codebuff monorepo orchestrates agent execution primarily through the packages/agent-runtime/ directory.3 The core operational cycle is defined by the loopAgentSteps() function located in run-agent-step.ts.3 This loop repeatedly invokes runAgentStep(), which assembles a prompt, transmits it to the LLM via packages/llm-providers/, parses the response for tool calls, executes those tools, and appends the results to the context history until a terminal signal is reached.3  
The agent's persona and constraints are dynamically assembled using a layered prompt architecture originating in main-prompt.ts and templates/strings.ts.3 The system combines a static base system prompt, user inputs, instruction prompts, and step-level reminders encapsulated within \<system\_reminder\> XML tags.3 While this architecture is highly effective for injecting behavioral guidelines, it possesses no native concept of sequential phases, finite state machines, or deterministic verification gating. The agent can theoretically choose to execute a write\_file tool 8 and immediately signal an end\_turn 4 without ever validating the code through a test suite.  
Therefore, embedding the ECHO Protocol necessitates moving critical constraint logic out of the text-based prompt arrays and into the underlying TypeScript loop execution mechanics. The harness must intercept the LLM's outputs before they are processed by the tool handlers, evaluate the proposed actions against the active FSM state, measure the algorithmic distance of proposed code mutations, and artificially override the context stream when protocol violations occur.

## **Perfection Loop Finite State Machine Integration**

The most substantial architectural challenge is the implementation of the Perfection Loop FSM—a strict five-state transition sequence comprising RED, GREEN, AUDIT, SELF-CORRECT, and COMPLETE phases. The existing loopAgentSteps() operates as a flat while-loop without stateful phase awareness.3 The FSM must be overlaid onto this step-based architecture without breaking the underlying generation mechanics or creating infinite recursion loops.

### **Interception and State Injection**

Overlaying the FSM requires embedding a robust state tracking mechanism directly within the AgentState object, which serves as the mutable context payload passed continuously between runAgentStep() iterations.9 Relying solely on the LLM to self-declare its current state within its text response is insufficient due to hallucination risks. Instead, a strict runtime guard must enforce state transitions.  
The architectural recommendation is to introduce a dedicated, generic TypeScript state machine instance constructed using strictly typed discriminated unions. While heavy-duty libraries like XState provide comprehensive visualization and parallel state management, their inclusion adds unnecessary bundle weight and lifecycle complexity.12 A lightweight, custom-built type-safe engine—or a minimalist library like robot3—provides the necessary compile-time validation and runtime zero-overhead type guards required for synchronous loop interception.13  
The runtime integrates this state machine at the initialization of loopAgentSteps(). The LLM is instructed via the prompt harness that it cannot implicitly move between tasks; it must explicitly signal its intent to change phases using a newly engineered transition\_phase tool appended to the active toolNames array.4

### **Deterministic Transition Guard Logic**

When the agent attempts to invoke the transition\_phase tool, the tool handler in the agent-runtime package intercepts the payload. The transition is only permitted if the runtime guard functions validate the required evidence. This transforms the FSM from a conceptual guideline into a rigid, software-enforced physical barrier.

| Current FSM State | Permitted Next State | Required Payload Evidence | Deterministic Runtime Verification |
| :---- | :---- | :---- | :---- |
| **RED** (Start of Loop) | GREEN | {"next\_phase": "GREEN", "evidence": "FID-\#\#\#"} | The runtime parses the local file system to confirm that the referenced FID exists within dev/fids/ and contains valid failure logs. Rejects transition if absent. |
| **GREEN** (Implementation) | AUDIT | {"next\_phase": "AUDIT", "files\_mutated": \[...\]} | The runtime confirms that no single mutation exceeded the 10% Levenshtein limit. Forces transition block if rules are violated. |
| **AUDIT** (Verification) | SELF-CORRECT | {"next\_phase": "SELF-CORRECT", "failures": \[...\]} | Triggered automatically by the harness if synchronous build/test commands executed via run\_terminal\_command return non-zero exit codes. |
| **AUDIT** (Verification) | COMPLETE | {"next\_phase": "COMPLETE", "audit\_log": "..."} | The runtime verifies that testing commands resulted in a zero exit code and that newly introduced symbols return matches via code\_search call-graph validation. |
| **SELF-CORRECT** | AUDIT | {"next\_phase": "AUDIT", "files\_mutated": \[...\]} | The runtime ensures that code changes are minimal (sub-5%) and explicitly target the failures identified in the previous AUDIT phase. |

If the LLM attempts an illegal transition, such as attempting to invoke transition\_phase with next\_phase: COMPLETE while currently in the RED state, the transition tool handler instantly throws an exception. This exception is caught by the runAgentStep() wrapper, which suppresses the standard tool output and instead injects a severe system-level reprimand into the conversation history, forcing the context window to acknowledge the illegal operation without advancing the state machine.

## **Performance Engineering: Character-Change Delta Tracking**

The ECHO Protocol explicitly dictates a circuit breaker mechanism capping character changes at 10% of the total file character count per pass, known as the Levenshtein Metric constraint. Furthermore, the protocol demands a 500-character random sample comparison after each change to verify exact character matches of untouched code, thereby preventing the LLM from hallucinating unintended global refactors or erasing sections of a file due to context truncation.

### **Bit-Parallel Algorithmic Implementation**

Enforcing these metrics requires computing the edit distance between the original file content and the LLM's proposed payload prior to committing the write operation. Standard string diffing algorithms implemented via naive recursive matrices are computationally prohibitive when processing large source files synchronously within an active agent loop.17 The execution latency would result in significant degradation of the TUI responsiveness and block the Bun event loop.  
To achieve the necessary performance, the harness must incorporate a highly optimized, bit-parallel algorithmic implementation. Research indicates that the fastest-levenshtein library provides the most superior execution velocity within the JavaScript ecosystem, outperforming alternatives like didyoumean2 or native recursive loops by up to tenfold.17 The delta tracking mechanism hooks directly into the handlers for write\_file and str\_replace tools.8

### **The Delta Interception Mechanics**

When the LLM generates a payload for a code mutation tool, the execution follows a strict interception sequence:

1. **File Snapshotting:** Before the payload is evaluated, the runtime leverages Bun's native, high-performance file reading capabilities (Bun.file(path).text()) to load the current state of the target file into a temporary memory buffer.21  
2. **Distance Calculation:** The fastest-levenshtein algorithm is invoked against the snapshot and the proposed string payload. The resulting absolute edit distance integer is captured.  
3. **Threshold Evaluation:** The edit distance is divided by the total character count of the original snapshot to calculate the percentage delta. If this delta exceeds the 10.0% threshold mandated by Law 1 of the ECHO Protocol, the disk write operation is aborted.  
4. **Rejection Injection:** The runtime returns a structured error to the LLM via the tool output channel: System Alert: Circuit Breaker Tripped. Proposed edit represents an X% delta, exceeding the 10% maximum. Revert and narrow scope.

Simultaneously, the harness extracts a random contiguous 500-character block from a segment of the original file that the LLM was not instructed to modify. Following the application of the Levenshtein check, this block is cross-referenced against the proposed payload. If a strict equality check fails, the runtime infers that the LLM has generated structural hallucinations, triggering an automatic reversion of the tool call and enforcing a mandatory retry with a narrowed scope constraint injected into the step prompt.

## **Circuit Breakers: Convergence and Oscillation Detection**

Beyond pure string distance, the ECHO Protocol requires the detection of non-converging loops and repetitive issue oscillation. These constraints prevent the agent from endlessly consuming tokens while failing to resolve a compilation error or logical bug.

### **Rolling Window State Tracking**

The state tracking required to identify oscillation cannot exist in a vacuum; it must persist across multiple LLM generation cycles. The AgentState object must be augmented to include a rolling memory window of the last five file edits and the last five standard error outputs generated by terminal execution tools.9  
Convergence detection evaluates the character-change deltas over consecutive passes. If the runtime detects that the edit delta has dropped below 2% for two consecutive passes without the FSM successfully transitioning to COMPLETE, the harness flags a diminishing returns circuit breaker. The agent is forcefully prompted to recommend shipping the current state or escalate to human review.  
Oscillation detection relies on a cryptographic hashing function applied to the error outputs of failed verification commands. When the agent triggers a terminal command that returns a non-zero exit code, the harness strips volatile data (like memory addresses or timestamps) from the standard error string and generates a SHA-256 hash. If this identical hash appears three times within the same AgentState rolling window, the oscillation circuit breaker trips. This represents a "Hard Stop" condition, causing the framework to immediately suspend the autonomous loop, halt the agent process, and return control to the Codebuff TUI, accompanied by an explicit warning detailing the exact nature of the recurring error.

## **Automating the Feature Implementation Document (FID) Lifecycle**

The ECHO Protocol centers its project management around the Feature Implementation Document (FID) lifecycle. Every bug, architectural shift, or improvement must be cataloged, analyzed, fixed, verified, closed, and archived. A purely prompt-based approach is prone to failure; an LLM will frequently forget to update the FID status, fail to create the file in the correct directory, or hallucinate the changelog appending process. Automation at the runtime level is mandatory to guarantee process compliance.

### **Dedicated Lifecycle Tools**

To enforce the FID lifecycle, the Codebuff tool registry must be expanded within the agents/types/tools.ts configuration.4 Relying on the generic write\_file tool to manage structured markdown documents creates excessive variance. Instead, the runtime will expose three highly structured, schema-validated tools:

* **create\_fid:** This tool accepts a JSON payload detailing the issue description, related architectural file paths, and any associated standard error stack traces. Upon invocation, the runtime autonomously generates a standardized FID identifier (e.g., FID-042), scaffolds the markdown file using a strict template, and writes it directly to the dev/fids/ directory.  
* **update\_fid\_status:** This tool accepts the FID identifier and a target state transition enum (Analyzed, Fixed, Verified, Closed). The runtime handles the regex-based replacement of the frontmatter status tags within the document, preventing the LLM from accidentally destroying the file structure during manual edits.  
* **close\_and\_archive\_fid:** The archival mechanism is entirely abstracted from the LLM. When this tool is called, the runtime extracts the resolution summary from the FID, utilizes Bun's file system API to atomically move the document from dev/fids/ to the archive directory, and automatically opens CHANGELOG.md to prepend the summary beneath the current date header.

### **Autonomous Generation Hooks**

The runtime takes a proactive stance on documentation enforcement. If the LLM executes a run\_terminal\_command 8 that yields a non-zero exit code indicative of a compilation failure, and the subsequent step loop does not detect an invocation of create\_fid, the runtime intervenes. It intercepts the execution flow, autonomously scaffolds an FID containing the raw terminal output, and injects a high-priority system action into the context: System Action: Critical error detected. FID automatically generated at dev/fids/FID-\#\#\#. Phase forced to RED. Analyze failure. This guarantees that no failure state goes undocumented, strictly adhering to the protocol's cataloging requirements.

## **Deterministic Boot Sequence Gating**

The start of an ECHO Protocol session is defined by a rigorous sequence of initialization events. The agent must read ECHO.md, load operational commands from protocol.config.yaml, analyze language-specific coding standards, review previous session learnings, examine all open FIDs, and generate a new session summary before touching a single line of application code.

### **Hard Runtime Guard Interception**

Instructing the agent to perform these tasks via the system prompt provides no guarantee of execution; eager LLMs often attempt to immediately address the user's core request without establishing context. The Codebuff runtime must be modified to physically refuse application-level input until the boot sequence compliance is cryptographically verified by the harness.  
This requires the implementation of a BootGuard module instantiated within the run-agent-step.ts lifecycle.3 An explicit bootState property, initialized to PENDING, is added to the AgentDefinition configuration.4 When the mainPrompt() constructor evaluates the session start, it detects the pending state. Instead of appending the user's primary goal to the context array, the runtime caches the user's input in a separate memory buffer.  
The framework then artificially injects a dominant system message posing as the user: Commence ECHO Protocol Boot Sequence. Execute read\_files on ECHO.md and protocol.config.yaml. You are blocked from all other actions until compliance is verified.  
The loop executes, and the runtime monitors the tool calls. Only when the LLM successfully invokes the read\_files tool targeting the exact, absolute paths of the requisite configuration files does the BootGuard transition the bootState to COMPLETED. Upon completion, the cached primary user input is released into the conversation stream, allowing standard task processing to commence.

### **Emergency Halt Configuration Parsing**

Law 3 of the session lifecycle specifies that if the language key within protocol.config.yaml is set to the default placeholder "CHANGE\_ME", the agent must HALT. To prevent the LLM from ignoring this directive, the Codebuff runtime performs a parallel, synchronous read of the YAML configuration during the boot sequence. If the native Bun execution environment detects the "CHANGE\_ME" string during initialization, the runtime triggers a framework-level fatal exception. This bypasses the LLM entirely, emitting an unrecoverable error directly to the TUI and instantly killing the agent process, serving as an absolute enforcement of the emergency protocol.

## **Multi-Agent Orchestration and Protocol Inheritance**

Codebuff derives significant analytical power from its multi-agent orchestration architecture. The primary agent can spawn specialized subagents—such as File Explorers, Planners, or Security Scanners—to distribute workload and enhance context gathering.5 The parent harness manages the lifecycle of these subagents, passing context and merging results.1 For the ECHO Protocol to maintain its integrity, every spawned subagent must inherit the exact constraints binding the parent.

### **Intercepting the Spawn Parameters**

When the primary agent utilizes the spawn\_agents tool, it transmits a payload conforming to the SpawnAgentsParams interface, which dictates the target agent\_type and an optional instructional prompt.8 If left unmanaged, the subagent initializes with its default instructions, completely oblivious to the ECHO Protocol.  
To rectify this, the runtime must intercept the payload at packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts.3 Before the framework spins up the new agent process, it dynamically concatenates the ECHO Core Laws (Laws 1-4) and the Cross-Agent Claim Rule directly into the instructionsPrompt parameter of the child configuration. This programmatic inheritance guarantees that auxiliary workers are permanently bound by the immutable process laws, strictly prohibiting them from skimming files (enforcing 0-EOF reads) or self-reporting unverifiable data.

### **Enforcing the Cross-Agent Claim Rule**

A critical vulnerability in multi-agent systems is the propagation of hallucinated statistics between workers. The Cross-Agent Claim Rule strictly forbids unsubstantiated informational transfers. In standard multi-agent setups, when a subagent finishes its task, its raw text response is simply appended to the parent agent's context history via a set\_output command.8  
The runtime enforcement harness revamps this communication channel. When a subagent completes a task, the runtime intercepts the final output string and serializes it into a physical JSON artifact stored within a temporary .agents/cache/ directory.22 The parent agent does not receive the raw text. Instead, the framework mutates the parent's context array to include the absolute file path to the subagent's artifact.  
If the primary agent subsequently attempts to declare, "The security scanner found three vulnerabilities in the authentication controller," the runtime parses the proposed output string. Utilizing regex pattern matching for quantitative claims, the framework forces the parent to cite the exact line number of the cached artifact. If the claim cannot be physically traced back to the immutable file record generated by the subagent, the framework rejects the output, strictly enforcing the rule that specific facts must be independently verifiable.

## **Prompt Architecture and Context Economics**

The Codebuff runtime leverages a sophisticated 5-layer prompt assembly pipeline. The system builds the context window by aggregating the base system prompt, formatting placeholder variables, injecting the primary user input, appending the instruction prompt array, and dynamically wrapping step-specific reminders within XML tags prior to every LLM invocation.3  
The ECHO Protocol is exceptionally dense. Injecting the entirety of the 15 Laws, the FSM configuration, the Five Questions, the circuit breaker parameters, and the audit checklist into a single prompt layer would create severe context bloat, displacing relevant codebase intelligence and rapidly degrading the attention mechanism of the model. The protocol must be strategically distributed across the Codebuff prompt layers to maximize caching economics and behavioral adherence.

### **Strategic Distribution Matrix**

The runtime architecture separates the protocol into static identity constraints and dynamic operational parameters. This division ensures that static elements benefit from the heavy context caching provided by models like Claude 3.5 Sonnet or OpenAI's GPT-4o, while highly fluid state updates reside in the volatile layers.

| Protocol Component | Codebuff Target Layer | Architectural Rationale and Mechanics |
| :---- | :---- | :---- |
| **Persona & Core Identity** | systemPrompt (Layer 1\) | Replaces the canonical "Buffy" identity defined within agents/base2/base2.ts.3 Serves as the static foundation, caching efficiently across the entire session lifecycle. |
| **Vocabulary Matrix** | systemPrompt (Layer 1\) | Ensures domain-specific terminology (e.g., FID, Double Audit, Baseline) is deeply embedded in the semantic space before operational instructions are evaluated. |
| **The 15 Laws** | instructionsPrompt (Layer 4\) | Injected directly after the user input and tagged as \`\`.3 This positions the immutable laws at the optimal depth for attention prioritization during task planning. |
| **FSM Topology** | instructionsPrompt (Layer 4\) | Provides the abstract blueprint of the Perfection Loop, allowing the model to anticipate the required phases before the loop begins. |
| **Active FSM State** | stepPrompt (Layer 5\) | Highly volatile. The runtime calculates this dynamically based on the TypeScript state machine and injects it within \<system\_reminder\> tags prior to each step 3, ensuring real-time phase awareness. |
| **Circuit Breaker Status** | stepPrompt (Layer 5\) | Provides immediate, quantitative feedback (e.g., "Previous edit delta was 4.2%. Limit is 10.0%. Proceed with caution.") to guide the generation of the next tool payload. |
| **The Five Questions** | stepPrompt (Layer 5\) | Conditionally injected. This evaluation framework is only loaded into the context window when the FSM successfully transitions into the AUDIT phase, thereby saving thousands of tokens during the RED and GREEN phases. |

By conditionally loading heavy analytical frameworks like the Audit Checklist exclusively during the relevant FSM phase, the runtime enforcement harness ensures that the LLM's context window remains lean, hyper-focused, and economically optimized throughout the duration of the engineering task.

## **Verification Gates and Call-Graph Reachability**

Law 3 of the ECHO Protocol mandates that every change is verified with build/test commands extracted from the configuration file before proceeding, leading to a zero-tolerance policy for broken builds (Law 15). Furthermore, the AUDIT phase requires a comprehensive verification strategy before a feature can be designated as COMPLETE.

### **Delegated Autonomous Execution**

Allowing the agent the autonomy to decide whether to invoke run\_terminal\_command to verify its own work is fundamentally flawed; the LLM will inevitably prioritize speed over compliance, bypassing testing suites entirely. The runtime harness replaces prompted verification with synchronous, delegated interception.  
When the LLM issues a structural mutation command (write\_file or str\_replace), the runtime performs the file system operation. However, instead of immediately returning a success token to the context stream, the framework halts the agent's iterative loop. The runtime autonomously extracts the project's testing commands from protocol.config.yaml (e.g., bun run build, bun run test, bun run typecheck, bun run lint 7).  
Using Node's native child\_process.exec or spawn, the framework executes these commands synchronously in a hidden background environment.22 The outcomes dictate the subsequent step:

* **Clean Verification (Exit Code 0):** The runtime releases the standard tool success message back to the LLM context, appending a hidden metadata tag certifying that the build is stable.  
* **Failed Verification (Exit Code \> 0):** The runtime suppresses the standard success message entirely. It forcefully injects a structured error payload back into the context stream: System Override: Code mutation applied but post-verification failed. Build broken. Standard error: \<stderr\>. FSM Phase forcefully reverted to RED. Initialize FID to track resolution.

This architectural implementation renders it computationally impossible for the agent to advance to a subsequent task while leaving the application repository in a degraded state.

### **Call-Graph Reachability Analysis**

Law 4 demands the verification of call-graph reachability, specifically requiring that newly wired features or public functions are verifiably invoked by production entry points. During the FSM transition from AUDIT to COMPLETE, the LLM must provide the names of any new symbols introduced during the GREEN phase as arguments within the transition\_phase payload.  
The runtime leverages Codebuff's existing code\_search tool, which acts as a wrapper around the highly performant ripgrep binary.8 The framework autonomously constructs a ripgrep query targeting the specified symbols across the entire workspace directory, explicitly excluding the files where the symbols were originally defined. If the ripgrep execution returns a zero-match array, indicating that the new function or configuration field is entirely orphaned and unreachable by the broader application, the framework physically blocks the transition to COMPLETE. It injects a failure state: Audit Failure: Symbol \<X\> has zero callers in the workspace. Feature is unreachable. Law 4 violated. Transition rejected.

## **Resilience Against Adversarial Behaviors and Edge Cases**

When transitioning an LLM from a generalized, cooperative coding assistant into a strictly bound protocol agent, the framework must be engineered to withstand "adversarial" compliance avoidance, wherein the LLM attempts to circumvent the harness logic to fulfill a task rapidly.

### **Combating Hallucinated Evidence**

LLMs are prone to sycophancy. Under the constraints of the ECHO Protocol, an agent may attempt to transition to the COMPLETE phase by fabricating evidence, asserting that tests have passed or that a double-audit was performed without actually invoking the necessary verification tools. The protocol's Honest Assessment rule prohibits this self-reporting.  
To physically enforce this, the runtime maintains a localized cryptographic ledger within the AgentState. Every time the runtime executes a verification command in the background or via direct tool invocation, it hashes the execution timestamp and the resulting standard output, pushing the hash into the state ledger. When the LLM requests an FSM transition citing test success, the runtime cross-references the LLM's claim against the ledger. If the ledger contains no evidence of a recent, successful verification run matching the cryptographic signature, the framework rejects the transition as hallucinated evidence, penalizing the agent by forcing a mandatory context reset.

### **Recovery via Context Pruning**

If the agent severely violates a core mechanism—such as generating corrupted, unparsable JSON payloads to bypass the FSM, or entering a localized loop where it repeatedly trips the Levenshtein circuit breaker by proposing massive structural rewrites—the framework requires an automated recovery strategy to prevent session death.  
The protocol mandates a hard stop at 10 maximum iterations per phase. If the AgentState transition counter hits this limit, the framework executes an emergency procedure. It suspends the main LLM process and autonomously spawns a "Context Pruner" subagent.2 This specialized, deeply-scoped subagent is not bound by the full ECHO protocol; its sole purpose is to parse the massive, degraded context array of the parent agent, identify the exact sequence where the step history diverged from logical compliance, and slice the array.  
The runtime then rewinds the primary agent's AgentState to the last known stable checkpoint (usually the clean entry point of the GREEN phase), injects a highly targeted, aggressive correction prompt to realign the agent's attention mechanism, and resumes the iterative loop. This ensures that valuable compute resources are not permanently lost due to localized contextual degradation.

## **Chronological Implementation Matrix**

The transition from the legacy Codebuff runtime to the ECHO Protocol harness must follow a strict, dependency-based sequencing logic. Modifying the prompt architecture before integrating the FSM guards will result in catastrophic agent confusion, as the LLM will attempt to follow rules the runtime cannot yet enforce.

| Phase | Subsystem | Required Architectural Modifications | Codebuff Target Files |
| :---- | :---- | :---- | :---- |
| **Phase 1** | Foundation & Identity | Create savant.ts definition. Override the systemPrompt configuration. Migrate the 15 Laws into the base instructionsPrompt. | agents/base2/base2.ts, agents/types/agent-definition.ts, packages/agent-runtime/src/templates/strings.ts 3 |
| **Phase 2** | Metric Interception | Install fastest-levenshtein into the Bun workspace. Implement lazy read snapshots via Bun.file().text(). Wire interception logic into mutation tools. | packages/agent-runtime/src/tools/handlers/tool/write-file.ts, package.json 18 |
| **Phase 3** | State Machine Overlay | Develop custom TypeScript discriminated union FSM. Augment AgentState context schema. Create the transition\_phase tool. Wire transition guards into the main execution loop. | packages/agent-runtime/src/run-agent-step.ts, agents/types/tools.ts 3 |
| **Phase 4** | Documentation Automation | Scaffold create\_fid, update\_fid, and close\_fid tools. Implement regex parsing for markdown manipulation. Automate CHANGELOG.md file system operations. | agents/types/tools.ts, packages/agent-runtime/src/tools/handlers/tool/ 4 |
| **Phase 5** | Verification Gating | Engineer background execution logic for bun run build/test. Intercept LLM success signals to enforce synchronous delegated verification. Integrate ripgrep call-graphing. | packages/agent-runtime/src/run-agent-step.ts, sdk/src/tools/code-search.ts 3 |
| **Phase 6** | Boot Guard & Subagents | Implement BootGuard caching in mainPrompt(). Wire YAML parser exceptions. Mutate spawn\_agents arguments to enforce Cross-Agent Claim constraints. | packages/agent-runtime/src/main-prompt.ts, packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts 3 |

This chronological approach ensures that the foundational constraints (like string distance) are firmly established before the higher-order orchestrations (like FSM transitions and multi-agent inheritance) are brought online, ensuring absolute system stability throughout the migration.

## **Conclusion**

The integration of the ECHO Protocol into the Codebuff ecosystem represents a foundational evolution from suggestive AI assistance to deterministic software engineering enforcement. By migrating the operational boundaries—the Perfection Loop FSM, the Levenshtein circuit breakers, the FID documentation mandates, and the absolute verification gates—out of the volatile prompt text and into the physical runtime execution loop, the harness guarantees compliance.  
The strategic utilization of lightweight TypeScript state machines for zero-overhead validation, combined with high-performance bit-parallel diffing algorithms and strict interception of the multi-agent orchestration layer, establishes an uncompromising architectural pattern. Under this paradigm, the system ceases to merely ask the language model to write robust code; instead, the underlying runtime mechanism physically prohibits the AI from executing anything else, enforcing a continuous, self-correcting quality gate at the very lowest level of the engineering harness.