<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# **Architectural Blueprint: Discord Rich Presence Integration for Savant-Code**

## **The Integration Imperative and Ecosystem Context**

The deployment of autonomous and semi-autonomous coding agents introduces a novel requirement for developer tooling: the need to externalize internal machine states into human-readable social signals. Savant-Code currently operates as a highly sophisticated, terminal-native multi-agent harness governed by the ECHO Protocol v0.2.01. Running on a strict TypeScript foundation within the Bun 1.3.14 runtime, the system utilizes a ten-agent roster to execute a deterministic Perfection Loop Finite State Machine (FSM), navigating phases from initial investigation (RED) through to final metadata verification (ADVERSARIAL and COMPLETE)1. While the internal state is flawlessly broadcast to the operator via the OpenTUI sidebar1, this visibility remains trapped within the local terminal emulator.  
The objective of this architectural blueprint is to design a Discord Rich Presence (RPC) subsystem for Savant-Code. This system must securely broadcast the operator’s current coding activity, detailing the active agent, the FSM phase, and the high-level task, to the Discord network. The primary inspiration for this feature is the open-source project Devvy, a macOS-only Rich Presence application designed for coding workflows1. Devvy establishes a critical baseline for privacy by intentionally obscuring proprietary file contents, codebase structures, and credential data, exposing only the project basename, the active AI model, and a generalized activity state1.  
However, translating the Devvy paradigm into the Savant-Code ecosystem necessitates a profound architectural departure. Where Devvy functions as a standalone daemon that arbitrates state from various integrated development environments (IDEs) via a loopback HTTP endpoint at 127.0.0.1:173771, Savant-Code must internalize this logic. The proposed blueprint outlines an in-process, cross-platform subscriber embedded directly within Savant-Code's existing Zustand state management layer1. This eliminates the need for auxiliary daemons, satisfies the zero-configuration constraint, and enables robust deployments across Windows, macOS, and Linux without requiring administrative privileges.

## **Architectural Paradigm: Surpassing the Devvy Model**

The foundational architecture of Devvy relies on decoupling the presence publisher from the source application. Devvy runs a background daemon managed by macOS LaunchAgent, which claims ownership of the local Discord Inter-Process Communication (IPC) UNIX socket1. Target applications, such as VS Code or Command Code, utilize extensions to publish structured state payloads over HTTP to a local loopback port, which the Devvy daemon then sanitizes and forwards to Discord1.  
While this architecture is logical for an aggregator designed to support multiple disparately built IDEs, it introduces unnecessary overhead, latency, and platform exclusivity when applied to a monolithic, integrated environment like Savant-Code. Savant-Code already possesses a centralized, globally accessible state container managed by Zustand and Immer1. Therefore, adapting the Devvy model requires collapsing the distributed HTTP architecture into a synchronized, in-memory subscriber pattern.  
By embedding the IPC client directly within the @savant-code/cli package, the application achieves a zero-dependency footprint1. The operator installs the system via a standard npm install \-g savant-code command, and the presence capabilities are immediately available3. The in-process model also guarantees lifecycle synchronization; when the Savant-Code terminal process terminates, the Discord IPC socket is gracefully closed, immediately clearing the user's presence profile and preventing stale "ghost" activities from persisting on the Discord network.

### **System Topography and Component Isolation**

To ensure that the networking requirements of the Discord RPC protocol do not interfere with the high-performance OpenTUI React rendering cycle or the agent execution loop, the presence subsystem must be strictly isolated. The architecture introduces four dedicated modules adjacent to the existing cli/src/state/chat-store/ directory.

# **\============================================================================= SAVANT-CODE DISCORD RPC ARCHITECTURE**

\[ OpenTUI / React Layer \] \<--- (UI Rendering) | v \+-----------------------+ \+-------------------------------------------+  
| Zustand Store | \===\> | 1\. Presence Selector & Debouncer | | (chat-store/index) | | (presence-selector.ts) | \+-----------------------+ \+-------------------------------------------+  
| | v v \[ Agent Runtime / EHEL \] \+-------------------------------------------+  
| 2\. Privacy Enforcer & Redactor | | (presence-privacy.ts) | \+-------------------------------------------+ | v \+-------------------------------------------+  
| 3\. Payload Mapper & Asset Resolver | | (presence-mapper.ts) | \+-------------------------------------------+ | v \[ Local Operating System \] \+-------------------------------------------+  
| | 4\. Cross-Platform IPC Client | \+================== | (presence-ipc.ts) | \+-------------------------------------------+ | v \+-----------------------+ \+-------------------------------------------+  
| Discord Desktop App | \<=== | UNIX Socket / Windows Named Pipe | | (Local Client) | | (discord-ipc-0) | \+-----------------------+ \+-------------------------------------------+  
The flow of data through this topography is strictly unidirectional. The Presence Selector utilizes Zustand's subscription capabilities to monitor for specific mutations in the perfectionLoopPhase, currentActivity, and activeAgentId variables without triggering React re-renders1. To comply with Discord's stringent rate limits, the selector implements a sliding-window debounce mechanism. The raw, debounced state is then passed to the Privacy Enforcer, which mechanically strips all sensitive strings, file paths, and tool arguments, aligning with the ECHO Protocol's data governance mandates2. The Payload Mapper translates this sanitized context into the exact JSON schema required by Discord, resolving internal state enumerations to pre-configured large\_image and small\_image asset keys6. Finally, the Cross-Platform IPC Client handles the asynchronous byte-framing and socket transmission, managing reconnections and error suppression silently to protect the host process.

## **Cross-Platform IPC Transport Mechanics**

The core technical challenge of integrating Discord Rich Presence without utilizing a third-party library is mastering the undocumented nuances of Discord's local IPC protocol. Discord does not expose a local HTTP REST API for presence updates; instead, it relies entirely on local sockets8. The transport layer must be robust enough to handle the divergent socket architectures of POSIX and Windows systems while navigating specific runtime bugs present in modern JavaScript engines.

### **Socket Path Discovery**

The Discord desktop application opens a local socket, appending an integer from 0 to 9 to accommodate environments where multiple Discord instances (e.g., Stable, Canary, PTB) might be running simultaneously7. The Savant-Code IPC client must sequentially probe these paths until a successful connection is established.  
On Linux and macOS, Discord resolves the IPC prefix by prioritizing standard UNIX environment variables. The client must check XDG\_RUNTIME\_DIR, followed by TMPDIR, TMP, TEMP, and ultimately falling back to the hardcoded /tmp directory8. The resulting string takes the format ${BASE}/discord-ipc-{n}8. Utilizing Bun's net.createConnection({ path: socketPath }), the application can bind to these UNIX domain sockets natively10.  
Conversely, Windows relies on the Object Manager namespace for Inter-Process Communication, utilizing named pipes. The path format is strictly defined as \\\\.\\pipe\\discord-ipc-{n}8.

### **Mitigating the Bun 1.3.14 Windows Named Pipe Anomaly**

Implementing this on the target runtime—Bun 1.3.141—introduces a critical platform-specific hurdle. Recent telemetry and community issue tracking indicate a systemic flaw in how Bun and underlying libuv bindings handle Windows named pipe connections13. When invoking net.createConnection with a Windows named pipe string, the internal path resolution logic may erroneously attempt to locate the pipe within the standard NTFS filesystem namespace (e.g., C:\\Users\\Operator\\AppData\\Local\\Temp\\) rather than the correct Object Manager namespace (\\\\.\\pipe\\)13. This results in a persistent ENOENT (Error No Entity) failure, completely breaking IPC connectivity on Windows environments.  
To achieve the cross-platform requirement mandated by the research goals, the Savant-Code IPC module cannot simply rely on the default net.createConnection wrapper for Windows. The architecture must implement a targeted workaround. The IPC client will detect the platform via process.platform \=== 'win32'. When executing on Windows, the client must ensure the path is formatted exactly to bypass Bun's internal options.host validation failures11. If the native net module continues to intercept and misroute the connection, the fallback strategy involves utilizing Bun's internal fs.openSync or File Descriptor handling capabilities to write directly to the pipe handle, treating the named pipe as a standard file stream rather than a network socket11. This guarantees that Windows operators receive the same seamless zero-config presence experience as macOS and Linux users, definitively solving the platform exclusivity issue inherent in the original Devvy design1.

### **The Discord IPC Framing Protocol**

Communication over the established socket follows a strict, byte-level framing protocol9. Every packet sent to and received from the Discord client consists of an eight-byte header immediately followed by a UTF-8 encoded JSON string9.  
The header is composed of two 32-bit little-endian unsigned integers:

> 1. **Opcode (4 bytes)**: Denotes the type of message being transmitted (e.g., 0 for Handshake, 1 for Frame)8.  
> 2. **Length (4 bytes)**: Specifies the exact byte size of the subsequent JSON payload7.

Upon establishing the socket connection, the Savant-Code IPC client must immediately construct and transmit the Handshake packet utilizing Opcode 08. The JSON payload for this handshake is minimal, requiring only the RPC protocol version ("v": 1\) and the unique Discord Application Client ID registered for Savant-Code8. The transmission logic must use a binary buffer to pack the little-endian integers accurately to prevent socket malformation7.  
Following a successful handshake, the Discord client responds with an Opcode 1 (FRAME) packet containing a READY event payload8. Once this acknowledgment is received, the IPC client transitions to an active state, ready to accept sanitized presence updates from the upper layers of the architecture and transmit them using Opcode 1\.

## **State Mapping Engine: Translating ECHO to Presence**

The translation of Savant-Code's internal multidimensional state into a flat Discord Rich Presence profile is the core semantic challenge of this integration. The Discord SET\_ACTIVITY payload accepts several highly specific fields: details (a top-level description limited to 2-128 characters), state (a secondary status line, also 2-128 characters), and an assets object containing keys for large\_image, large\_text, small\_image, and small\_text6.  
Savant-Code operates on a multi-tiered state hierarchy: the macroscopic FSM phase of the Perfection Loop, the specific agent currently holding the execution context, and the highly transient AgentActivity type representing the micro-action occurring at that exact millisecond1. The presence-mapper.ts module is responsible for synthesizing these layers into a coherent, static snapshot.

### **Resolving the details and state Fields**

The details field will represent the broadest context of the operator's work. It concatenates the sanitized project basename with the currently active LLM provider model1. Because Savant-Code utilizes a unified provider registry, the active model (e.g., openrouter/free or claude-3-5-sonnet) is easily extracted from the Zustand store3. The resulting string (e.g., "Project: core-api | Model: claude-3-sonnet") provides external observers with immediate context regarding the technological environment without revealing sensitive directory structures.  
The state field is mapped dynamically based on the intersection of the FSM phase and the current agent activity1. This creates a narrative of the development lifecycle.

| Savant-Code FSM Phase | Primary Agent | Discord state String Synthesis | Justification based on ECHO Protocol |
| :---- | :---- | :---- | :---- |
| **IDLE** | Orchestrator | "Awaiting Operator Input" | The system has completed its boot sequence or previous task and is waiting for a command2. |
| **RED** | Detective | "RED Phase: Investigating Codebase" | The Detective is mapping call-graphs and cataloging evidence of defects2. |
| **GREEN** | Forge | "GREEN Phase: Implementing Fixes" | The Forge is actively utilizing the write\_file and str\_replace tools to alter the codebase2. |
| **AUDIT** | Verifier | "AUDIT Phase: Double-Checking" | The Verifier is executing Law 3 (Verify Before Proceed) and Law 4 (Call-Graph Reachability)2. |
| **ADVERSARIAL** | Adversary | "ADVERSARIAL Phase: Refuting" | The Adversary is conducting a meta-verification pass to overrule hallucinations or false negatives2. |
| **SELF\_CORRECT** | Thinker | "SELF-CORRECT: Revising Approach" | Following a failed audit, the Thinker utilizes sequentialthinking to formulate an alternative plan2. |
| **COMPLETE** | Recorder | "COMPLETE: Archiving FID" | The Recorder finalizes the artifact, updates the CHANGELOG.md, and prepares the repository for the next iteration2. |

### **Visual Identity: Asset Key Resolution**

To create a visually striking and informative Rich Presence profile, the system leverages Discord's image asset capabilities. Discord requires developers to upload images to the Developer Portal, assigning them unique, strictly lowercase string keys16. The Savant-Code integration will utilize 10 primary large\_image assets, each representing one of the canonical ECHO runtime roles1.  
When the Orchestrator delegates a task to a subagent, the large\_image dynamically shifts to reflect the new persona. The large\_text tooltip is mapped to the agent's formal title.

| ECHO Roster Agent | Uploaded Discord Asset Key | large\_text Tooltip Mapping |
| :---- | :---- | :---- |
| Orchestrator | agent\_orchestrator | "Orchestrator (Protocol Enforcement)" |
| Detective | agent\_detective | "Detective (Codebase Analysis)" |
| Forge | agent\_forge | "Forge (Code Implementation)" |
| Verifier | agent\_verifier | "Verifier (Double-Audit Validation)" |
| Recorder | agent\_recorder | "Recorder (FID Lifecycle Management)" |
| Thinker | agent\_thinker | "Thinker (Sequential Logic Engine)" |
| Scout | agent\_scout | "Scout (Contextual Exploration)" |
| Researcher | agent\_researcher | "Researcher (External Verification)" |
| Scribe | agent\_scribe | "Scribe (Documentation Synthesis)" |
| Adversary | agent\_adversary | "Adversary (Meta-Verification Override)" |

The small\_image overlay provides secondary context. This will be mapped to the broader execution mode (e.g., mode\_strict, mode\_hybrid, mode\_scaffold) or the specific transient activity3. For instance, when an agent utilizes the tool activity1, the small\_image transitions to a status\_tool icon, and the small\_text displays a sanitized descriptor of the action (e.g., "Executing: run\_readonly\_command").

### **Timestamps and Temporal Context**

Discord Rich Presence allows for the display of an elapsed timer, providing viewers with an understanding of how long a user has been engaged in an activity16. The Savant-Code mapper will generate a timestamps.start variable (a Unix epoch integer) at the moment the CLI boots and the PresenceService is initialized7. By passing this identical timestamp in every subsequent SET\_ACTIVITY payload, the Discord client accurately calculates and displays the total session duration, creating a continuous narrative of the coding session despite rapid internal FSM transitions.

## **Privacy Enforcer: Mechanical Information Governance**

The ECHO Protocol enforces a philosophy of Zero-Trust Agentic Provenance (ZTAP) and strict data security3. Devvy achieves privacy by relying on loosely coupled editor extensions1. Savant-Code, having direct access to the entire memory space, must implement a rigorous, mechanical redaction layer (presence-privacy.ts) to guarantee that no proprietary information ever reaches the IPC transport module. The consequences of a data leak via Discord RPC—such as broadcasting AWS credentials passed as a bash argument or revealing the names of unreleased proprietary modules—are catastrophic.

### **Data Masking Algorithms**

The Privacy Enforcer applies a series of deterministic transformations to the raw state extracted from the Zustand store.

> 1. **Project Basename Extraction**: When the system initializes, it determines the Current Working Directory (CWD). The redaction layer utilizes standard path manipulation (e.g., path.basename()) to strip all parent directories. If the operator is working in C:\\Corporate\\Projects\\NextGen\\AuthService\\, the presence system receives and transmits only the string "AuthService". All absolute and relative path information is unconditionally discarded.  
> 2. **Tool Argument Annihilation**: The AgentActivity system tracks when an agent transitions into a tool state1. While the internal CLI UI displays the tool name and its arguments for operator oversight, the RPC payload must aggressively redact this. An internal state of executeToolCall('write\_file', { path: 'src/crypto/keys.ts', content: '...' }) is transformed mathematically into a flat string: "using tool: write\_file". No heuristic filtering is attempted; argument dropping is absolute to prevent edge-case leaks.  
> 3. **FID Title Obfuscation**: The Feature Implementation Document (FID) lifecycle is the core of the ECHO protocol2. FIDs are named using the format FID-YYYY-MMDD-NNN-{kebab-case-title}.md2. Because the kebab-case title often contains sensitive vulnerability descriptions or feature names, the redaction layer utilizes a regular expression to strip everything following the incremental ID. A FID named FID-2026-0819-042-fix-jwt-bypass-vulnerability.md is broadcast simply as "Active FID: 2026-0819-042".  
> 4. **Query Redaction**: The Detective agent utilizes code\_search and query\_blast\_radius to navigate the codebase4. These search parameters represent intellectual property. The system masks these completely, replacing the specific activity descriptor with a generalized string such as "Analyzing knowledge graph".

### **Schema Validation via Zod**

To ensure that future updates to the Savant-Code codebase do not inadvertently bypass the redaction layer, the final payload is subjected to a strict schema validation pass using Zod, which is already a core dependency of the stack3.

TypeScript  
import { z } from 'zod';

// Rigorous outbound payload validation schema  
const OutboundPresenceSchema \= z.object({  
  cmd: z.literal('SET\_ACTIVITY'),  
  args: z.object({  
    pid: z.number().int().positive(),  
    activity: z.object({  
      details: z.string().min(2).max(128).refine(val \=\> \!val.includes('/') && \!val.includes('\\\\'), {  
        message: "Path leakage detected in details field"  
      }),  
      state: z.string().min(2).max(128).refine(val \=\> \!val.includes('/') && \!val.includes('\\\\'), {  
        message: "Path leakage detected in state field"  
      }),  
      assets: z.object({  
        large\_image: z.string().regex(/^\[a-z0-9\_\]+$/),  
        large\_text: z.string().max(128).optional(),  
        small\_image: z.string().regex(/^\[a-z0-9\_\]+$/).optional(),  
        small\_text: z.string().max(128).optional()  
      }),  
      timestamps: z.object({  
        start: z.number().int().positive()  
      })  
    })  
  }),  
  nonce: z.string().uuid()  
});

If the generated payload fails this schema check—for example, if a developer mistakenly passes a full file path into the details field, violating the regex refinement—the Privacy Enforcer catches the Zod error. Instead of crashing the application, it falls back to a hardcoded, universally safe payload (e.g., "Working in Savant-Code"), logs a local compliance\_warning3, and suppresses the error to maintain process stability.

## **Rate Limiting and Telemetry Governance**

Discord implements strict rate limiting on the IPC socket to prevent abuse. The specific limit for the SET\_ACTIVITY command is 5 updates per 20 seconds19. Exceeding this limit causes Discord to forcibly terminate the connection, issuing a 4002 RATELIMITED close code9.  
The Savant-Code agent loop operates at machine speed. A single turn may involve the Orchestrator thinking, spawning the Scout, the Scout reading three files, and returning context, all within two seconds3. If every state transition were forwarded to Discord, the rate limit would be breached almost instantly.

### **The Sliding Window Debouncer**

To harmonize the high-frequency internal state with the low-frequency RPC requirements, the Presence Selector utilizes a sliding window debounce algorithm, commonly implemented via a Token Bucket pattern.

> 1. **State Accumulation**: As the Zustand store emits changes via useChatStore.subscribe, the raw state is written into a volatile holding variable.  
> 2. **Tick Interval**: A non-blocking setInterval loop runs every 4,000 milliseconds (4 seconds). This mathematically caps the maximum possible output to exactly 5 updates per 20 seconds, aligning perfectly with Discord's constraints19.  
> 3. **Delta Comparison**: On each tick, the algorithm deeply compares the holding variable against the last transmitted payload. If the state is identical, the tick is ignored.  
> 4. **Payload Dispatch**: If a delta exists, the state is passed through the Privacy Enforcer, validated, and dispatched to the IPC client. The holding variable is then marked as clean.

This architectural decision ensures that highly transient states—such as a sub-agent spinning up and shutting down within 500 milliseconds—are gracefully skipped. Observers on Discord perceive a stable, macroscopic view of the development process, focusing on meaningful transitions between FSM phases rather than micro-tool executions.

## **Lifecycle Management and OpenTUI Integration**

For the operator, the presence system must represent a seamless, zero-configuration enhancement to the terminal environment. Devvy requires the user to execute terminal commands to manage its daemon1; Savant-Code integrates this directly into its slash command ecosystem3.

### **Boot Sequence and Connection Resilience**

During the initialization of the @savant-code/cli package, the PresenceService is instantiated. It attempts a non-blocking asynchronous connection to the Discord IPC socket. If the socket is unavailable (e.g., the user does not have Discord open), the service catches the ENOENT error, suppresses it, and enters a dormant polling state, checking for the socket every 60 seconds12. This ensures that the terminal boots instantly regardless of Discord's status.  
If the socket connects but subsequently drops mid-session (e.g., the user closes the Discord desktop app), the IPC client receives a close or error event. The event handlers are designed to absorb these exceptions entirely. The socket handle is nullified, and the system gracefully returns to the dormant polling state without emitting errors to the OpenTUI console or interrupting the active LLM stream3.

### **Operator Controls**

To respect operator autonomy, the system provides discrete commands, mapping directly to the existing /telemetry and /permissions structures3.

* **/presence enable**: Instructs the PresenceService to immediately initiate a connection attempt and begin transmitting the debounced payload. This is the default boot state unless previously disabled.  
* **/presence disable**: Instructs the service to send one final SET\_ACTIVITY payload with an empty activity object (or to issue the clear command if supported by the specific framing implementation)7, effectively wiping the rich presence from the user's Discord profile. It then forcibly closes the IPC socket. This preference is persisted locally in \~/.savant-code/credentials.json to ensure it survives reboots3.  
* **/presence status**: Prints a diagnostic line to the OpenTUI chat log, indicating whether the presence subsystem is Active, Dormant (Polling), or Disabled by User.

## **Implementation Path and Deployment Strategy**

Integrating this comprehensive blueprint into the active v0.0.25 repository3 requires a methodical, three-week phased approach, adhering to the rigorous FID lifecycle mandated by the ECHO Protocol2.

### **Week 1: Protocol Foundation and IPC Layer**

* **FID Generation**: The Recorder agent initiates FID-2026-0819-001-discord-rpc-ipc-layer.md.  
* **Objective**: Develop the presence-ipc.ts module. This involves writing the raw byte-framing logic necessary to pack and unpack the 8-byte (Opcode \+ Length) header and encode the JSON payloads9.  
* **Platform Hardening**: Implement the socket discovery loops for POSIX (XDG\_RUNTIME\_DIR, /tmp) and the specific Windows Object Manager workaround (\\\\.\\pipe\\discord-ipc-n) to bypass the known Bun 1.3.14 path resolution anomalies8.  
* **Validation**: Achieve a successful Opcode 0 (Handshake) and receive the Opcode 1 (READY) event across macOS, Linux, and Windows test environments without causing process panics.

### **Week 2: State Subscription and Mechanical Redaction**

* **FID Generation**: The Recorder agent initiates FID-2026-0826-002-discord-rpc-state-mapping.md.  
* **Objective**: Develop the presence-selector.ts and presence-privacy.ts modules. Integrate the useChatStore.subscribe hook to passively monitor the Zustand state1.  
* **Logic Implementation**: Build the 4,000ms Token Bucket rate limiter19. Implement the Zod validation schemas and the deterministic string manipulation routines necessary to extract the CWD basename and obliterate tool arguments.  
* **Validation**: Execute unit tests simulating complex multi-agent interactions to prove that no file paths or sensitive strings survive the redaction boundary.

### **Week 3: Asset Pipeline, Asset Resolution, and UX**

* **FID Generation**: The Recorder agent initiates FID-2026-0902-003-discord-rpc-assets-and-commands.md.  
* **Objective**: Finalize the visual identity. Design and upload the 10 distinct agent icons and the FSM phase icons to the Discord Developer Portal, ensuring the keys match the strict lowercase requirements (e.g., agent\_orchestrator, phase\_audit)16.  
* **UI Integration**: Build the /presence slash commands into the OpenTUI command parser3. Finalize the presence-mapper.ts logic to bind the internal state enumerations to the uploaded asset keys.  
* **Validation**: Conduct a full end-to-end integration test. Verify that the Discord profile accurately and dynamically reflects the real-time execution of the ECHO Perfection Loop without dropping frames due to rate limits or leaking proprietary data.

By adhering to this architectural blueprint, the Savant-Code platform will seamlessly externalize its sophisticated internal state, providing operators with a secure, professional, and zero-configuration social signaling mechanism that drastically improves upon the foundational concepts established by Devvy.

#### **Works cited**

> 1. AGENTS.md  
> 2. ECHO.md  
> 3. README.md  
> 4. ARCHITECTURE.md  
> 5. @rocket.chat/apps-engine | Yarn, [https://classic.yarnpkg.com/en/package/@rocket.chat/apps-engine](https://classic.yarnpkg.com/en/package/@rocket.chat/apps-engine)  
> 6. discord-rpc-new \- UNPKG, [https://app.unpkg.com/discord-rpc-new@1.4.1/files/src/types/activities.ts](https://app.unpkg.com/discord-rpc-new@1.4.1/files/src/types/activities.ts)  
> 7. discord-rpc/documentation/hard-mode.md at master \- GitHub, [https://github.com/discord/discord-rpc/blob/master/documentation/hard-mode.md](https://github.com/discord/discord-rpc/blob/master/documentation/hard-mode.md)  
> 8. RPC \- Documentation \- Discord Developer Platform, [https://docs.discord.com/developers/topics/rpc](https://docs.discord.com/developers/topics/rpc)  
> 9. Discord RPC \- Discord Userdoccers, [https://docs.discord.food/topics/rpc](https://docs.discord.food/topics/rpc)  
> 10. Node net.createConnection function | API Reference \- Bun, [https://bun.com/reference/node/net/createConnection](https://bun.com/reference/node/net/createConnection)  
> 11. Bun v1.2.18 | Bun Blog, [https://bun.com/blog/bun-v1.2.18](https://bun.com/blog/bun-v1.2.18)  
> 12. discord-presence/discord\_ipc.py at main \- GitHub, [https://github.com/trakt/discord-presence/blob/main/discord\_ipc.py](https://github.com/trakt/discord-presence/blob/main/discord_ipc.py)  
> 13. Claude-in-Chrome Windows & WSL working fixes · Issue \#23828 · anthropics/claude-code, [https://github.com/anthropics/claude-code/issues/23828](https://github.com/anthropics/claude-code/issues/23828)  
> 14. Nuxt 4 doesn't work with Bun since version 1.2.14 to 1.2.20 \#21762 \- GitHub, [https://github.com/oven-sh/bun/issues/21762](https://github.com/oven-sh/bun/issues/21762)  
> 15. Discord Interprocess Communication \- Read Messages \- Stack Overflow, [https://stackoverflow.com/questions/67339313/discord-interprocess-communication-read-messages](https://stackoverflow.com/questions/67339313/discord-interprocess-communication-read-messages)  
> 16. Setting Rich Presence \- Documentation \- Discord Developer Platform, [https://docs.discord.com/developers/discord-social-sdk/development-guides/setting-rich-presence](https://docs.discord.com/developers/discord-social-sdk/development-guides/setting-rich-presence)  
> 17. Discord-RPC — Documentation \- Senophyx, [https://senophyx.id/docs/discord-rpc/](https://senophyx.id/docs/discord-rpc/)  
> 18. Discord RPC \- GitHub, [https://github.com/discord/discord-rpc](https://github.com/discord/discord-rpc)  
> 19. claude-discord-activity \- canigom \- GitHub, [https://github.com/canigom/claude-discord-activity](https://github.com/canigom/claude-discord-activity)