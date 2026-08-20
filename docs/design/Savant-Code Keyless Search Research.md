# **Architectural Blueprint: Self-Hosted Discovery and Offline Retrieval for Savant-Code**

## **Executive Summary**

The Savant-Code engineering framework operates on a highly structured multi-agent architecture governed by the ECHO Protocol v0.2.0, enforcing strict separation of duties across a ten-agent roster1. Within this local-first ecosystem, the Researcher agent requires robust web discovery (web\_search, deep\_research) and documentation retrieval (read\_docs) capabilities to inform the planning and implementation phases of the Perfection Loop1. Currently, these critical capabilities are functionally inert. The existing tool handlers route queries through a non-existent centralized SavantCode backend, which inherently short-circuits when the CLI is operated in its permanent, direct-to-provider mode via the DIRECT\_PROVIDER environment variable1.  
Resolving this dead-end requires a paradigm shift away from commercial, per-user API keys, which are economically unviable for an install base exceeding one hundred thousand users. The architecture must transition toward a decentralized, self-hosted, and keyless infrastructure that achieves zero marginal cost per query while maintaining the rigorous security boundaries of the ECHO Harness Enforcement Layer (EHEL)3. Based on an exhaustive analysis of the contemporary search API landscape, the limitations of open-source intelligence scraping, and the specific architectural constraints of the TypeScript and Bun-based Savant-Code monorepo, it is evident that commercial free-tier APIs and client-side scraping are structurally incapable of sustaining production loads. The optimal architecture consists of a bifurcated topological approach: a shared, centrally-hosted SearXNG metasearch cluster for real-time web discovery, coupled with a decentralized, client-side SQLite docset ingestion model for documentation retrieval, leveraging the existing @savant-code/knowledge-graph engine1.

## **Foundational Architecture and Verified Constraints**

The current state of the Savant-Code repository dictates strict operational boundaries that any proposed discovery architecture must respect. The framework is a TypeScript monorepo executed on the Bun 1.3.14 runtime, utilizing hoisted workspaces encompassing the agent runtime, the public SDK, and the terminal CLI1. The fundamental architectural invariant is the local-first execution model. Inference routes directly to LLM providers (for example, utilizing DIRECT\_PROVIDER=openrouter), entirely bypassing any centralized Savant-Code backend logic for token generation or conversational state management1.  
The existing research tools exhibit a critical disparity in operational readiness. The read\_url primitive is a natively implemented, client-side tool that successfully fetches readable text from web endpoints. It is heavily guarded against Server-Side Request Forgery (SSRF) attacks through the assertUrlAllowed function, which systematically blocks private and link-local IP ranges1. This tool operates flawlessly without API keys or backend dependencies, establishing the baseline mechanism for content ingestion. Conversely, the web\_search and read\_docs tools are entirely dependent on legacy routing paths. Their handlers attempt to communicate with an absent backend API (/api/v1/web-search and /api/v1/docs-search), resulting in immediate short-circuiting when the DIRECT\_PROVIDER flag is active1. The deep\_research tool, which operates as a mechanical multi-query orchestrator built atop web\_search, inherits this total failure state1.  
Despite these broken routing paths, the monorepo possesses highly sophisticated internal engines ready for repurposing. The @savant-code/code-map package provides tree-sitter-based indexing and language detection, while the @savant-code/knowledge-graph package offers a deterministic, SQLite-backed codebase graph engine capable of complex clustering and querying1. Furthermore, all tool executions must pass the EHEL, which enforces the fifteen laws of the ECHO Protocol—such as Law 1 (Read 0-EOF Before Touch)—and generates Zero-Trust Agentic Provenance (ZTAP) receipts for every automated action3. Any proposed retrieval architecture must seamlessly integrate into this local-first, structurally enforced paradigm without introducing per-user credentials, compromising the EHEL boundary, or triggering upstream rate limits.

## **The Collapse of the Commercial Free-Tier Search Market**

The assumption that open-web search functionality can be sustained via commercial "free tiers" is an outdated artifact of previous software development cycles. A rigorous analysis of the current market landscape reveals that commercial search providers have systematically dismantled unmetered access, transforming search into a premium asset explicitly designed to monetize AI grounding pipelines.  
The most profound shift occurred with the permanent retirement of the Bing Search and Bing Custom Search APIs. Microsoft formally decommissioned these REST APIs on August 11, 2025, disabling all new deployments and terminating existing instances across both free and paid tiers5. This was not merely a pricing adjustment; it represented a strategic transition away from providing raw search infrastructure. Developers were directed toward the "Grounding with Bing Search" feature embedded within the Azure AI Agent Service, transforming a standalone JSON input into a vertically integrated, paid Azure ecosystem feature with complex data handling protocols and compliance boundaries5. Consequently, any architecture relying on a shared Bing F0 key is fundamentally impossible.  
Simultaneously, independent search providers have heavily financialized their access models. Brave Search, which historically offered a generous free allowance of up to 5,000 queries per month, eliminated its zero-cost plan in early 20269. The current iteration provides a nominal five-dollar monthly credit, equating to approximately 1,000 queries per month at their standard rate, while enforcing severe throughput constraints of 50 queries per second (QPS) on the Search plan and a mere 2 QPS on the Answers plan11. The broader market mirrors these restrictions, with providers like Tavily and Exa capping their free tiers at 1,000 monthly credits7. While alternative engines like Mojeek maintain distinct indexes, their unmetered tiers lack the scale required to act as an aggregated proxy for a massive user base without incurring prohibitive enterprise costs15.  
Table 1 illustrates the structural incompatibility of commercial free tiers with a proxy architecture designed to support a user base exceeding one hundred thousand individuals.

| Provider | Legacy Free Tier | Current 2026 Allowance | Rate Limits | Verdict for 100k+ Users |
| :---- | :---- | :---- | :---- | :---- |
| **Bing Web Search** | 1,000 queries/month (F0) | Retired (August 11, 2025\) | N/A | Impossible (Service Dead) |
| **Brave Search API** | 5,000 queries/month | \~1,000 queries/month ($5 credit) | 50 QPS (Search) | Non-Viable (Exhausted in minutes) |
| **Tavily** | 1,000 queries/month | 1,000 queries/month | Unknown | Non-Viable (Exhausted in minutes) |
| **Exa** | 1,000 queries/month | 1,000 queries/month | Unknown | Non-Viable (Exhausted in minutes) |
| **Bright Data SERP** | N/A | Pay-as-you-go ($1.50/1K) | Unlimited QPS | Non-Viable (Requires heavy capital) |

If a single Savant-Code server-side key were utilized to proxy searches for a growing user base, a one-thousand-query monthly limit would be exhausted almost instantaneously. Relying on commercial free-tier APIs for a production-grade agent framework is economically and technically unfeasible.

## **The Fragility of Client-Side Web Scraping**

In the absence of viable free-tier APIs, developers frequently turn to open-source intelligence gathering via client-side scraping. Historically, libraries such as the Python-based duckduckgo-search (often abbreviated as ddgs) and the Node.js equivalent duck-duck-scrape provided keyless search capabilities by parsing HTML or Lite endpoints16. However, upstream providers have implemented highly aggressive anomaly detection and rate-limiting protocols that render these libraries unsuitable for enterprise-grade applications.  
Client-side scraping attempts currently result in pervasive 202 Ratelimit and 403 Forbidden HTTP errors across the developer ecosystem16. The internal mechanics of these defensive blocks are highly sophisticated. Upstream engines monitor request headers, query parameters, and session behavior. For instance, appending seemingly innocuous localization parameters (such as ss\_mkt=FR) to a DuckDuckGo query triggers JavaScript injection payloads containing DDG.deep.anomalyDetectionBlock({...}), which actively halts automated parsing routines22. Furthermore, the Verification Query Document (VQD) token system, historically utilized by scrapers to simulate legitimate browser sessions and bypass basic blocks, frequently fails, throwing fatal exceptions such as Uncaught Error Error: Failed to get the VQD for query23.  
The implementation of pure client-side scraping within the Savant-Code CLI would force the local application to execute these easily detectable scraping patterns directly from the user's IP address. For an install base of one hundred thousand users, this would rapidly result in localized IP bans, effectively severing the user's access to standard search engines outside of the CLI. This behavior directly violates the principle of providing a stable, secure, and production-grade software engineering tool. The cat-and-mouse game of maintaining scraping regex patterns against actively hostile upstream anomaly detection is a massive misallocation of engineering resources and guarantees high failure rates for the deep\_research orchestrator.

## **Evaluation of Decision Thresholds**

The architectural transition requires definitive verdicts on six core decision questions. The following analysis synthesizes the evidence to establish the foundational truths guiding the final system design.

### **Verdict 1: The Viability of Free Open-Web Search at Scale**

**Verdict:** No commercial API or client-side scraping library offers sustainable, zero-cost access at a 100,000-user scale. The only viable architecture achieving a zero-dollar marginal cost for the end-user is a centralized, self-hosted SearXNG instance serving the client fleet via a proxy layer.  
**Evidence:** The commercial market has deliberately eliminated high-volume free tiers, evidenced by the retirement of Bing Search5 and the restriction of Brave Search to 1,000 monthly queries10. Client-side scraping triggers severe 202 Ratelimit errors and anomaly detection blocks that lead to IP bans16. Conversely, SearXNG is an actively maintained, AGPL-3.0 licensed metasearch engine explicitly designed for self-hosted aggregation25.  
**Confidence:** High.  
**Analytical Justification:** Commercial search providers have realized that raw search data is a critical component of AI grounding, and they have adjusted their pricing models to capture this value7. Consequently, proxying a massive user base through a single free-tier key is mathematically impossible. Client-side scraping is heavily mitigated by upstream engines and will result in localized IP bans, destroying user trust. A shared, server-side instance of SearXNG abstracts the search queries away from the user's local network. While this requires the Savant-Code maintainers to fund a baseline infrastructure for hosting and IP rotation, it successfully shifts the marginal cost away from the user, fulfilling the primary constraint of the project.

### **Verdict 2: Keyless Documentation Retrieval and the Context7 Replacement**

**Verdict:** Documentation retrieval can be fully decoupled from Context7 and made entirely keyless by pre-compiling official software documentation into SQLite databases (mimicking the Dash/Zeal docset format) and querying them locally utilizing the existing @savant-code/knowledge-graph engine.  
**Evidence:** The open-source DevDocs aggregator successfully utilizes static scrapers to compile documentation28, while the Dash and Zeal ecosystems rely heavily on SQLite databases to index HTML documentation for offline access29. Savant-Code already possesses a deterministic, SQLite-backed graph engine capable of executing complex local queries1. Relying on dynamic GitHub API fetches is impossible due to the unauthenticated rate limit of 60 requests per hour1.  
**Confidence:** High.  
**Analytical Justification:** Software documentation represents a fundamentally different engineering challenge than open-web search. Web search is unbounded, highly dynamic, and requires real-time crawling; documentation is bounded, version-controlled, and changes relatively slowly. Applying a dynamic search API to static documentation is an architectural mismatch that incurs unnecessary latency and cost. Instead of relying on a paid Context7 API or attempting fragile, live-crawling of GitHub repositories, Savant-Code can establish an automated continuous integration pipeline that scrapes official documentation, converts it into optimized SQLite indexes, and distributes them via a global Content Delivery Network (CDN). The local CLI can download the specific SQLite index for the user's project stack and query it natively with zero latency, entirely eliminating external dependencies.

### **Verdict 3: The Futility of In-Process MCP Server Cloning**

**Verdict:** Cloning the mechanics of existing search and documentation Model Context Protocol (MCP) servers in-process is architecturally futile because the MCP is merely a transport layer; the fundamental dependency remains the upstream data source and its associated authentication requirements.  
**Evidence:** An examination of open-source MCP wrappers, such as duck-duck-scrape-mcp, reveals that they simply pipe broken, rate-limited NPM packages over standard input/output (stdio), inheriting all the 202 Ratelimit and anomaly detection failures of the underlying scraper22. Similarly, the mcp-searxng server requires a running, independently hosted SearXNG instance to query34.  
**Confidence:** High.  
**Analytical Justification:** Integrating an MCP server directly into the Savant-Code runtime does not magically bypass upstream authentication, API costs, or rate limits. Rebuilding a Tavily MCP in-process still strictly requires a Tavily API key to function. Rebuilding a DuckDuckGo MCP still subjects the user's IP address to CAPTCHAs and anomaly detection blocks. The core issue to be solved is data acquisition and rate-limit evasion, not the tool execution protocol. Therefore, time spent porting MCP logic is wasted unless the underlying data source is independently secured.

### **Verdict 4: Optimal Security Topology for Keyless Retrieval**

**Verdict:** The optimal topology is a hybrid model: a single, self-hosted SearXNG service managed by the maintainers for dynamic web search, combined with pure client-side SQLite database queries for static documentation retrieval. Baking a shared server-side commercial API key into the client binary must be entirely rejected.  
**Evidence:** Extracting baked API keys from a Node.js or Bun CLI binary is trivially easy using basic decompilation or network inspection tools, leading to immediate key compromise, financial exposure, and account suspension. Client-side scraping triggers upstream IP bans22.  
**Confidence:** High.  
**Analytical Justification:** Distributing a shared commercial API key inside the CLI binary violates fundamental security principles; malicious actors would extract the key and utilize it for their own pipelines, instantly exhausting the budget. To protect the 100,000+ user base from IP bans and provide reliable search, the dynamic web queries must be routed through a central proxy (SearXNG) that handles request distribution and upstream IP rotation. To minimize server costs and maximize query speed, documentation search must be pushed to the edge (the user's local machine) using pre-built SQLite indexes. This minimizes centralized infrastructure costs while guaranteeing high availability and absolute privacy for code-specific documentation queries.

### **Verdict 5: Legal, Terms of Service, and Scale Limitations**

**Verdict:** Commercial scraping violates upstream Terms of Service and is technically blocked. Free-tier commercial APIs strictly forbid multi-tenant proxying. SearXNG is legally safe to host and query over HTTP, provided the AGPL-3.0 source-sharing obligations are met.  
**Evidence:** Microsoft explicitly retired the Bing APIs, rendering legacy terms of service irrelevant5. Providers like Brave and Tavily actively monitor QPS throughput (e.g., Brave's 50 QPS hard limit) and will terminate accounts exhibiting massive multi-tenant proxy patterns13. SearXNG is explicitly licensed under AGPL-3.0, which governs network access to modified source code25.  
**Confidence:** High.  
**Analytical Justification:** The AGPL-3.0 license requires that if software is modified and hosted over a network, the modified source code must be made available to users interacting with it25. If Savant-Code hosts a vanilla SearXNG instance (or one with minor configuration changes) and queries it via the CLI, the AGPL obligations apply to the *SearXNG server instance*, not the Savant-Code CLI client calling its HTTP endpoint. Linking to the SearXNG source repository from the Savant-Code documentation fully satisfies this requirement. The primary operational risk is not legal, but technical: upstream blocking of the SearXNG instance by Google or Bing. This necessitates robust rate limiting via valkeydb and rotating outbound proxy networks to maintain service availability26.

### **Verdict 6: Maximizing Reuse of Internal Monorepo Assets**

**Verdict:** The existing deep\_research orchestrator, read\_url fetch primitive, and @savant-code/knowledge-graph engine provide the vast majority of the required infrastructure, minimizing the need for net-new development.  
**Evidence:** The read\_url tool currently possesses production-grade SSRF guards that block private network ranges1. The deep\_research module is designed to be facade-agnostic, meaning the underlying search provider can be hot-swapped1. The knowledge-graph package natively utilizes bun:sqlite for deterministic indexing and querying2.  
**Confidence:** High.  
**Analytical Justification:** The web\_search tool handler only needs to be re-wired to execute HTTP requests against the new self-hosted SearXNG endpoint. The highly complex deep\_research orchestrator—which handles URL deduplication, domain scoring, and source budgets—will automatically inherit this new capability without requiring logic modifications. It will continue to rely on the secure read\_url primitive to safely ingest the HTML content of the discovered SERP links. The read\_docs handler must be rewritten to interface with @savant-code/knowledge-graph, executing full-text SQL queries against downloaded documentation SQLite files. The only missing components that must be built are the external SearXNG proxy layer and the GitHub Actions cron job to compile the SQLite docsets.

## **Architectural Blueprint: The Hybrid Topology**

To achieve zero marginal cost for the user while circumventing the collapse of commercial free-tier search APIs, the Savant-Code framework must adopt a bifurcated retrieval architecture. This design segregates highly dynamic, unbounded queries (the open web) from static, bounded queries (software documentation), treating each domain with the most mathematically efficient retrieval mechanism.

### **Domain 1: The Self-Hosted Metasearch Gateway (Dynamic Web Search)**

The web\_search tool will be backed by a centrally hosted SearXNG cluster managed entirely by the Savant-Code infrastructure team.  
The core engine relies on SearXNG, a privacy-respecting, AGPL-3.0 licensed metasearch engine that aggregates results from over seventy underlying search services, including Google, Bing, and DuckDuckGo25. The service will be deployed on a scalable Virtual Private Server (VPS) provider utilizing the official SearXNG Docker image34. To prevent upstream search engines from rate-limiting or blocking the single VPS IP address, outbound traffic from the SearXNG instance must be routed through an expansive IPv6 subnet pool or a commercial proxy rotation service.  
Crucially, the SearXNG instance will not be exposed directly to the public internet. It will sit behind a lightweight edge compute layer (such as a Cloudflare Worker or AWS API Gateway) that enforces JWT-based rate limiting. This rate limit will be tied to a cryptographic hash of the user's local machine ID or the existing anonymous telemetry ID4, preventing malicious actors from utilizing the Savant-Code endpoint as a free, unmetered scraping API.  
Integration into the existing monorepo is remarkably clean. The @savant-code/agent-runtime will update the packages/agent-runtime/src/tools/handlers/tool/web-search.ts file to execute standard HTTP GET requests to https://search.savant-code.io/search?q={query}\&format=json. The existing read\_url client-side primitive will ingest the URLs returned by this JSON payload and fetch the actual webpage content, maintaining the strict SSRF protections that prevent LLM-driven internal network probing1.

### **Domain 2: Client-Side SQLite Docsets (Static Documentation)**

The read\_docs tool will be permanently decoupled from external API latency and Context7 dependencies by leveraging the offline architecture pioneered by the Zeal and Dash documentation browsers29.  
Instead of performing live web searches for API documentation, a Savant-Code GitHub Actions cron job will periodically execute static scrapers (leveraging logic similar to the DevDocs repository28) to generate optimized SQLite databases for major programming languages and frameworks (e.g., React, Python, Node.js, Bun). These SQLite files, typically ranging from 10MB to 50MB, will be hosted on a global CDN (such as Cloudflare R2, which incurs zero egress fees) as static assets.  
All documentation queries will occur strictly on the user's local hardware. When an agent invokes the documentation tool, the CLI checks if the corresponding SQLite docset exists in the user's local \~/.savant-code/docsets/ directory. If missing or outdated, it downloads the highly compressed file from the CDN. The read\_docs handler will then utilize the existing @savant-code/knowledge-graph engine, which already orchestrates bun:sqlite connections2, to perform SQLite Full-Text Search (FTS5) queries against the local database. This returns precise, offline results instantly, generating zero server load for the maintainers and absolute privacy for the user.

## **Risk Assessment and Mitigation Strategies**

The implementation of a centralized search cluster and a decentralized documentation system introduces specific operational, legal, and security risks that must be proactively mitigated. Table 2 outlines the primary threat vectors and the corresponding architectural defenses.

| Risk Category | Specific Threat Vector | Likelihood | Impact | Mitigation Strategy |
| :---- | :---- | :---- | :---- | :---- |
| **Upstream Blocking** | Google, Bing, or DuckDuckGo algorithmically identify the SearXNG instance's IP address as a scraper due to high query volume, returning CAPTCHAs or 403 errors. | High | Critical | Route SearXNG outbound requests through an expansive IPv6 /64 block, rotating addresses per request. Configure the internal valkeydb limiter26 within SearXNG to manage internal connection states and detect upstream hostile responses early. |
| **Endpoint Abuse** | Malicious actors discover the public search.savant-code.io proxy endpoint and utilize it as a free scraping API, exhausting server bandwidth and triggering upstream blocks. | Medium | High | Deploy the endpoint behind an edge compute layer. Require a unique, cryptographically signed hardware ID (or the existing telemetry ID4) in the request header to enforce strict per-user rate limits. |
| **AGPL-3.0 Compliance** | Violating the SearXNG AGPL-3.0 license by failing to provide the source code for the hosted instance to users interacting over the network25. | Low | Legal | Execute unmodified vanilla SearXNG Docker images. Provide a prominent link in the Savant-Code repository and CLI documentation pointing directly to the official SearXNG GitHub repository, fully satisfying the distribution requirements. |
| **Data Staleness** | Pre-compiled SQLite docsets become outdated as new library versions are released, leading the LLM to hallucinate deprecated syntax. | Low | Medium | Automate a weekly GitHub Actions workflow to rebuild SQLite docsets using DevDocs scrapers and push new hashes to the CDN. The CLI checks a tiny manifest JSON on boot for updates. |
| **SSRF Vulnerability** | The LLM orchestrates the read\_url tool to probe local network endpoints (e.g., localhost:8080) using URLs hallucinated or manipulated from the SearXNG proxy. | Low | Critical | Ensure the SearXNG JSON output is strictly parsed. Maintain and heavily audit the existing assertUrlAllowed logic in the read\_url tool1 that strictly drops RFC 1918 (private) and link-local IP blocks before executing the fetch. |

## **Financial Analysis: The Reality of Maintainer Costs**

The project directive requires "zero marginal cost" for the end user and "no per-user API keys"1. While the cost to the user is genuinely zero, the physics of network infrastructure dictate a baseline operational cost for the Savant-Code maintainers. It is a fundamental fallacy to assume that one hundred thousand users can query the open web without someone paying for compute cycles and bandwidth.  
If Savant-Code attempted to absorb the cost of a commercial API to provide a seamless experience, the financial exposure would be catastrophic. Utilizing the Brave Search API at their published rate of five dollars per one thousand requests11, a conservative estimate of 100,000 users making just ten searches a day would cost the organization $15,000 per month, scaling infinitely as the user base grows.  
Transitioning to a self-hosted infrastructure model converts this variable, infinitely scaling expense into a highly predictable, flat-rate infrastructure cost. Table 3 breaks down the estimated monthly operational expenditure for the proposed hybrid architecture.

| Infrastructure Component | Purpose | Estimated Monthly Cost |
| :---- | :---- | :---- |
| **SearXNG Compute Nodes** | 2x high-memory VPS instances to handle concurrent HTTP connections, JSON parsing, and metasearch aggregation. | \~$30.00 |
| **IPv6 Proxy / Routing** | Outbound traffic routing via a proxy provider or an ISP offering massive IPv6 subnets to prevent upstream engine blocking. | \~$50.00 |
| **Docset Edge Storage (CDN)** | Hosting 50GB of static SQLite files and serving them globally via Cloudflare R2 (which features zero egress bandwidth fees). | \~$10.00 |
| **Edge Compute Limiter** | Cloudflare Workers execution for verifying hardware IDs and enforcing rate limits before requests hit the SearXNG cluster. | \~$5.00 |
| **Total Estimated Maintainer Cost** | **Highly predictable, flat-rate expenditure supporting 100k+ users.** | **\~$95.00 / month** |

The hybrid architecture achieves the zero-dollar goal for the user while remaining economically sustainable for the maintainers, successfully isolating the project from the volatile pricing of commercial AI grounding APIs.

## **Phased Build Order and Execution Plan**

To align with the ECHO Protocol's Perfection Loop (RED → GREEN → AUDIT) and ensure that no untested code disrupts the local-first execution environment3, the migration from the dead backend to the self-hosted architecture must occur in atomic, verifiable phases.

### **Phase 1: The Documentation Edge-Engine (Local-First)**

The initial phase focuses on completely replacing the broken Context7 dependency with local SQLite docsets. This phase carries zero infrastructure cost beyond CDN setup and can be developed entirely offline.

> 1. Develop a lightweight Python or Node.js pipeline within the scripts/ directory to download existing Dash/Zeal docsets and repackage them into a highly simplified SQLite schema containing only id, title, path, and content.  
> 2. Upload a baseline test database (e.g., react.sqlite) to an R2 storage bucket.  
> 3. Modify the packages/agent-runtime/src/tools/handlers/tool/read-docs.ts file to utilize the @savant-code/database wrapper2 to execute SELECT and FTS5 queries against the local database file.  
> 4. Implement automated download, caching, and integrity hashing of the SQLite file within the \~/.savant-code/docsets/ directory during the CLI boot sequence.

### **Phase 2: The Web Search Metasearch Gateway (Server-Side)**

The second phase establishes the SearXNG infrastructure and the protective edge compute layer.

> 1. Deploy a private SearXNG Docker container utilizing docker-compose on a scalable VPS. Configure the limiter.toml file to activate valkeydb for bot protection and connection management26.  
> 2. Deploy a Cloudflare Worker that intercepts requests from the Savant-Code CLI, validates a basic cryptographic hardware ID for rate-limiting, and securely proxies the request to the backend SearXNG container.  
> 3. Modify packages/agent-runtime/src/tools/handlers/tool/web-search.ts to execute HTTP GET requests against the new Cloudflare Worker endpoint, replacing the dead SavantCode backend routes1.

### **Phase 3: Integration, Orchestration, and ZTAP Compliance**

The third phase wires the new retrieval primitives into the broader agent orchestration engines and verifies compliance with the ECHO Protocol's Zero-Trust Agentic Provenance (ZTAP) mechanisms4.

> 1. Ensure the deep\_research multi-query orchestrator1 successfully injects the new web\_search SearXNG adapter, confirming that URL deduplication and domain scoring logic remain functional when processing SearXNG JSON outputs.  
> 2. Confirm that the ECHO Harness Enforcement Layer (EHEL) correctly intercepts and logs the new tool calls, generating valid, signed ZTAP receipts for both web searches and local docset queries4.

### **Phase 4: Hardening and Release**

The final phase ensures system resilience against the scale anomalies expected from a 100,000-user installation base.

> 1. Implement robust fallback mechanisms within web\_search.ts. If the SearXNG proxy is temporarily unresponsive or rate-limited, the tool must smoothly degrade the agent's behavior, returning clear error strings to the LLM rather than crashing the runtime.  
> 2. Update the CLI /diagnostics command4 to report the network health of the SearXNG endpoint and the storage footprint of the local docset cache.  
> 3. Execute the final build utilizing the bun run ci command and deploy via the release:public token-native engine4.

## **Open Architectural Questions for Maintainer Resolution**

Before finalizing the implementation, the core maintenance team must resolve several operational thresholds regarding infrastructure management and agent authorization.  
First, the scope of docset curation must be explicitly defined. The team must determine which programming languages and frameworks will be officially supported and compiled into the CDN distribution. Furthermore, a decision must be made regarding whether the framework will provide a standardized mechanism for enterprise users to compile and inject their own bespoke SQLite docsets for internal, proprietary libraries.  
Second, the mechanism for edge rate limiting requires clarification. The CLI currently permits users to disable remote analytics and telemetry via the /telemetry disable command4. If a user opts out of telemetry, the system must define a privacy-preserving mechanism (such as a salted hash of the local MAC address) to generate a unique identifier. This identifier is strictly necessary to enforce rate limits at the Cloudflare Worker edge, preventing malicious actors from bypassing quotas while respecting the user's telemetry preferences.  
Finally, phase gating for the retrieval tools must be strictly enforced within the ECHO Protocol state machine. Currently, the Researcher agent handles web searches3. The team must determine whether the powerful deep\_research tool will be gated exclusively to the RED (Detective) and GREEN (Forge) phases of the Perfection Loop, or if the Thinker agent will be granted permission to trigger background research during sequential planning phases3.

## **Post-Perfection-Loop Converged Design Blueprint**

The following section reflects the final, synthesized architecture ready for immediate implementation by the Forge agent, having successfully cleared the RED and GREEN analysis phases of the Perfection Loop3.  
The Savant-Code research subsystem will be fully operationalized without reliance on commercial APIs, fragile client-side scraping, or user-provided credentials. The architecture strictly adheres to the local-first, zero-trust ethos mandated by the ECHO Protocol v0.2.0.  
To fulfill the requirements of open-web discovery, the system will utilize a Centralized SearXNG Metasearch Gateway. The Savant-Code infrastructure will host an AGPL-3.0 compliant SearXNG Docker instance, protected by an edge compute proxy layer. This proxy will enforce a fair-use rate limit tied to a cryptographic hardware hash, protecting the maintainers' infrastructure from targeted abuse. The CLI's web\_search tool will query this proxy endpoint, receiving structured JSON arrays containing URLs and contextual snippets. Crucially, the actual retrieval of the webpage content will remain entirely decentralized; the client-side read\_url tool, fortified by existing SSRF protections, will execute localized HTTP GET requests to the discovered URLs1. This design preserves the Zero-Trust Agentic Provenance boundaries and prevents the central server from acting as a massive, vulnerable web proxy.  
To fulfill the requirements of documentation retrieval, the system will execute a permanent transition to a Decentralized SQLite Docset model. The legacy Context7 dependency will be permanently excised from the codebase. The maintainers will host pre-compiled, Dash-compatible SQLite databases on a global CDN. When an agent invokes a documentation request, the CLI will fetch the corresponding highly compressed SQLite file to the user's local .savant-code/docsets/ directory. The query will execute instantaneously on the local machine utilizing the native @savant-code/knowledge-graph engine's SQL bindings2.  
This bifurcated topology guarantees total independence from the rapidly degrading and highly financialized free-tier API market. It insulates the user base from the IP bans associated with client-side scraping, maximizes the reuse of existing monorepo assets, and reduces the operational cost of serving over one hundred thousand users to a highly predictable, negligible infrastructure baseline.

#### **Works cited**

> 1. AGENTS.md  
> 2. ARCHITECTURE.md  
> 3. ECHO.md  
> 4. README.md  
> 5. Microsoft Retires Bing Search APIs; Pushes Azure AI Agents \- WinBuzzer, [https://winbuzzer.com/2025/05/12/microsoft-retires-bing-search-apis-pushes-azure-ai-agents-xcxwbn/](https://winbuzzer.com/2025/05/12/microsoft-retires-bing-search-apis-pushes-azure-ai-agents-xcxwbn/)  
> 6. Microsoft ends Bing Search APIs on August 11, alternative costs 40-483% more \- PPC Land, [https://ppc.land/microsoft-ends-bing-search-apis-on-august-11-alternative-costs-40-483-more/](https://ppc.land/microsoft-ends-bing-search-apis-on-august-11-alternative-costs-40-483-more/)  
> 7. What are the Best Bing Search API Alternatives in 2026 \- Firecrawl, [https://www.firecrawl.dev/blog/bing-search-api-alternatives](https://www.firecrawl.dev/blog/bing-search-api-alternatives)  
> 8. Bing API Deprecation Impacts Tavily | Sacra Chat, [https://sacra.com/chat/h/88611061-5cb3-4ebb-a7f1-b9b622e6665e/](https://sacra.com/chat/h/88611061-5cb3-4ebb-a7f1-b9b622e6665e/)  
> 9. Top 5 Brave Search API Alternatives in 2026 \- Firecrawl, [https://www.firecrawl.dev/blog/brave-search-api-alternatives](https://www.firecrawl.dev/blog/brave-search-api-alternatives)  
> 10. Brave Drops Free Search API Tier, Puts All Developers on Metered Billing \- Implicator.ai, [https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing/](https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing/)  
> 11. Cheapest Web Search APIs for Production Use (2026): Real Costs, Hidden Fees, and What Actually Matters | by Sludgieboy | Medium, [https://medium.com/@RonaldMike/cheapest-web-search-apis-for-production-use-2026-real-costs-hidden-fees-and-what-actually-90f2e7643243](https://medium.com/@RonaldMike/cheapest-web-search-apis-for-production-use-2026-real-costs-hidden-fees-and-what-actually-90f2e7643243)  
> 12. Brave Search API in 2026: Search vs Answers, Pricing, and First Working Requests, [https://blog.laozhang.ai/en/posts/brave-search-api](https://blog.laozhang.ai/en/posts/brave-search-api)  
> 13. Bright Data vs. Brave Search API: Which Should You Use?, [https://brightdata.com/blog/ai/bright-data-vs-brave-search-api](https://brightdata.com/blog/ai/bright-data-vs-brave-search-api)  
> 14. Complete Tavily Tutorial: AI Search API for RAG and AI Agents, [https://rubythalib.ai/en/articles/tutorial-lengkap-tavily-ai-search-api-untuk-rag-dan-ai-agents](https://rubythalib.ai/en/articles/tutorial-lengkap-tavily-ai-search-api-untuk-rag-dan-ai-agents)  
> 15. Mojeek Web Search API, [https://www.mojeek.com/services/search/web-search-api/](https://www.mojeek.com/services/search/web-search-api/)  
> 16. duckduckgo rate limit error · Issue \#136 · crewAIInc/crewAI \- GitHub, [https://github.com/crewAIInc/crewAI/issues/136](https://github.com/crewAIInc/crewAI/issues/136)  
> 17. Snazzah/duck-duck-scrape: Search from DuckDuckGo and utilize its spice APIs in Node, [https://github.com/Snazzah/duck-duck-scrape](https://github.com/Snazzah/duck-duck-scrape)  
> 18. Duckduckgo search not working \- Page 2 \- Part 1 2022 \- fast.ai Course Forums, [https://forums.fast.ai/t/duckduckgo-search-not-working/105738?page=2](https://forums.fast.ai/t/duckduckgo-search-not-working/105738?page=2)  
> 19. Is it a bird? Creating a model from your own data \- Kaggle, [https://www.kaggle.com/code/jhoward/is-it-a-bird-creating-a-model-from-your-own-data/comments](https://www.kaggle.com/code/jhoward/is-it-a-bird-creating-a-model-from-your-own-data/comments)  
> 20. issue: Web Search with DuckDuckGo broken · open-webui open-webui · Discussion \#13292, [https://github.com/open-webui/open-webui/discussions/13292](https://github.com/open-webui/open-webui/discussions/13292)  
> 21. Uncaught Error Error: Failed to get the VQD for query "node.js". · Issue \#131 · Snazzah/duck-duck-scrape \- GitHub, [https://github.com/Snazzah/duck-duck-scrape/issues/131](https://github.com/Snazzah/duck-duck-scrape/issues/131)  
> 22. Repeated searches results in anomaly detection · Issue \#140 · Snazzah/duck-duck-scrape \- GitHub, [https://github.com/Snazzah/duck-duck-scrape/issues/140](https://github.com/Snazzah/duck-duck-scrape/issues/140)  
> 23. DuckDuckScrape, [https://duck-duck-scrape.js.org/](https://duck-duck-scrape.js.org/)  
> 24. Issues · Snazzah/duck-duck-scrape \- GitHub, [https://github.com/Snazzah/duck-duck-scrape/issues](https://github.com/Snazzah/duck-duck-scrape/issues)  
> 25. searxng: Self-Hosted Metasearch Engine Without Tracking, [https://www.prompts.brightcoding.dev/blog/searxngsearxng-self-hosted-metasearch-engine-without-tracking](https://www.prompts.brightcoding.dev/blog/searxngsearxng-self-hosted-metasearch-engine-without-tracking)  
> 26. searx.limiter \- SearXNG Documentation (2026.7.28+c01178d03), [https://docs.searxng.org/\_modules/searx/limiter.html](https://docs.searxng.org/_modules/searx/limiter.html)  
> 27. searxng \- Privacy-respecting federated metasearch engine \- Repositories, [https://git.jordan.im/searxng/](https://git.jordan.im/searxng/)  
> 28. awesome-stars/topics.md at master \- GitHub, [https://github.com/pstanton237/awesome-stars/blob/master/topics.md](https://github.com/pstanton237/awesome-stars/blob/master/topics.md)  
> 29. DevDocs \- Hacker News, [https://news.ycombinator.com/item?id=38972153](https://news.ycombinator.com/item?id=38972153)  
> 30. Feature to add own set of docs · Issue \#295 · freeCodeCamp/devdocs \- GitHub, [https://github.com/freeCodeCamp/devdocs/issues/295](https://github.com/freeCodeCamp/devdocs/issues/295)  
> 31. Create a docset for dash/zeal · Issue \#1401 · nim-lang/Nim \- GitHub, [https://github.com/nim-lang/Nim/issues/1401](https://github.com/nim-lang/Nim/issues/1401)  
> 32. mmkal/duck-duck-scrape-mcp: An MCP server for (free\!) search results via duckduckgo \- GitHub, [https://github.com/mmkal/duck-duck-scrape-mcp](https://github.com/mmkal/duck-duck-scrape-mcp)  
> 33. duck-duck-scrape-mcp \- A free MCP integration tool for scraping DuckDuckGo search results, [https://mcp.aibase.com/server/1916355323165122562](https://mcp.aibase.com/server/1916355323165122562)  
> 34. Mournweiss/mcp-search: Containerized search and web scraping infrastructure powered by Model Context Protocol \- GitHub, [https://github.com/Mournweiss/mcp-search](https://github.com/Mournweiss/mcp-search)  
> 35. Brave Search MCP Server \- AWS Marketplace, [https://aws.amazon.com/marketplace/pp/prodview-6yt3tbr7ucbjy](https://aws.amazon.com/marketplace/pp/prodview-6yt3tbr7ucbjy)  
> 36. awesome-selfhosted, [https://awesome-selfhosted.net/](https://awesome-selfhosted.net/)  
> 37. The 10 Best Self-Hosted Docker Apps in 2026 \- Riven Cloud, [https://sa.net/blog/best-self-hosted-apps/](https://sa.net/blog/best-self-hosted-apps/)