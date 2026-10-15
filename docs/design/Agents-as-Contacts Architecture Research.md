<!-- markdownlint-disable MD001 MD013 -->
<!-- MD013 is narrowly disabled for this evidence-heavy research report: long cited prose, wide comparison tables, and the verification appendix are intentionally preserved in source form, per repo convention. -->

# **Agents-as-Contacts Command Surface: Product & Technical Landscape Report**

## **Executive Summary**

The transition from a monolithic chatbot interface to an "agents-as-contacts" command surface represents a critical evolution in human-AI interaction. Instead of a single ephemeral conversational window, modern agentic systems require a specialized, distributed roster of persistent computational agents. The objective of this research is to define the definitive architectural and product blueprint for integrating this command surface into the existing SavantCode desktop application. The system must natively extend the ECHO Protocol’s 10-role governance finite state machine (FSM), operating strictly within the constraints of a Tauri v2 shell, a Bun backend, and a React 19 WebGL-accelerated frontend.  
Extensive analysis of the current landscape, indexing heavily on the architectures of OpenMausBot, Grok Bot, and emerging agentic frameworks, reveals that the fundamental challenge is not underlying capability, but orchestration and cognitive load management. Users expect distinct models matched to specific agent roles, persistent memory, and seamless background execution. However, exposing unrestricted autonomous agents to local file systems and host operating systems introduces severe security vulnerabilities and the well-documented phenomenon of approval fatigue, wherein human operators reflexively rubber-stamp security prompts, defeating the purpose of human-in-the-loop safeguards.  
To navigate these constraints, this report formulates an architecture built upon zero-trust provenance, load-aware security policies, and deterministic event sourcing. The analysis drives a set of ten foundational architectural decisions required for the full build:

> 1. **Unified Discriminated Event Union**: The WebSocket transport will utilize a single, strongly-typed JSON-RPC stream with discriminated event unions, rejecting parallel namespaced channels to ensure strict schema evolution and chronological deterministic playback.  
> 2. **Background Host Control via Cua-Driver**: Computer use will leverage the open-source trycua/cua daemon architecture, which utilizes UIAutomation (UIA) and native accessibility trees to allow agents to control the host without stealing user focus or the physical cursor.  
> 3. **Risk-Adaptive Consent Broker**: To combat approval fatigue, the system will implement a risk-adaptive auto-allow policy where read operations are executed silently, but destructive writes and host executions require explicit, context-rich consent unless operating within predefined exempt paths.  
> 4. **Tailscale Funnel for Ingress**: Webhook ingress and remote triggers will be routed through Tailscale Funnel, providing a stable, TLS-secured, local-first endpoint without relying on third-party cloud relays.  
> 5. **Native Secret Management**: API keys and persistent secrets will be managed by keyring-rs through the Tauri sidecar, interfacing directly with the Windows Credential Manager and Linux Secret Service, ensuring secrets never rest in plain text on the disk.  
> 6. **Low-Latency Voice Pipeline**: The voice architecture will rely on Cartesia Sonic or ElevenLabs Flash for sub-100ms TTS latency, paired with offline whisper.cpp for cross-platform on-device dictation, bypassing OS-specific limitations.  
> 7. **Durable Goal Engine Integration**: Scheduled routines and webhooks will not spawn an independent task scheduler; they will inject synthetic events directly into the existing ECHO durable goal engine, triggering the Orchestrator's continuation driver.  
> 8. **Project-to-Fleet Thread Duality**: The data model will utilize a unified SQLite store where conversations possess a polymorphic scope attribute, allowing seamless UI navigation between project-specific Feature Implementation Documents (FIDs) and global fleet-wide commands.  
> 9. **WebGL-Accelerated Contextual Drawers**: Agent introspection will occur via slide-over contextual panels overlaid on the WebGL holographic deck, preventing context switching while monitoring specific sub-agent tool executions.  
> 10. **Noise-Protocol Mobile Pairing**: The iOS companion will pair entirely over the local network using mDNS discovery and the Noise protocol, eliminating the need for a centralized cloud account backend.

## **A. Product & UX Landscape**

The evolution of agent interaction models has moved rapidly from single-threaded conversational interfaces to multi-agent, persistent workspaces. Analyzing current implementations reveals divergent approaches to context management, tool visibility, and user cognitive load.

### **Landscape Analysis**

| Product / Framework | Interaction Model & Structure | Tool Rendering & Approvals | Documented Complaints & Limitations |
| :---- | :---- | :---- | :---- |
| **Grok Bot (xAI)** | Shared persistent cloud VM; bots act as named teammates collaborating in a unified workspace1. | Natural conversation OAuth; no explicit dry-run mode for actions3. | Lack of separate security boundaries between bots; high cost ($200/mo) for standalone access2. |
| **OpenMausBot** | Telegram-style UI; per-bot local CLIs; distinct channels per context4. | Inline Allow/Deny question cards; strict local permission broker4. | Voice mode restricted to macOS; webhook ingress requires the desktop app to remain active4. |
| **ChatGPT Tasks** | Monolithic interface; scheduled tasks run entirely within OpenAI's cloud environment. | Abstracted processing indicators; minimal granular visibility into tool sequences. | Vendor lock-in; inability to route sub-tasks to specialized open-source models; no local file access. |
| **Slack / Teams Agents** | Fleet-wide channels and direct messages; agent acts as a standard user entity within the tenant. | Thread replies for activity; OAuth via standard platform integration protocols. | High context fragmentation; difficult to trace multi-step autonomous reasoning within standard chat streams. |
| **Linear / Vercel** | Contextual side-drawers linked to specific deployment/issue entities. | Highly structured, read-only audit logs with distinct status colors and deterministic outputs. | Not optimized for bidirectional conversational chat; strictly an observability and audit surface. |

### **User Expectations and Cognitive Load**

Demonstrable user expectations for an "agents-as-contacts" model revolve heavily around specialization, resource allocation, and isolation. The prevailing demand is the ability to assign distinct underlying models to different agents based on the specific task requirements, preventing the inefficient use of expensive reasoning models on trivial tasks6. Users expect a coding agent (such as the Savant Forge) to retain a completely different context window, configuration, and model engine than a documentation agent (such as the Savant Scribe)6.  
Furthermore, users anticipate that these agents will operate persistently in the background. The interaction model must mirror a workplace hierarchy where the Orchestrator acts as a chief of staff, dispatching tasks to specialists and reporting back asynchronously, rather than forcing the user to juggle a dozen separate direct messages1. The paradigm of a single chat interface is insufficient; the interface must evolve into a management console. UX research indicates that users suffer from transcript blindness when complex tool payloads (such as raw JSON responses or dense stack traces) are dumped directly into the primary conversational timeline.

### **Project-Scoped vs. Fleet-Wide Duality**

To integrate project-scoped interactions alongside fleet-wide channels within a single messaging surface, the underlying data model must support polymorphic scoping. A standard workspace model, akin to Slack or Discord, forces a hard, impenetrable boundary between servers (projects) and DMs (fleet-wide commands). In the SavantCode environment, a unified SQLite schema is required to provide a seamless transition between contexts. Thread records must contain a scope\_type (ENUM: project, global) and a scope\_id.  
Navigationally, this is optimally represented by a collapsible dual-rail sidebar. The primary rail displays the 10-role ECHO roster (the fleet), allowing global, context-free commands (e.g., "Schedule a routine system diagnostic for the Detective"). The secondary rail, populated conditionally when a local project directory is active, displays the project-specific channels and active FIDs (Feature Implementation Documents) tracking the Perfection Loop8. When an agent is invoked within a project channel, the system automatically injects the project's protocol.config.yaml and codebase knowledge graph into the agent's context block, rendering the environmental setup entirely invisible to the user8.

### **Contextual Panel UX**

For monitoring autonomous agent activity, the traditional chat stream becomes rapidly polluted by tool execution logs and JSON payloads. The optimal UX pattern draws heavily from modern IDE debugger panels and Vercel's deployment drawers. When the Orchestrator spawns a sub-agent (e.g., the Detective entering the RED phase of the Perfection Loop), the main chat thread should display a single, compact, animated status component8.  
Clicking this status component triggers a contextual slide-over drawer overlaid upon the WebGL "holographic deck." This drawer provides a real-time, read-only view of the sub-agent's event stream. This includes raw tool inputs, diff generation, and the sequentialthinking engine's current active thought branch10. This satisfies the requirement to inspect what a specific agent is doing at a highly granular level without destroying the primary conversational context or requiring a disruptive window switch. The WebGL layer itself can render physical manifestations of this data, such as visualizing the codebase graph as a cluster of nodes when the Scout agent invokes the query\_blast\_radius tool10.

### **Architectural Recommendations: Product & UX**

* **Recommended Approach**: Implement a dual-rail navigation model backed by a polymorphic SQLite thread store, utilizing right-side slide-over drawers for deep-dive tool inspection, seamlessly integrated over the existing WebGL canvas.  
* **Second Choice**: A tabbed interface separating "Global Agents" and "Current Project." While easier to implement in React, this introduces higher friction during context switching and disrupts the illusion of a unified agentic team.  
* **Explicit Anti-Recommendation**: Do not render raw tool calls, extensive JSON payloads, or multi-step iterative thinking logs directly into the primary chat stream. This violates the cyberpunk aesthetic and rapidly overwhelms the user, leading to transcript blindness.

## **B. Computer-Use Subsystem**

The integration of computer-use capabilities represents the highest technical risk and the most substantial architectural leap required for the command surface. The system must broker interactions across local and virtual environments while maintaining the strict safety hygiene required by the ECHO protocol's 15 Laws.

### **Landscape Analysis**

| Technology Stack | Determinism & Safety | Latency & Protocol | Cost & OS Support | Licensing Model |
| :---- | :---- | :---- | :---- | :---- |
| **trycua / cua-driver** | High; background execution via UIA/MSAA; does not steal user focus11. | Low; direct local daemon execution via named pipes. | Free; Strong Windows/macOS; Linux via GNOME5. | Open-source (MIT/Apache compatible)13. |
| **Anthropic Computer Use** | Moderate; relies on generic VM sandboxing and coordinate clicks. | High; cloud-roundtrip required for screenshots and actions. | High API costs per token; N/A (Cloud only). | Proprietary API. |
| **Playwright MCP / Browser-use** | Very High (for web tasks); strictly bounded to DOM execution15. | Very Low (local CDP connection). | Free; Excellent cross-platform web support. | Open-source (MIT/Apache). |
| **E2B Cloud Sandboxes** | High; isolated persistent file systems and network access16. | Moderate; cloud execution overhead. | Pay-per-compute; N/A (Cloud Linux environments). | Open-source Core / Commercial SaaS. |

### **Host Control via UIAutomation (UIA)**

For a desktop application running natively on Windows and Linux, traditional computer-use agents rely on coordinate-based clicking and full-screen image capture. This renders the host machine unusable for the human operator while the agent works, as the agent continually steals window focus and hijacks the physical mouse pointer. The optimal architecture for a background-capable agent fleet leverages the trycua/cua-driver pattern.  
This approach utilizes OS-level accessibility trees (UIAutomation on Windows, AT-SPI on Linux, and Accessibility APIs on macOS) to execute actions transparently in the background11. By indexing elements via the accessibility tree, the agent can invoke programmatic interfaces such as TogglePattern or ValuePattern directly on UI controls without moving the physical mouse pointer or requiring the window to be in the foreground12. The SavantCode desktop app acts as a local broker, mounting the CUA daemon alongside the Tauri sidecar. This allows the Forge or Researcher agents to interact with native desktop applications while the human operator continues typing in another window.

### **Screen Preview and Streaming**

Providing live screen preview streaming from the agent's target environment (whether local background window or sandboxed Docker VM) into the React 19 WebView requires a highly optimized transport layer. While WebRTC is the industry standard for peer-to-peer video, its connection negotiation protocols (ICE/STUN/TURN) are vastly over-engineered and brittle for localhost loopback streaming.  
The superior protocol choice for a local-first desktop app is a continuous stream of H.264 frames transmitted over the existing JSON-RPC WebSocket, decoded natively by the WebCodecs API17. WebCodecs allows the React renderer to accept raw VideoFrame objects from the WebSocket payload and paint them directly onto an off-screen \<canvas\>, bypassing the heavy DOM overhead and buffering delays of standard \<video\> tags17. This achieves sub-16ms frame rendering, matching the 60fps refresh rate required by the cyberpunk WebGL environment.

### **Threat Modeling the Host-Control Path**

Brokering a system where an "agent drives THIS machine" requires a highly defensive threat model, significantly stricter than operating within cloud-sandboxed VMs. The primary vectors of attack are unauthorized data exfiltration, destructive file operations, and lateral network movement initiated by prompt injection or model hallucination.  
The Cua-driver architecture mitigates this by functioning as a strict intercepting proxy. The security model must implement the following safeguards:

> 1. **Strict Process Allowlisting**: The agent cannot interact with arbitrary processes (e.g., terminal emulators, password managers, or system settings). The driver must enforce a strict, user-configurable allowlist of targetable window classes.  
> 2. **Visual Consent Indicators**: When the agent interacts with a background window, the driver must paint a synthetic, transparent cursor over the target UI. This provides the user with an un-forgeable visual indicator of agent activity, remaining separate from the physical hardware cursor12.  
> 3. **Hardware Kill Switch**: The Tauri app must bind a global OS-level hotkey (e.g., Ctrl+Shift+Escape) that instantly severs the JSON-RPC connection to the Cua-driver and terminates the agent's execution loop, forcibly overriding any active sequentialthinking processes or queued actions.

### **Architectural Recommendations: Computer Use**

* **Recommended Approach**: Integrate a Rust-ported variation of the cua-driver UIA/accessibility-tree logic directly into the Tauri sidecar for non-blocking local host control. Use WebCodecs over WebSocket for screen rendering. For web-only tasks, utilize the Playwright MCP.  
* **Second Choice**: Confine all computer-use exclusively to Docker-based local VMs, relying on standard VNC/noVNC over WebSocket for interaction. This ensures safety but severely limits the agent's utility for local workflows.  
* **Explicit Anti-Recommendation**: Do not utilize cloud-based computer-use APIs (e.g., Anthropic's hosted computer-use instances) for local file-system or IDE manipulation. This violates the local-first security constraint, introduces severe latency penalties, and incurs prohibitive token costs for visual processing.

## **C. Voice Pipeline and Integration**

The integration of voice capabilities transforms the agent from a static text generator into an interactive, ambient companion. The architecture must handle sub-second latency, barge-in capabilities, and the highly complex translation of markdown-formatted coding output into natural speech.

### **Landscape Analysis**

| TTS Provider / Engine | Latency (Time to First Audio) | Cost per 1M Characters | Voice Quality & Cloning | Licensing & Deployment |
| :---- | :---- | :---- | :---- | :---- |
| **Cartesia (Sonic 3.5)** | \~82ms (State Space Model)18. | \~$35 \- $4919. | Excellent for conversational, real-time UX. | Commercial API; Hosted. |
| **ElevenLabs (Flash v2.5)** | \~75ms19. | $50 (PAYG API)19. | Industry-leading expressive cloning. | Commercial API; Hosted. |
| **OpenAI Realtime** | \~250ms (Native Speech-to-Speech)19. | \~$0.015/min (Audio out)19. | High; highly steerable style. | Commercial API; Hosted. |
| **Deepgram (Aura-2)** | \~90ms \- 200ms18. | $3020. | Optimized for high-throughput IVR. | Commercial API; Hosted. |
| **Piper / whisper.cpp** | Local execution variable based on hardware22. | Free (Compute Cost Only). | Robotic to moderate; no zero-shot cloning. | MIT / Open-source; Fully local/offline. |

### **Architectural Design for "Call My Agent"**

Achieving a truly conversational voice interface requires adhering to a strict physiological latency budget. Natural human conversation dictates a maximum round-trip time (from the moment the user stops talking to the moment the agent starts talking) of roughly 700ms; beyond one second, the interaction mimics a degraded telephone line19. This 700ms budget is rapidly consumed by network transport (\~100ms), Speech-to-Text (STT) processing (\~200ms), LLM Time-to-First-Token (\~200ms), and Text-to-Speech (TTS) Time-to-First-Audio (\~200ms)19.  
To achieve this, the architecture requires a persistent WebRTC or WebSocket audio stream. The local Tauri sidecar will utilize Voice Activity Detection (VAD) powered by a local WebAssembly module (e.g., Silero VAD). When the user speaks, the VAD triggers a "barge-in" event. This event instantly halts the active audio playback buffer and cancels the ongoing TTS streaming request, signaling the LLM to process the interruption contextually.  
For the STT pipeline on Windows and Linux, where native on-device dictation APIs are heavily fragmented and unreliable, the architecture will embed whisper.cpp. Running a quantized Whisper base or small model locally ensures near-zero network latency for the transcription phase and guarantees absolute privacy for ambient microphone data, ensuring the agent is not broadcasting background conversations to a cloud provider22.

### **Markdown Translation Heuristics**

A critical challenge for a coding agent is reading technical output aloud. Raw markdown containing code blocks, JSON payloads, or git diffs is entirely incomprehensible when spoken through a TTS engine. The system must implement a strict pre-processing heuristic pipeline before feeding text to the audio generator:

> 1. **Code Block Stripping**: Any content within triple backticks is stripped from the audio payload. The system injects a synthesized contextual cue, such as: *"I have written the implementation, which is thirty lines of TypeScript. I am displaying it in the chat now."*  
> 2. **Symbol Normalization**: Inline code snippets (e.g., git push \--force) are expanded into phonetic equivalents (e.g., "git push dash dash force").  
> 3. **Tool Narration**: When an agent executes a tool (e.g., code\_search or query\_blast\_radius), the TTS pipeline injects a non-blocking asynchronous audio cue, such as *"Searching the codebase for dependencies..."* This fills the acoustic dead air while the LLM awaits the tool response, maintaining the illusion of active presence.

### **Architectural Recommendations: Voice**

* **Recommended Approach**: Integrate Cartesia Sonic 3.5 or ElevenLabs Flash v2.5 for the TTS backend due to their sub-100ms Time-to-First-Audio18, paired with a locally embedded whisper.cpp instance for Windows/Linux STT dictation.  
* **Second Choice**: OpenAI Realtime API. While offering impressive native speech-to-speech reasoning, it binds the system strictly to a single provider's LLM ecosystem, fundamentally breaking the framework's model-agnostic architecture.  
* **Explicit Anti-Recommendation**: Do not attempt to read raw code, stack traces, or JSON outputs via TTS. The cognitive dissonance of hearing syntax formatting spoken aloud will immediately alienate the user and degrade the utility of the voice channel.

## **D. Schedules, Webhooks, and Triggers**

Automated routines and external triggers transform the agent from a reactive answering machine into a proactive system orchestrator. The engineering challenge lies in integrating these asynchronous events cleanly into the existing synchronous, perfection-loop-governed architecture without creating race conditions.

### **Trigger Attachment to the Durable Goal Engine**

SavantCode currently implements an event-sourced durable goal engine running on a finite state machine (active | paused | blocked | complete)10. Rather than building a parallel, standalone cron scheduler or task queue (which would fragment the source of truth for agent activity), all schedules and webhooks must act as edge-triggers that inject state transitions directly into this existing FSM.  
When a cron schedule fires or a webhook payload is received, the sidecar constructs a synthetic UserMessage containing the trigger payload and a system directive (e.g., \[SYSTEM TRIGGER: Webhook Received from GitHub PR \#42\]). This message is appended to the relevant agent's persistent thread, and the update\_goal tool is invoked mechanically by the backend. The Orchestrator’s continuation driver then evaluates the FSM, seamlessly resuming the paused goal context without requiring separate replay or deduplication logic. At-least-once semantics are guaranteed by the FSM's SQLite checkpointing; if the desktop application crashes during execution, the goal remains in the active state and resumes immediately upon reboot.

### **Ingress Architecture: Local Receivers vs. Hosted Relays**

Exposing a local desktop application to public webhooks (e.g., GitHub CI events, Stripe webhooks) requires traversing NAT and local firewalls. Traditional solutions like ngrok provide temporary, randomized URLs which are incompatible with persistent webhook configurations required by external services24.  
The optimal infrastructure relies on Tailscale Funnel. Tailscale Funnel securely exposes a local port to the public internet, terminating HTTPS on a stable, georeplicated \*.ts.net subdomain tied directly to the user's machine24. The Bun backend binds a dedicated webhook listener exclusively to 127.0.0.1:8800. The local Tailscale daemon proxies inbound traffic from the public Funnel URL directly to this localhost port, isolating it from the primary application API25.  
For secret handling, relying on static Capability URLs is insufficient due to the high risk of URL leakage in server logs. The webhook receiver must enforce Bearer token authentication4. The user provisions cryptographic webhook secrets within the desktop app; these secrets are validated via constant-time string comparison in the Bun sidecar before the payload is allowed to touch the SQLite event store or trigger the goal engine.

### **Architectural Recommendations: Triggers**

* **Recommended Approach**: Utilize Tailscale Funnel for persistent, TLS-secured public ingress to a local Bun listener, secured by Bearer tokens. Map all external triggers as synthetic event injections into the existing ECHO durable goal engine.  
* **Second Choice**: Cloudflare Tunnels (cloudflared), which provides similar stable URL routing but requires heavier external account configuration and domain management compared to Tailscale's zero-config node approach26.  
* **Explicit Anti-Recommendation**: Do not utilize ngrok for production webhook ingress due to its ephemeral URL lifecycle on standard tiers, which breaks external integrations upon every application restart24.

## **E. Mobile Companion Pairing & Streaming**

An iOS companion app extends the command surface beyond the desktop, allowing users to monitor autonomous tasks and approve elevated actions remotely. The architectural mandate prohibits the use of a centralized cloud account backend, necessitating a secure, peer-to-peer trust model.

### **Pairing Protocols**

To establish a secure cryptographic link between the iOS device and the desktop application without a cloud intermediary, the system will utilize a QR-code-based out-of-band key exchange utilizing the Noise Protocol Framework.

> 1. **Discovery**: The desktop application broadcasts its presence on the local network via Multicast DNS (mDNS / Bonjour).  
> 2. **Key Exchange**: The desktop app generates an ephemeral X25519 keypair and displays the public key, local IP, and port encoded within a QR code.  
> 3. **Handshake**: The iOS app scans the QR code, extracts the public key, and initiates a Noise XX handshake over the local network. Upon successful cryptographic validation, both devices exchange long-term identity keys, establishing a persistent trust bond.

If the user is operating outside the local LAN, the pairing and subsequent communication can route transparently over the user's personal Tailnet (Tailscale), preserving the peer-to-peer security model without relying on a Savant-controlled centralized cloud server.

### **Push Notifications**

Delivering push notifications (e.g., "Forge requires approval for shell execution") to an iOS device without a centralized cloud backend is structurally difficult due to Apple's strict APNs (Apple Push Notification service) requirements, which mandate a central provider certificate.  
To bypass a heavy cloud infrastructure while maintaining the local-first ethos, the system will utilize a self-hosted ntfy-class architecture. A minimal, open-source relay server (deployable via Docker or a lightweight free-tier cloud instance) will act solely as a blind APNs forwarder. The desktop app encrypts the notification payload using the iOS device's public Noise key and sends the encrypted blob to the relay. The relay forwards the encrypted blob to APNs. The iOS app receives the notification and decrypts it locally, ensuring the relay server never views the plaintext contents or agent activities.

### **Streaming Live Screen Frames**

Transmitting live screen frames (captured via the Cua-driver) to the mobile companion requires balancing bandwidth, latency, and battery consumption. In a purely local network environment, WebRTC negotiation is unnecessarily complex. Instead, the desktop application will serve a continuous Motion JPEG (MJPEG) stream over a standard HTTP connection.  
The Bun sidecar limits the capture rate to 5 frames per second, compresses the frames via a hardware-accelerated JPEG encoder, and streams them as a multipart/x-mixed-replace HTTP response. This requires negligible CPU overhead on the desktop and relies on highly optimized, battery-efficient native image decoding on the iOS device, ensuring security by routing the stream strictly over the authenticated Noise-protocol channel.

### **Architectural Recommendations: Mobile**

* **Recommended Approach**: Implement mDNS discovery with Noise protocol QR-code pairing. Use a blind, encrypted ntfy relay for push notifications, and MJPEG streaming over HTTP for low-overhead screen viewing.  
* **Second Choice**: Require users to install Tailscale on their mobile devices, utilizing Tailscale's direct IP routing to bypass mDNS and APNs entirely through persistent WebSocket long-polling.  
* **Explicit Anti-Recommendation**: Do not implement a centralized user-account database for pairing. This violates the local-only server trust model and introduces unnecessary compliance overhead4.

## **F. Security, Consent, and Trust Models**

The security posture of an autonomous coding agent dictates its viability. As agents gain the ability to execute shell commands, modify codebases, and interact with live databases, traditional "human-in-the-loop" safeguards rapidly degrade under the psychological weight of approval fatigue.

### **Defeating Approval Fatigue**

The current industry standard of asking the human operator to approve every action creates a severe vulnerability. When an agent requests approval for fifty consecutive read operations (e.g., read\_files, list\_directory), the human operator learns to reflexively click "Approve" without reading the prompt27. Consequently, when a destructive command (e.g., a malicious database drop or credential exfiltration) is subsequently proposed, it is rubber-stamped by the fatigued human. This renders a naive "Confirm Everything" policy less safe than a system that asks less but means it27.  
To ensure genuine safety, the consent surface must be designed as a **Load-Aware, Risk-Adaptive Policy**29. The system must mechanically filter what warrants human attention:

> 1. **Auto-Allow by Design**: All read-only operations and operations executing strictly within the isolated dev/fids/ or dev/scratchpad/ directories must be unconditionally auto-approved10. This eliminates the vast majority of trivial prompts, preserving the user's attention budget.  
> 2. **Destructive Write Gating**: Any operation that modifies the primary codebase (write\_file, apply\_patch) or executes a shell command (bash) outside of an explicitly sandboxed container is intercepted by the ECHO Harness Enforcement Layer (EHEL)9.  
> 3. **Contextual Audit UX**: When a prompt is escalated to the user, the UI must not present a generic "Allow/Deny" dialog. The inline card must display a rich, semantic diff of the proposed file change or the exact AST implications of the shell command, forcing cognitive engagement before the "Allow" button becomes active.

### **Secret Management**

Managing API keys, database credentials, and OAuth tokens within a local-first application requires strict adherence to OS-level security paradigms. Plaintext .env files or basic JSON configurations are insufficient against modern local malware, info-stealers, or path traversal vulnerabilities.  
The architecture will integrate the Rust keyring-rs library into the Tauri backend30. This library provides a unified, cross-platform interface to the native secure enclaves: the Windows Credential Manager on Windows, the Apple Keychain on macOS, and the Secret Service API (via dbus) on Linux30.  
When the user provisions a provider key via the UI (e.g., /provider openrouter), the React frontend passes the secret to the Tauri command layer. Tauri immediately writes the secret into the native OS keychain33. The React frontend state is then updated with a boolean is\_configured flag. The plaintext secret is strictly write-only from the perspective of the UI and is never rendered back to the DOM, effectively preventing memory scraping or accidental screen-share leakage4.

### **Architectural Recommendations: Security**

* **Recommended Approach**: Implement a risk-adaptive EHEL auto-allow policy to combat approval fatigue, reserving manual prompts exclusively for out-of-bounds destructive actions. Utilize keyring-rs for native OS secret management.  
* **Second Choice**: Encrypt a local SQLite database utilizing SQLCipher, deriving the encryption key from a user-provided master password at application boot.  
* **Explicit Anti-Recommendation**: Do not implement a "Confirm Everything" policy. It provides theatrical security while actively training the user out of the loop, leading directly to rubber-stamping vulnerabilities27.

## **Decision Matrices (D1–D4)**

### **Scoring Rubric**

*(Scores 1-5, where 5 is optimal. Weighted equally across Safety, Maintainability, Cost, DX (Developer Experience), and Longevity).*

### **D1: Event Transport (Typed Union vs. Namespaced Channels)**

| Option | Safety | Maint. | Cost | DX | Long. | Total | Justification |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Typed Event Union (Single Stream)** | 5 | 4 | 5 | 4 | 5 | **23** | **Selected.** SavantCode already relies on a strict PrintModeEvent discriminated union. Expanding this schema via zod-literals ensures all events (tool calls, audio cues, state changes) remain chronologically ordered in a single deterministic ledger, making replay and rewinding structurally sound23. |
| **Namespaced Event Channels** | 3 | 3 | 5 | 4 | 3 | **18** | Parallel WS channels (e.g., ws://.../chat, ws://.../system) introduce race conditions in the UI state and complicate the event-sourcing requirement of the durable goal engine. |

### **D2: Build-vs-Buy/Adapt Matrix**

| Subsystem | Recommendation | Licensing / Model | Justification |
| :---- | :---- | :---- | :---- |
| **Computer Use** | **Adapt** trycua daemon. | MIT13 | Building a UIA/accessibility hook from scratch is a multi-year effort. Adapting trycua into the Tauri sidecar provides immediate, non-blocking background host control without OS-level cursor hijacking. |
| **Voice (TTS)** | **Buy** Cartesia / ElevenLabs. | Commercial API | Sub-100ms TTS latency requires highly specialized state-space models (SSMs). Local generation (Piper) cannot meet the latency or quality requirements for a conversational UI. |
| **Webhook Ingress** | **Buy/Adapt** Tailscale Funnel. | Zero-config / Free | Building a reliable NAT traversal relay is complex. Tailscale provides a secure, TLS-terminated ingress path that requires zero local firewall manipulation24. |
| **Mobile Pairing** | **Build** Noise/QR. | Custom | Off-the-shelf cloud pairings violate the local-only trust model. Building a direct mDNS \+ Noise protocol handshake ensures cryptographic sovereignty. |

### **D3: Thread Data Model (Polymorphic vs. Fragmented)**

| Option | Safety | Maint. | Cost | DX | Long. | Total | Justification |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Polymorphic SQLite Store** | 5 | 5 | 5 | 4 | 5 | **24** | **Selected.** A single threads table with a scope\_type (fleet/project) allows the WebGL UI to query and render all activity efficiently. Moving a thread from project-scoped to fleet-wide is a simple row update. |
| **Separate Data Stores** | 4 | 2 | 5 | 3 | 3 | **17** | Separating fleet data from project data requires complex cross-database queries for unified dashboard rendering and duplicates schema migration efforts. |

### **D4: Trigger Attachment Points (Synthetic Goal Injection)**

| Option | Safety | Maint. | Cost | DX | Long. | Total | Justification |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **FSM Goal Injection** | 5 | 5 | 5 | 4 | 5 | **24** | **Selected.** Attaching webhooks directly into the existing ECHO durable goal engine via update\_goal eliminates the need for a separate task executor. The FSM inherently handles deduplication, retries, and persistence10. |
| **Standalone Task Queue** | 3 | 2 | 5 | 3 | 3 | **16** | Building a separate BullMQ-style queue alongside the ECHO FSM creates architectural redundancy and splits the source of truth for agent activity, violating the ZTAP ledger sequence. |

## **Risk Register: Top 10 Build Risks and Mitigations**

| \# | Risk Description | Impact | Probability | Mitigation Strategy |
| :---- | :---- | :---- | :---- | :---- |
| **1** | **Approval Fatigue Vulnerability:** Users blindly approve malicious command executions due to high prompt volume27. | Critical | High | Implement a strict EHEL risk-adaptive policy. Auto-allow non-destructive reads; require high-friction UI interactions for writes outside dev/fids/. |
| **2** | **CSWSH (Cross-Site WebSocket Hijacking):** Malicious local websites interface with the unguarded WebSocket port to execute commands36. | Critical | High | Enforce strict Origin header validation on the WS upgrade request. Mandate the exchange of the ephemeral Bearer token generated on app launch. |
| **3** | **Cua-Driver Host Instability:** Background UIA actions trigger unintended OS-level disruptions or infinite loops in native applications. | High | Medium | Implement strict process-class allowlists. Provide a hardcoded hardware kill switch (Ctrl+Shift+Escape) that bypasses the React UI to terminate the driver thread. |
| **4** | **Context Window Bloat:** Unbounded tool logs and JSON payloads rapidly exhaust the LLM's token context window. | High | High | Implement progressive L0-L3 auto-compaction (summarize old turns, compress tool results). Strip raw JSON into semantic summaries before appending to the context block9. |
| **5** | **Voice Barge-in Failure:** Echo cancellation fails, causing the agent to transcribe its own TTS output and create infinite conversation loops. | Moderate | High | Implement strict hardware-level echo cancellation and aggressive WebRTC VAD thresholding to physically mute the STT buffer during active TTS playback. |
| **6** | **Tauri 300-Line File Limit Breach:** Complex WebGL rendering logic or event routing exceeds the strict 300-line-per-file architectural ceiling23. | Low | High | Enforce rigorous modularity. Extract WebGL shader chunks, React context providers, and JSON-RPC dispatchers into highly focused, single-responsibility files. |
| **7** | **Webhook Replay Attacks:** Adversaries capture and replay Tailscale Funnel ingress payloads to trigger redundant agent actions. | High | Medium | Enforce mandatory timestamps and cryptographic nonces in the webhook payload headers, validated by the Bun sidecar before goal engine injection. |
| **8** | **Secret Extraction via Memory Dump:** Plaintext API keys extracted from the Bun process memory by local info-stealer malware. | Critical | Low | Keep secrets stored securely in keyring-rs until the exact moment of HTTP request construction. Overwrite memory buffers immediately after use. |
| **9** | **Mobile mDNS Discovery Failure:** Corporate networks or restrictive firewalls block UDP multicast, breaking mobile pairing procedures. | Moderate | Medium | Provide a fallback manual pairing option requiring the user to type the local IP address and Noise public key displayed on the desktop UI. |
| **10** | **ECHO Protocol Deviation:** The Orchestrator agent attempts to bypass the FID-bound execution process to write code directly. | Critical | Medium | Maintain the mechanical EHEL tool-gate. The tool executor must unconditionally reject write\_file requests from the Orchestrator unless operating in Hybrid mode on simple tasks or within the dev/fids/ directory10. |

## **Full Source List**

*Note: References are compiled from the provided research materials, prioritizing primary documentation and repositories.*

> 1. 23  
>    : Command-Deck Master Plan Takeover (FID-2026-0823-012) – Savant Desktop Architecture.  
> 2. 34  
>    : Cyberpunk Holographic WebGL Research – High-Performance WebGL Architecture.  
> 3. 8  
>    : ECHO Protocol v0.2.0 – Savant Agent Bootstrap and 10-Role Roster.  
> 4. 9  
>    : SavantCode Product Overview (README.md) – Feature Inventory and Telemetry.  
> 5. 7  
>    : AGENTS.md – Agent directory and tooling mapping.  
> 6. 10  
>    : ARCHITECTURE.md – Savant-Code ECHO Protocol Agent Architecture and Tool Gating.  
> 7. 4  
>    : OpenMausBot Open Source Alternatives Profile – Interaction model and architecture.  
> 8. 5  
>    : OpenMausBot GitHub Repository – Open Source Alternative to Grok Bot.  
> 9. 6  
>    : AISEOInsider Reddit Thread – "Free Open Source Apps Let Every Agent Have Its Own Brain."  
> 10. 6  
>     : AISEOInsider Reddit Thread – Discussion on model specialization per agent role.  
> 11. 11  
>     : LocalLLaMA Reddit Thread – "Open source multi-cursor background computer-use" (trycua).  
> 12. 12  
>     : trycua Blog – "Inside Windows Computer Use" (UIA/MSAA interaction models).  
> 13. 13  
>     : cua.ai Documentation – Background computer-use driver for native desktop apps.  
> 14. 14  
>     : npm registry – @trycua/cua-driver.  
> 15. 4  
>     : OpenMausBot Open Source Alternatives Profile – Webhook triggers and permission broker.  
> 16. 4  
>     : OpenMausBot Open Source Alternatives Profile – MacOS voice restrictions.  
> 17. 5  
>     : OpenMausBot GitHub Repository – Computer Use, Voice, and iOS Companion.  
> 18. 19  
>     : ForaSoft Blog – "Synthetic Voice Library Apps" (TTS Latency and Pricing 2026).  
> 19. 18  
>     : MarkTechPost – "Best Text-to-Speech (TTS) Models in 2026."  
> 20. 21  
>     : Coval AI Blog – "Best Text-to-Speech Providers in 2026" (Latency and Cartesia Sonic analysis).  
> 21. 20  
>     : Speechify Blog – OpenAI Realtime vs Speechify and Cartesia Sonic pricing.  
> 22. 19  
>     : ForaSoft Blog – "What's the Real Latency Budget for a Voice Agent?" (700ms budget breakdown).  
> 23. 18  
>     : MarkTechPost – Cartesia Sonic 3.5 SSM architecture and latency metrics.  
> 24. 22  
>     : University of Illinois Physics – whisper.cpp and Piper TTS latency testing.  
> 25. 1  
>     : MindStudio Blog – "What is Grok Bot?" (Shared persistent cloud VM analysis).  
> 26. 1  
>     : MindStudio Blog – Grok Bot shared workspace and inter-bot coordination.  
> 27. 2  
>     : Vellum AI Blog – "Official Grok Bot Breakdown" (Persistent cloud execution model).  
> 28. 3  
>     : Eesel AI Blog – Grok Bot shared browser sessions and lack of distinct security boundaries.  
> 29. 27  
>     : mrMr Blog – "Approval fatigue and human-in-the-loop AI."  
> 30. 27  
>     : mrMr Blog – "Confirm everything is a fake kind of safety."  
> 31. 28  
>     : arXiv:2606.08919 – "Oversight Has a Capacity: Calibrating Agent Guards to a Subjective, Fatiguing Human."  
> 32. 37  
>     : arXiv:2606.15549v1 – "Command Denylist Fragility" and 93% user rubber-stamping rate.  
> 33. 28  
>     : arXiv:2606.08919 – Analysis of agent oversight as a resource-allocation problem.  
> 34. 38  
>     : arXiv:2606.08919v1 – Reviewer fatigue as an attack surface and flooding vulnerabilities.  
> 35. 29  
>     : arXiv:2605.24309v1 – "Risk-adaptive approval" and bidirectional scope adjustment for AI agents.  
> 36. 39  
>     : awesome-video GitHub – MJPEG vs H.264 stream encoding capabilities.  
> 37. 15  
>     : skill-of-skills GitHub – Playwright MCP vs trycua and E2B comparisons.  
> 38. 16  
>     : Agent Switchboard – Browser & Computer Use (Playwright MCP, Cua, E2B).  
> 39. 40  
>     : Tailscale Documentation – "Funnel vs Sharing" (Webhook testing via public routing).  
> 40. 24  
>     : Chris Shennan Blog – "Tailscale as an ngrok / local tunnel / Cloudflare Tunnel alternative."  
> 41. 25  
>     : Tailscale Blog – "Introducing Tailscale Funnel."  
> 42. 26  
>     : Dev.to / MechCloud Academy – "Cloudflare Tunnel vs ngrok vs Tailscale."  
> 43. 30  
>     : keyring-rs Documentation (docs.rs) – Rust keyring ecosystem overview.  
> 44. 31  
>     : keyring-rs Wiki – Naming and storing secrets via native credential stores.  
> 45. 32  
>     : open-source-cooperative GitHub – keyring-rs and secret-service-rs repositories.  
> 46. 33  
>     : npm @dreamshive/better-auth-tauri – Exposing keyring-rs via custom Tauri commands.  
> 47. 17  
>     : Chrome Developer Docs – WebCodecs and MediaStreamTrackProcessor for low-latency canvas rendering.  
> 48. 36  
>     : aw-junaid/bug-bounty GitHub – WebSocket Exploitation and CSWSH vulnerabilities.  
> 49. 41  
>     : arXiv:2608.18733v1 – JSON-RPC implementation over MCP.  
> 50. 35  
>     : SimpleClaw Gateway API – Binary framing protocol and JSON-RPC over WebSocket.  
> 51. 36  
>     : aw-junaid/bug-bounty GitHub – Testing for Cross-Site WebSocket Hijacking (CSWSH).

#### **Works cited**

> 1. What Is Grok Bot? xAI's Install-and-Go AI Agent Explained | MindStudio, [https://www.mindstudio.ai/blog/what-is-grok-bot](https://www.mindstudio.ai/blog/what-is-grok-bot)  
> 2. Official Grok Bot Breakdown (2026), [https://www.vellum.ai/blog/official-grok-bot-breakdown](https://www.vellum.ai/blog/official-grok-bot-breakdown)  
> 3. Grok Bot explained: what xAI's always-on AI teammates actually do \- eesel AI, [https://www.eesel.ai/blog/grok-bot](https://www.eesel.ai/blog/grok-bot)  
> 4. OpenMausBot: Open Source Alternative to Grok Bot and Lindy AI, [https://www.opensourcealternatives.to/item/openmausbot](https://www.opensourcealternatives.to/item/openmausbot)  
> 5. GitHub \- milind-soni/OpenMausBot: Open Source Alternative to Grok Bot with a virtual machine that bots can use, [https://github.com/milind-soni/OpenMausBot](https://github.com/milind-soni/OpenMausBot)  
> 6. Free Open Source Apps OpenMausBot Runs AI Agents With Different Models \- Reddit, [https://www.reddit.com/r/AISEOInsider/comments/1vpjy48/free\_open\_source\_apps\_openmausbot\_runs\_ai\_agents/](https://www.reddit.com/r/AISEOInsider/comments/1vpjy48/free_open_source_apps_openmausbot_runs_ai_agents/)  
> 7. AGENTS.md  
> 8. ECHO.md  
> 9. README.md  
> 10. ARCHITECTURE.md  
> 11. Open source multi-cursor/background computer-use (Codex-like) using Hermes Agent \+ Qwen3.6-35B-A3B-4bit \+ Cua-Driver : r/LocalLLaMA \- Reddit, [https://www.reddit.com/r/LocalLLaMA/comments/1suux6h/open\_source\_multicursorbackground\_computeruse/](https://www.reddit.com/r/LocalLLaMA/comments/1suux6h/open_source_multicursorbackground_computeruse/)  
> 12. cua/blog/inside-windows-computer-use.md at main · trycua/cua \- GitHub, [https://github.com/trycua/cua/blob/main/blog/inside-windows-computer-use.md](https://github.com/trycua/cua/blob/main/blog/inside-windows-computer-use.md)  
> 13. Cua: Scale computer fleets for computer-use agents, [https://cua.ai/](https://cua.ai/)  
> 14. @trycua/cua-driver | npm | Open Source Insights \- Deps.dev, [https://deps.dev/npm/%40trycua%2Fcua-driver](https://deps.dev/npm/%40trycua%2Fcua-driver)  
> 15. the911fund/skill-of-skills: The autonomous discovery engine for AI coding tools. Indexes skills, plugins, MCP servers, agents, and integrations across Claude Code, Codex, Gemini CLI, and more. \- GitHub, [https://github.com/the911fund/skill-of-skills](https://github.com/the911fund/skill-of-skills)  
> 16. Browser & Computer Use AI Agents | Agent Switchboard, [https://agentswitchboard.dev/categories/browser-computer](https://agentswitchboard.dev/categories/browser-computer)  
> 17. Video processing with WebCodecs | Web Platform \- Chrome for Developers, [https://developer.chrome.com/docs/web-platform/best-practices/webcodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs)  
> 18. Best Text-to-Speech TTS Models in 2026: A Benchmark-Based Comparison \- MarkTechPost, [https://www.marktechpost.com/2026/05/30/best-text-to-speech-tts-models-in-2026-a-benchmark-based-comparison/](https://www.marktechpost.com/2026/05/30/best-text-to-speech-tts-models-in-2026-a-benchmark-based-comparison/)  
> 19. Text to Speech API: 6 Best Libraries Compared (2026) \- Fora Soft, [https://www.forasoft.com/blog/article/synthetic-voice-library-apps](https://www.forasoft.com/blog/article/synthetic-voice-library-apps)  
> 20. The 6 best OpenAI TTS alternatives for developers, tested July 2026 \- Speechify, [https://speechify.ai/alternatives/openai](https://speechify.ai/alternatives/openai)  
> 21. Best TTS Providers 2026: Why Vendor Benchmarks Lie \- Coval, [https://www.coval.ai/blog/best-text-to-speech-providers-in-2026-how-to-choose-(and-why-vendor-benchmarks-lie)/](https://www.coval.ai/blog/best-text-to-speech-providers-in-2026-how-to-choose-\(and-why-vendor-benchmarks-lie\)/)  
> 22. Design Document \- Google Docs, [https://courses.physics.illinois.edu/ece445/getfile.asp?id=24367](https://courses.physics.illinois.edu/ece445/getfile.asp?id=24367)  
> 23. 2026-0823-2328-command-deck-master-plan-handoff.md  
> 24. Tailscale as an ngrok / local tunnel / Cloudflare Tunnel alternative \- Chris Shennan, [https://chrisshennan.com/blog/tailscale-as-an-ngrok-local-tunnel-cloudflare-tunnel-alternative](https://chrisshennan.com/blog/tailscale-as-an-ngrok-local-tunnel-cloudflare-tunnel-alternative)  
> 25. Tailscale Funnel: Securely Expose Local Services to the Internet, [https://tailscale.com/blog/introducing-tailscale-funnel](https://tailscale.com/blog/introducing-tailscale-funnel)  
> 26. Cloudflare Tunnel vs. ngrok vs. Tailscale: Choosing the Right Secure Tunneling Solution, [https://dev.to/mechcloud\_academy/cloudflare-tunnel-vs-ngrok-vs-tailscale-choosing-the-right-secure-tunneling-solution-4inm](https://dev.to/mechcloud_academy/cloudflare-tunnel-vs-ngrok-vs-tailscale-choosing-the-right-secure-tunneling-solution-4inm)  
> 27. Approval Fatigue: Why "Confirm Everything" Breaks Human-in-the-Loop AI \- mrmr, [https://getmrmr.com/blog/approval-fatigue](https://getmrmr.com/blog/approval-fatigue)  
> 28. Oversight Has a Capacity: Calibrating Agent Guards to a Subjective, Fatiguing Human \- arXiv, [https://arxiv.org/pdf/2606.08919](https://arxiv.org/pdf/2606.08919)  
> 29. Reframing LLM Agent Security as an Agent–Human Interaction Problem \- arXiv, [https://arxiv.org/html/2605.24309v1](https://arxiv.org/html/2605.24309v1)  
> 30. keyring 4.1.6 \- Docs.rs, [https://docs.rs/crate/keyring/latest](https://docs.rs/crate/keyring/latest)  
> 31. Keyring · open-source-cooperative/keyring-rs Wiki \- GitHub, [https://github.com/open-source-cooperative/keyring-rs/wiki/Keyring](https://github.com/open-source-cooperative/keyring-rs/wiki/Keyring)  
> 32. open-source-cooperative \- GitHub, [https://github.com/open-source-cooperative](https://github.com/open-source-cooperative)  
> 33. @dreamshive/better-auth-tauri \- npm, [https://www.npmjs.com/package/@dreamshive/better-auth-tauri](https://www.npmjs.com/package/@dreamshive/better-auth-tauri)  
> 34. Cyberpunk Holographic WebGL Research.md  
> 35. API Overview \- SimpleClaw, [https://asundar43-simpleclaw.mintlify.app/api/overview](https://asundar43-simpleclaw.mintlify.app/api/overview)  
> 36. bug-bounty/methodologies/web penetration/WebSocket Exploitation.md at main \- GitHub, [https://github.com/aw-junaid/bug-bounty/blob/main/methodologies/web%20penetration/WebSocket%20Exploitation.md](https://github.com/aw-junaid/bug-bounty/blob/main/methodologies/web%20penetration/WebSocket%20Exploitation.md)  
> 37. CmdNeedle: Measuring the Incompleteness of Command Denylists for AI Agents \- arXiv, [https://arxiv.org/html/2606.15549v1](https://arxiv.org/html/2606.15549v1)  
> 38. Oversight Has a Capacity: Calibrating Agent Guards to a Subjective, Fatiguing Human, [https://arxiv.org/html/2606.08919v1](https://arxiv.org/html/2606.08919v1)  
> 39. awesome-video/README.md at master \- GitHub, [https://github.com/krzemienski/awesome-video/blob/master/README.md](https://github.com/krzemienski/awesome-video/blob/master/README.md)  
> 40. Funnel vs. sharing devices · Tailscale Docs, [https://tailscale.com/docs/reference/funnel-vs-sharing](https://tailscale.com/docs/reference/funnel-vs-sharing)  
> 41. 1Introduction \- arXiv, [https://arxiv.org/html/2608.18733v1](https://arxiv.org/html/2608.18733v1)