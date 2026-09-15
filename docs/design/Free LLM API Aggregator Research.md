# **Automated Discovery and Verification of Zero-Cost LLM Inference Providers**

## **Executive Summary**

The evaluation of automated discovery pipelines for zero-cost Large Language Model (LLM) inference endpoints indicates that relying on a single upstream data source introduces unacceptable security and operational risks to production coding-agent architectures. The primary source under evaluation, the freeairouter.com tracker, provides a highly structured and readily accessible daily telemetry feed that maps the current availability of public AI relays and official free tiers. However, its architectural reliance on tertiary upstream collections and its probabilistic, sentiment-driven verification mechanism expose consuming systems to significant supply-chain vulnerabilities, most notably typosquatting and intermediary hijacking.

The definitive verdict on freeairouter.com as a primary ground-truth feed is that it is structurally insufficient to stand alone but remains highly valuable as a secondary liveness and latency signal within a larger orchestration system. The recommended pipeline architecture for the savant-code ecosystem must enforce a multi-feed consensus model. The top three risks identified in this landscape are systemic, requiring aggressive mitigation strategies. First, the proliferation of malicious intermediaries, commonly referred to as LLMjacking, poses an existential threat to downstream agents. Recent academic measurements of commodity LLM proxy routers reveal that a statistically significant portion of unauthenticated relays actively inject malicious payloads, conduct prompt injection, or harvest transitive credentials via tool-calling architectures. Second, stealth data-for-training postures present a severe data governance risk. First-party providers frequently mandate data-training consent as the unalterable cost of free-tier access. Routing sensitive or proprietary codebases to these endpoints without explicit user consent violates standard enterprise security policies. Third, the extreme ecosystem volatility associated with unofficial free endpoints results in a terminal churn rate. Nodes frequently appear and vanish within a forty-eight-hour window, necessitating aggressive, automated daily pruning to prevent cascading failure rates in client applications.

To mitigate these risks, the recommended feed stack for the discovery pipeline mandates a tripartite consensus mechanism. The primary ground-truth feed should be derived from the heavily audited and community-governed cheahjs/free-llm-api-resources repository, which enforces strict inclusion criteria. The freeairouter.com JSON feed should operate in tandem as the secondary telemetry layer, providing essential daily reachability, uptime history, and latency metrics. Finally, the zukixa/cool-ai-stuff matrix should serve as the tertiary metadata layer, utilized strictly for capability mapping and model feature verification. Any endpoint candidate must achieve cryptographic and operational consensus across all three layers before the system automatically triggers a human-approval proposal. This architecture ensures that the high velocity of the free-compute ecosystem is captured daily while effectively insulating the savant-code client base from malicious routing and silent data retention policies.

## **Source Dossier: Operational Trust and Sustainability Analysis**

The fundamental viability of any automated pipeline relies on the operational trust, funding sustainability, and historical continuity of its upstream data providers. An exhaustive analysis of the freeairouter.com platform reveals a highly active but structurally fragile ecosystem heavily dependent on unpaid open-source maintenance.

The platform is primarily operated by open-source developer Ihuzaifa Shoukat, who serves as the principal author and maintainer of the overarching free-ai-router software framework1. The website functions as an open-source utility designed to index, score, and route traffic to free LLM sites, public-benefit relays, and the first-party free tiers of major commercial AI labs2. There is no explicit signal of enterprise venture funding, corporate backing, or commercial Service Level Agreements supporting the platform's infrastructure. Consequently, the longevity of the service is entirely tethered to the individual maintainer's continued interest and the broader open-source community's willingness to sustain upstream directories. The historical continuity of the dataset, particularly regarding update cadence history and Wayback Machine snapshots of continuous availability, is largely unverifiable through standard public telemetry, but the project's direct admission of upstream provenance indicates that the data is not natively sourced. The platform explicitly inherits its primary endpoint discoveries from the for-the-zero/Free-LLM-Collection GitHub repository, an active project with over 562 stars3. This upstream repository lacks rigorous cryptographic or organizational identity verification for the endpoints it curates, serving merely as a crowdsourced bulletin board for operational API URLs3. Therefore, freeairouter.com inherently absorbs the systemic volatility of its upstream sources, meaning that if the maintainers of these tertiary lists abandon their curation, the freeairouter.com dataset will immediately degrade in quality and accuracy.

Regarding automated ingestion, while formal developer-facing API documentation is absent from the primary domain pages, the architectural implementation of the sites.json feed explicitly invites automated consumption2. The presence of the HTTP Access-Control-Allow-Origin: \* header, combined with a Cache-Control: public, max-age=300 directive, demonstrates that the operator designed the endpoint specifically for cross-origin, high-frequency automated polling by third-party clients. Furthermore, the robots.txt configuration explicitly permits crawling across the root domain for all user agents, responsibly restricting only the /go redirect links to prevent recursive link tracking and infinite crawling loops. There is no evidence in the project's GitHub issue trackers, commit changelogs, or community discussions suggesting that the operator objects to automated harvesting. However, the complete absence of a published Terms of Service, privacy page, or explicit data schema guarantee means that the JSON structure could mutate—or the endpoint could be deprecated entirely—without advanced notice to consumers2.

The platform's internal verification methodology is a composite of three distinct automated processes rather than manual human auditing. First, the system employs read-only probing, which periodically executes network pings against discovered endpoints to establish basic network reachability and measure response latency in milliseconds2. This mechanism successfully validates raw hardware performance, such as confirming the extremely fast inference speeds of \~2,600 tokens per second on Cerebras endpoints4. Second, the system executes an automated community reputation search, aggregating discussions and user warnings across developer platforms such as Reddit, V2EX, and Zhihu5. Third, the platform utilizes language model synthesis to process these disparate signals into a normalized risk review, generating a zero to one-hundred reputation score and categorizing the systemic risk level4. Crucially, freeairouter.com does not independently audit quota enforcement documentation or manually probe signup page restrictions. Instead, it automatically synchronizes rate limits, context limits, and free quota specifications on a daily basis directly from the cheahjs/free-llm-api-resources repository4. When populated, the internal report fields contain a synthesized summary of safety advantages, risk flags, hardware architecture (e.g., first-party operator versus relay), and community sentiment4.

The most critical operational failure mode in this ecosystem is the rapid state fluctuation and the active proliferation of malicious lookalike domains, known as typosquatting. Endpoints within the relay ecosystem frequently flip their status between up and down due to rate-limit exhaustion, abandoned hosting, or account bans by the primary AI labs. Furthermore, the dataset frequently captures and lists highly dangerous endpoints such as api.celebras.ai, a single-character substitution designed specifically to mimic the legitimate api.cerebras.ai base URL6. While the internal risk analysis engine occasionally flags these lookalikes with a false category confirmation or a down status, the sheer presence of these domains in the raw JSON feed poses a severe risk to any downstream automated consumer that blindly trusts the data4. This class of attack is not theoretical; malicious actors actively exploit the trust that software engineers place in AI-branded packages and tooling ecosystems to intercept cloud API keys and inject malicious code8. Recent supply-chain compromises in 2026, such as the backdooring of 144 mastra NPM packages via the easy-day-js typosquat, demonstrate that attackers are aggressively targeting LLM development environments to steal API keys, crypto wallets, and continuous integration secrets9. Relying on a primary feed that does not proactively and cryptographically filter unregistered or typo-adjacent domains guarantees that an automated pipeline will eventually ingest and propose a malicious endpoint.

## **Landscape and Comparison Universe**

To contextualize the data provided by freeairouter.com, it is necessary to analyze the broader comparison universe of maintained public trackers mapping free LLM access in 2026\. The ecosystem is fragmented across highly structured community repositories, automated JSON feeds, and unstructured social chat platforms.

### **Comparison of Public Trackers**

&nbsp;

| Tracker / Source | Format & Machine Readability | Update Cadence | Verification Method | License / Legal Posture |
| :---- | :---- | :---- | :---- | :---- |
| **freeairouter.com** | JSON API (sites.json); highly structured, nested objects. | Daily (Automated pipeline). | Read-only probing, cheahjs quota synchronization, LLM sentiment synthesis2. | Unspecified open data; permissive CORS headers permit global access2. |
| **cheahjs/free-llm-api-resources** | Raw Markdown tables; structurally consistent but requires regex parsing. | Continuous (Community Pull Requests). | Manual community auditing; strict inclusion rules requiring permanent free tiers rather than temporary promotions11. | Standard Open Source; explicit data usage constraints outside training contexts13. |
| **zukixa/cool-ai-stuff** | Markdown with robust OpenAPI, JSON, YAML, and CSV structure exports. | Weekly to Daily. | Tiered manual evaluation (1–5 scale), matrix mapping of model capabilities and NSFW filtering rules14. | Open Source (Custom legal.md framework outlining inclusion criteria)15. |
| **for-the-zero/Free-LLM-Collection** | Unstructured raw Markdown lists; minimal programmatic consistency. | Intermittent (High variance based on maintainer availability). | Minimal to none; functions primarily as a raw aggregator of active endpoints without rigorous risk assessment3. | Unspecified / Standard GitHub repository defaults3. |
| **Discord/Telegram Networks** | Unstructured chat logs, pinned messages, and bot outputs. | Real-time but extremely noisy. | Zero verification; relies entirely on anecdotal user reports of depleted limits or discovered keys16. | Proprietary closed platforms; requires active scraping and violating platform terms of service. |

When ranking these sources as feed candidates for a daily automated harvester, the primary criteria must be structured machine-readability, the rigor of inclusion criteria, and update velocity. The highest-ranked primary ground truth is the cheahjs/free-llm-api-resources repository. Despite being formatted primarily in Markdown, its status as the definitive global standard, boasting over 29,400 GitHub stars, ensures it receives the highest volume of peer-reviewed community corrections and manual audits12. Parsers can reliably extract endpoint base URLs, rate limits, and model support using regular expressions applied to the table structures. The second-ranked candidate, serving strictly as a liveness telemetry layer, is freeairouter.com. Its sites.json payload is the most developer-friendly format available, offering pre-computed arrays of latency, reachability, and historical uptime4. It is optimal for determining if an endpoint discovered in the primary repository is currently responding to network traffic. The third-ranked candidate is zukixa/cool-ai-stuff, which serves as an essential metadata mapping layer. Because it offers direct YAML and JSON exports via OpenAPI definitions, this source provides the most rigorous metadata regarding content moderation rules, open-source status, and specific multimodal support frameworks14. Conversely, Telegram and Discord networks, such as the r/hermesagent communities, must be entirely discarded as candidates. The signal-to-noise ratio in these environments is too low for automated ingestion, and while they serve as early warning systems for when free tiers are exhausted, the unstructured nature of the data makes programmatic parsing impossible16.

The computational necessity of polling these feeds on a daily cadence is justified by the extreme churn rate inherent to the free AI API ecosystem. Telemetry from global domain name system lookups indicates millions of newly resolved hostnames associated with AI relays, accompanied by exceptionally high Pointer Record (PTR) churn rates as temporary infrastructures are provisioned and subsequently abandoned21. In the context of API monetization, a free endpoint operating without an underlying sustainable business model or strict rate limiting is frequently described by industry analysts as a "dead endpoint" within weeks of its initial launch22. High-value, ungated research APIs experience exceptionally high churn as automated clients consume all available compute resources, forcing operators to abruptly pull the endpoints offline or place them behind aggressive paywalls24. Consequently, to prevent high failure rates in client applications, the automated pipeline must implement a strict dead-entry pruning policy. A standard best practice dictates a seventy-two-hour grace period; any provider failing network reachability checks for three consecutive days should be automatically and permanently excised from the active registry.

## **Per-Provider Verification Problem**

### **The Minimum Evidence Bundle**

For an automated pipeline discovering candidate endpoints, a strict, multi-stage gating mechanism must be implemented to ensure operational safety. An endpoint must satisfy a comprehensive "Minimum Evidence Bundle" before a human integration proposal is generated. This verification protocol acts as the primary defense against malicious routing and degraded service.

The first required check is endpoint reachability and cryptographic handshake validation. The system must execute an HTTP OPTIONS or basic GET request to the base URL to verify that the server successfully negotiates TLS 1.3 encryption. Crucially, the Secure Sockets Layer certificate must be verified against the official domain of the provider, explicitly rejecting wildcard certificates associated with known dynamic DNS providers, free hosting platforms, or anonymous proxy networks. The second check is introspection verification. The endpoint must successfully respond to a /v1/models request—the standard OpenAI protocol—with a valid, well-formed JSON array of model object identifiers. This confirms that the endpoint supports standard conversational or completion interfaces rather than proprietary or deprecated formatting. The third check is the authentication boundary evaluation. The endpoint must strictly reject unauthenticated requests, returning an HTTP 401 Unauthorized status code when queried for a text completion without an API key. Endpoints that allow unauthenticated text generation are highly volatile, rapidly exhausted by automated scraping, and routinely serve as vectors for malware distribution and abuse25. The final and most critical check is domain provenance and typosquat prevention. The base URL's domain must be programmatically cross-referenced against the Levenshtein distance of the top one hundred known AI laboratories and primary cloud providers. Any domain exhibiting a distance of one or two—such as the previously identified api.celebras.ai—must trigger an automatic hard failure to prevent supply chain poisoning6.

### **Privacy Postures, KYC Constraints, and Workload Viability**

A central barrier to utilizing zero-cost inference for coding agents is the pervasive industry practice of mandating data-for-training consent in exchange for free access. Source code represents highly proprietary intellectual property, and routing coding-agent workloads through standard free tiers without zero-data-retention guarantees represents a critical, often catastrophic, data leak.

The data-for-training postures of major providers in 2026 exhibit significant variance. Mistral explicitly mandates training consent on its free "Experiment" tier; the service utilizes API inputs and outputs to train future models by default27. While Vibe Enterprise customers are opted out by default, users of the free tier must navigate complex manual settings to toggle anonymous improvement data off, and in some contexts, the free tier strictly prohibits opting out altogether27. Similarly, under the Gemini API Additional Terms of Service for the free tier, Google reserves the right to retain interactions for one day and use the submitted content to improve products, specifically for machine-learning purposes31. While this data is technically disconnected from the user's primary Google Account, it is still ingested into the training pipeline, and human reviewers may annotate the prompts31. Transitioning to a paid tier is the only structural mechanism to guarantee zero data retention within the Google AI Studio ecosystem32. Conversely, direct usage of standard paid APIs from OpenAI and Anthropic strictly prohibits data-for-training without explicit user opt-in, but third-party aggregators providing alleged "free" access to these models frequently intercept and log the data themselves to build their own fine-tuning datasets37. A notable mitigation strategy is provided by the aggregator OpenRouter, which enforces a "Zero Data Retention" (ZDR) parameter. When a request includes the zdr flag, the platform's internal logic ensures the prompt is exclusively routed to upstream endpoints that mathematically guarantee no data retention, effectively bypassing the training policies of less scrupulous providers40.

Furthermore, coding-agent workloads possess unique computational requirements that disqualify many free tiers. Agents generate massive context windows—frequently exceeding eight thousand tokens per request due to the inclusion of system prompts, repository maps, and large file contexts—and require high tokens-per-minute throughput43. Strict Know Your Customer (KYC) requirements, such as mandatory phone verification or placing a credit card on file, introduce significant friction for automated onboarding and risk accidental overage charges4. Specialized hardware providers offer the most viable environments for these workloads. Groq provides a free tier limited to thirty requests per minute and six thousand tokens per minute without requiring a credit card, though the token limit can bottleneck large context tasks2. Cerebras offers a much more accommodating daily reset quota of one million tokens without a credit card requirement, delivering inference speeds approximating 2,600 tokens per second, making it highly suitable for heavy coding workloads despite its shrinking roster of available free models4.

### **The LLMjacking Threat Landscape**

The architectural risk of utilizing unvetted free APIs was starkly quantified in an April 2026 measurement study conducted by researchers at UC Santa Barbara, titled *"Your Agent Is Mine: Measuring Malicious Intermediary Attacks on the LLM Supply Chain"*7. The researchers analyzed 428 commodity LLM proxy routers and found a disturbing rate of compromise: 26 endpoints were actively injecting malicious code, and 17 actively touched or intercepted researcher-owned credentials50.

These malicious intermediaries do not simply engage in passive prompt logging; they execute active, targeted attacks against the downstream agents. By exploiting the transitive trust established between the client agent and the remote model, these proxies engage in sophisticated prompt injection and credential theft48. When an automated agent utilizes a tool-calling architecture to access local cloud resources or continuous integration environments, the malicious relay modifies the model's response payload to request authentication tokens or inject backdoor execution scripts directly into the generated code52. Consequently, the verification pipeline must adopt a zero-trust posture regarding anonymous relays. Any endpoint categorized by freeairouter.com as a "free relay" or a "commercial-aggregator" without verifiable corporate backing and registered Autonomous System Numbers (ASN) must be permanently denylisted from the automated proposal system.

### **Harvesting Etiquette and Legal Posture**

Automated pipelines systematically polling these directories must strictly adhere to established network etiquette to avoid triggering IP bans, rate-limit blacklisting, and legal takedown notices. The Hypertext Transfer Protocol specifications, specifically RFC 9110, dictate that HTTP clients should explicitly identify themselves and their purpose via the User-Agent header57. By distinguishing themselves from standard human browsers, crawlers enable servers to perform appropriate content negotiation and traffic shaping60.

A well-behaved automated harvester for the savant-code ecosystem should broadcast a custom, highly transparent user-agent string providing direct contact information (e.g., User-Agent: SavantCode-DiscoveryBot/1.0 (+https://github.com/savant-code)). The crawler must strictly respect robots.txt directives, specifically avoiding any paths disallowed by the target servers to prevent index poisoning63. To prevent server exhaustion and respect the limited resources of open-source aggregators, the pipeline must implement exponential backoff algorithms and limit its polling frequency to exactly once per twenty-four-hour cycle, ideally executing during off-peak Coordinated Universal Time hours. While documented cases of providers explicitly banning automated catalog harvesting of their free tiers remain legally opaque, bypassing basic header conventions and replication of real browser behaviors to evade scraping blocks is viewed as hostile activity that rapidly leads to network-level denylisting64.

## **Integration-Fit Findings**

### **Protocol Dominance and Translation Shims**

Analysis of the platform and kind fields within the dataset, corroborated by the wider landscape, reveals that the OpenAI protocol—specifically the /v1/chat/completions and /v1/models endpoints—has achieved near-total dominance as the standard interface for LLM inference66. Major hardware providers and first-party labs, including Groq, Cerebras, Together AI, DeepInfra, and Fireworks, have natively adopted this interface26. This homogeneity allows for seamless integration into the savant-code gateways, enabling the drop-in replacement of base URLs and API keys without necessitating any complex alterations to client-side application logic.

However, a subset of highly valuable free tiers utilizes proprietary, protocol-specific routing mechanisms that necessitate the development of translation shims to achieve OpenAI compatibility. Cloudflare Workers AI offers a highly generous allocation of 10,000 free neurons daily but requires requests to be routed to a specific account-bound path (https://api.cloudflare.com/client/v4/accounts/{account\_id}/ai/run/)69. To integrate this provider, a shim must dynamically inject the user's Account ID into the URL path and map standard OpenAI-style message arrays into Cloudflare's expected payload format. Similarly, the Hugging Face Serverless Inference ecosystem provides extensive free access to a vast array of open-weight models but utilizes a distinct routing infrastructure that requires model-specific paths and unique payload structures, deviating significantly from standard chat completion expectations73. GitHub Models provides highly valuable free access to advanced proprietary models (e.g., GPT-4o) for developers using GitHub authentication, but it strictly routes traffic through Azure's infrastructure (models.inference.ai.azure.com) and requires specific token handling77. Because of the high volume and quality of compute provided by Cloudflare and GitHub Models, building dedicated shims for these specific providers is highly recommended, whereas smaller, highly esoteric protocols should be ignored to minimize technical debt.

### **Gate Criteria for Pipeline Integration**

To safely auto-draft an integration proposal for a human reviewer on a daily cadence, the pipeline must enforce strict zero-trust gate criteria. The pipeline should absolutely enforce zero auto-merge capabilities; every newly discovered provider must be manually approved by a human maintainer before being pushed to the client allowlist.

The primary gate criteria must enforce the following sequence of evaluations. First, Protocol Match: the provider must natively support the OpenAI protocol or map to a pre-existing shim within the savant-code repository. Proprietary endpoints without an existing shim trigger an internal notification but are excluded from the auto-drafting queue. Second, Hardware and First-Party Verification: the discovered domain must successfully resolve to a known, established first-party infrastructure provider through ASN verification. Anonymous aggregators, unauthenticated relays, and endpoints failing the Levenshtein distance typosquat check are immediately and permanently discarded. Third, Data-Training Exemption: the automated proposal engine must programmatically parse the provider's Terms of Service URL. If textual analysis detects the terms "training," "improve our services," or "machine learning" in close proximity to "user data" or "prompts" without detecting an explicit opt-out mechanism for the free tier, the proposal is flagged with a high-risk data leak warning, requiring explicit human override. Finally, Context Window Viability: the introspection response or the synchronized database must confirm a context window of at least 8,192 tokens. Coding agents cannot operate effectively below this threshold due to the sheer volume of file context required, meaning models restricted to 4,096 tokens must be filtered out of the integration queue43.

## **Per-Provider Appendix**

The following table represents the top fifteen high-confidence free providers identified across all evaluated sources, mapped strictly to the required operational fields for integration evaluation.

&nbsp;

| Provider | Endpoint base URL | OpenAI-compatible (y/n) | Free tier shape (quota \+ rate limits) | Context windows of free models | KYC/data-training caveats | Evidence (URL \+ date) | Confidence (high/med/low) |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Groq | https://api.groq.com/openai/v1 | y | 30 RPM, 6,000 TPM limit46. | 8k \- 128k (varies by model) | Data is not strictly claimed for training; no credit card required on the free tier2. | https://console.groq.com/docs/rate-limits (Sep 2026\) | high |
| Cerebras | https://api.cerebras.ai/v1 | y | 1M tokens per day, approximately 30 RPM4. | 8k | Shrinking roster of free models; lacks explicit denial of data training4. | https://freeairouter.com/s/cerebras.ai (Sep 2026\) | high |
| OpenRouter (:free) | https://openrouter.ai/api/v1 | y | 30 RPM, 500 requests per day per key81. | Dependent entirely on upstream model routing | ZDR (Zero Data Retention) flag enforced; mathematically prevents data retention40. | https://openrouter.ai/docs/cookbook/administration/data-api (Sep 2026\) | high |
| Google AI Studio | https://generativelanguage.googleapis.com/v1beta/openai/ | y | 15 RPM, 1M TPM, 1,500 requests per day | 1M \- 2M (Gemini 1.5/2.0 architecture) | **Strict Risk:** Free tier data is retained for one day and utilized for ML training31. | https://ai.google.dev/gemini-api/terms (Sep 2026\) | high |
| Mistral | https://api.mistral.ai/v1 | y | 1 request per second, 500k TPM2. | 32k \- 128k | **Strict Risk:** Experiment tier utilizes data for training by default27. | https://developer.puter.com/tutorials/mistral-api-pricing/ (Sep 2026\) | high |
| GitHub Models | https://models.inference.ai.azure.com | y | Dependent on user tier; strict RPM limits applied79. | 4k \- 128k | Requires valid GitHub account authentication; enterprise data protection policies apply67. | https://thomascherickal.com/2026/06/24/the-ai-engineers-guide-to-the-top-10-genuinely-free-ai-inference-providers-in-2026/ (Sep 2026\) | high |
| Cloudflare Workers AI | https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1 | n | Generous 10,000 free neurons daily70. | Model dependent (frequently restricted below 8k) | Strict enterprise cloud privacy policies apply; highly secure environment70. | https://getfreeai.net/en/services/api/cloudflare-workers-ai/ (Sep 2026\) | high |
| Hugging Face Serverless | https://api-inference.huggingface.co/models/ | n | Limit of a few hundred requests per hour73. | Model dependent | Adheres to base HF privacy standards; heavily rate-limited by IP and user ID73. | https://huggingface.co/learn/cookbook/enterprise\_hub\_serverless\_inference\_api (Sep 2026\) | high |
| Together AI | https://api.together.xyz/v1 | y | Pay-what-you-use architecture; strict initial limits applied84. | Up to 128k | Strict enterprise privacy limits; no default training on paid tiers84. | https://docs.together.ai/docs/serverless/rate-limits (Sep 2026\) | med |
| DeepInfra | https://api.deepinfra.com/v1/openai | y | IP-based rate limits for unauthenticated traffic26. | Up to 128k | Privacy policy restricts data reuse; strictly operates as pay-as-you-go26. | https://deepinfra.com/blog/compare-models (Sep 2026\) | med |
| Fireworks AI | https://api.fireworks.ai/inference/v1 | y | Rate limits dynamically scale by model size86. | Up to 128k | Requires manual account registration to access68. | https://docs.fireworks.ai/updates/changelog (Sep 2026\) | med |
| Novita AI | https://api.novita.ai/v3/openai | y | Daily request quotas governed by referral credits87. | Up to 128k | General broad cloud Terms of Service applies88. | https://blogs.novita.ai/free-llm-api-comparison-2026/ (Sep 2026\) | med |
| Hyperbolic | https://api.hyperbolic.xyz/v1 | y | Up to 200 requests per second specifically for Llama 3.189. | Up to 128k | Governed by strict developer terms of use90. | https://hyperbolic.xyz/blog/llama-3-1-405b-support (Sep 2026\) | med |
| Cohere | https://api.cohere.com/v1 | y | Trial keys restricted to 1,000 API calls per month91. | Up to 128k | Trial keys are heavily restricted; enterprise policies apply exclusively to production environments91. | https://docs.cohere.com/docs/rate-limits (Sep 2026\) | high |
| SambaNova | https://api.sambanova.ai/v1 | y | High-throughput limitations, similar architecture to Cerebras92. | Up to 128k | Rapid hardware provider, requires account creation92. | https://www.slideshare.net/slideshow/the-best-free-ai-apis-for-developers-in-2026-tested-ranked-and-compared/286847790 (Sep 2026\) | high |

## **JSON Appendix**

&nbsp;

&nbsp;

&nbsp;

JSON

\[  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Groq",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.groq.com/openai/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "30 RPM, 6,000 TPM limit",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "8k \- 128k (varies by model)",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Data is not strictly claimed for training; no credit card required on the free tier",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://console.groq.com/docs/rate-limits (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Cerebras",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.cerebras.ai/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "1M tokens per day, approximately 30 RPM",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "8k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Shrinking roster of free models; lacks explicit denial of data training",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://freeairouter.com/s/cerebras.ai (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "OpenRouter (:free)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://openrouter.ai/api/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "30 RPM, 500 requests per day per key",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Dependent entirely on upstream model routing",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "ZDR (Zero Data Retention) flag enforced; mathematically prevents data retention",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://openrouter.ai/docs/cookbook/administration/data-api (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Google AI Studio",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://generativelanguage.googleapis.com/v1beta/openai/",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "15 RPM, 1M TPM, 1,500 requests per day",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "1M \- 2M (Gemini 1.5/2.0 architecture)",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Strict Risk: Free tier data is retained for one day and utilized for ML training",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://ai.google.dev/gemini-api/terms (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Mistral",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.mistral.ai/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "1 request per second, 500k TPM",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "32k \- 128k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Strict Risk: Experiment tier utilizes data for training by default",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://developer.puter.com/tutorials/mistral-api-pricing/ (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "GitHub Models",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://models.inference.ai.azure.com",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "Dependent on user tier; strict RPM limits applied",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "4k \- 128k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Requires valid GitHub account authentication; enterprise data protection policies apply",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://thomascherickal.com/2026/06/24/the-ai-engineers-guide-to-the-top-10-genuinely-free-ai-inference-providers-in-2026/ (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Cloudflare Workers AI",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "n",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "Generous 10,000 free neurons daily",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Model dependent (frequently restricted below 8k)",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Strict enterprise cloud privacy policies apply; highly secure environment",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://getfreeai.net/en/services/api/cloudflare-workers-ai/ (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Hugging Face Serverless",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api-inference.huggingface.co/models/",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "n",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "Limit of a few hundred requests per hour",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Model dependent",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Adheres to base HF privacy standards; heavily rate-limited by IP and user ID",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://huggingface.co/learn/cookbook/enterprise\_hub\_serverless\_inference\_api (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Together AI",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.together.xyz/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "Pay-what-you-use architecture; strict initial limits applied",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Up to 128k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Strict enterprise privacy limits; no default training on paid tiers",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://docs.together.ai/docs/serverless/rate-limits (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "med"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "DeepInfra",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.deepinfra.com/v1/openai",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "IP-based rate limits for unauthenticated traffic",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Up to 128k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Privacy policy restricts data reuse; strictly operates as pay-as-you-go",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://deepinfra.com/blog/compare-models (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "med"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Fireworks AI",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.fireworks.ai/inference/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "Rate limits dynamically scale by model size",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Up to 128k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Requires manual account registration to access",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://docs.fireworks.ai/updates/changelog (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "med"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Novita AI",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.novita.ai/v3/openai",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "Daily request quotas governed by referral credits",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Up to 128k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "General broad cloud Terms of Service applies",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://blogs.novita.ai/free-llm-api-comparison-2026/ (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "med"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Hyperbolic",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.hyperbolic.xyz/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "Up to 200 requests per second specifically for Llama 3.1",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Up to 128k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Governed by strict developer terms of use",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://hyperbolic.xyz/blog/llama-3-1-405b-support (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "med"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "Cohere",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.cohere.com/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "Trial keys restricted to 1,000 API calls per month",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Up to 128k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Trial keys are heavily restricted; enterprise policies apply exclusively to production environments",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://docs.cohere.com/docs/rate-limits (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;},  
&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;"Provider": "SambaNova",  
&nbsp;&nbsp;&nbsp;&nbsp;"Endpoint base URL": "https://api.sambanova.ai/v1",  
&nbsp;&nbsp;&nbsp;&nbsp;"OpenAI-compatible (y/n)": "y",  
&nbsp;&nbsp;&nbsp;&nbsp;"Free tier shape (quota \+ rate limits)": "High-throughput limitations, similar architecture to Cerebras",  
&nbsp;&nbsp;&nbsp;&nbsp;"Context windows of free models": "Up to 128k",  
&nbsp;&nbsp;&nbsp;&nbsp;"KYC/data-training caveats": "Rapid hardware provider, requires account creation",  
&nbsp;&nbsp;&nbsp;&nbsp;"Evidence (URL \+ date)": "https://www.slideshare.net/slideshow/the-best-free-ai-apis-for-developers-in-2026-tested-ranked-and-compared/286847790 (Sep 2026)",  
&nbsp;&nbsp;&nbsp;&nbsp;"Confidence (high/med/low)": "high"  
&nbsp;&nbsp;}  
\]

#### **Works cited**

> 1. ihuzaifashoukat/free-ai-router \- GitHub, [https://github.com/ihuzaifashoukat/free-ai-router](https://github.com/ihuzaifashoukat/free-ai-router)  
> 2. Free AI Router · free LLM API radar | risk review of free AI API sites, [https://freeairouter.com/](https://freeairouter.com/)  
> 3. README.md \- for-the-zero/Free-LLM-Collection \- GitHub, [https://github.com/for-the-zero/Free-LLM-Collection/blob/main/README.md](https://github.com/for-the-zero/Free-LLM-Collection/blob/main/README.md)  
> 4. Is cerebras.ai safe? Free quota · free models · risk review, [https://freeairouter.com/s/cerebras.ai](https://freeairouter.com/s/cerebras.ai)  
> 5. Is api.linkcloud.sh safe? Free quota, [https://freeairouter.com/s/api.linkcloud.sh](https://freeairouter.com/s/api.linkcloud.sh)  
> 6. 免费大模型API合集/ Free LLM api Collection \- GitHub, [https://github.com/for-the-zero/Free-LLM-Collection](https://github.com/for-the-zero/Free-LLM-Collection)  
> 7. Your Agent Is Mine: Measuring Malicious Intermediary Attacks on, [https://arxiv.org/html/2604.08407v1](https://arxiv.org/html/2604.08407v1)  
> 8. AI Developer Tool Impersonation: Typosquatting, Fake Install, [https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-tool-impersonation-installfix-typosquat/](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-tool-impersonation-installfix-typosquat/)  
> 9. Mastra npm Supply Chain Attack: 140+ Packages Backdoored via, [https://www.stepsecurity.io/blog/mastra-npm-packages-compromised-using-easy-day-js](https://www.stepsecurity.io/blog/mastra-npm-packages-compromised-using-easy-day-js)  
> 10. Mastra npm Supply Chain Attack: easy-day-js RAT Campaign, [https://phoenix.security/easy-day-js-mastra-npm-supply-chain-typosquat-rat-2026/](https://phoenix.security/easy-day-js-mastra-npm-supply-chain-typosquat-rat-2026/)  
> 11. Introduction \- Free LLM API Resources, [https://cheahjs-free-llm-api-resources.mintlify.app/introduction](https://cheahjs-free-llm-api-resources.mintlify.app/introduction)  
> 12. free-llm-api-resources/.gitignore at main \- GitHub, [https://github.com/cheahjs/free-llm-api-resources/blob/main/.gitignore](https://github.com/cheahjs/free-llm-api-resources/blob/main/.gitignore)  
> 13. GitHub \- cheahjs/free-llm-api-resources at hackernoon.com · GitHub, [https://github.com/cheahjs/free-llm-api-resources?ref=hackernoon.com](https://github.com/cheahjs/free-llm-api-resources?ref=hackernoon.com)  
> 14. stars/README.md at master · iakat/stars \- GitHub, [https://github.com/iakat/stars/blob/master/README.md](https://github.com/iakat/stars/blob/master/README.md)  
> 15. zukixa/cool-ai-stuff \- GitHub, [https://github.com/zukixa/cool-ai-stuff](https://github.com/zukixa/cool-ai-stuff)  
> 16. rising repo \- GitHub Pages, [https://yanggggjie.github.io/rising-repo/](https://yanggggjie.github.io/rising-repo/)  
> 17. A curated list of awesome LLM frameworks, libraries and software., [https://github.com/uhub/awesome-chatgpt](https://github.com/uhub/awesome-chatgpt)  
> 18. Models, Providers & Plans Megathread — June 2026 : r/hermesagent, [https://www.reddit.com/r/hermesagent/comments/1ufrtsf/models\_providers\_plans\_megathread\_june\_2026/](https://www.reddit.com/r/hermesagent/comments/1ufrtsf/models_providers_plans_megathread_june_2026/)  
> 19. cheahjs/free-llm-api-resources \- 29.4k Stars · Global Rank \#1238, [https://www.star-history.com/cheahjs/free-llm-api-resources](https://www.star-history.com/cheahjs/free-llm-api-resources)  
> 20. LLMjacking: How Attackers Gain LLM Access \- Kodem Security, [https://www.kodemsecurity.com/resources/how-attackers-are-gaining-access-to-llm-inference](https://www.kodemsecurity.com/resources/how-attackers-are-gaining-access-to-llm-inference)  
> 21. Blog \- ipapi.is, [https://ipapi.is/blog.html](https://ipapi.is/blog.html)  
> 22. Grok 4.1 vs Gemini 3 vs GPT 5.1: Real IPstack API Tests, [https://blog.apilayer.com/grok-4-1-vs-gemini-3-vs-gpt-5-1-we-tested-the-latest-llms-on-the-ipstack-api/](https://blog.apilayer.com/grok-4-1-vs-gemini-3-vs-gpt-5-1-we-tested-the-latest-llms-on-the-ipstack-api/)  
> 23. How to Make Your REST APIs Accessible to AI Assistants Using MCPs, [https://blog.apilayer.com/step-by-step-guide-how-to-make-your-rest-apis-accessible-to-ai-assistants-using-mcps/](https://blog.apilayer.com/step-by-step-guide-how-to-make-your-rest-apis-accessible-to-ai-assistants-using-mcps/)  
> 24. Google Ads vs. Social Media for Forex Brokerages in 2026, [https://limitless.center/social-media-ads-vs-google-ads-for-forex-what-converts-better-in-2025/](https://limitless.center/social-media-ads-vs-google-ads-for-forex-what-converts-better-in-2025/)  
> 25. Attackers Hijack Exposed AI Endpoints to Steal Tokens and Launch, [https://mallory.ai/stories/019f37c4-0c98-71bd-8edc-06289d29bb52](https://mallory.ai/stories/019f37c4-0c98-71bd-8edc-06289d29bb52)  
> 26. Compare Llama2 vs OpenAI models for FREE. \- DeepInfra, [https://deepinfra.com/blog/compare-models](https://deepinfra.com/blog/compare-models)  
> 27. Mistral API Pricing: Full Breakdown of Costs (Jun 2026), [https://developer.puter.com/tutorials/mistral-api-pricing/](https://developer.puter.com/tutorials/mistral-api-pricing/)  
> 28. What Free AI Tiers Do With Your Prompts: A 2026 Census, [https://www.digitalapplied.com/blog/free-and-promo-tier-data-terms-census](https://www.digitalapplied.com/blog/free-and-promo-tier-data-terms-census)  
> 29. Mistral Trains on User Data by Default: How to Opt Out, [https://www.aipricing.guru/news/mistral-user-data-training-default-opt-out-september-2026/](https://www.aipricing.guru/news/mistral-user-data-training-default-opt-out-september-2026/)  
> 30. Do you use my user data to train your Artificial Intelligence models?, [https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models](https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models)  
> 31. Google Gemini Data Retention Policy 2026 \- Meetily, [https://meetily.ai/llm-privacy/gemini](https://meetily.ai/llm-privacy/gemini)  
> 32. Interactions API | Gemini API \- Google AI for Developers, [https://ai.google.dev/gemini-api/docs/interactions-overview](https://ai.google.dev/gemini-api/docs/interactions-overview)  
> 33. Gemini CLI free tier privacy policy \- Google AI Developers Forum, [https://discuss.ai.google.dev/t/gemini-cli-free-tier-privacy-policy/91152](https://discuss.ai.google.dev/t/gemini-cli-free-tier-privacy-policy/91152)  
> 34. Free tier data processed before billing was enabled \- Gemini API, [https://discuss.ai.google.dev/t/data-deletion-request-free-tier-data-processed-before-billing-was-enabled/180514](https://discuss.ai.google.dev/t/data-deletion-request-free-tier-data-processed-before-billing-was-enabled/180514)  
> 35. When will the Free of Charge plan be available in Romania?, [https://discuss.ai.google.dev/t/when-will-the-free-of-charge-plan-be-available-in-romania/4865](https://discuss.ai.google.dev/t/when-will-the-free-of-charge-plan-be-available-in-romania/4865)  
> 36. GEMMA API. Important question \- TOS, does this violate the rules?, [https://discuss.ai.google.dev/t/gemma-api-important-question-tos-does-this-violate-the-rules/137896](https://discuss.ai.google.dev/t/gemma-api-important-question-tos-does-this-violate-the-rules/137896)  
> 37. Free AI Models: Run LLMs at $0 via One API \- Requesty, [https://www.requesty.ai/models/free](https://www.requesty.ai/models/free)  
> 38. Best LLM API Providers with ZDR and privacy \- Ginger Labs, [https://gingerlabs.ai/blog/best-llm-api-providers-with-zdr-and-privacy](https://gingerlabs.ai/blog/best-llm-api-providers-with-zdr-and-privacy)  
> 39. Claude privacy: How Anthropic handles your data \- Anonyome Labs, [https://anonyome.com/knowledge-center/ai-privacy/claude-privacy/](https://anonyome.com/knowledge-center/ai-privacy/claude-privacy/)  
> 40. Provider Routing \- Smart Multi-Provider Request Management, [https://openrouter.ai/docs/guides/routing/provider-selection](https://openrouter.ai/docs/guides/routing/provider-selection)  
> 41. Guardrails \- Organization Spending and Access Controls, [https://openrouter.ai/docs/guides/features/guardrails](https://openrouter.ai/docs/guides/features/guardrails)  
> 42. BYOK \- Bring Your Own Keys to OpenRouter, [https://openrouter.ai/docs/guides/overview/auth/byok](https://openrouter.ai/docs/guides/overview/auth/byok)  
> 43. Applying Brevity and Language Efficiency in Prompt Engineering, [https://prahladyeri.github.io/guides/applying-brevity-and-language-efficiency-to-prompt-engineering.html](https://prahladyeri.github.io/guides/applying-brevity-and-language-efficiency-to-prompt-engineering.html)  
> 44. Free api for beginners \- Hugging Face Forums, [https://discuss.huggingface.co/t/free-api-for-beginners/179088](https://discuss.huggingface.co/t/free-api-for-beginners/179088)  
> 45. 10 Free LLM APIs for OpenClaw \- Compared 2026 \- ClawHosters, [https://clawhosters.com/blog/posts/free-llm-api-openclaw](https://clawhosters.com/blog/posts/free-llm-api-openclaw)  
> 46. Best AI Inference Platforms for Speed & Cost in 2026, [https://deepinfra.com/blog/best-ai-inference-platforms](https://deepinfra.com/blog/best-ai-inference-platforms)  
> 47. Free Tiers · diegosouzapw/OmniRoute Wiki \- GitHub, [https://github.com/diegosouzapw/OmniRoute/wiki/Free-Tiers](https://github.com/diegosouzapw/OmniRoute/wiki/Free-Tiers)  
> 48. Your Agent Is Mine: Measuring Malicious Intermediary Attacks on, [https://www.alphaxiv.org/abs/2604.08407](https://www.alphaxiv.org/abs/2604.08407)  
> 49. Measuring Malicious Intermediary Attacks on the LLM Supply Chain, [https://arxiv.org/pdf/2604.08407](https://arxiv.org/pdf/2604.08407)  
> 50. An Attack-Surface Survey of MCP, Skills, and Tool Calling \- arXiv, [https://arxiv.org/html/2608.17275v1](https://arxiv.org/html/2608.17275v1)  
> 51. Prompt Injection \- The critical vulnerability lurking beneath the AI hype, [https://promptinjection.wtf/](https://promptinjection.wtf/)  
> 52. Malicious LLM Proxy Routers: Hidden AI Supply Chain Risk, [https://labs.cloudsecurityalliance.org/research/csa-research-note-llm-proxy-router-risk-20260416-csa-styled/](https://labs.cloudsecurityalliance.org/research/csa-research-note-llm-proxy-router-risk-20260416-csa-styled/)  
> 53. r/artificial on Reddit: 2.1% of LLM API routers are actively malicious, [https://www.reddit.com/r/artificial/comments/1sn7lq9/21\_of\_llm\_api\_routers\_are\_actively\_malicious/](https://www.reddit.com/r/artificial/comments/1sn7lq9/21_of_llm_api_routers_are_actively_malicious/)  
> 54. The Malicious Middleman: How LLM Relays Became Healthcare's, [https://bregg.com/blog/malicious-llm-relays-healthcare-supply-chain](https://bregg.com/blog/malicious-llm-relays-healthcare-supply-chain)  
> 55. Learn & Share | Tips, Best Practices, and Success Stories from the, [https://connect.securonix.com/learn-share-31](https://connect.securonix.com/learn-share-31)  
> 56. Half the 'AI APIs' You're Buying Are Lying to You \- Peike Li, [https://gogoduck912.github.io/blog/middlemen/](https://gogoduck912.github.io/blog/middlemen/)  
> 57. User-Agent header \- Wikipedia, [https://en.wikipedia.org/wiki/User-Agent\_header](https://en.wikipedia.org/wiki/User-Agent_header)  
> 58. What is the standard format for a browser's User-Agent string?, [https://stackoverflow.com/questions/2601372/what-is-the-standard-format-for-a-browsers-user-agent-string](https://stackoverflow.com/questions/2601372/what-is-the-standard-format-for-a-browsers-user-agent-string)  
> 59. RFC 9110: HTTP Semantics \- RFC Editor, [https://www.rfc-editor.org/info/rfc9110/](https://www.rfc-editor.org/info/rfc9110/)  
> 60. RFC 9110 \- HTTP Semantics \- IETF Datatracker, [https://datatracker.ietf.org/doc/html/rfc9110](https://datatracker.ietf.org/doc/html/rfc9110)  
> 61. User-Agent Client Hints \- GitHub Pages, [https://wicg.github.io/ua-client-hints/](https://wicg.github.io/ua-client-hints/)  
> 62. User-Agent \- Expert Guide to HTTP headers, [https://http.dev/user-agent](https://http.dev/user-agent)  
> 63. Crawler best practices \- IETF, [https://www.ietf.org/archive/id/draft-illyes-aipref-cbcp-00.html](https://www.ietf.org/archive/id/draft-illyes-aipref-cbcp-00.html)  
> 64. HTTP User Agent and Custom Headers: Real World Examples, [https://www.webtonative.com/blog/http-user-agent-and-custom-headers](https://www.webtonative.com/blog/http-user-agent-and-custom-headers)  
> 65. How Headers Are Used to Block Web Scrapers and How to Fix It, [https://scrapfly.io/blog/posts/how-to-avoid-web-scraping-blocking-headers](https://scrapfly.io/blog/posts/how-to-avoid-web-scraping-blocking-headers)  
> 66. One OpenAI-Compatible Endpoint for 34 Free LLM Providers, [https://dev.to/arshtechpro/freellmapi-one-openai-compatible-endpoint-for-34-free-llm-providers-3630](https://dev.to/arshtechpro/freellmapi-one-openai-compatible-endpoint-for-34-free-llm-providers-3630)  
> 67. The AI Engineers' Guide to The Top 10 Genuinely Free AI Inference, [https://thomascherickal.com/2026/06/24/the-ai-engineers-guide-to-the-top-10-genuinely-free-ai-inference-providers-in-2026/](https://thomascherickal.com/2026/06/24/the-ai-engineers-guide-to-the-top-10-genuinely-free-ai-inference-providers-in-2026/)  
> 68. Best LLM API Providers in 2026: We Reviewed 8 Options, [https://fireworks.ai/blog/best-llm-api-providers](https://fireworks.ai/blog/best-llm-api-providers)  
> 69. Claude Code \+ Cloudflare: Free AI Image Generation (2026, [https://learnwithhasan.com/guide/free-ai-images-claude-code-cloudflare/](https://learnwithhasan.com/guide/free-ai-images-claude-code-cloudflare/)  
> 70. Cloudflare Workers AI API \- Edge AI Inference Interface, [https://getfreeai.net/en/services/api/cloudflare-workers-ai/](https://getfreeai.net/en/services/api/cloudflare-workers-ai/)  
> 71. Cloudflare Workers AI \- Edge AI Inference Platform, [https://www.cloudflare.com/products/workers-ai/](https://www.cloudflare.com/products/workers-ai/)  
> 72. Cloudflare Workers AI Tutorial: REST, Wrangler, and SDK | Easton, [https://eastondev.com/blog/en/posts/ai/20251121-workers-ai-tutorial/](https://eastondev.com/blog/en/posts/ai/20251121-workers-ai-tutorial/)  
> 73. Serverless Inference API \- Hugging Face, [https://huggingface.co/learn/cookbook/enterprise\_hub\_serverless\_inference\_api](https://huggingface.co/learn/cookbook/enterprise_hub_serverless_inference_api)  
> 74. Pricing and Billing \- Hugging Face, [https://huggingface.co/docs/inference-providers/pricing](https://huggingface.co/docs/inference-providers/pricing)  
> 75. Inference Providers \- Hugging Face, [https://huggingface.co/docs/inference-providers/index](https://huggingface.co/docs/inference-providers/index)  
> 76. Frequent 504 Gateway Timeout Errors on Inference API, [https://discuss.huggingface.co/t/frequent-504-gateway-timeout-errors-on-inference-api-sentence-transformers-all-minilm-l6-v2/173034](https://discuss.huggingface.co/t/frequent-504-gateway-timeout-errors-on-inference-api-sentence-transformers-all-minilm-l6-v2/173034)  
> 77. Getting Started with GitHub Models | pkbullock.com, [https://pkbullock.com/blog/2024/getting-started-with-github-models](https://pkbullock.com/blog/2024/getting-started-with-github-models)  
> 78. Stop Paying OpenAI: Free Local AI in .NET with Ollama, [https://dev.to/mashrulhaque/stop-paying-openai-free-local-ai-in-net-with-ollama-50k8](https://dev.to/mashrulhaque/stop-paying-openai-free-local-ai-in-net-with-ollama-50k8)  
> 79. 15 Free LLM APIs You Can Use in 2026 \- Analytics Vidhya, [https://www.analyticsvidhya.com/blog/2026/01/top-free-llm-apis/](https://www.analyticsvidhya.com/blog/2026/01/top-free-llm-apis/)  
> 80. Guides \+ Explainers \- NoCode.Tech, [https://www.nocode.tech/stories/guides-explainers](https://www.nocode.tech/stories/guides-explainers)  
> 81. Data API \- Rankings, Benchmarks, App Analytics, and Task, [https://openrouter.ai/docs/cookbook/administration/data-api](https://openrouter.ai/docs/cookbook/administration/data-api)  
> 82. Google AI Studio Pricing (2026): Free, Paid Plans & Gemini API Costs, [https://www.nocode.mba/articles/google-ai-studio-pricing](https://www.nocode.mba/articles/google-ai-studio-pricing)  
> 83. AI Integration for PowerShell Developers: Getting Started with, [https://blog.netnerds.net/2025/03/getting-started-with-ai-for-pwsh/](https://blog.netnerds.net/2025/03/getting-started-with-ai-for-pwsh/)  
> 84. Rate limits \- Together AI docs, [https://docs.together.ai/docs/serverless/rate-limits](https://docs.together.ai/docs/serverless/rate-limits)  
> 85. MiMo-V2.5 Model Documentation and Integration Guide \- DeepInfra, [https://deepinfra.com/blog/mimo-v2-5-model-documentation-integration-guide](https://deepinfra.com/blog/mimo-v2-5-model-documentation-integration-guide)  
> 86. Changelog \- Fireworks AI Docs, [https://docs.fireworks.ai/updates/changelog](https://docs.fireworks.ai/updates/changelog)  
> 87. Free LLM API Options in 2026: Real Rate Limits and Credits, [https://blogs.novita.ai/free-llm-api-comparison-2026/](https://blogs.novita.ai/free-llm-api-comparison-2026/)  
> 88. Rate limits \- Documentation \- Novita AI, [https://novita.ai/docs/guides/model-apis-rate-limits](https://novita.ai/docs/guides/model-apis-rate-limits)  
> 89. Announcing Llama 3.1 405B Support on Hyperbolic, [https://hyperbolic.xyz/blog/llama-3-1-405b-support](https://hyperbolic.xyz/blog/llama-3-1-405b-support)  
> 90. Open-Access GPU & AI Cloud \- Hyperbolic, [https://hyperbolic.xyz/terms](https://hyperbolic.xyz/terms)  
> 91. Different Types of API Keys and Rate Limits \- Cohere Documentation, [https://docs.cohere.com/docs/rate-limits](https://docs.cohere.com/docs/rate-limits)  
> 92. The Best Free AI APIs for Developers in 2026: Tested, Ranked, and, [https://www.slideshare.net/slideshow/the-best-free-ai-apis-for-developers-in-2026-tested-ranked-and-compared/286847790](https://www.slideshare.net/slideshow/the-best-free-ai-apis-for-developers-in-2026-tested-ranked-and-compared/286847790)  
> 93. AI Inference Providers 2026: Free Tier Deep-Dive for CTOs and, [https://belski.me/blog/ai\_inference\_providers\_2026\_free\_tier\_deep\_dive/](https://belski.me/blog/ai_inference_providers_2026_free_tier_deep_dive/)