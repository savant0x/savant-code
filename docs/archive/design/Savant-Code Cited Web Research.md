<!-- markdownlint-disable MD013 -->
<!-- MD013 is narrowly disabled for this evidence-heavy research report because its long cited prose and embedded technical tables are intentionally preserved as source-form documentation. -->

# **Savant-Code: Cited Streaming Web Research Capability Design and Implementation Report**

The integration of real-time, cited web research into autonomous agent frameworks represents a critical evolution in context-aware software engineering. The objective of this analysis is to deconstruct the generative search paradigm demonstrated by Fireplexity—an open-source Perplexity clone—and architect a rigorous, deterministic equivalent for the Savant-Code Researcher agent. This capability must operate seamlessly within the constraints of the ECHO Protocol v0.2.0, relying exclusively on zero-cost gathering mechanisms, leveraging the existing unified harness model, and adhering strictly to the universal grounding gate enforced by the ECHO Harness Enforcement Layer (EHEL)1.

## **1\. The Fireplexity Pattern Decoded: Recontextualization for Deterministic Frameworks**

The Fireplexity reference implementation establishes a highly effective user experience (UX) paradigm for information retrieval. It circumvents the traditional "link list" output of standard search engines in favor of synthesized narratives accompanied by real-time, inline citations4. By coupling a multi-step query expansion pipeline with the Vercel AI SDK's streaming capabilities, it provides users with immediate, highly readable answers5.  
However, analyzing this architecture through the lens of the ECHO Protocol reveals fundamental structural compromises. The Fireplexity model relies heavily on Firecrawl, a commercial scraping infrastructure that introduces variable costs and vendor dependency5. Furthermore, it pipes the Large Language Model (LLM) generation directly to the client interface without intermediate factual verification5. In an enterprise-grade engineering environment where code and architectural decisions are derived from agent output, streaming unverified text violates the core tenets of separation of duties and deterministic verification1.  
To integrate this concept into Savant-Code's multi-agent roster, the Fireplexity pattern must be decoded, decoupling its highly effective presentation layer from its commercial dependencies and stochastic generation flaws.

| Component Category | Element | Analysis and Disposition for Savant-Code |
| :---- | :---- | :---- |
| **Reusable** | Multi-Query Pipeline | Expanding a single user prompt into parallel search queries increases information recall. This logic will be retained and migrated to a native TypeScript executor5. |
| **Reusable** | Streaming Synthesis UX | The fluid reading experience achieved via streamText and smoothStream transformations mitigates latency and significantly improves operator experience10. |
| **Reusable** | Inline Citation Mapping | The presentation of semantic claims mapped to specific source indices (e.g., \[1\], \[2\]) allows operators to independently audit the provenance of facts4. |
| **Throwaway** | Paid Scraping Backends | The reliance on Firecrawl conflicts directly with Savant-Code's zero-cost infrastructure preference. This must be replaced with open-source alternatives1. |
| **Throwaway** | Ungrounded Streaming | Direct piping of LLM output to the terminal without a verification pass violates ECHO Law 3 (Verify Before Proceed). A gating mechanism is strictly required2. |
| **Throwaway** | Ephemeral Session State | Fireplexity abandons retrieved knowledge after the session ends. Savant-Code requires persistent compounding of data into its knowledge graph1. |
| **Throwaway** | Standalone Web App | Operating as a separate Next.js application fragments the developer workflow. The capability must be embedded as an Orchestrator-invokable primitive within the CLI1. |

## **2\. Zero-Cost Gather: The Autonomous Sourcing Engine**

The requirement for a zero-cost gathering path necessitates the deprecation of commercial Application Programming Interfaces (APIs) in favor of resilient, self-hostable, or free-tier open-source components1. The gathering architecture is bifurcated into two distinct operational phases: metasearch for URL discovery and headless extraction for converting HyperText Markup Language (HTML) payloads into LLM-ready Markdown.

### **Metasearch Discovery via SearXNG**

SearXNG is a privacy-first, open-source metasearch engine that aggregates results from over seventy independent search providers, including Google, Bing, and DuckDuckGo, without requiring API keys or user tracking13. Crucially for autonomous agents, SearXNG exposes a native JSON API (/search?q={query}\&format=json) that bypasses the need for HTML parsing at the discovery layer14.  
The integration into @savant-code/agent-runtime requires the development of a SearxngService adapter. This adapter will interface with the SEARXNG\_URL environment variable, allowing operators to route traffic through a local Docker deployment or a trusted public instance16. To ensure data quality, the adapter will utilize the min\_score parameter to filter out low-relevance domains and enforce a strict retrieval ceiling via SEARXNG\_MAX\_RESULTS to bound the subsequent extraction workload16. Furthermore, the adapter will implement canonical URL deduplication to prevent redundant extraction of identical content surfaced by different upstream search engines.

### **Content Extraction via Jina AI Reader**

While SearXNG excels at discovery, deep research necessitates the ingestion of full-text documents. Relying on raw HTML introduces excessive token overhead and exposes the LLM to irrelevant navigational boilerplate. The Jina AI Reader API (https://r.jina.ai/{url}) provides a highly reliable, zero-cost web scraping utility that handles JavaScript rendering, navigates anti-bot protections, and outputs clean, semantic Markdown19.  
The deterministic gathering pipeline executed by the Researcher agent follows a strict temporal sequence. First, the Researcher translates the Orchestrator's prompt into three to five targeted sub-queries. Second, the SearxngService executes these queries concurrently, retrieving a broad spectrum of candidate URLs. Third, the results are aggressively deduplicated and scored, narrowing the pool to the top five highest-signal endpoints. Fourth, these URLs are passed concurrently to the Jina AI Reader API. Finally, the resulting Markdown payloads are retrieved, truncated to a predefined byte limit to prevent context window saturation, and assembled into a structured ResearchContext artifact for the synthesis phase.

## **3\. Citation Integrity: The Adversarial Verification Gate**

The defining vulnerability of contemporary generative search implementations is the phenomenon of citation hallucination, often referred to as "ghost citations." Extensive academic benchmarking demonstrates that LLMs, driven by autoregressive token prediction, routinely fabricate references or misattribute claims to sources that do not contain the supporting evidence21. In the Savant-Code ecosystem, such unverified outputs threaten the integrity of the codebase and violate the foundational principles of the ECHO Protocol2.  
To secure citation integrity, the streaming architecture is intercepted by an adversarial grounding gate owned by the Adversary agent. As defined in uploaded:ARCHITECTURE.md and uploaded:ECHO.md, the Adversary is responsible for meta-verification, possessing the authority to refute unevidenced claims and override standard verification passes1.

### **The Deterministic Verification Mechanism**

When the Researcher agent completes its initial synthesis, the output is explicitly blocked from the rendering pipeline. It is instead routed to the Adversary agent as an untrusted draft artifact. The Adversary utilizes the Thinker's sequentialthinking tool to execute a rigorous, multi-dimensional evaluation of the draft1:  
The evaluation strictly assesses two parameters of attribution. First, it verifies existence and reachability: ensuring that every cited index (e.g.,3) corresponds to a valid Markdown payload successfully retrieved during the gather phase. Second, it assesses contributive attribution: executing a semantic alignment check to confirm that the specific text within the source document explicitly supports the semantic claim made in the synthesized draft23.  
The alignment analysis categorizes the relationship between the claim and the source into one of three distinct states derived from established natural language inference frameworks23:

> 1. **Attributable:** The reference entirely backs the generated statement without requiring deductive leaps.  
> 2. **Extrapolatory:** The reference offers insufficient backing, indicating that the LLM has synthesized an assumption beyond the source material.  
> 3. **Contradictory:** The generated statement directly opposes the factual data in the cited text.

If the Adversary determines that any claim is *Extrapolatory* or *Contradictory*, it issues a REFUTED verdict. This triggers a mandatory SELF-CORRECT phase within the Perfection Loop2. The Researcher is provided with the Adversary's explicit correction directives and forced to rewrite the offending claim to align strictly with the source text. This deterministic gate ensures that no ghost citations or hallucinated facts can bypass the EHEL and reach the operator's terminal2.

## **4\. Harness-Model Fuel & Provider Integration Seam**

The introduction of a secondary, specialized LLM API solely for research synthesis is actively discouraged by the project constraints. The research capability must operate entirely upon the resolved provider model already initialized within the harness (e.g., Nous Research, OpenRouter, or local Ollama instances)1.

### **Vercel AI SDK Exploitation**

The integration relies on the robust abstractions provided by the Vercel AI SDK, specifically leveraging the SavantCodeClient provider registry3. Because the SDK abstracts the underlying API architectures, the Researcher agent can execute complex synthesis tasks regardless of whether the active model is hosted via a commercial gateway or running locally7.  
To achieve the fluid, character-by-character rendering UX pioneered by platforms like Fireplexity, the implementation leverages the SDK's experimental\_transform parameter in conjunction with the smoothStream middleware10. Certain LLM providers batch text deltas, resulting in a jarring, chunky streaming experience where large blocks of text appear instantaneously10. The smoothStream utility intercepts these incoming StreamChunk payloads, buffers them internally, and re-emits them word-by-word utilizing a regular expression separator (/\\S+\\s+/m) and a configurable delay (e.g., delayInMs: 10\)10. This transforms any underlying provider into a smooth, highly readable output stream, masking network latency and computational batching from the operator.

## **5\. Reconciling Streaming with the Grounding Contract**

A fundamental architectural paradox exists between the desire for real-time streaming UX and the strict enforcement of ECHO Law 3 (Verify Before Proceed)2. Traditional streaming applications immediately paint the user interface with generated tokens. However, the universal grounding gate dictates that an ungrounded first response must not render before the Adversary resolves its verification pass1.  
To resolve this contradiction without sacrificing operator experience, the architecture employs a **Multi-Stage Buffered Streaming Architecture**:

> 1. **Activity Streaming (The Illusion of Velocity):** Upon invocation, the OpenTUI console does not wait silently. It utilizes the Activity runtime indicator defined in ECHO (FID-2026-0718-009) to stream high-fidelity status updates2. The operator sees real-time indicators such as "Expanding query parameters...", "Searching SearXNG (4 domains found)...", "Extracting Markdown via Jina...", and "Synthesizing draft artifact...". This satisfies the user's need for immediate feedback.  
> 2. **Shadow Synthesis:** The Researcher executes the generation utilizing generateText rather than streamText. The initial draft is produced entirely in a background buffer, isolated from the rendering pipeline7.  
> 3. **Adversarial Gate Execution:** The completed background draft is passed directly to the Adversary agent, which executes its semantic entailment checks and citation verification via sequentialthinking1.  
> 4. **Verified Streaming (Simulated Emission):** Once the Adversary issues a CONFIRMED verdict, the final, verified text string is passed to a simulated streaming utility (such as simulateReadableStream or a custom adapter mimicking smoothStream behavior)11. The verified text is then dripped to the OpenTUI console at a controlled character rate.

This multi-stage architecture strictly enforces the deterministic grounding gate—guaranteeing that no unverified claim ever reaches the output buffer—while simultaneously providing the operator with a dynamic, responsive interface that completely masks the latency of the adversarial pass.

## **6\. Persistence: Compounding the Knowledge Graph**

Consumer-grade generative search engines treat research sessions as ephemeral interactions. Once the browser is closed, the retrieved context and synthesized conclusions evaporate. In the context of an autonomous coding assistant, this represents a severe inefficiency. Research output must feed the deterministic codebase knowledge engine, ensuring that subsequent architectural decisions benefit from prior investigations and compound over time1.  
Savant-Code maintains a SQLite-backed graph database within the packages/knowledge-graph/ workspace1. Upon the successful completion of the COMPLETE phase of the Perfection Loop for a research task, the Recorder agent intercepts the verified artifact and executes a dual-persistence strategy:

### **Graph Injection**

The cited URLs and their corresponding Jina-extracted Markdown summaries are hashed and inserted as new RESEARCH\_DOCUMENT nodes into the SQLite graph database. The Recorder agent then generates directed edges (e.g., CITES, EXPLAINS) linking the newly acquired research nodes to the specific codebase domain clusters that triggered the inquiry. This allows future agents (such as the Scout or Detective) utilizing the query\_node\_edges and query\_domain\_clusters tools to effortlessly retrieve previously verified external documentation alongside local Abstract Syntax Tree (AST) data1.

### **Archival Documentation**

For research tasks that yield highly salient architectural insights or dictate new implementation patterns, the Scribe agent is spawned to formalize the findings. The Scribe appends a structured entry into the dev/LEARNINGS.md ledger2. This entry encapsulates the date, the core verified claims, and the permanent source URLs, tagged with explicit \[cite: URL\] markers to preserve provenance. This guarantees that the knowledge persists across entirely separate terminal sessions and remains accessible for offline review.

## **7\. The Orchestrator-Invokable Primitive**

To align with the project constraints, the cited streaming capability must not exist as a separate operational mode or a standalone application. It must be designed as an *agent primitive* embedded directly within the perfection loop, accessible mid-build by the Orchestrator1.  
This is accomplished by introducing a new, highly structured tool into the Researcher agent's schema, exposed to the Orchestrator via the standard spawn\_agents interface1.  
**Schema Definition (deep\_research\_cited):** The tool requires specific parameters to bound the computational expense of the operation:

* hypothesis\_or\_query (string): The core engineering question to be resolved.  
* required\_depth (enum): Dictates the expansion logic (e.g., standard executes 3 queries, exhaustive executes up to 10).  
* max\_sources (number): Establishes a hard ceiling on the number of URLs passed to the Jina extraction phase to protect the LLM context window (defaulting to 5).

When the Orchestrator encounters a knowledge deficit during the GREEN phase (e.g., an unfamiliar API schema or an undocumented library behavior), it pauses code generation and delegates the query to the Researcher via this tool1. The entire gather, shadow synthesis, and adversarial verification pipeline executes as a localized sub-routine. The final, verified output is returned as the tool's execution result. The Orchestrator then resumes its implementation phase, utilizing the highly reliable, cited facts to author accurate code.

## **8\. Presentation Layer Analysis: CLI versus Next.js Dashboard**

The architectural decision regarding the presentation layer—whether to render the research interface within the existing OpenTUI Command Line Interface (CLI) or to build a supplementary Next.js dashboard—requires careful evaluation against the ARCHITECTURE.md guidelines.

### **The Next.js Dashboard Option**

Developing a Next.js application (similar to the Fireplexity reference implementation) offers distinct advantages in data visualization. A web environment natively supports rich typography, complex interactive graph visualizations for citation trees, and seamless hover-state popovers for source previews5. However, this approach introduces severe architectural anti-patterns for Savant-Code. It directly violates the explicit constraint against designing a standalone web app. Furthermore, it forces a context switch upon the developer, demanding they leave their terminal and IDE to view research results. Finally, it necessitates the maintenance of a parallel state management system outside the established OpenTUI ecosystem, drastically increasing technical debt3.

### **The OpenTUI CLI Option**

Integrating the capability natively into the @savant-code/cli workspace leverages the existing React 19 and OpenTUI architecture3. It ensures zero friction for the operator, aligning perfectly with the single-runtime, terminal-native product vision. Research output can be directly piped into local files or the dev/fids/ directory. The primary disadvantage is the visual limitation of terminal emulators. Terminals lack native hover states for popovers and struggle to render dense, multi-citation text with the clarity of a modern web browser.

### **The Hybrid Export Strategy**

The definitive architectural choice is to build the capability strictly as an **OpenTUI CLI primitive**. To mitigate the terminal's visual constraints, the framework will exploit Savant-Code's existing /export and /graph-export offline HTML reporting infrastructure3.  
The research report will render in the terminal using standard bracketed citations (e.g., \[1\]). Simultaneously, the Recorder agent will generate a rich, self-contained, interactive HTML artifact (e.g., dev/exports/research/research-report.html). This offline report will feature the hoverable citations and source previews typical of web-native answer engines3. The OpenTUI console will simply render a local file:// hyperlink to this artifact. This hybrid approach perfectly marries the terminal-native workflow with the rich presentation capabilities of the web, without requiring a live dashboard server.

## **9\. ECHO-Compliance Lens**

A naive integration of the Fireplexity repository's logic into Savant-Code would trigger multiple systemic violations of the ECHO Protocol. The following table maps these potential violations to their engineered mitigations and the corresponding Feature Implementation Documents (FIDs).

| ECHO Law / Protocol Concept | Naive Port Violation | Implemented Mitigation | FID Mapping |
| :---- | :---- | :---- | :---- |
| **Law 1: Read 0-EOF** | Generating text based on LLM latent knowledge or short search snippets without fully reading source documents. | Jina Reader extraction ensures the full Markdown content of the source is injected into the context window prior to synthesis, satisfying the 0-EOF requirement. | FID-2026-0812-002 |
| **Law 3: Verify Before Proceed** | Streaming generated answers directly to the user before factual alignment is confirmed (ungrounded first response). | The Multi-Stage Buffered Architecture decouples generation from rendering. The Adversary agent gates the output, verifying all citations before the TUI paints the text. | FID-2026-0812-003 |
| **Separation of Duties** | A single agent gathering, synthesizing, and verifying its own output. | The Researcher synthesizes; the Adversary verifies. The Orchestrator initiates. Strict role boundaries are maintained across the agent roster. | FID-2026-0812-001 |
| **Zero-Cost Preference** | Hard-coded dependencies on the paid Firecrawl API. | Implementation of a dual-engine open-source pipeline utilizing SearXNG for metasearch and Jina AI Reader for Markdown extraction. | FID-2026-0812-002 |
| **Knowledge Accumulation** | Treating sessions as ephemeral; research disappears when the window is closed. | The Recorder agent injects verified citations and conclusions into the SQLite packages/knowledge-graph/ and appends core findings to LEARNINGS.md. | FID-2026-0812-004 |

## **10\. Honest Gap List**

Prior to the commencement of the GREEN implementation phase, the following operational and technical gaps necessitate empirical testing and operator validation:

> 1. **Jina AI Reader Rate Limits and Latency:** While the r.jina.ai endpoint is free, it is subject to undocumented rate limiting algorithms and potential queue times during peak loads19. Operator evidence is required to determine if a fallback extraction method (such as a local headless browser pool orchestrated via the existing browser-use helper1) is necessary for high-volume research tasks.  
> 2. **Context Window Saturation:** Aggregating five full Markdown pages can easily consume upwards of 40,000 tokens. Empirical testing is required to determine the optimal token truncation strategy. Aggressive pruning of navigational elements, footers, and capping extraction at the first 2,000 words per source may be necessary to prevent saturating the harness model's context window, particularly for smaller local models running via Ollama3.  
> 3. **Adversarial False-Positive Rate:** The Adversary agent's strict semantic alignment check carries the risk of over-correction, potentially flagging nuanced but entirely valid LLM synthesis as *Extrapolatory*23. The prompt engineering for the verification pass requires rigorous empirical tuning against a benchmark dataset of known valid and invalid citations to establish an acceptable false-positive rate that does not cripple the agent loop with endless SELF-CORRECT cycles2.  
> 4. **UX Latency Tolerance:** Decoupling the synthesis phase from the streaming phase via the Adversarial gate inherently introduces a delay between query initiation and the first rendered text token. Operator testing is required to verify if the granular "Activity Streaming" sufficiently mitigates user impatience during the background generation and verification phases2.

## **11\. Draft Feature Implementation Documents (FIDs)**

The following FIDs detail the precise implementation specifications, adhering strictly to the templates/FID-TEMPLATE.md standard required by the Recorder agent and the ECHO Perfection Loop2.

### **FID-2026-0812-001-researcher-cited-streaming**

# **FID-2026-0812-001: Researcher Cited Streaming Capability**

**ID:** 001 **Severity:** High **Status:** analyzed **Created:** 2026-08-12 **Author:** Recorder

## **Description**

The Researcher agent currently lacks the ability to produce synthesized, cited, and streaming research answers. Web search operates as a disjointed, unverified process. This FID outlines the architectural primitive to enable a Perplexity-style cited research capability natively within the Orchestrator's workflow, utilizing the Vercel AI SDK.

## **Scope**

Implementation of the deep\_research\_cited tool schema for the Researcher agent in @savant-code/agents. Integration of the Multi-Stage Buffered Streaming architecture utilizing generateText for shadow drafts and simulated streaming for the final output, leveraging the SavantCodeClient provider registry.

## **Out of Scope**

Implementation of the underlying search utilities (handled in FID-002). Implementation of the Adversary verification gate logic (handled in FID-003). Standalone UI development.

## **RED (Analysis & Issues)**

* **Issue 1:** The Orchestrator's current research workflow interrupts standard code generation and produces flat text without traceable provenance. (uploaded:ARCHITECTURE.md \- Agent Roster)  
* **Issue 2:** Direct streaming of LLM synthesis using streamText violates ECHO Law 3 if the text is unverified. (uploaded:ECHO.md \- The 15 Laws)  
* **Evidence:** Code analysis of agents/researcher.ts reveals a lack of verification mechanisms before returning context payloads to the Orchestrator.

## **GREEN (Proposed Solution)**

* **Implementation:** Add deep\_research\_cited to the Researcher's tool registry.  
* **Execution Flow:**  
  1. The Orchestrator invokes the tool during a knowledge deficit.  
  2. The Researcher emits TUI Activity updates ("Gathering", "Synthesizing") per FID-2026-0718-009.  
  3. The Researcher generates a draft internally using generateText (blocking stream).  
  4. Output is passed to the Adversary (FID-003).  
  5. Verified output is dripped to the OpenTUI console mimicking a stream via simulateReadableStream, and full HTML is written to dev/exports/research/.  
* **Default Decisions:** The tool will default to a max\_sources of 5\.

## **AUDIT (Verification Criteria)**

* \[ \] Code compiles and typechecks across workspaces (bun run type\_check).  
* \[ \] Tool execution correctly intercepts the generateText payload before any rendering occurs in the OpenTUI console.  
* \[ \] run\_readonly\_command confirms that deep\_research\_cited is accessible in the Orchestrator's prompt context during the GREEN phase.

## **ADVERSARIAL (Meta-Verification)**

* \[ \] Confirm that no partial text tokens are leaked to the standard output buffer before the verification gate resolves, ensuring zero bypass of the EHEL.

### **FID-2026-0812-002-zero-cost-gather-searxng-jina**

# **FID-2026-0812-002: Zero-Cost Gather Integration (SearXNG \+ Jina)**

**ID:** 002 **Severity:** Medium **Status:** analyzed **Created:** 2026-08-12 **Author:** Recorder

## **Description**

To support the cited research capability without violating the zero-cost infrastructure preference outlined in the project manifesto, the system requires a robust URL discovery and content extraction pipeline that circumvents paid APIs like Firecrawl.

## **Scope**

Implementation of the SearxngService adapter in @savant-code/agent-runtime. Implementation of a Jina AI Reader client for HTML-to-Markdown extraction. Management of concurrent fetch requests and context truncation.

## **Out of Scope**

Hosting or deployment of the SearXNG Docker containers (assumes external provisioning via SEARXNG\_URL).

## **RED (Analysis & Issues)**

* **Issue 1:** Web gathering requires handling JS-rendered content and complex rate limits which raw fetch cannot accomplish.  
* **Issue 2:** Returning raw HTML to the context window exceeds token limits rapidly, degrading model performance.  
* **Evidence:** The current web\_search implementation in packages/agent-runtime/src/tools/ relies on unstructured API calls lacking deep content extraction capabilities.

## **GREEN (Proposed Solution)**

* **SearXNG Integration:** Create SearxngAdapter utilizing the /search?format=json endpoint. Support concurrent queries. Filter out low-signal domains via the min\_score parameter and cap results via SEARXNG\_MAX\_RESULTS.  
* **Jina Reader Integration:** Map discovered URLs to https://r.jina.ai/{url}. Execute fetches concurrently via Promise.allSettled.  
* **Context Management:** Implement a 15-second strict timeout and a 20,000 character truncation limit per document to preserve the LLM context window. Assemble results into a ResearchContext array.

## **AUDIT (Verification Criteria)**

* \[ \] SearxngAdapter unit tests pass against a mock JSON endpoint, verifying URL deduplication logic.  
* \[ \] Jina AI Reader client correctly yields valid Markdown and handles 4xx/5xx HTTP errors gracefully.  
* \[ \] Timeout parameters successfully terminate hung extraction requests without crashing the core agent loop.

## **ADVERSARIAL (Meta-Verification)**

* \[ \] Validate that the character truncation logic does not sever Markdown code fences () or markdown links midway, which would corrupt the document structure and disrupt the Adversary's subsequent citation index parsing.

\#\#\# FID-2026-0812-003-adversary-citation-grounding-gate

\`\`\`markdown  
\# FID-2026-0812-003: Adversary Citation Verification Gate  
\*\*ID:\*\* 003  
\*\*Severity:\*\* Critical  
\*\*Status:\*\* analyzed  
\*\*Created:\*\* 2026-08-12  
\*\*Author:\*\* Recorder

\#\# Description  
The core differentiator of the Savant-Code research primitive. Every citation generated by the Researcher must be verified for existence, reachability, and factual alignment by the Adversary agent before it is permitted to render on the terminal or influence codebase architecture.

\#\# Scope  
Development of the \`verify\_citations\` tool for the Adversary agent. Integration of the natural language inference prompt utilizing the \`sequentialthinking\` engine to detect extrapolatory or contradictory claims.

\#\# Out of Scope  
General code linting or test verification (this remains the domain of the Verifier agent per ECHO rules).

\#\# RED (Analysis & Issues)  
\- \*\*Issue 1:\*\* LLMs hallucinate citations ("ghost citations") systematically via autoregressive token prediction, presenting fabricated data as fact.  
\- \*\*Issue 2:\*\* Ungrounded claims ingested into the codebase cause severe architectural drift and security vulnerabilities.  
\- \*\*Evidence:\*\* ECHO Protocol Law 3 (\`uploaded:ECHO.md\`) strictly mandates verification before proceeding. Academic literature confirms hallucination rates exceeding 90% in naive generative search.

\#\# GREEN (Proposed Solution)  
\- \*\*Implementation:\*\* The Adversary receives the draft text string and the \`ResearchContext\` object payload. It initiates the \`sequentialthinking\` tool to iterate sequentially over every \`\[cite: N\]\` marker found in the text via Regex extraction.  
\- \*\*Entailment Logic:\*\*  
  1\. Verify index \`N\` exists in the context array.  
  2\. Extract the generated sentence containing the citation.  
  3\. Compare the semantic meaning of the sentence against the Markdown source of \`N\`.  
  4\. Yield an explicit verdict: \`CONFIRMED\`, \`REFUTED\_EXTRAPOLATORY\`, or \`REFUTED\_CONTRADICTORY\`.  
\- \*\*Correction Protocol:\*\* If any claim evaluates to \`REFUTED\`, the Adversary triggers a state transition back to \`SELF-CORRECT\` for the Researcher, passing the specific failure rationale to force a rewrite.

\#\# AUDIT (Verification Criteria)  
\- \[ \] The grounding gate successfully blocks the rendering pipeline upon any \`REFUTED\` verdict.  
\- \[ \] \`sequentialthinking\` step outputs correctly log the semantic comparison logic for debugging purposes in the session summary.

\#\# ADVERSARIAL (Meta-Verification)  
\- \[ \] Execute the \`verify\_citations\` prompt against a curated benchmark dataset of known hallucinated citations to ensure the false-negative rate (allowing a hallucination to pass) is mathematically zero under the \`STRICT\` execution mode.

### **FID-2026-0812-004-knowledge-graph-persistence**

Markdown  
\# FID-2026-0812-004: Research Persistence and Knowledge Graph Injection  
**\*\*ID:\*\*** 004  
**\*\*Severity:\*\*** Medium  
**\*\*Status:\*\*** analyzed  
**\*\*Created:\*\*** 2026-08-12  
**\*\*Author:\*\*** Recorder

\#\# Description  
Research conducted during a session must compound. Ephemeral research output forces the agent harness to repeatedly incur the computational expense of searching for the same architectural answers across different sessions. This FID integrates the verified research artifacts into the local SQLite knowledge graph.

\#\# Scope  
Database schema migrations in \`packages/knowledge-graph/\` to support \`RESEARCH\_DOCUMENT\` node types. Updates to the Recorder and Scribe agents to intercept closed research reports and catalog them persistently.

\#\# Out of Scope  
Modification of the core tree-sitter codebase indexing and parsing logic.

\#\# RED (Analysis & Issues)  
\- **\*\*Issue 1:\*\*** Fireplexity-style consumer systems lose all retrieved context when the browser window is closed.  
\- **\*\*Issue 2:\*\*** The current knowledge graph only indexes local source code, ignoring highly valuable external API documentation gathered during the research phase.  
\- **\*\*Evidence:\*\*** The current SQLite schema in \`packages/knowledge-graph/\` lacks node definitions for external URIs, preventing \`query\_node\_edges\` from surfacing external context (\`uploaded:README.md\`).

\#\# GREEN (Proposed Solution)  
\- **\*\*Schema Update:\*\*** Execute a migration to add a \`RESEARCH\_DOCUMENT\` node type to the SQLite schema. Include dedicated columns for \`uri\`, \`hash\`, \`summary\_markdown\`, and \`timestamp\`.  
\- **\*\*Edge Creation:\*\*** When a research task concludes in the \`COMPLETE\` phase, the Recorder creates \`CITES\` and \`EXPLAINS\` directed edges from the local codebase domain cluster to the new \`RESEARCH\_DOCUMENT\` node.  
\- **\*\*File Update:\*\*** The Scribe agent is spawned to append salient architectural conclusions to \`dev/LEARNINGS.md\`, embedding explicit \`\[cite: URL\]\` tags to preserve provenance across terminal sessions.

\#\# AUDIT (Verification Criteria)  
\- \[ \] SQLite schema migrations execute successfully without corrupting existing AST data.  
\- \[ \] Subsequent queries via the Scout agent's \`query\_node\_edges\` tool successfully return the injected external research documents.  
\- \[ \] \`LEARNINGS.md\` is appended to correctly without overwriting existing formatting or guidelines.

\#\# ADVERSARIAL (Meta-Verification)  
\- \[ \] Ensure that injected research nodes cannot accidentally overwrite or collide with the deterministic AST nodes generated by the tree-sitter parser by enforcing strict node ID isolation in the graph schema.

### **FID-2026-0812-005-multi-stage-buffered-streaming**

Markdown  
\# FID-2026-0812-005: Multi-Stage Buffered Streaming and Export Rendering  
**\*\*ID:\*\*** 005  
**\*\*Severity:\*\*** Medium  
**\*\*Status:\*\*** analyzed  
**\*\*Created:\*\*** 2026-08-12  
**\*\*Author:\*\*** Forge

\#\# Description  
To provide an optimal operator experience without violating the EHEL grounding gates, the system requires a specialized rendering pipeline. This FID specifies the integration of the Vercel AI SDK's streaming utilities and the generation of the rich offline HTML export.

\#\# Scope  
Implementation of the \`simulateReadableStream\` and \`smoothStream\` utilities within the CLI workspace. Updates to the \`/export\` functionality to handle research-specific Markdown rendering (hoverable citations).

\#\# Out of Scope  
Replacement of the underlying \`OpenTUI\` framework.

\#\# RED (Analysis & Issues)  
\- **\*\*Issue 1:\*\*** Terminals lack native hover states for popovers, degrading the UX of dense, multi-citation text compared to web applications.  
\- **\*\*Issue 2:\*\*** Batching delays from certain LLM providers cause jarring, chunky rendering in the terminal.  
\- **\*\*Evidence:\*\*** Constraints forbid the creation of a standalone Next.js dashboard, requiring a terminal-native solution with rich HTML fallback (\`uploaded:README.md\`).

\#\# GREEN (Proposed Solution)  
\- **\*\*Activity Streaming:\*\*** Utilize the runtime \`Activity\` indicator to stream phase transitions ("Gathering", "Verifying") while the LLM generates in the background.  
\- **\*\*Smooth Streaming:\*\*** Once verified, utilize a custom implementation of \`simulateReadableStream\` (mimicking \`smoothStream\` behavior with a 10ms delay) to drip the text to the OpenTUI console.  
\- **\*\*Hybrid Export:\*\*** Concurrently write a rich HTML artifact to \`dev/exports/research/research-report.html\`. This artifact will inject CSS and JavaScript to enable hoverable citation popovers containing the source snippets, leveraging the existing offline-first styling from \`/export\`.

\#\# AUDIT (Verification Criteria)  
\- \[ \] Terminal output drips characters smoothly without chunking artifacts.  
\- \[ \] The generated HTML artifact opens successfully via \`file://\` protocol and contains valid, interactive citation popovers.

\#\# ADVERSARIAL (Meta-Verification)  
\- \[ \] Verify that the HTML artifact generation does not inadvertently execute arbitrary JavaScript pulled from the scraped Markdown payloads (XSS vulnerability check).

## **12\. Conclusion**

The integration of a Cited Streaming Web Research capability into the Savant-Code framework requires a fundamental architectural divergence from consumer-grade answer engines like Fireplexity. By replacing paid scraping APIs with a zero-cost SearXNG and Jina Reader pipeline, and by instituting a rigorous Adversarial grounding gate to eliminate LLM citation hallucinations, the framework ensures that external research meets the strict deterministic standards of the ECHO Protocol. Furthermore, utilizing the Vercel AI SDK to buffer and simulate streaming, combined with the offline HTML export strategy, allows the system to deliver a superior, Perplexity-style user experience without compromising the terminal-native product vision or violating the immutable laws of verification.

### **Works cited**

> 1. ARCHITECTURE.md  
> 2. ECHO.md  
> 3. README.md  
> 4. Fireplexity v2 \- GitHub, [https://github.com/firecrawl/fireplexity](https://github.com/firecrawl/fireplexity)  
> 5. 10 AI Projects You Can Build with Firecrawl Now, [https://www.firecrawl.dev/blog/10-ai-projects-with-firecrawl](https://www.firecrawl.dev/blog/10-ai-projects-with-firecrawl)  
> 6. Announcing Fireplexity: Our Open Source AI Answer Engine \- Firecrawl, [https://www.firecrawl.dev/blog/introducing-fireplexity-open-source-answer-engine](https://www.firecrawl.dev/blog/introducing-fireplexity-open-source-answer-engine)  
> 7. api-ai-vercel-ai-sdk | Skills Market... \- LobeHub, [https://lobehub.com/zh/skills/agents-inc-skills-api-ai-vercel-ai-sdk](https://lobehub.com/zh/skills/agents-inc-skills-api-ai-vercel-ai-sdk)  
> 8. Mastering Firecrawl's Crawl Endpoint: A Complete Web Scraping Guide, [https://www.firecrawl.dev/blog/mastering-the-crawl-endpoint-in-firecrawl](https://www.firecrawl.dev/blog/mastering-the-crawl-endpoint-in-firecrawl)  
> 9. GitHub \- firecrawl/firecrawl: The context API to search, scrape, and interact with the web at scale., [https://github.com/firecrawl/firecrawl](https://github.com/firecrawl/firecrawl)  
> 10. feat: add smoothStream transform for word-by-word text delivery · Issue \#439 · TanStack/ai, [https://github.com/TanStack/ai/issues/439](https://github.com/TanStack/ai/issues/439)  
> 11. Smooth Text Streaming in AI SDK v5 | Upstash Blog, [https://upstash.com/blog/smooth-streaming](https://upstash.com/blog/smooth-streaming)  
> 12. Generating Text \- AI SDK Core, [https://ai-sdk.dev/docs/ai-sdk-core/generating-text](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)  
> 13. Deploy & Host SearXNG | Open Source Search API for AI Agents \- Railway, [https://railway.com/deploy/searxng-open-source-search-api-for-ai-agents--searxng-search-api](https://railway.com/deploy/searxng-open-source-search-api-for-ai-agents--searxng-search-api)  
> 14. Search API \- SearXNG Documentation (2026.8.10+0a118066d), [https://docs.searxng.org/dev/search\_api.html](https://docs.searxng.org/dev/search_api.html)  
> 15. Feature: Add SearXNG as a web search provider option \#43822 \- GitHub, [https://github.com/openclaw/openclaw/issues/43822](https://github.com/openclaw/openclaw/issues/43822)  
> 16. mcp-searxng/CONFIGURATION.md at main \- GitHub, [https://github.com/ihor-sokoliuk/mcp-searxng/blob/main/CONFIGURATION.md](https://github.com/ihor-sokoliuk/mcp-searxng/blob/main/CONFIGURATION.md)  
> 17. Schema | mcp-searxng \- Glama, [https://glama.ai/mcp/servers/vinas1/mcp-searxng/schema](https://glama.ai/mcp/servers/vinas1/mcp-searxng/schema)  
> 18. GitHub \- ihor-sokoliuk/mcp-searxng: Private web search for AI assistants via SearXNG — supports Claude, Cursor, and any MCP client, [https://github.com/ihor-sokoliuk/mcp-searxng](https://github.com/ihor-sokoliuk/mcp-searxng)  
> 19. Reader MCP by jina-ai | Web Content Grounding \- Augment Code, [https://www.augmentcode.com/mcp/reader](https://www.augmentcode.com/mcp/reader)  
> 20. The Drive AI vs Jina Reader vs Firecrawl — Web-to-Markdown API Compared (2026), [https://thedrive.ai/blog/drive-ai-vs-jina-reader-vs-firecrawl-markdown-api](https://thedrive.ai/blog/drive-ai-vs-jina-reader-vs-firecrawl-markdown-api)  
> 21. GhostCite: A Large-Scale Analysis of Citation Validity in the Age of Large Language Models \- arXiv, [https://arxiv.org/pdf/2602.06718](https://arxiv.org/pdf/2602.06718)  
> 22. GhostCite: A Large-Scale Analysis of Citation Validity in the Age of Large Language Models, [https://arxiv.org/html/2602.06718v2](https://arxiv.org/html/2602.06718v2)  
> 23. A Survey of Large Language Models Attribution \- arXiv, [https://arxiv.org/html/2311.03731v2](https://arxiv.org/html/2311.03731v2)  
> 24. \\model: Fine-grained Attribution with Executable Programs \- arXiv, [https://arxiv.org/html/2506.14580v1](https://arxiv.org/html/2506.14580v1)  
> 25. Firecrawl \- The context API to search, scrape, and interact with the web at scale., [https://www.firecrawl.dev/](https://www.firecrawl.dev/)  
> 26. markdown not rendered correctly in assistant message using ai-elements · Issue \#142 · vercel/streamdown \- GitHub, [https://github.com/vercel/streamdown/issues/142](https://github.com/vercel/streamdown/issues/142)  
> 27. Reference: AI SDK Core, [https://ai-sdk.dev/docs/reference/ai-sdk-core](https://ai-sdk.dev/docs/reference/ai-sdk-core)  
> 28. protocol.config.yaml  
> 29. Benchmark for checking scientific references produced by LLMs \- Newline.co, [https://www.newline.co/@Dipen/benchmark-for-checking-scientific-references-produced-by-llms--ee01f20b](https://www.newline.co/@Dipen/benchmark-for-checking-scientific-references-produced-by-llms--ee01f20b)