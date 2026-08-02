# **Savant Inference: Architectural Blueprint and Commercial Strategy for a Rust-Based AI Gateway**

## **Executive Summary**

The transition of enterprise artificial intelligence workloads from experimental prototypes to mission-critical production systems has exposed severe deficiencies in existing API gateway infrastructure. Dominant market solutions, predominantly built on Python-based frameworks, exhibit cascading failures under high concurrency, introducing unacceptable latency overhead and operational fragility. The Savant Inference gateway is conceived as a high-performance, financially transparent, and cryptographically verifiable API gateway designed to route, meter, and govern AI developer traffic.  
Serving as the primary revenue engine for the Savant AI ecosystem—operating seamlessly alongside Savant Code and Savant Core—Savant Inference leverages a Rust-based proxy architecture to achieve sub-millisecond routing overhead, zero-allocation data plane processing, and strict Zero Data Retention (ZDR) compliance. The gateway is engineered to route developer API traffic through a unified endpoint, reselling access to frontier models from MiMo, DeepSeek, MiniMax, OpenAI, Anthropic, and Google, while enforcing ECHO Protocol governance through advanced quality gates and agent orchestration.  
This exhaustive analysis evaluates optimal network primitives, distributed state management for real-time token metering, enterprise-grade compliance mechanisms, and dynamic multi-provider failover routing. By integrating the ECHO Protocol for quality governance and leveraging advanced WebAssembly (WASM) extensibility, the gateway is positioned to decisively outcompete legacy aggregators and gray-market providers.

## **1\. Rust Proxy Architecture and Network Design**

The fundamental requirement for an API gateway operating at scale is absolute minimal overhead on the time-to-first-token (TTFT) metric. Generative AI applications are acutely sensitive to latency; thus, the proxy must operate invisibly. Building a system capable of handling tens of thousands of concurrent connections requires selecting the optimal networking primitives and avoiding architectural bottlenecks inherent in legacy proxy servers.

### **Framework Selection: Pingora vs. Axum vs. Hyper**

The Rust ecosystem offers several paradigms for HTTP networking, each optimized for different deployment profiles. Hyper provides the foundational, low-level HTTP implementation utilized by most Rust web servers, offering a highly protective and efficient HTTP/1 and HTTP/2 library1. Axum, built atop Hyper and Tokio, offers highly ergonomic routing and state management for standard web applications2. However, neither is optimized out-of-the-box as a high-performance reverse proxy for massive throughput. Attempting to build a reverse proxy directly on Axum introduces unnecessary abstractions, such as extractors and complex routing trees, which are designed for traditional web endpoints rather than raw byte forwarding3.  
The optimal foundation for Savant Inference is Pingora, a Rust framework engineered by Cloudflare to replace NGINX across their global edge network5. Pingora is explicitly designed for building fast, reliable, and evolvable network proxies. It currently processes over a trillion requests per day at Cloudflare, utilizing merely a third of the CPU and memory resources previously required by the legacy NGINX infrastructure5. Pingora resolves the limitations of traditional worker-process architectures by enabling true asynchronous execution and optimal connection reuse across all CPU cores5. For Savant Inference, Pingora provides built-in mechanisms for HTTP/2 end-to-end proxying, gRPC, and WebSocket support, alongside customizable load balancing and failover strategies out of the box7.

### **Zero-Allocation TCP Proxying and Server-Sent Events (SSE) Streaming**

Handling Server-Sent Events (SSE) efficiently is critical for streaming Large Language Model (LLM) responses. Savant Inference must act as a transparent conduit, streaming sequential chunks directly from upstream providers—such as Anthropic and OpenAI—to the client without buffering the payload in memory. Buffering introduces latency and creates memory bottlenecks under high concurrency.  
Pingora's architecture enables "unbuffered bypass by default," a mechanism where responses that bypass caching are streamed directly to the client socket, drastically reducing the time-to-first-byte (TTFB)8. To achieve true zero-allocation parsing in Rust, the data plane must utilize the bytes crate, passing Bytes objects through the proxy chain. These objects act as reference-counted pointers to underlying memory buffers. As the proxy reads the incoming TCP stream, it identifies the double-newline \\n\\n delimiters characterizing standard SSE chunks, extracts the token metadata for billing purposes, and immediately flushes the buffer to the downstream client socket. Because the memory is simply referenced rather than cloned, the proxy avoids the expensive allocation and deallocation cycles that degrade performance in garbage-collected languages.

### **Connection Pooling and Upstream Keep-Alive**

Establishing new Transport Layer Security (TLS) connections to upstream providers introduces hundreds of milliseconds of latency due to the requisite TCP handshakes and cryptographic key exchanges. A core architectural advantage of Pingora over legacy NGINX architectures is its global connection pooling mechanism. In NGINX, connection pools are strictly isolated per worker process, leading to fragmented and highly inefficient connection reuse5. As the proxy scales horizontally, the reuse ratio collapses.  
Conversely, Pingora maintains connection pools that are efficiently shared across threads, dramatically improving connection reuse ratios5. Savant Inference will utilize this shared connection pooling to maintain persistent, Keep-Alive HTTP/2 connections to OpenAI, Anthropic, and other targeted providers. When an ECHO Protocol agent orchestrates a request, the proxy immediately retrieves a pre-warmed connection from the pool, effectively eliminating handshake latency from the critical path.

### **TLS Termination Efficiency**

Handling TLS termination efficiently in Rust requires careful selection of the underlying cryptographic library. While OpenSSL and BoringSSL are industry standards and natively supported by Pingora, compiling and deploying them introduces external C-dependencies that complicate the build pipeline6. Rustls offers a pure-Rust implementation of TLS that eliminates memory safety vulnerabilities associated with C-based cryptographic libraries2. Although Rustls integration within Pingora was initially marked as experimental, recent advancements have stabilized its usage, making it the preferred choice for a modern, memory-safe API gateway7. Terminating TLS at the edge using Rustls ensures that the entire data plane remains within the safe confines of the Rust borrow checker.

### **Latency Overhead: Rust vs. Python (LiteLLM)**

The current market standard for AI API gateways, LiteLLM, is predominantly built in Python. Because Python is structurally constrained by the Global Interpreter Lock (GIL), multiple native threads cannot execute Python bytecodes simultaneously10. Benchmarks demonstrate that at 500 requests per second (RPS), LiteLLM's P99 latency spikes dramatically—often degrading to tens of seconds or failing completely due to event loop saturation10. Furthermore, synchronous logging mechanisms heavily tax the hot path, causing "invisible queue time" where requests wait in memory before processing even begins12.  
In stark contrast, a Rust-based proxy like Savant Inference, executing on Pingora, bypasses these structural bottlenecks. Compiled native binaries executing asynchronous tasks via Tokio (Pingora's underlying runtime) can sustain tens of thousands of RPS with overheads measured in the low microseconds. Empirical testing of comparable Rust proxies demonstrates a mere 11-microsecond overhead at 5,000 RPS, effectively neutralizing the gateway as a latency bottleneck10.

### **Architecture Diagram**

Code snippet  
graph TD  
    Client\[Client Application\] \--\>|HTTPS / SSE| Edge\[Edge Load Balancer / DNS\]  
    Edge \--\> ProxyNode1\[Savant Inference Proxy Node 1\]  
    Edge \--\> ProxyNode2\[Savant Inference Proxy Node 2\]  
      
    subgraph Savant Inference Data Plane  
        ProxyNode1 \--\>|1. TLS Termination| AuthFilter\[Auth & JWT Validation\]  
        AuthFilter \--\>|2. Rate Limit Check| Redis\[Redis / KeyDB Cluster\]  
        Redis \-.-\>|Sliding Window State| AuthFilter  
        AuthFilter \--\> WasmEngine\[Wasmtime Plugin Engine\]  
        WasmEngine \--\>|ECHO Protocol Rules| Router\[Dynamic Router & Load Balancer\]  
        Router \--\>|Token Metering| Metering\[In-Memory Token Estimator\]  
    end  
      
    Router \--\>|Pool| ConnPool\[Global Connection Pool\]  
    ConnPool \--\>|Keep-Alive HTTPS| Upstream1\[OpenAI API\]  
    ConnPool \--\>|Keep-Alive HTTPS| Upstream2\[Anthropic API\]  
    ConnPool \--\>|Keep-Alive HTTPS| Upstream3\[DeepSeek API\]  
      
    Metering \-.-\>|Async Flush| Kafka\[Event Message Queue\]  
    Kafka \-.-\> ClickHouse\[(ClickHouse Analytics)\]  
    Kafka \-.-\> Postgres\[(PostgreSQL Ledger)\]

## **2\. Billing, Metering, and High-Throughput Database Schema**

Because the Savant Inference gateway serves as the primary revenue engine for the ecosystem, absolute transaction integrity and accurate token metering are non-negotiable requirements. The system must account for every token routed through the proxy, ensuring precise chargebacks and maintaining developer trust through transparent accounting.

### **Real-Time Token Metering During SSE Streams**

For standard, non-streaming HTTP requests, metering is a trivial exercise: the upstream API returns exact usage statistics embedded within the final JSON payload. However, for Server-Sent Events (SSE) streams, providers emit usage data uniquely. OpenAI, for example, sends an optional usage object only in the final chunk of the stream, while Anthropic provides message\_start and message\_delta events distributed throughout the response.  
The primary architectural challenge arises when a client application disconnects mid-stream, severing the TCP connection before the final usage chunk is transmitted. To prevent massive revenue leakage on interrupted streams, the proxy must implement real-time heuristic token estimation. As the proxy forwards chunks to the client, an in-memory counter tracks the byte length of the payload. If the client disconnects prematurely, the proxy captures the precise byte-length transmitted, calculates the estimated token usage based on the specific model's historical token-to-byte ratio (typically \~4 characters or \~1.2 bytes per token for English text), and immediately flushes this calculated charge to the billing system before gracefully closing the upstream connection to halt further provider billing12.

### **Database Selection: PostgreSQL and ClickHouse**

A bifurcated database strategy is required to balance strict financial ACID compliance with high-throughput observability requirements14. Relying on a single database engine for both financial ledgers and telemetry inevitably leads to performance degradation as tables expand into the millions of rows12.

> 1. **System of Record (Ledger):** PostgreSQL is strictly required for managing billing, API keys, account balances, and invoices. Financial transactions demand the ACID (Atomicity, Consistency, Isolation, Durability) guarantees that PostgreSQL provides.  
> 2. **System of Intelligence (Telemetry):** ClickHouse is required for raw usage events, trace logging, and observability. ClickHouse is a columnar database optimized for Online Analytical Processing (OLAP), capable of handling massive ingestion rates and powering developer-facing analytics dashboards without impacting the transactional performance of the PostgreSQL ledger14.

### **Credit-Based Billing Architecture (Double-Entry Ledger)**

To maintain precise developer balances, track complex credit distributions (such as promotional grants versus purchased credits), and prevent race conditions, the PostgreSQL schema must implement a double-entry ledger15. Relying on a simple balance integer column on a user table is fundamentally flawed, as concurrent API requests will attempt to read and update the integer simultaneously, leading to race conditions and balance drift. Instead, all credit additions and deductions must be recorded as immutable transactions.

| Database | Table Name | Column | Data Type | Description |
| :---- | :---- | :---- | :---- | :---- |
| **PostgreSQL** | accounts | id | UUID | Primary key for the developer or enterprise account |
| **PostgreSQL** | accounts | billing\_tier | VARCHAR | Indicates tier: Free, Pro, or Enterprise |
| **PostgreSQL** | api\_keys | hash | VARCHAR | SHA-256 hash of the API key for security |
| **PostgreSQL** | api\_keys | account\_id | UUID | Foreign key linking the key to the account |
| **PostgreSQL** | ledger\_entries | id | UUID | Unique identifier for the ledger transaction |
| **PostgreSQL** | ledger\_entries | account\_id | UUID | Foreign key linking the transaction to the account |
| **PostgreSQL** | ledger\_entries | amount | DECIMAL | Positive values for deposits, negative for token usage |
| **PostgreSQL** | ledger\_entries | currency\_type | VARCHAR | Denotes fiat (USD) or platform credits (ECHO) |
| **PostgreSQL** | ledger\_entries | reference\_id | VARCHAR | Stripe invoice ID or internal ClickHouse trace ID |
| **ClickHouse** | telemetry\_logs | timestamp | DateTime64 | Exact time of the event execution |
| **ClickHouse** | telemetry\_logs | request\_id | UUID | Unique trace identifier matching the ledger reference |
| **ClickHouse** | telemetry\_logs | model\_routed | String | The exact model utilized (e.g., claude-3-5-sonnet) |
| **ClickHouse** | telemetry\_logs | latency\_ms | UInt32 | Time-to-first-token or total request duration |
| **ClickHouse** | telemetry\_logs | prompt\_tokens | UInt32 | Exact or estimated input tokens consumed |
| **ClickHouse** | telemetry\_logs | completion\_tokens | UInt32 | Exact or estimated output tokens generated |

### **Rolling Window Quotas and Race Conditions**

Implementing rolling quotas, such as a strict limit of 10,000 requests per 5-hour window, requires highly optimized atomic operations to prevent race conditions during concurrent API spikes. Redis is the industry standard for this mechanism. To ensure atomicity, the gateway must use Redis EVAL to execute Lua scripts. This ensures that the entire read-decide-update cycle runs inside a single atomic operation on the Redis thread, preventing concurrent requests from double-spending credits or exceeding quotas before the database persists the state change16.

### **Best Practices for Stripe and Creem Integration**

Usage-based billing presents unique challenges for traditional payment processors. When developers consume tokens rapidly, attempting to charge a credit card for micro-transactions incurs unsustainable fixed transaction fees. The optimal architecture aggregates usage across the double-entry ledger and generates a consolidated invoice at the end of the billing cycle (or when a predefined dollar threshold is reached).  
While Stripe provides robust API capabilities for standard SaaS models, integrating Creem offers a strategic advantage. Creem acts as the Merchant of Record (MoR), assuming full responsibility for global tax compliance, collection, and remittance18. For an API gateway servicing developers globally, utilizing an MoR eliminates the immense regulatory burden of calculating and remitting VAT across different international jurisdictions. For enterprise customers requiring purchase orders and net-30 payment terms, the PostgreSQL ledger serves as the source of truth to programmatically generate highly detailed PDF invoices, breaking down exact usage by project, model, and API key.

## **3\. Rate Limiting and Key Pool Management**

Managing traffic flow is critical to protect both the gateway's internal infrastructure and the fragile rate limits imposed by upstream providers.

### **Multi-Key Load Balancing and Key Pools**

For Savant Inference to seamlessly resell models at scale, it must manage a large, distributed pool of API keys across multiple upstream provider accounts. This circumvents the strict per-account rate limits imposed by entities like OpenAI or Anthropic. The minimum viable key pool manager consists of a Redis Hashes structure containing the active upstream keys and their current rate-limit exhaustion status.  
The optimal routing algorithm for this key pool is Adaptive Weighted Round-Robin13. Traditional round-robin algorithms fail because they blindly route requests to keys that may have already exhausted their rate limits. In an adaptive model, the Rust proxy actively monitors the HTTP 429 (Too Many Requests) headers returned by providers. Keys that return 429s are temporarily penalized—their routing weight is reduced to zero—and they are placed on an exponential backoff timer with calculated jitter to prevent thundering herd problems upon recovery. Conversely, keys demonstrating healthy, low-latency responses receive increased traffic weighting.

### **Request Queueing and Backpressure**

When downstream client demand exceeds the aggregate rate limit of the upstream key pool, the gateway must implement backpressure to prevent dropping requests. A Leaky Bucket algorithm is the optimal choice for this scenario. Operating as a traffic shaping mechanism, the Leaky Bucket places incoming requests into a First-In-First-Out (FIFO) queue16. The proxy drains this queue at a fixed rate that matches the known limitations of the upstream providers, forwarding requests steadily. This delays the response slightly but prevents the client from receiving a frustrating HTTP 429 error, creating a much smoother developer experience.

### **Per-Customer Rate Limiting Architecture**

Rate limiting external developers involves a fundamental trade-off between memory efficiency and mathematical accuracy. The Sliding Window Counter algorithm is the optimal choice for the Savant Inference gateway, striking the best balance for general-purpose API limits20.  
Fixed Window algorithms, while simple, fail in production because they allow 2x traffic bursts at the edges of time boundaries21. Sliding Window Log algorithms offer perfect accuracy but require storing the exact timestamp of every single request in a Redis Sorted Set (O(N) memory), which quickly exhausts Redis memory and crashes clusters under high concurrency16.  
The Sliding Window Counter algorithm resolves this by using a weighted approximation. It stores only two integers per client: the count of the previous time window and the count of the current time window (O(1) memory)20. The formula estimates the current rate based on the progression of time: estimated\_count \= (previous\_count \* (1 \- progress)) \+ current\_count. In Rust, this is implemented using a high-performance concurrent map, such as DashMap, to store counters locally in memory with RwLock protection, combined with a background Tokio thread that periodically syncs to a centralized Redis backend to ensure distributed consistency across all proxy instances21. Alternatively, for absolute memory efficiency, Pingora's native pingora-limits crate utilizes a Count-Min Sketch estimation algorithm, providing lock-free O(1) counting that consumes roughly 1/2000th the memory of naive hash table approaches22.

## **4\. Enterprise Compliance and Security**

Enterprise adoption of AI gateways is heavily impeded by data privacy concerns. Competitors often fail stringent enterprise security reviews because their architectures log sensitive customer prompt data by default23.

### **SOC2 Readiness and Zero Data Retention (ZDR)**

Zero Data Retention (ZDR) is a strict, zero-storage architectural paradigm where integration payloads are processed strictly in-memory and are never written to disk or persistent storage24. When a user sends a prompt, the proxy reads the bytes, routes the payload, and discards the memory.  
To achieve Day-1 SOC2 readiness with genuine ZDR, the gateway must implement the following controls:

> 1. **Memory-Only Processing:** Explicitly disable any local caching of prompts or completions within the proxy layer. File-system logging for request bodies must be structurally impossible within the Rust binary23.  
> 2. **Metadata-Only Logging:** The proxy must only extract and transmit telemetry metadata (such as timestamps, token counts, model names, and latency metrics) to the ClickHouse observability cluster25. The actual conversational text must never enter the logging pipeline.  
> 3. **Data Residency Guarantees (GDPR):** To comply with the General Data Protection Regulation (GDPR), the architecture must deploy regional proxy clusters (e.g., AWS us-east-1 for North America and eu-central-1 for Europe). Geo-routing at the DNS and Edge Load Balancer level ensures that European developer traffic remains strictly within EU data centers and is never routed across the Atlantic24.

### **Cryptographic Attestation for Payload Forwarding**

Enterprise clients often require mathematical proof that the data received by their internal orchestration layers has not been tampered with or intercepted by the proxy. Savant Inference must implement HTTP Signature headers utilizing Ed25519 cryptography to provide this guarantee26.  
When the gateway prepares to forward a payload, it generates an HMAC-SHA256 hash of the request method and authority. It then signs this hash, along with the payload components, using the gateway's private Ed25519 elliptic curve key. This signature is attached to the outbound request via the standard Signature HTTP header27. The downstream ECHO Protocol agent or the upstream enterprise server can cryptographically verify this signature against the gateway's known public key, providing a non-repudiable proof of origin and strict data integrity.

## **5\. Multi-Provider Routing and Optimization**

### **Universal Schema Translation**

To provide a frictionless developer experience, Savant Inference must support the industry-standard OpenAI API schema (specifically /v1/chat/completions) and dynamically translate these payloads to other frontier providers like Anthropic and DeepSeek28.  
This translation is achieved via zero-allocation struct mapping in Rust. When an OpenAI-formatted JSON payload is received targeting an Anthropic model (e.g., claude-3-5-sonnet), the proxy intercepts the payload, deserializes it into an internal Rust intermediate representation, and serializes it into Anthropic's distinct messages and system format. This allows developers to switch underlying models by simply changing a string in their application code, without rewriting their integration logic.

### **Provider Health Checking and Model Spoofing Detection**

Upstream AI models frequently experience silent degradation, high latency spikes, or complete outages. Health checking is managed via asynchronous probes. A dedicated Tokio task periodically issues minimal token requests to all provider endpoints, measuring latency, time-to-first-token, and general uptime.  
Furthermore, the gateway must implement model spoofing detection. Certain gray-market providers (such as UnoRouter) may attempt to serve cheaper models (e.g., Llama 3\) while charging for premium models (e.g., GPT-4) to maximize illicit margins. Savant Inference will detect this by periodically injecting deterministic, proprietary logic puzzles into the prompt stream and analyzing the response. If the output deviates from the known capability signature of the requested model, the upstream provider is immediately flagged and removed from the active routing pool.

### **Automatic Failover Chains and Dynamic Cost Optimization**

If claude-3-5-sonnet times out or returns a 5xx error, the proxy must automatically re-route the exact payload to a predefined fallback model (e.g., gpt-4o) without exposing the failure to the end user13.  
The routing algorithm balances cost, latency, and quality. When a developer requests a generalized task, the dynamic routing engine queries the ClickHouse telemetry database for real-time latency statistics across all providers. It selects the provider that currently offers the lowest latency and highest historical quality score for that specific prompt length, optimizing the request dynamically.

## **6\. Open Source Architecture and Extensibility (WASM)**

To accommodate bespoke enterprise requirements without bloating the core binary, the gateway must be highly extensible. Hardcoding every specific provider quirk, authentication method, or customer integration into the core Rust proxy reduces stability and increases the risk of regressions.

### **WebAssembly (WASM) Plugins**

Savant Inference will embed wasmtime, a highly mature WebAssembly runtime developed by the Bytecode Alliance, directly into the Pingora proxy pipeline30. By adopting the Proxy-Wasm specification—a standard originally developed for Envoy and supported by platforms like NGINX and Kong30—developers can write custom middleware in Rust, Go, or C++ and compile it to a highly portable .wasm module.  
When an HTTP request arrives, Pingora hands the request context to the isolated Wasmtime sandbox30. The plugin can inspect headers, enforce complex ECHO Protocol quality gates, or run Data Loss Prevention (DLP) logic to redact Personally Identifiable Information (PII) before forwarding the payload to OpenAI. Because WASM executes in a strictly memory-safe sandbox with near-native execution speed, a crashing or malicious plugin cannot crash the core proxy or access unauthorized memory30. This architecture allows Enterprise customers to safely inject their own proprietary logic directly into the proxy chain32.

### **Configuration Management**

Configuration of the proxy should rely on TOML for static, application-level settings (due to its native familiarity within the Rust ecosystem)4. However, dynamic routing rules, rate limits, and upstream provider URLs must be managed via a centralized database and propagated to the proxy nodes in real-time. This ensures that configuration changes are hot-reloaded without requiring a restart of the Rust binary, eliminating downtime6.

## **7\. Deployment, Infrastructure, and Cost Analysis**

### **Deployment Architecture**

Serverless architectures (e.g., AWS Lambda) are fundamentally inappropriate for high-performance API gateways due to latency-inducing cold starts and the inability to maintain persistent Keep-Alive connection pools to upstream providers. The constant tearing down of network sockets introduces unacceptable latency.  
The optimal deployment architecture relies on long-running, persistent containers managed by Kubernetes (e.g., Amazon EKS) or deployed directly on Bare Metal servers. Bare metal deployment offers the lowest possible network latency and highest CPU efficiency, though Kubernetes provides superior orchestration and auto-scaling capabilities.

### **Minimum Viable Infrastructure (1,000 Concurrent Users)**

Given Rust's extreme resource efficiency—where Pingora processes millions of requests on minimal hardware—the infrastructure footprint for 1,000 concurrent users is surprisingly minimal5.

* **Compute (Data Plane):** 2x AWS c7g.large (ARM-based Graviton) instances deployed across two Availability Zones for the Rust proxy nodes. ARM processors provide superior price-to-performance ratios for network-bound Rust applications.  
* **State (Rate Limiting/Queue):** 1x ElastiCache Redis instance (cache.m7g.large) for distributed sliding window state.  
* **Database (Ledger):** 1x Amazon Aurora PostgreSQL Serverless v2 to handle spiky transactional workloads efficiently.  
* **Observability:** Managed ClickHouse Cloud (basic tier) for ingesting telemetry logs.

## **8\. Pricing Models and Margin Analysis**

The API gateway market is currently characterized by aggressive, race-to-the-bottom pricing. CommandCode offers a $1/mo Go plan34, which functions fundamentally as a loss-leader or relies on extreme, unadvertised rate limiting to constrain costs. Savant Inference cannot compete purely on price; it must compete on transparency, mathematical performance, and governance.

### **Recommended Pricing Structure**

| Tier | Monthly Price | Core Features | Target Audience |
| :---- | :---- | :---- | :---- |
| **Free (BYOK)** | $0/month | Bring Your Own Key (BYOK). Gateway acts as a pure routing and telemetry layer. Strict rate limit (50 req/min). | Hobbyists, students, early prototypes. |
| **Pro (Cost-Plus)** | $15/month | Access to managed key pool. Models resold at **absolute cost**. 1,000 req/min limits. Priority routing. | Professional developers, startups. |
| **Max** | $49/month | High concurrency limits. Advanced failover chains. Custom WASM plugin support. | Scaling startups, heavy power users. |
| **Enterprise** | Custom ($500+) | Dedicated IP addresses. Zero Data Retention SLAs. SSO/SAML auth. Custom ECHO integrations. | Regulated industries (Finance, Healthcare). |

### **Margin Analysis and Overage Penalties**

Reselling models like MiMo, DeepSeek, and MiniMax at a markup is a flawed strategy that rapidly alienates sophisticated power users who track token costs closely. The "transparent cost-plus" model is highly defensible. By reselling tokens exactly at the provider's cost, Savant Inference neutralizes accusations of "skimming" and builds immense developer trust. The financial margins are generated entirely from the $15/month Pro subscriptions and lucrative Enterprise contracts.  
Assuming infrastructure overhead of approximately $0.50 per user per month (thanks to Rust's efficiency), the $15/mo Pro tier yields a 96% gross margin on the software platform side, entirely insulating the business from the volatility of upstream token costs. Overage penalties should be avoided; instead, the system should enforce strict auto-recharge thresholds. When a developer's credit balance dips below $5.00, the Stripe/Creem integration automatically triggers a top-up transaction, preventing service interruption without frustrating the user with punitive fees.

### **Defeating CommandCode's $1/mo Plan**

To counter CommandCode's aggressive $1/mo tier, Savant Inference must position itself as the "Professional Grade" alternative. Marketing materials should aggressively highlight that $1/mo services inevitably suffer from noisy-neighbor problems, high latency spikes, and opaque token accounting. Savant Inference offers transparent pass-through pricing with mathematically verifiable sub-millisecond overhead.

## **9\. Competitive Positioning and Go-to-Market Strategy**

### **Market Gaps and Competitor Failures**

* **LiteLLM:** While currently ubiquitous, LiteLLM is fundamentally hobbled by Python's architecture. Production environments expose severe ceilings: P95 latencies hit 8ms even at low concurrency, and memory leaks force scheduled restarts10. It lacks built-in enterprise ZDR and relies heavily on external databases for routing, increasing operational complexity35.  
* **Kong AI Gateway:** While robust, Kong introduces 25-40ms of latency per request due to its heavy architecture and external Lua/WASM inter-process communication11.  
* **OpenRouter / UnoRouter:** OpenRouter is an effective aggregator but adds significant routing latency and lacks deep enterprise governance10. UnoRouter utilizes gray-market tactics and the restrictive AGPL license, making it legally toxic for enterprise integration.

### **Competitive Positioning Statement**

*"Savant Inference is the first true zero-overhead AI gateway built explicitly for production. Engineered in Rust to bypass the structural bottlenecks of legacy Python proxies, Savant delivers transparent cost-plus access to frontier models, cryptographically secure Zero Data Retention routing, and native ECHO Protocol governance. It is the enterprise-grade alternative to OpenRouter, delivering absolute scale without the latency penalty."*

### **Go-to-Market (GTM) Strategy**

> 1. **Open Source the Data Plane:** Release the core Rust proxy engine under an MIT or Apache 2.0 license (similar to Cloudflare's release of Pingora)6. This neutralizes UnoRouter's AGPL trap, builds immense goodwill in the Rust community, and drives rapid, bottom-up developer adoption.  
> 2. **Target the Pain Points (DevRel):** Execute a content marketing strategy focused heavily on "Why your LLM app is slow." Publish reproducible, head-to-head performance benchmarks demonstrating Savant Inference processing 10,000 RPS with 50µs latency, juxtaposed against LiteLLM failing entirely at 500 RPS10.  
> 3. **Acquiring the First 1000 Users:** Integrate natively with the Savant Code product. Every developer utilizing the multi-agent coding harness is seamlessly defaulted to the Savant Inference gateway via their existing ECHO Protocol identity. This creates an immediate, captive user base that guarantees initial liquidity and platform testing.

## **10\. Minimum Viable Product (MVP) Scope**

To launch rapidly and disrupt established players, the MVP must be fiercely scoped to core competencies:

> 1. **Core Proxy Engine:** Deploy the Rust/Pingora binary with unbuffered SSE streaming capabilities. Implement universal OpenAI schema translation for Anthropic and DeepSeek.  
> 2. **Billing & Authentication:** Implement JWT-based authentication. Deploy Redis sliding-window rate limiting. Construct the PostgreSQL double-entry ledger for accurate balance tracking.  
> 3. **Pricing & Tiers:** Launch the BYOK Free Tier and the $15/mo Cost-Plus Pro Tier via Creem integration for seamless usage-based billing and tax compliance18.  
> 4. **Security:** Implement Ed25519 payload signing and fundamental ZDR compliance (strict in-memory processing with no disk logging).  
> 5. **Dashboard:** Release a minimal, fast web interface pulling usage telemetry directly from ClickHouse.

*Deferred to v2:* Multi-region geo-routing, the Wasmtime plugin engine, and complex adaptive weighted load-balancing across dynamic key pools.

## **11\. Risk Analysis and Mitigation Strategies**

| Risk Factor | Impact Level | Mitigation Strategy |
| :---- | :---- | :---- |
| **Provider API Schema Changes** | High | Abstract all upstream providers behind a unified internal Rust struct. Implement extensive automated integration tests running daily against live provider endpoints to catch breaking schema changes early. |
| **Redis Cluster Saturation** | Medium | Utilize highly memory-efficient Sliding Window Counters20. Offload all heavy analytics to ClickHouse; reserve Redis strictly for transient rate-limit state and active key-pool weights17. |
| **Stripe/Billing Desync** | High | Rely exclusively on the PostgreSQL double-entry ledger as the absolute source of truth. Disconnect streaming clients instantly if their local credit cache reaches zero15. |
| **WASM Plugin Overhead** | Low to Medium | Utilize Ahead-of-Time (AOT) compilation for .wasm modules using the Cranelift compiler within wasmtime. This ensures native execution speed, minimizing latency penalties during HTTP interception31. |
| **Market Race to Zero** | High | Avoid competing purely on token price. Brand aggressively around platform stability, zero-latency overhead, ZDR compliance, and the overarching governance value of the ECHO Protocol ecosystem. |

## **12\. Technology Stack Recommendations**

To achieve the architectural goals outlined in this report, the following technology stack is strictly recommended:

* **Proxy Runtime:** Rust, Pingora, and Tokio. This combination provides sub-millisecond asynchronous networking and eliminates garbage collection pauses.  
* **State & Rate Limiting:** Redis or KeyDB. Essential for managing distributed Sliding Window Counters and shared key-pool state.  
* **Transactional Ledger:** PostgreSQL. Non-negotiable for strict ACID compliance and managing the double-entry billing ledger.  
* **Telemetry & Observability:** ClickHouse. Optimized for high-throughput, columnar time-series event ingestion without slowing down the proxy.  
* **Plugin Engine:** Wasmtime. Provides a highly secure, memory-isolated sandbox compatible with the Proxy-Wasm specification.  
* **Cryptography:** Ed25519 and Rustls. Delivers high-speed elliptic curve signatures and memory-safe TLS termination.  
* **Payments & Compliance:** Creem. Acts as the Merchant of Record, handling usage-based billing complexities and global tax compliance automatically.

#### **Works cited**

> 1. GitHub \- rust-unofficial/awesome-rust: A curated list of Rust code and resources., [https://github.com/rust-unofficial/awesome-rust](https://github.com/rust-unofficial/awesome-rust)  
> 2. HTTP server — list of Rust libraries/crates // Lib.rs, [https://lib.rs/web-programming/http-server](https://lib.rs/web-programming/http-server)  
> 3. Axum as reverse proxy in production? : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1gptzri/axum\_as\_reverse\_proxy\_in\_production/](https://www.reddit.com/r/rust/comments/1gptzri/axum_as_reverse_proxy_in_production/)  
> 4. Axum vs Pingora for smart proxy/loadbalancer : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1sgnpzi/axum\_vs\_pingora\_for\_smart\_proxyloadbalancer/](https://www.reddit.com/r/rust/comments/1sgnpzi/axum_vs_pingora_for_smart_proxyloadbalancer/)  
> 5. How we built Pingora, the proxy that connects Cloudflare to the Internet, [https://blog.cloudflare.com/how-we-built-pingora-the-proxy-that-connects-cloudflare-to-the-internet/](https://blog.cloudflare.com/how-we-built-pingora-the-proxy-that-connects-cloudflare-to-the-internet/)  
> 6. Rust-based open-source reverse proxy \- Reddit, [https://www.reddit.com/r/rust/comments/1qrinqq/rustbased\_opensource\_reverse\_proxy/](https://www.reddit.com/r/rust/comments/1qrinqq/rustbased_opensource_reverse_proxy/)  
> 7. GitHub \- cloudflare/pingora: A library for building fast, reliable and evolvable network services., [https://github.com/cloudflare/pingora](https://github.com/cloudflare/pingora)  
> 8. Pingora now powers Cloudflare's cache · Changelog, [https://developers.cloudflare.com/changelog/post/2026-05-04-pingora-powers-cache/](https://developers.cloudflare.com/changelog/post/2026-05-04-pingora-powers-cache/)  
> 9. Pingora or hyper for a chain of webservers? : r/rust \- Reddit, [https://www.reddit.com/r/rust/comments/1npfywy/pingora\_or\_hyper\_for\_a\_chain\_of\_webservers/](https://www.reddit.com/r/rust/comments/1npfywy/pingora_or_hyper_for_a_chain_of_webservers/)  
> 10. Top 5 LiteLLM Alternatives for AI in 2026 \- LockLLM Blog, [https://www.lockllm.com/blog/litellm-alternatives](https://www.lockllm.com/blog/litellm-alternatives)  
> 11. Best LiteLLM Alternatives in 2026 \- Maxim AI, [https://www.getmaxim.ai/articles/best-litellm-alternatives-in-2026/](https://www.getmaxim.ai/articles/best-litellm-alternatives-in-2026/)  
> 12. LiteLLM Alternatives : When Accuracy, Latency, and Ops Start to Hurt \- LLM API, [https://llmapi.ai/litellm-alternatives-when-accuracy-latency-and-ops-start-to-hurt/](https://llmapi.ai/litellm-alternatives-when-accuracy-latency-and-ops-start-to-hurt/)  
> 13. We built an LLM gateway 50x faster than LiteLLM (and it's open source) \- DEV Community, [https://dev.to/kuldeep\_paul/we-built-an-llm-gateway-50x-faster-than-litellm-and-its-open-source-4a57](https://dev.to/kuldeep_paul/we-built-an-llm-gateway-50x-faster-than-litellm-and-its-open-source-4a57)  
> 14. LLM observability with ClickStack, OpenTelemetry, and MCP | ClickHouse, [https://clickhouse.com/blog/llm-observability-clickstack-mcp](https://clickhouse.com/blog/llm-observability-clickstack-mcp)  
> 15. How to design a ledger table that references multiple document types (e.g., Invoices, Purchases) : r/SQL \- Reddit, [https://www.reddit.com/r/SQL/comments/1mwz3oy/how\_to\_design\_a\_ledger\_table\_that\_references/](https://www.reddit.com/r/SQL/comments/1mwz3oy/how_to_design_a_ledger_table_that_references/)  
> 16. Build 5 Rate Limiters with Redis: Algorithm Comparison Guide, [https://redis.io/tutorials/howtos/ratelimiting/](https://redis.io/tutorials/howtos/ratelimiting/)  
> 17. Redis rate limiter | Docs, [https://redis.io/docs/latest/develop/use-cases/rate-limiter/](https://redis.io/docs/latest/develop/use-cases/rate-limiter/)  
> 18. 7 Best Stripe Alternatives for SaaS in 2026 (Fees, Taxes & Features Compared) | Creem, [https://www.creem.io/blog/stripe-alternatives-top-providers-2026](https://www.creem.io/blog/stripe-alternatives-top-providers-2026)  
> 19. MkSaaS Payment Module | MkSaaS \- Make Your AI SaaS Product in, [https://mksaas.com/blog/payment](https://mksaas.com/blog/payment)  
> 20. Sliding-Window Counter Rate Limiter \- Grasp, [https://paths.grasp.study/public-modules/b37f6a81-d14a-4593-9275-7192a8672e77/lessons/be0a850a-3835-4381-9351-4e9435d664ac](https://paths.grasp.study/public-modules/b37f6a81-d14a-4593-9275-7192a8672e77/lessons/be0a850a-3835-4381-9351-4e9435d664ac)  
> 21. How to Implement Sliding Window Rate Limiting in Rust \- OneUptime, [https://oneuptime.com/blog/post/2026-01-25-sliding-window-rate-limiting-rust/view](https://oneuptime.com/blog/post/2026-01-25-sliding-window-rate-limiting-rust/view)  
> 22. How Pingora keeps count | The Cloudflare Blog, [https://blog.cloudflare.com/how-pingora-keeps-count/](https://blog.cloudflare.com/how-pingora-keeps-count/)  
> 23. Zero Data Retention: What It Means for AI Security | Teleskope Blog, [https://www.teleskope.ai/post/zero-data-retention](https://www.teleskope.ai/post/zero-data-retention)  
> 24. Zero Data Retention for SaaS & Fintech Integrations | Apideck, [https://www.apideck.com/zero-data-retention](https://www.apideck.com/zero-data-retention)  
> 25. Zero data retention gateway: overview, benefits, and implementation steps \- Merge.dev, [https://www.merge.dev/blog/zero-data-retention-gateway](https://www.merge.dev/blog/zero-data-retention-gateway)  
> 26. Ed25519 signing — Cryptography 51.0.0-dev1 documentation, [https://cryptography.io/en/latest/hazmat/primitives/asymmetric/ed25519/](https://cryptography.io/en/latest/hazmat/primitives/asymmetric/ed25519/)  
> 27. Signature \- Expert Guide to HTTP headers, [https://http.dev/signature](https://http.dev/signature)  
> 28. Anthropic Proxy \- OpenPipe Documentation, [https://docs.openpipe.ai/features/chat-completions/anthropic](https://docs.openpipe.ai/features/chat-completions/anthropic)  
> 29. Proxy Anthropic Requests | APISIX & API7 API Gateway Docs, [https://docs.api7.ai/apisix/how-to-guide/ai-gateway/proxy-anthropic-requests](https://docs.api7.ai/apisix/how-to-guide/ai-gateway/proxy-anthropic-requests)  
> 30. NGINX WebAssembly Module: Proxy \[2026\] \- Wasm Guide \- GetPageSpeed, [https://www.getpagespeed.com/server-setup/nginx/nginx-webassembly-proxy-wasm](https://www.getpagespeed.com/server-setup/nginx/nginx-webassembly-proxy-wasm)  
> 31. Wasmtime and Cranelift in 2023 \- Bytecode Alliance, [https://bytecodealliance.org/articles/wasmtime-and-cranelift-in-2023](https://bytecodealliance.org/articles/wasmtime-and-cranelift-in-2023)  
> 32. Proxy-Wasm: It's WebAssembly for Proxies \- Kong Inc., [https://konghq.com/blog/engineering/proxy-wasm](https://konghq.com/blog/engineering/proxy-wasm)  
> 33. How to Understand Istio's WebAssembly Plugin System \- OneUptime, [https://oneuptime.com/blog/post/2026-02-24-istio-webassembly-plugin-system/view](https://oneuptime.com/blog/post/2026-02-24-istio-webassembly-plugin-system/view)  
> 34. Command Code \- AI coding agent with taste, [https://commandcode.ai/](https://commandcode.ai/)  
> 35. Kong vs LiteLLM: Architecture, Pricing, and Trade‑Offs \- Truefoundry, [https://www.truefoundry.com/blog/kong-vs-litellm](https://www.truefoundry.com/blog/kong-vs-litellm)  
> 36. LiteLLM vs Kong: Choosing the Right Enterprise AI Gateway for Production, [https://konghq.com/blog/enterprise/kong-ai-gateway-vs-litellm](https://konghq.com/blog/enterprise/kong-ai-gateway-vs-litellm)  
> 37. The Six Ways of Optimizing WebAssembly \- InfoQ, [https://www.infoq.com/articles/six-ways-optimize-webassembly/](https://www.infoq.com/articles/six-ways-optimize-webassembly/)