# **Codebase Migration and Architectural Blueprint: Savant & Savant-Free**

**Filename:** `FID-2026-0717-014-codebuff-rebrand-migration-plan.md`
**ID:** FID-2026-0717-010
**Severity:** critical
**Status:** closed
**Created:** 2026-0717 00:00
**Author:** Historical record (metadata backfill)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `MISSING`; Original ID: `FID-2026-0717-014-codebuff-rebrand-migration-plan`. Canonical ID: `FID-2026-0717-010`. Backfilled fields: Filename, ID, Severity, Status, Created, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.

The following research report and execution blueprint provides an exhaustive architectural analysis for decoupling, rebranding, and migrating the open-source savant0x/savant-code monorepo1. The overarching objective of this analysis is to transform the existing TypeScript-based client applications—specifically the premium, subscription-based savant-code client and the ad-supported, zero-configuration savant-free client1—into the distinct entities savant and savant-free, respectively. Furthermore, this document details the meticulous API surface extraction required to sever ties with the original proprietary backend infrastructure. This extraction informs a comprehensive specification for rebuilding the server layer using a high-performance Rust web framework.  
The original application operates as a terminal-native, multi-agent artificial intelligence coding assistant built heavily on TypeScript, the Bun runtime, and a React-based web component architecture1. Because the target backend infrastructure is inaccessible, the frontend architecture must be systematically reverse-engineered at the network boundary to deduce the expected HTTP and WebSocket data contracts. This analysis is structurally divided into six critical execution phases, designed to serve as a direct operational manual for an autonomous coding agent executing the frontend migration while the Rust backend is synthesized in parallel.

## **Phase 1: Dual-Client Global Rebranding Strategy**

The monorepo structure contains over 7,500 commits and is heavily skewed toward TypeScript (98.1%)1. The rebranding process must account for strict casing preservation across standard variables, classes, environment variables, localized string literals, and deeply nested configuration files. The executing agent must distinctly differentiate between the premium tier (savant-code transitioning to savant) and the free tier (savant-free transitioning to savant-free)1. A naive global substitution will immediately corrupt the Abstract Syntax Tree (AST) of the TypeScript application, breaking module imports, React component hierarchies, and interface bindings.

### **Lexical Search-and-Replace Mappings**

To prevent AST compilation errors, the autonomous agent must execute context-aware string replacements. The semantic mapping must preserve the casing conventions utilized throughout the original repository, which includes standard camelCase, PascalCase, and SCREAMING\_SNAKE\_CASE environments.

| Original String (Regex Target) | Target Replacement | Structural Context and Target File Types |
| :---- | :---- | :---- |
| \\bcodebuff\\b | savant | Package names (package.json), CLI execution commands, lowercase variables, directory paths, and logging literals1. |
| \\bCodebuff\\b | Savant | Class names (e.g., SavantCodeClient), React functional components, TypeScript interface definitions, and exported module names3. |
| \\bCODEBUFF\\b | SAVANT | Environment variables, macro definitions, and static configuration constants (e.g., NEXT\_PUBLIC\_CODEBUFF\_APP\_URL)4. |
| \\bfreebuff\\b | savant-free | CLI install commands, secondary directory names, configuration overrides, and binary targets1. |
| \\bFreebuff\\b | SavantFree | Class names, UI rendering headers inside the terminal TUI, and namespace declarations specific to the free tier1. |
| \\bFREEBUFF\\b | SAVANT\_FREE | Environment variables specific to the free tier (e.g., NEXT\_PUBLIC\_FREEBUFF\_APP\_URL)4. |
| \\bmanicode\\b | savant | The local filesystem configuration directory typically residing at \~/.config/manicode/6. |
| \\bManicode\\b | Savant | Any legacy capitalized references to the configuration namespace within class names or error handling constants. |

### **Targeted Sub-System Rebranding Operations**

The string replacement methodology must encompass the CLI entry points, the local environment variable injection system, and the filesystem initialization logic. The application is distributed globally via Node Package Manager (NPM), requiring precise modifications to the package manifests across the workspace.  
The agent must traverse the root package.json, cli/package.json, and savant-free/cli/package.json1. The standard "name": "savant-code" must be translated to "name": "savant". Furthermore, the binary execution directives within the package manifests dictate how the global commands map to the compiled JavaScript artifacts. The "bin": { "savant-code": "./build/index.js" } directive must transition to "bin": { "savant": "./build/index.js" }, while the equivalent savant-free directive must transition to "savant-free". Concurrently, all markdown documentation, usage instructions, and terminal onboarding scripts must reflect the new installation pathway: npm install \-g savant1.  
The application utilizes a Next.js-style public environment variable architecture injected during the build process4. The .env.example, build shell scripts, and specifically the common/src/env.ts configuration file must be updated to reflect the new API endpoints. The legacy NEXT\_PUBLIC\_CODEBUFF\_APP\_URL variable, which historically hardcoded redirects to www.savant-code.com to manage OAuth headers, must be rebranded to NEXT\_PUBLIC\_SAVANT\_APP\_URL4.  
Finally, the original application persists user state, authorization tokens, and detailed chat history within the \~/.config/manicode/ filesystem namespace6. The agent must search for path constructions resolving to .config/manicode/projects/... and structurally rewrite these literals to .config/savant/projects/...6. The analysis reveals a critical bug in the original initialization sequence where getCurrentChatDir() failed to properly catch ENOENT directory creation exceptions, causing fatal crashes upon launch6. The migration process must ensure that the new savant directory initialization sequence implements correct try/catch fallbacks and executes recursive directory creation (mkdir { recursive: true }) to ensure seamless user onboarding.

## **Phase 2: Client/Server API Surface Extraction**

The original architecture functions largely as a sophisticated "thin router." It forwards user prompts to upstream Large Language Model (LLM) providers like OpenRouter and DeepSeek, while simultaneously managing user session state, complex multi-agent orchestration loops, and targeted ad injection for the free tier1. To decouple the TypeScript clients successfully, the autonomous agent must stub, document, and reroute the following API contracts to the proposed Rust backend.

### **Core REST Endpoints and JSON Contracts**

Based on the forensic analysis of cli/src/hooks/use-auth-query.ts, savant-free/web/src/app/api/..., and common/src/env.ts, the client fundamentally expects a series of highly specific endpoints to facilitate its application lifecycle4.

| Endpoint Path | HTTP Method | Expected Request Payload (JSON Schema) | Expected Response Payload (JSON Schema) | Architectural Purpose |
| :---- | :---- | :---- | :---- | :---- |
| /api/healthz | GET | *None* | { "status": "ok", "version": "string" } | CLI polling mechanism to verify backend connectivity before launching the TUI4. |
| /api/auth/cli/code | POST | { "device\_id": "string", "platform": "string" } | { "device\_code": "string", "user\_code": "string", "verification\_uri": "string", "expires\_in": 900, "interval": 5 } | Initiates the Device Flow OAuth sequence. Triggers the terminal to open a browser window for login4. |
| /api/auth/cli/poll | POST | { "device\_code": "string" } | { "status": "pending|success", "access\_token"?: "string", "refresh\_token"?: "string" } | Continuously polled by the CLI at the specified interval until the user completes the browser-based authentication4. |
| /api/v1/me | GET | *Headers: Authorization: Bearer \<token\>* | { "id": "string", "email": "string", "tier": "free|premium", "quota": { "remaining": number } } | Validates the active API key and fetches the specific user configuration to unlock terminal capabilities4. |
| /api/v1/chat/completions | POST | Standard OpenAI/OpenRouter chat completion schema combined with a custom cost\_mode parameter. | Streaming Server-Sent Events (SSE) stream containing model output and agent tool directives. | The primary conduit for executing the multi-agent system and LLM generation8. |

### **Real-Time Events and Multi-Agent Orchestration**

The application utilizes an advanced, event-driven architecture to coordinate its specialized agents: the File Picker Agent, the Planner Agent, the Editor Agent, and the Reviewer Agent1. Instead of executing a single, monolithic completion, the system operates in a continuous feedback loop. The client expects to stream responses and specific agent state transitions in real-time. Consequently, the new Rust backend must fully support high-bandwidth Server-Sent Events (SSE) or full-duplex WebSockets.  
The client architecture expects the backend event emitters to broadcast payloads matching strictly defined SavantCodeToolOutput schemas9. For instance, when the Planner Agent determines that the project directory must be indexed, the server pushes a tool\_call\_request (specifically an invocation for ripgrep or a file read) through the stream. The client immediately intercepts this event, executes the local filesystem read, and posts the tool\_call\_result back to the server, allowing the backend LLM to continue its generation context2. The core expected event types include agent\_spawned, tool\_call\_request, tool\_call\_result, chunk (for standard token generation), and turn\_complete3.

### **Licensing, Rate Limiting, and Telemetry Delineation**

The client codebase strictly differentiates operational behavior based on the specific binary execution context and the cost\_mode supplied to the routing layer8.  
The premium Savant tier relies on validating standard JSON Web Tokens (JWTs) or proprietary access tokens via the /api/v1/me endpoint. Once validated, the backend routes requests to premium intelligence models (e.g., DeepSeek V4 Pro, MiMo 2.5 Pro) via an OpenRouter interface1. The client passively checks the response headers or the initial /me payload for rate limit consumption, enforcing usage limits locally based on server directives.  
Conversely, the Savant-Free tier operates under significant, hardcoded restrictions. The architecture deliberately bypasses strict /api/v1/me validation via the seedUserInfoCache() function located in sdk/src/impl/database.ts4. This allows the free client to boot faster without exhaustive API key checks. However, the backend enforces two distinct geographic modes: "full" and "limited"1. If the backend detects a user connecting from an unauthorized country or via a VPN, it returns a session\_model\_mismatch or country\_not\_allowed HTTP error. The client intercepts this and automatically downgrades the user to a strict quota of five one-hour sessions per day8. The new Rust backend must replicate this geographic IP evaluation logic and session state tracking if similar geographic or quota management restrictions are intended.

### **Ad Serving Mechanics and Impression Tracking**

Because savant-free is fundamentally supported by text advertisements rendered directly within the terminal interface, the API extraction must identify how impressions are fetched, queued, and reported back to the analytics engine1.  
Prior to rendering a final agent response, the CLI requests a localized ad payload. This is typically executed via a GET request to /api/v1/ads?placement=terminal\_footer. The expected payload schema dictates the structure that the local @opentui/core rendering engine requires to display the text block7. The backend must return a JSON object containing an ad\_id, the textual text copy (e.g., "Sponsored: \[Ad Copy\]"), an actionable outbound link, and an impression\_url. To ensure accurate monetization tracking, the CLI executes a background HTTP GET request to this impression\_url the exact millisecond the text block becomes visible on the user's screen. The Rust server must implement a highly concurrent analytics endpoint to ingest these tracking pings without delaying core API responsiveness.

### **Third-Party API Integrations**

The client architecture interacts with several external services that must be safely isolated or reconfigured to prevent cross-contamination with the legacy application.  
First, the application relies on deeply integrated LLM providers. The client routing includes explicit configurations for models labeled "Collects data for training," specifically deepseek/deepseek-v4-pro and deepseek/deepseek-v4-flash8. Because handling proprietary codebase data introduces massive privacy liabilities, the API keys for these LLM providers must reside strictly on the Rust server. The frontend client must never hold OpenRouter or DeepSeek keys; it must only pass authorization tokens to the Savant server, which proxies the request.  
Furthermore, the application integrates with Google Analytics and PostHog for telemetry and usage metrics8. The API keys for these services embedded within the frontend build system must be rotated to unique Savant instances. Stripe integration, which facilitates the premium subscription lifecycle, relies on server-side webhooks that update the database state, which subsequently alters the response of the /api/v1/me endpoint.

## **Phase 3: Authentication and State Decoupling Strategy**

The original authentication architecture implements an asynchronous Device Authorization Grant (RFC 8628), which is heavily optimized for headless environments where standard browser redirects are impossible4. The decoupling process requires meticulously intercepting the local credential storage mechanisms and repointing the OAuth flow directly to the newly synthesized Rust backend.

### **Local State Storage Mechanics**

Session states, active models, and authorization caches are persisted natively to the user's local disk inside the \~/.config/savant/ directory. The primary artifact, credentials.json, stores the active JWTs, refresh tokens, and basic user metadata4.  
A critical vulnerability—or intentional bypass—exists within the savant-free application path. The client deliberately circumvents continuous network validation for API keys to reduce latency. As noted in the analysis of cli/src/hooks/use-auth-query.ts and sdk/src/impl/database.ts, the seedUserInfoCache() method pre-populates the SDK's internal caching layer using historical data read directly from credentials.json4. This prevents fatal application crashes if the backend /api/v1/me endpoint experiences downtime. To fully decouple the state, the executing agent must modify use-auth-query.ts to query the new NEXT\_PUBLIC\_SAVANT\_APP\_URL. The fallback caching mechanism (seedUserInfoCache()) should be maintained to ensure offline resilience and instantaneous terminal startup, but the validation interval logic must be strictly synchronized with the Rust backend's token expiry schedule to prevent unauthorized access.

### **Defined User Object Shape**

Upon successful initialization and token validation via /api/v1/me, the client expects a rigid data structure. The agent must ensure the Rust backend serialization strictly matches this expected shape to prevent type-checking failures in the frontend.

JSON  
{  
  "user": {  
    "id": "c56a4180-65aa-42ec-a945-5fd21dec0538",  
    "github\_username": "savant\_developer",  
    "tier": "savant|savant-free",  
    "capabilities": \["web\_search", "browser\_use", "bash\_mode"\],  
    "quota\_remaining": 100  
  }  
}

### **Decoupling the Authentication Flow**

The legacy application possesses hardcoded redirects targeting www.savant-code.com. These absolute URLs were implemented to prevent intermediate HTTP 301 redirects from actively stripping the sensitive Authorization headers during routing4. The migration agent must actively strip all absolute URIs from the codebase, replacing them entirely with dynamic environmental variables derived from the local configuration.  
During the login process, the findWindowsBash() utility or the generic terminal launcher triggers a browser window launch, directing the user to the backend's OAuth URL11. The callback URI must be fundamentally updated in the backend provider (e.g., GitHub OAuth application settings) to point to the new Rust server's designated callback endpoint. The CLI will continuously hit the /api/auth/cli/poll endpoint using its generated device\_code until the Rust server registers the OAuth success and returns the final access\_token4.

## **Phase 4: Structural Renaming and the "Do Not Touch" List**

The monorepo architecture operates via the bun runtime, leveraging cross-referenced workspace packages such as cli, common, sdk, and freebuff1. Migrating directory structures within a TypeScript monorepo requires atomic Git operations to preserve deep history logs and prevent the immediate fracturing of relative import paths.

### **Directory and File Renaming Strategy**

The autonomous agent must execute the following structural renames using strictly validated git mv operations.

| Source Filesystem Path | Target Filesystem Path | Explicit Terminal Execution Command |
| :---- | :---- | :---- |
| savant-free/ | savant-free/ | git mv savant-free savant-free |
| savant-free/cli/ | savant-free/cli/ | *(Implicit execution via parent directory move)* |
| savant-free/web/ | savant-free/web/ | *(Implicit execution via parent directory move)* |
| cli/src/tests/savant-code.test.ts | cli/src/tests/savant.test.ts | git mv cli/src/tests/savant-code.test.ts cli/src/tests/savant.test.ts |
| .savantignore | .savantignore | git mv .savantignore .savantignore \[cite: 1\] |

Following the execution of these directory moves, the agent must recursively update workspace array references in the root package.json, bunfig.toml, and tsconfig.base.json to reflect the new paths (utilizing savant-free instead of savant-free) to ensure the Bun runtime correctly maps the dependencies1.

### **The Architectural "Do Not Touch" List**

Certain files, dependencies, and external configurations within this ecosystem are highly fragile. Modifying them naively will immediately compromise the build pipeline or core logic. The agent must bypass the following components during the search-and-replace phase:

1. **Hardware Compilation Targets (Bun Baselines)**: The internal build system (located in cli/scripts/build-binary.ts and savant-free/cli/build.ts) contains highly specific logic designed to compile standalone binaries for older central processing units lacking Advanced Vector Extensions 2 (AVX2) instructions4. The string literals bun-windows-x64-baseline and bun-linux-x64-baseline must **not** be modified, as they dictate literal upstream Bun compilation targets4. Modifying these names will force the compiler to default to modern instruction sets, causing immediate SIGILL (illegal instruction) or error code 3221225501 crashes on legacy hardware7.  
2. **Third-Party TUI Libraries**: The terminal user interface relies entirely on the @opentui/core framework7. Namespace references, import statements, and interface extensions mapping to opentui must be preserved in their exact original casing.  
3. **Local Agent Definitions (.agents/)**: The multi-agent workflow allows developers to define custom routines in .agents/types/agent-definition.ts1. The hidden directory name .agents must remain unchanged. Modifying this string would instantly break backward compatibility for existing users who possess this directory structure populated in their local project roots.  
4. **Tree-Sitter Namespaces**: The parsing engine utilized for Abstract Syntax Tree code analysis relies on highly specific language grammars (e.g., tree-sitter-typescript, tree-sitter-python)1. The agent must not alter any tree-sitter queries or configuration files mapping to these native node modules.  
5. **External Context Directories**: Hardcoded references to external system directories such as .claude, .github/workflows, .gitlab, .circleci, .husky, and knowledge.md are actively referenced directly in the native code search utilities (sdk/src/tools/code-search.ts)9. These exact string literals must remain intact to ensure the agent context gathering pipeline correctly discovers these workflow files.

## **Phase 5: Rust Backend Architectural Blueprint**

To successfully decouple the frontend clients and transition toward an independent server architecture, the backend must be synthesized with precise attention to concurrency and memory safety. The analytical data dictates the absolute necessity of a framework capable of efficiently multiplexing thousands of active WebSocket/SSE streams for real-time agent orchestration without succumbing to memory leaks or thread starvation.

### **Framework Selection Strategy**

**Axum** stands as the optimal Rust web framework selection over alternatives like Actix-Web for this highly specific, agentic workload. Built natively on top of the tokio asynchronous ecosystem and utilizing the robust tower middleware stack, Axum seamlessly shares Tokio's threading primitives. Because the Savant backend fundamentally acts as a massive "thin router"—forwarding high-bandwidth Server-Sent Events from upstream LLM inference engines down to the local TUI clients—Axum's flawless integration with reqwest streams and tokio-websockets makes it exceptionally resilient against head-of-line blocking during intensive, multi-turn AI inference loops.

### **Core Data Models (Rust Struct Definitions)**

The following serde-serializable definitions form the exact API data contracts required to fulfill the payloads identified in Phase 2\. Implementing these accurately guarantees that the frontend AST will parse the incoming data without throwing fatal type exceptions.

#### **1\. User Authentication and Profile Model**

This struct parses the response for the /api/v1/me endpoint.

Rust  
use serde::{Deserialize, Serialize};  
use uuid::Uuid;

\#\[derive(Debug, Serialize, Deserialize)\]  
pub enum SubscriptionTier {  
    \#\[serde(rename \= "savant")\]  
    Premium,  
    \#\[serde(rename \= "savant-free")\]  
    Free,  
}

\#\[derive(Debug, Serialize, Deserialize)\]  
pub struct UserAuth {  
    pub id: Uuid,  
    pub github\_username: Option\<String\>,  
    pub tier: SubscriptionTier,  
    pub capabilities: Vec\<String\>,  
    pub quota\_remaining: i32,  
}

\#\[derive(Debug, Serialize, Deserialize)\]  
pub struct DeviceAuthResponse {  
    pub device\_code: String,  
    pub user\_code: String,  
    pub verification\_uri: String,  
    pub expires\_in: u64,  
    pub interval: u64,  
}

#### **2\. Agent Task and Tool Call Messages (Server-Sent Events)**

Because the agents operate through advanced programmatic tool calling capabilities3, the event schema must precisely capture commands dispatched to the client (e.g., executing terminal bash commands or reading local project files).

Rust  
use serde::{Deserialize, Serialize};  
use serde\_json::Value;

\#\[derive(Debug, Serialize, Deserialize)\]  
\#\[serde(tag \= "type", content \= "payload")\]  
pub enum AgentEvent {  
    \#\[serde(rename \= "chunk")\]  
    StreamChunk { text: String },  
      
    \#\[serde(rename \= "tool\_call\_request")\]  
    ToolCallRequest {  
        tool\_name: String,  
        arguments: Value,  
        call\_id: String,  
    },  
      
    \#\[serde(rename \= "tool\_call\_result")\]  
    ToolCallResult {  
        call\_id: String,  
        output: String,  
    },  
      
    \#\[serde(rename \= "turn\_complete")\]  
    TurnComplete,  
}

#### **3\. Targeted Ad Payload Schema for Savant-Free**

The terminal interface requires a structured ad payload to correctly render impressions in the terminal footer without corrupting the active chat interface1.

Rust  
use serde::{Deserialize, Serialize};

\#\[derive(Debug, Serialize, Deserialize)\]  
pub struct AdPayload {  
    pub ad\_id: String,  
    pub text: String,  
    pub link: String,  
    pub impression\_url: String,  
}

### **System Architecture Flow**

1. **Authentication Middleware**: Axum extractor functions will rapidly parse the Authorization: Bearer JWT provided by the CLI. For savant-free requests, an IP-based rate-limiting middleware (utilizing an asynchronous Redis backend via redis-rs) will strictly enforce the required "5 one-hour sessions per day" quota, checking the connecting IP against known country blocklists to enforce "Limited Mode" restrictions1.  
2. **Asynchronous Streaming Proxy**: When a user initiates a codebase edit, the Axum handler will open a bidirectional asynchronous channel (tokio::sync::mpsc). It maps the local context request to an OpenRouter or DeepSeek payload, maintaining the secure API keys entirely in server memory. The system pipes the upstream LLM SSE response directly to the mpsc receiver and immediately flushes the bytes out to the client's socket. This strict streaming proxy design prevents the server from needing to buffer massive token outputs in memory, preserving server RAM.

## **Phase 6: Step-by-Step Autonomous Execution Plan**

To execute this frontend migration autonomously while ensuring continuous integration tests and the build pipeline pass deterministic checks, the agent must adhere to the following chronological checklist.

### **Step 1: Automated String Replacements and Structural Renaming**

1. **Execute Directory Reorganization**: Programmatically execute the git mv commands specified in Phase 4\. Commit immediately to lock the filesystem changes into the tree: git commit \-m "chore: structural directory renames for savant".  
2. **Execute AST-Aware Lexical Replacements**: Utilize programmatic AST manipulation tools like ts-morph, or fallback to ripgrep (rg) piped to sed to enact the lexical replacements from Phase 1\.  
   * *Execution Context*: rg "savant-code" \-l | xargs sed \-i '' 's/savant-code/savant/g'. (The agent must utilize case-preserving regex libraries to prevent breaking camelCase module imports).  
3. **Sanitize Storage Paths and Error Handlers**: Traverse the deeply nested utilities associated with logging and disk storage, specifically src/utils/logger.ts and src/project-files.ts6. Explicitly wrap the getCurrentChatDir() initialization in a robust try/catch block. Ensure the new .config/savant directory path is created recursively prior to any device fingerprinting or login logic firing to mitigate known launch crashes.

### **Step 2: Configuration and Build Script Updates**

1. **Package Manifest Overhauls**: Update the root package.json, tsconfig.json, and bunfig.toml across all workspace boundaries. Modify package names, bin execution commands (savant and savant-free), and upstream repository URLs to sever historical links1.  
2. **Binary Build Script Alignment**: Access cli/scripts/build-binary.ts and savant-free/cli/build.ts4. Update the hardcoded executable outputs to yield savant.exe and savant-free.exe. The agent must ensure that the spawnSync calls utilizing process.execPath—which were previously patched specifically for Windows cmd compatibility—remain fully intact and undisturbed4.  
3. **Dependency Cache Alignment**: Run bun install \--no-cache to force a clean, deterministic resolution of the newly renamed local workspaces. This explicit flag circumvents a known architectural bug in the Bun runtime where caching conflicts during massive filesystem syncs cause failures (PathAlreadyExists: failed copying files...)15.

### **Step 3: API Stubbing and Mock Server Layer Initialization**

Because the new Rust server infrastructure is currently in parallel development, the frontend compilation will inevitably fail at runtime if the application cannot resolve its backend token validation and initialization routines.

1. **Implement Mock Service Worker (MSW)**: Integrate the MSW framework directly into the CLI's network request abstraction layer.  
2. **Generate Localized Mock Endpoints**:  
   * Intercept GET NEXT\_PUBLIC\_SAVANT\_APP\_URL/api/healthz and programmatically return an HTTP 200 { "status": "ok" } to bypass connection lockouts.  
   * Intercept GET /api/v1/me and return a heavily mocked UserAuth schema to allow the premium CLI to bypass its startup locks and initialize the TUI.  
   * Intercept GET /api/v1/ads and return a dummy AdPayload schema to ensure the savant-free terminal footer renders correctly without throwing a rendering exception inside OpenTUI.  
3. **Bypass the Auth Cache Temporarily**: Extend the seedUserInfoCache() method4 logic to aggressively mock standard JWT credentials until the Rust-based Device Authorization Flow is fully operational.  
4. **Execute the Final Compile Target Verification**: Run bun test in the root and cli/ directories1. Finally, execute bun build to compile the standalone executables. The agent must verify that the baseline compilation targets (bun-linux-x64-baseline and bun-windows-x64-baseline) successfully yield binaries capable of bypassing the AVX2 hardware requirement, ensuring backward compatibility is preserved for the newly minted applications4.

By executing this exact architectural blueprint, the autonomous agent will systematically sever the legacy application from its proprietary ecosystem, rebrand it entirely into the dual Savant architecture, and establish a deterministic network boundary precisely configured for integration with the incoming Rust infrastructure.
