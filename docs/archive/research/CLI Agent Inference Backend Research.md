<!-- markdownlint-disable MD041 -->

> **Historical note:** This document uses the original product name *Savant* in some sections because it references
  external research and third-party projects from that period. The product is now **Savant-Code / Savant-Free**.

# **Architecting a Sustainable Free-Tier Inference Backend for a CLI Coding Agent**

The evolution of autonomous AI coding agents is currently constrained by a rigid economic dichotomy: developers must
either pay substantial monthly subscriptions for proprietary platforms (e.g., Cursor, GitHub Copilot, Claude Code) or
rely on open-source frameworks (e.g., Cline, Aider, Continue.dev) that require high-end local GPUs or "Bring Your Own
Key" (BYOK) API setups1. The emergence of tools like Savant has proven the viability of a third path: a
zero-configuration, free-to-use CLI agent subsidized by a combination of targeted developer advertising and strategic
"data-for-compute" partnerships with major AI laboratories4.
Building a proprietary fork, such as Savant-Code, necessitates a highly resilient backend capable of orchestrating
thousands of concurrent agentic sessions. This infrastructure must proxy requests to diverse Large Language Model (LLM)
providers, seamlessly integrate multiple AI-native ad networks (Gravity, ZeroClick, Carbon), and enforce cryptographic
validation to prevent headless API exploitation4.

## **1\. Backend Architecture Deep Dive: Edge-Native Proxy Design**

Serving free inference to a massive global user base requires a backend architecture that minimizes persistent compute
costs while managing long-lived, stateful connections. Traditional containerized deployments (e.g., AWS ECS or
Kubernetes) introduce idle costs that erode the margins of an ad-subsidized model. Cloudflare Workers provides the ideal
serverless edge computing substrate, but standard HTTP proxying is insufficient for the continuous, bidirectional
streaming required by multi-turn AI agents.

### **1.1 Managing WebSocket Streaming on Cloudflare Workers**

CLI coding agents rely on real-time streaming to output planning, file scanning, and code generation steps9. Standard
reverse proxies often buffer Server-Sent Events (SSE) or terminate connections prematurely. For instance, Nginx defaults
to a 60-second read timeout, silently dropping connections during complex, long-running LLM reasoning phases10.
Cloudflare's edge network natively supports WebSocket upgrades, but it enforces a strict 100-second idle timeout10.
To maintain persistent connections for agentic loops without being disconnected by edge timeouts, the backend must
utilize **Cloudflare Durable Objects (DO)** configured as WebSocket servers. A single Durable Object instance
coordinates the state of a user's terminal session, maintaining the connection to the CLI client while waiting for
upstream responses from models like DeepSeek V4 Pro or Kimi K2.7 Code4.
However, running active Durable Objects continuously is cost-prohibitive. Billing accrues for the entire duration the
object remains in memory12. The architectural solution is the **WebSocket Hibernation API**. This API allows the Durable
Object to hibernate—removing it from active memory and halting billable duration (GB-s charges)—while keeping the
client's WebSocket connection alive at the network edge14.
When the upstream LLM provider returns a chunk of the response, the Durable Object is instantly re-initialized, its
webSocketMessage handler executes, it forwards the payload to the CLI, and it immediately returns to hibernation14. This
event-driven hibernation is the only mechanism that makes a free-tier WebSocket proxy economically viable at scale.

### **1.2 The Session Management State Machine**

A robust session management approach requires a tiered state tracking system utilizing Cloudflare's entire storage
ecosystem: KV, Durable Objects, and D1.

| Storage Layer | Purpose in Proxy Architecture | Performance Characteristics |
| :---- | :---- | :---- |
| **Cloudflare KV** | Geographic routing, IP rate limiting, and global token blacklisting. | High-speed global reads, eventual consistency for writes. Ideal for checking cf.country against the Full/Limited tier lists4. |
| **Durable Objects** | Active state machine for concurrent session tracking. | Strongly consistent, single-region execution. Ensures a user cannot exploit concurrency by opening multiple terminal instances simultaneously16. |
| **Cloudflare D1** | Asynchronous audit logging, token consumption metrics, and streak rewards. | Serverless SQLite. Used for analytics and reporting to ad networks and AI providers without blocking the critical execution path16. |

The Durable Object acts as a strict state machine, transitioning the session through specific phases:

* Queued: The user is waiting for upstream capacity (polled until active)8.  
* Active: The session is currently provisioned and bound to a specific model.  
* Superseded: The user has issued a new prompt, aborting the previous generation to save compute8.  
* Ended: The session has expired or the task is complete.  
* Disabled: No active session is required.

If a user attempts to request a model that violates their current state—for example, a session\_model\_mismatch where a
user requests a premium model while assigned to a limited-tier session—the Durable Object automatically ends the session
and attempts to recreate a valid one transparently8.

### **1.3 Upstream LLM Routing and Normalization**

The proxy must act as a universal translator. The CLI issues standard OpenAI-compatible /v1/chat/completions or
Anthropic-compatible /v1/messages requests. The proxy intercepts these payloads, resolves the requested model (e.g.,
translating kimi-k2.6 to moonshotai/kimi-k2.6), and routes the traffic to the corresponding provider8.
Critically, the proxy must perform real-time **Message Normalization**. Providers have distinct formatting rules; for
example, some Chinese models reject the developer role, requiring the proxy to map it to the system role before
forwarding8. The proxy must also resolve JSON schema definitions, normalizing $ref pointers within tool schemas for
providers that do not natively support deeply nested function-calling structures8.

### **1.4 Minimal Viable Backend for 1,000+ Concurrent Users**

To support 1,000+ concurrent users, the minimal viable backend must address Cloudflare's subrequest limits. The free
tier of Cloudflare Workers allows 50 subrequests per request, while the paid tier allows 1,00018. Because a single
multi-agent CLI loop (Planner, File Picker, Editor, Reviewer) can spawn dozens of LLM calls, the proxy must batch
messages efficiently9.
The minimal architecture requires:

> 1. A standard Worker to validate GitHub OAuth tokens and upgrade the connection to a WebSocket14.  
> 2. A Hibernatable Durable Object to manage the WebSocket lifecycle and route requests to the LLM APIs14.  
> 3. A request debounce mechanism (e.g., a 1.3-second global lock) to prevent automated looping scripts from triggering
  429 Too Many Requests errors from upstream providers8.

## **2\. Provider Partnership Playbook: The Data-for-Compute Exchange**

The fundamental economic engine of the free-tier model relies on bartering developer workflow data for LLM inference
compute. Subsidizing peak inference costs (which can exceed $7,800 daily at high scale) strictly via ad revenue is
challenging4. The solution is negotiating partnerships with AI laboratories that are desperate for high-quality,
domain-specific training data.

### **2.1 The Value of Developer Telemetry**

Frontier model development is currently bottlenecked by a scarcity of high-quality reasoning data. While public
repositories (GitHub, StackOverflow) have been exhausted, the next leap in coding AI requires execution
traces—specifically, how humans and agents iteratively plan, edit, debug, and recover from compilation errors19. This
concept, often referred to as "Harness Engineering," focuses on designing agent workspaces where models can learn from
multi-turn interactions and environment feedback20.
Chinese AI providers—such as DeepSeek, Moonshot (Kimi), Zhipu (GLM), and MiniMax—are uniquely positioned in this market.
Facing geopolitical constraints on hardware accumulation, they rely on algorithmic efficiency, MoE (Mixture-of-Experts)
architectures, and superior data pipelines to compete with Western frontier models21. Evidence suggests that some of
these laboratories have aggressively distilled Western models (e.g., Claude) to capture reasoning pathways23. By
partnering with a CLI coding agent, these providers gain legal, direct access to proprietary, multi-turn developer
telemetry: bash execution traces, file edits, and error-correction loops.

### **2.2 Negotiating the Deal and Typical Terms**

When negotiating a "data-for-compute" deal with providers like DeepSeek or MiniMax, the CLI developer must position the
telemetry as a premium, exclusive asset.
**What they want in return:** Providers seek deep visibility into the agentic loop. They want anonymized prompt logs,
codebase context mapped by the File Picker agent, applied code diffs, and the terminal output of failed test runs4. They
analyze this data to fine-tune their base models, improving their performance on complex benchmarks like SWE-bench and
CursorBench20.
**Typical Terms and Governance:**

* **Perpetual Licensing:** Data policy surveys indicate that providers like Zhipu and Moonshot/Kimi often require
  "perpetual licenses" to utilize the submitted telemetry for ongoing model training25.
* **Compute Subsidies:** In exchange for the data, the provider grants unrestricted, zero-cost API access for specific
  models, or sets a compute threshold that scales with user volume4.
* **Minimum User Counts:** To provide statistically significant data volumes, providers typically look for a minimum
  threshold of active users. A platform with 10,000 Daily Active Users (DAU) running 3 sessions a day generates millions
  of structured coding tokens daily, which is highly attractive to data-hungry labs.

### **2.3 Western vs. Eastern Provider Programs**

The "data-for-compute" model contrasts sharply with Western provider programs. OpenAI and Anthropic generally offer
structured, time-limited startup credits (e.g., via Microsoft for Startups)4. While these credits bootstrap early
development, they eventually expire, forcing the developer into a standard SaaS billing model that is incompatible with
a permanently free consumer tool.
Conversely, partnering with Chinese open-weight innovators provides a permanent subsidy mechanism. The tradeoff is
stringent regulatory compliance. Transferring user data cross-border requires strict adherence to privacy frameworks.
The proxy must implement robust sanitization, stripping Personally Identifiable Information (PII), API keys, and
environment variables before routing payloads to subsidized providers. Explicit user opt-in is mandatory; users must
understand that utilizing the free tier permits their prompts to be used for AI training4.

## **3\. Ad Network Integration: Monetizing the CLI**

To cover infrastructural overhead and generate profit, the CLI must integrate context-aware advertising without
disrupting the developer experience. Traditional ad networks rely on browser cookies and DOM manipulation, making them
incompatible with terminal environments5. The backend must integrate specialized AI-native networks—Gravity, ZeroClick,
and Carbon—using a hybrid of server-side fetching and cryptographic client-side validation.

### **3.1 Integrating Gravity Ads**

Gravity Ads is an AI-native network designed to monetize LLM conversations by matching contextual intent to sponsored
suggestions28. For example, if a developer asks the CLI to "set up a serverless database," Gravity might return a native
text ad for PlanetScale or MongoDB6.
**Integration Mechanics:** Gravity is integrated entirely server-side to ensure zero added latency for the user. The
backend utilizes the @gravity-ai/api SDK (or standard REST calls)6. When the proxy receives a user prompt, it spawns an
asynchronous fetch request to Gravity in parallel with the LLM inference call.

JavaScript  
// Conceptual flow, executed within the Cloudflare Worker  
const adTask \= gravity.getAds(request, messages, \[{"placement": "cli\_terminal"}\]);  
const llmStream \= fetchUpstreamLLM(messages);  
const adResult \= await adTask;  
// The ad is injected into the initial SSE response before the LLM tokens stream

Gravity requires the conversation context (the last 2-3 messages) to ensure high relevancy, filtering out
non-conversational roles like tool or function. The network pays on a CPM or CPC basis, with high-intent developer
audiences commanding premium CPMs.

### **3.2 Integrating ZeroClick**

ZeroClick focuses on agentic commerce, turning API services into agent-purchasable storefronts32. For a CLI tool,
ZeroClick functions as an offer marketplace, delivering contextual ads based on real-time user intent and continuously
learned preferences34.
**API Endpoints and Tracking Requirements:** Integrating ZeroClick requires a strict, two-step split architecture:

> 1. **Offer Retrieval (Server-Side):** The Cloudflare proxy issues a POST request to
  https://zeroclick.dev/api/v2/offers. The request must include the Content-Type: application/json and x-zc-api-key
  headers, passing a JSON body containing the method ("server"), the client's ipAddress, and the user's query7.
> 2. **Impression Tracking (Client-Side):** ZeroClick enforces rigorous tracking to prevent automated server scraping.
  After the CLI renders the ad, the CLI itself must issue a POST request to https://zeroclick.dev/api/v2/impressions.
  The JSON body must contain the ids of the rendered offers7.

*Critical Constraint:* Impression requests must originate from the end user's device, not the proxy server, and are
subject to IP-based rate limiting7. This split architecture introduces a massive vulnerability: if a user bypasses the
official CLI, the impression endpoint is never pinged, and revenue collapses.

### **3.3 Integrating Carbon Ads**

Carbon Ads is a veteran network (established in 2010 via BuySellAds) that curates native advertising for developers and
designers5. Unlike typical display networks, Carbon provides a single, unobtrusive text ad and strictly refuses to use
tracking cookies5.
Carbon provides a CLI-specific SDK that handles fetching, local caching, and formatting5. Crucially, the SDK
automatically suppresses ads in CI/CD pipelines or piped outputs (e.g., codebuff | grep) to avoid breaking developer
automation5. Carbon's CPMs are heavily dependent on geography; Tier 1 countries (US, UK, CA, EU) yield excellent
returns, while Tier 3 countries yield very little37. Therefore, Carbon should be prioritized for "Full Mode" tier users.

### **3.4 Realistic Fill Rates and CPMs**

For a CLI coding tool with 10,000 to 50,000 DAU, the blended monetization strategy yields substantial revenue:

* **Full Mode (Premium Geographies):** Combining Gravity's high-intent matching ($20-$30 CPM) with Carbon's established
  developer demand ($2-$5 CPM) and ZeroClick's CPC conversions results in an effective blended CPM of approximately
  $25.00 for Tier 1 users6.
* **Limited Mode (Global Geographies):** Traffic outside core markets suffers from low advertiser demand and lower fill
  rates. The effective blended CPM for these regions typically drops to around $4.0037.

## **4\. Anti-Abuse and Validation: The Cryptographic Ad Chain**

The greatest threat to a proxy-based free inference model is headless exploitation. Projects like "Freebuff2API" are
explicitly designed to translate the backend's proprietary protocol back into standard OpenAI API endpoints38. These
tools strip identifiers (like cost\_mode), rotate stolen authentication tokens, and allow users to run massive automated
workloads (or connect local IDEs like Cursor) without ever rendering an ad in the terminal8.
To prevent the total collapse of the business model, the backend must mathematically guarantee that LLM compute is only
provisioned *after* an ad has been verifiably rendered to a human user. This requires a Cryptographic Ad Chain.

### **4.1 Implementing HMAC Signature Validation**

The proxy leverages the Web Crypto API, which is natively supported on Cloudflare Workers, to create an unforgeable
state machine39. The flow operates as follows:

> 1. **Session Initiation & Ad Fetch:** The user initiates a CLI command. The proxy fetches an ad payload from Gravity
  or Carbon and generates a unique session\_id.
> 2. **Token Minting:** The Cloudflare Worker imports a master secret key using crypto.subtle.importKey configured for
  HMAC and SHA-25639. The Worker creates a concatenated message payload: version:session\_id:ad\_id:expiresAt. It then
  signs this payload using crypto.subtle.sign, encodes the binary buffer using base64UrlEncode, and returns the ad copy
  and this cryptographic token to the CLI41.
> 3. **Client-Side Verification:** The CLI renders the text ad in the terminal. If ZeroClick is used, the CLI executes
  the client-side impression tracking ping7.
> 4. **Inference Request:** The CLI sends the user's prompt to the proxy, placing the base64UrlEncode HMAC token in the
  authorization header41.
> 5. **Token Verification:** The Worker intercepts the prompt. It first checks the expiresAt timestamp to ensure the
  token hasn't timed out. It then decodes the token and validates the signature using crypto.subtle.verify41.

*Security Imperative:* The validation must rely on crypto.subtle.verify rather than a standard JavaScript string
comparison (token \=== expected). Standard string comparisons bail out on the first mismatched character, creating a
timing side-channel attack that allows malicious actors to guess the HMAC secret byte by byte41.
If the token is valid, the Worker opens the WebSocket and streams the LLM response. If invalid, the request is dropped.
Because third-party headless proxies (like Freebuff2API) refuse to render ads, they cannot complete the ad-fetch step to
acquire a valid HMAC token, effectively neutralizing the exploit8.

### **4.2 Defense-in-Depth Heuristics**

Cryptography alone cannot stop sophisticated scrapers that attempt to simulate the ad chain. The proxy must enforce a
minimal anti-abuse system:

* **HAR-Style Fingerprinting:** The proxy must inspect incoming HTTP headers (Accept-Encoding, Connection, Host,
  User-Agent) to ensure they exactly match the signature of the official Node.js/Bun CLI fetch implementation8.
* **SOCKS5 Proxy Blocking:** Attackers frequently use tools like Cloudflare WARP (Warp Plus Manager) or SOCKS5 proxies
  to bypass rate limits on limited-tier sessions8. The backend KV store should cross-reference incoming IPs against
  known VPN/proxy exit nodes and enforce aggressive CAPTCHA or token rotation penalties8.
* **Streak and Rate Limiting:** Implement a global debounce (e.g., a 1.3-second minimum gap between requests) and track
  daily usage streaks in D1 to dynamically adjust rate limits for trusted vs. untrusted accounts8.

## **5\. Unit Economics at Scale**

To determine the viability of the ad-subsidized, data-bartered model, we must model the monthly unit economics at
10,000, 50,000, and 170,000 registered users.

### **5.1 Cost and Revenue Assumptions**

The financial modeling relies on several distinct behavioral and infrastructural assumptions characteristic of developer
tools:

* **User Engagement:** Monthly Active Users (MAU) typically represent 30% of registered users. Daily Active Users (DAU)
  represent 25% of MAU (effectively 7.5% of total registrations). The average DAU initiates 3 multi-turn sessions per
  day.
* **Token Consumption and Prompt Caching:** An average agentic session requires significant context gathering, consuming
  roughly 150,000 input tokens and 10,000 output tokens.
  * *Flash Models (Limited Tier):* Baseline input cost is \~$0.15 per 1M tokens. Utilizing prompt caching yields an
    estimated 80% hit rate (cached tokens cost \~$0.015/1M). The effective blended input cost is $0.042 per 1M tokens.
    Total cost per session: \~$0.0093.
  * *Premium Models (Full Tier):* Baseline input cost is \~$1.00 per 1M tokens. With an 80% cache hit rate, the
    effective blended input cost is $0.28 per 1M tokens. Total cost per session: \~$0.062.
* **Geographic Distribution:** 30% of traffic originates from high-CPM countries (Full Mode, using Premium models). 70%
  originates from the rest of the world (Limited Mode, using Flash models)4.
* **Ad Impressions:** Each multi-turn session generates an average of 12 ad impressions (rendered between agentic
  reasoning steps).
* **Blended CPMs:** Full Mode yields a blended $25.00 CPM (Gravity \+ Carbon \+ ZeroClick). Limited Mode yields a $4.00
  CPM6.

### **5.2 Break-Even Analysis**

The break-even ad impression volume per inference session is highly favorable.

* In **Full Mode**, the inference cost per session is $0.062. At a $25.00 CPM, each ad impression generates $0.025.
  Therefore, a session reaches break-even after just **2.5 ad impressions**.
* In **Limited Mode**, the inference cost is $0.0093. At a $4.00 CPM, each impression generates $0.004. A session
  reaches break-even after **2.3 ad impressions**.

Because the CLI renders an average of 12 impressions per session, the model is inherently profitable *even without* the
data-for-compute subsidy.

### **5.3 Monthly Financial Projections**

The following table calculates the monthly unit economics across the three scale points.

* **Net Profit (No Subsidy):** Assumes the backend pays raw API costs out of pocket to the providers.  
* **Net Profit (With Subsidy):** Assumes a successful data-for-compute agreement where providers absorb 100% of LLM
  inference costs.

| Metric | Startup Phase | Growth Phase | Scale Phase |
| :---- | :---- | :---- | :---- |
| **Registered Users** | 10,000 | 50,000 | 170,000 |
| **Monthly Active Users (MAU)** | 3,000 | 15,000 | 51,000 |
| **Daily Active Users (DAU)** | 750 | 3,750 | 12,750 |
| **Daily Sessions** | 2,250 | 11,250 | 38,250 |
| **Inference Cost / Month (Unsubsidized)** | $1,694.93 | $8,474.62 | $28,813.72 |
| **Cloudflare Infra Cost / Month** | $5.08 | $5.41 | $6.38 |
| **Gross Ad Revenue / Month (Gravity \+ ZeroClick \+ Carbon)** | $8,343.00 | $41,715.00 | $141,831.00 |
| **Net Profit / Month (No Subsidy)** | **$6,642.99** | **$33,234.97** | **$113,010.90** |
| **Net Profit / Month (With Subsidy)** | **$8,337.92** | **$41,709.60** | **$141,824.62** |

At the 10,000 registered user mark, the system generates over 2.5 million structured coding tokens per day. This is the
inflection point where the sheer volume of high-quality telemetry becomes statistically significant for LLM training,
making the platform highly attractive to Chinese providers seeking to negotiate data-for-compute contracts.

## **6\. Competitive Landscape and Maturity**

The AI developer tools ecosystem is currently divided between premium proprietary subscriptions and highly fragmented
open-source frameworks.

### **6.1 The Open-Source vs. Proprietary Divide**

Commercial platforms such as Cursor, GitHub Copilot, and Claude Code operate strictly on subscription models, typically
ranging from $20 to $39 per month, or they meter usage heavily2. While they offer polished user experiences, they lock
developers into specific proprietary ecosystems.
Conversely, the open-source community has rallied around frameworks like Continue.dev, Aider, and Cline1. These tools
are highly capable and model-agnostic, supporting advanced features like the Model Context Protocol (MCP)2. However,
**none of these open-source alternatives provide a free, centralized inference backend**. Users are forced to either
supply their own API keys (shifting the cost burden directly to the developer) or run local models via Ollama or LM
Studio2. Local execution demands expensive GPU hardware (e.g., RTX 3090, Macs with massive Unified Memory), which
isolates developers in emerging markets or those working on low-power machines44.
Savant-Code, utilizing the Savant architecture, occupies a unique position: it provides cloud-based,
zero-configuration, frontier-level AI coding that is genuinely free to the end-user, subsidized seamlessly in the
background4.

### **6.2 Maturity of AI-Native Ad Networks**

The success of this model relies heavily on the maturity of the underlying ad networks.

* **Carbon Ads:** Extremely mature. Backed by BuySellAds and operating since 2010, Carbon is the gold standard for
  developer advertising, offering reliable payouts, robust CLI SDKs, and deep advertiser demand5.
* **Gravity Ads:** Emerging but highly capable. Gravity has successfully built SDKs specifically tailored for streaming
  LLM responses, allowing publishers to monetize conversational intent without introducing latency6.
* **ZeroClick:** The newest entrant, focused exclusively on the burgeoning field of agentic commerce and
  machine-to-machine payments32. While their API endpoints and tracking requirements are strict, their focus on
  providing agents with purchasing power represents the next frontier of monetization32.

## **Conclusion**

Architecting a sustainable free-tier inference backend for a CLI coding agent requires neutralizing the exorbitant costs
of LLM inference through a synthesis of edge computing, cryptographic security, and hybrid monetization.
By leveraging Cloudflare Workers and Hibernatable Durable Objects, the proxy can manage stateful, multi-turn WebSocket
streams for thousands of concurrent users with negligible infrastructure costs. Integrating AI-native advertising
networks (Gravity, ZeroClick, Carbon) directly into the agentic loop generates immediate positive unit economics.
However, this revenue is only protected by enforcing a rigorous Cryptographic Ad Chain using HMAC-SHA256 signatures,
mathematically guaranteeing that headless proxies cannot bleed compute without rendering ads.
Ultimately, true scale is unlocked not just through advertising, but by weaponizing the platform's developer telemetry.
By bartering execution traces, file edits, and debugging loops with data-hungry global AI providers, the platform
transforms its largest expense—inference compute—into a perpetually subsidized asset, ensuring the CLI remains powerful,
fast, and entirely free.

### **Works cited**

> 1. Pricing \- Cline AI Coding Agent, [https://cline.bot/pricing](https://cline.bot/pricing)  
> 2. What Is Cline? The Open-Source AI Coding Tool That Runs in VS Code \- Developers Digest,
  [https://www.developersdigest.tech/blog/what-is-cline-open-source-ai-coding-tool](https://www.developersdigest.tech/blog/what-is-cline-open-source-ai-coding-tool)
> 3. Continue.dev \+ Ollama Setup 2026: Free Copilot, Full config.yaml | Local AI Master,
  [https://localaimaster.com/blog/continue-dev-ollama-setup](https://localaimaster.com/blog/continue-dev-ollama-setup)
> 4. CodebuffAI/codebuff: Generate code from the terminal\! \- GitHub,
  [https://github.com/CodebuffAI/codebuff](https://github.com/CodebuffAI/codebuff)
> 5. Monetize Your CLI Tool with Carbon Ads, [https://www.carbonads.net/cli](https://www.carbonads.net/cli)  
> 6. For AI Platforms | Gravity, [https://www.trygravity.ai/ai-platforms](https://www.trygravity.ai/ai-platforms)  
> 7. Overview \- ZeroClick,
  [https://developer.zeroclick.ai/docs/integration-guide](https://developer.zeroclick.ai/docs/integration-guide)
> 8. notBlubbll/free-buff-lol \- GitHub,
  [https://github.com/notBlubbll/free-buff-lol](https://github.com/notBlubbll/free-buff-lol)
> 9. syntax-syndicate/codebuff-v0: Generate code from the terminal\! \- GitHub,
  [https://github.com/syntax-syndicate/codebuff-v0](https://github.com/syntax-syndicate/codebuff-v0)
> 10. SSE vs WebSockets vs gRPC Streaming for LLM Apps: The Protocol Decision That Bites You Later \- TianPan.co,
  [https://tianpan.co/blog/2026-04-19-sse-websockets-grpc-streaming-llm-applications](https://tianpan.co/blog/2026-04-19-sse-websockets-grpc-streaming-llm-applications)
> 11. Cloudflare WebSockets: CDN, Workers & Durable Objects,
  [https://websocket.org/guides/infrastructure/cloudflare/](https://websocket.org/guides/infrastructure/cloudflare/)
> 12. A Workers optimization that reduces your bill | The Cloudflare Blog,
  [https://blog.cloudflare.com/workers-optimization-reduces-your-bill/](https://blog.cloudflare.com/workers-optimization-reduces-your-bill/)
> 13. tRPC over websockets on Cloudflare Workers Durable Objects \#4400 \- GitHub,
  [https://github.com/trpc/trpc/discussions/4400](https://github.com/trpc/trpc/discussions/4400)
> 14. Use WebSockets · Cloudflare Durable Objects docs,
  [https://developers.cloudflare.com/durable-objects/best-practices/websockets/](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
> 15. Durable Object State \- Cloudflare Docs,
  [https://developers.cloudflare.com/durable-objects/api/state/](https://developers.cloudflare.com/durable-objects/api/state/)
> 16. Cloudflare Durable Objects \- Stateful Serverless Functions,
  [https://www.cloudflare.com/products/durable-objects/](https://www.cloudflare.com/products/durable-objects/)
> 17. Introducing WebSockets Support in Cloudflare Workers,
  [https://blog.cloudflare.com/introducing-websockets-in-workers/](https://blog.cloudflare.com/introducing-websockets-in-workers/)
> 18. Transport modes \- Sandbox SDK \- Cloudflare Docs,
  [https://developers.cloudflare.com/sandbox/configuration/transport/](https://developers.cloudflare.com/sandbox/configuration/transport/)
> 19. DeepSh\*t: Exposing the Security Risks of DeepSeek-R1 \- HiddenLayer,
  [https://www.hiddenlayer.com/research/deepsht-exposing-the-security-risks-of-deepseek-r1](https://www.hiddenlayer.com/research/deepsht-exposing-the-security-risks-of-deepseek-r1)
> 20. Superlinear Academy · Deep News \- Computing Life,
  [https://yage.ai/share/?lang=all\&page=29](https://yage.ai/share/?lang=all&page=29)
> 21. AI Models | NVIDIA Developer, [https://developer.nvidia.com/ai-models](https://developer.nvidia.com/ai-models)  
> 22. Deep News — Superlinear Academy \- AI Builders 2027, [https://grapeot.me/share/](https://grapeot.me/share/)  
> 23. Anthropic just dropped evidence that DeepSeek, Moonshot and MiniMax were mass-distilling Claude. 24K fake
  accounts, 16M+ exchanges. : r/ClaudeAI \- Reddit,
  [https://www.reddit.com/r/ClaudeAI/comments/1rd1j8u/anthropic\_just\_dropped\_evidence\_that\_deepseek/](https://www.reddit.com/r/ClaudeAI/comments/1rd1j8u/anthropic_just_dropped_evidence_that_deepseek/)
> 24. codebuff — Commands, Examples & Usage Guide \- Skywork,
  [https://skywork.ai/clihub/keywords/codebuff.html](https://skywork.ai/clihub/keywords/codebuff.html)
> 25. ai-coding-data-policy-survey-en-20260309,
  [https://yage.ai/share/ai-coding-data-policy-survey-en-20260309.html](https://yage.ai/share/ai-coding-data-policy-survey-en-20260309.html)
> 26. DeepSeek Security, Privacy, and Governance: Hidden Risks in Open-Source AI \- Theori,
  [https://theori.io/blog/deepseek-security-privacy-and-governance-hidden-risks-in-open-source-ai](https://theori.io/blog/deepseek-security-privacy-and-governance-hidden-risks-in-open-source-ai)
> 27. What Makes EthicalAds a Great Carbon Ads Alternative,
  [https://www.ethicalads.io/alternative-to-carbon-ads/](https://www.ethicalads.io/alternative-to-carbon-ads/)
> 28. Gravity | The Ad Network for AI, [https://www.trygravity.ai/](https://www.trygravity.ai/)  
> 29. Publisher Spotlight: How Freebuff Funds Free AI Coding | Carbon Ads,
  [https://www.carbonads.net/blog/savant-publisher-spotlight](https://www.carbonads.net/blog/savant-publisher-spotlight)
> 30. gravity-sdk \- PyPI, [https://pypi.org/project/gravity-sdk/](https://pypi.org/project/gravity-sdk/)  
> 31. AI Platform Monetization Help \- Gravity,
  [https://www.trygravity.ai/help/ai-platforms](https://www.trygravity.ai/help/ai-platforms)
> 32. ZeroClick \- Sell Your Product to AI Agents, [https://www.zeroclick.ai/](https://www.zeroclick.ai/)  
> 33. It's time to sell to AI agents \- ZeroClick,
  [https://www.zeroclick.ai/its-time-to-sell-to-agents](https://www.zeroclick.ai/its-time-to-sell-to-agents)
> 34. Overview \- ZeroClick, [https://developer.zeroclick.ai/docs](https://developer.zeroclick.ai/docs)  
> 35. Carbon Ads Media Kit \- Slides Design \- BuySellAds,
  [https://www.buysellads.com/hubfs/Carbon%20Ads%20Media%20Kit.pdf](https://www.buysellads.com/hubfs/Carbon%20Ads%20Media%20Kit.pdf)
> 36. GitHub \- buysellads/carbon-sdk · GitHub,
  [https://github.com/buysellads/carbon-sdk](https://github.com/buysellads/carbon-sdk)
> 37. What CTR Actually Looks Like for Developer Ads | Carbon Ads,
  [https://www.carbonads.net/blog/developer-ad-ctr-benchmarks](https://www.carbonads.net/blog/developer-ad-ctr-benchmarks)
> 38. GitHub \- Quorinex/Freebuff2API: OpenAI-compatible Freebuff proxy with dynamic free-agent tracking, token
  rotation, and ready-to-use Docker deployment.,
  [https://github.com/Quorinex/Freebuff2API](https://github.com/Quorinex/Freebuff2API)
> 39. Sign and Verify Messages with HMAC Using Web Crypto \- Brady Joslin,
  [https://bradyjoslin.com/posts/webcrypto-signing/](https://bradyjoslin.com/posts/webcrypto-signing/)
> 40. Web Crypto · Cloudflare Workers docs,
  [https://developers.cloudflare.com/workers/runtime-apis/web-crypto/](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
> 41. HMAC-signed URLs on Cloudflare Workers \- Flavio Copes,
  [https://flaviocopes.com/hmac-signed-urls-cloudflare-workers/](https://flaviocopes.com/hmac-signed-urls-cloudflare-workers/)
> 42. Workers Best Practices \- Cloudflare Docs,
  [https://developers.cloudflare.com/workers/best-practices/workers-best-practices/](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
> 43. Web Crypto \- Zuplo Docs,
  [https://zuplo.com/docs/programmable-api/web-crypto-apis](https://zuplo.com/docs/programmable-api/web-crypto-apis)
> 44. Continue.dev AI Coding | Guides \- Clore.ai,
  [https://docs.clore.ai/guides/ai-platforms-and-agents/continue-dev](https://docs.clore.ai/guides/ai-platforms-and-agents/continue-dev)
> 45. Freebuff — the free coding agent (free Claude Code, Codex, Cursor & Lovable alternative), [https://savant.com/](https://savant.com/)
