# Agents-as-Contacts Command Surface — Gemini Deep Research Prompt

> **What this is:** the finalized prompt for a Gemini Deep Research run (2026-08-24).
> Copy everything below the horizontal rule into Gemini Deep Research as-is.
>
> **Attachments to include with the run** (working-tree state that may be thin or absent
> on GitHub; attachments win over crawled files where they conflict):
>
> 1. `dev/session-summaries/2026-0823-2328-command-deck-master-plan-handoff.md`
>    (prerequisite state, Amendment Gate G1–G4, P1–P6 sequencing)
> 2. `docs/design/Savant Visual Workspace Architecture.md` (deck blueprint)
> 3. `docs/design/Cyberpunk Holographic WebGL Research.md` (renderer research)
>
> **Post-run plan:** fold the report into a master + child FID suite mirroring the desktop
> chain pattern, then run the full Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL) on
> the plan before any implementation. Placement decision already converged: the suite
> MERGES INTO the existing chat workspace (-010) as regions, not a separate screen.

---

# Deep Research Request: Agents-as-Contacts Command Surface — Product & Technical Landscape Report

## Role

You are a senior product-and-architecture researcher. Produce a single comprehensive report
that will inform the FULL build (no phased MVP) of an "agents-as-contacts" command surface
inside an existing AI-coding-agent desktop app. The goal is NOT to clone any existing product
but to identify the best patterns, stacks, and security models for each capability class,
evaluated against our specific constraints below.

## Our system (fixed constraints — evaluate everything against these)

- **SavantCode**: an open AI coding agent (CLI + SDK + desktop app) with a governed
  multi-agent runtime ("ECHO Protocol"): a fixed 10-role agent roster (Orchestrator,
  Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe, Adversary),
  structured sub-agent spawning with typed event streams, a Perfection Loop governance FSM,
  machine-readable implementation documents (FIDs), Ed25519-signed provenance receipts,
  lifecycle hooks, and a durable goal engine.
- **Desktop app**: Tauri v2 shell (WebView2/WebKitGTK) + Bun single-file sidecar backend;
  JSON-RPC over localhost WebSocket bridge (ephemeral port + bearer token); React 19
  renderer; zustand ^5 state; plain CSS driven by a generated design-token pipeline (dark
  cyberpunk identity: near-black #050508, neon cyan #18faf9, terminal-native aesthetics);
  strict TypeScript; hard 300-line-per-file ceiling; Windows + Linux first (macOS deferred).
- **Existing chat workspace**: a project-scoped conversation view with structured event
  rendering (tool calls, diffs, approvals) is already built. We are EVOLVING this workspace —
  adding an agent roster rail, cross-project "fleet" channels, and contextual panels — NOT
  building a separate screen. A WebGL "holographic deck" visualization layer over the same
  event stream already exists as an ambient watch-mode; the workspace is the act-surface.
- **Already native (do not recommend third-party replacements without strong
  justification)**: agent delegation hierarchy; permission/approval modes; durable scheduled
  goals; lifecycle hook system; an integration marketplace API (Composio-class + a provider
  discovery index).

## Reference product to outperform

OpenMausBot (open-source, Apache-2.0) — a Telegram-style chat app where every contact is a
real AI agent running on local CLIs. Its capability inventory (our parity target):

1. **Agents-as-contacts roster**: pin/unread/rename/context menus, per-agent profiles &
   avatars, channels per context with per-channel instructions/working folders/rosters.
2. **Per-agent model/engine selection** with mid-conversation switching; driver SPI
   normalizing CLI engines (claude/codex/grok) into one canonical event stream (HTTP
   commands + one SSE fan-in).
3. **Computer use**: cloud Linux desktops w/ live screen preview, Docker-based local VMs,
   host control (macOS + guarded Ubuntu GNOME via Cua driver 0.20), BYO-VPS backends;
   screenshots folded into transcripts; observation/benchmark harnesses.
4. **Permission broker**: inline Allow/Deny/question cards, auto-approve heuristics with
   sensitive-command detection, peer approvals between bots, decision logs, repeat-action
   detectors, turn watchdogs.
5. **Connected apps marketplace** (500+ apps via Composio Sessions; OAuth once).
6. **Voice**: ElevenLabs TTS readouts, hands-free call mode, on-device dictation (macOS).
7. **Routines**: one-off/weekday schedules feeding a queued task executor with calendar
   receipts; webhook triggers via a dedicated localhost receiver (bearer secrets +
   capability URLs, relay-friendly for public delivery).
8. **iOS companion**: QR/token pairing, transcripts, search, approvals, settled + live
   screen frames.
9. **Team library**: shareable multi-agent team manifests from GitHub + a public bot
   directory.
10. **Safety hygiene**: secret write-only storage with redaction, local-only server trust
    model, no-shell-spawn discipline, atomic writes, NDJSON thread logs + SQLite message
    store with full-text search.

## Primary sources

### OpenMausBot (public reference — crawl these)

- Repo: <https://github.com/milind-soni/OpenMausBot>
- Driver SPI + canonical event stream: `server/contracts.ts`, `server/drivers/`
- Permission broker & safety: `server/auto-approve.ts`, `server/redact.ts`, `SECURITY.md`
- Computer use: `docs/computer-use-integration.md`, `docs/byo-vps.md`,
  `third_party/cua-driver/`
- Voice: `docs/voice-mode.md`, `server/tts/`
- Routines/webhooks: `server/routines.ts`, `server/webhook-ingress.ts`
- Mobile companion: `docs/ios-companion.md`

### SavantCode (public — crawl these; this is the system being extended)

- Repo: <https://github.com/savant0x/savant-code>
- Product overview: `README.md`, `docs/features.md`
- Agent roster + runtime architecture: `ARCHITECTURE.md`, `agents/savant/`, `ECHO.md`
  (skim §Agent Roster and §Hybrid Mode only — full protocol ceremony is out of scope)
- Desktop app (the surface being evolved): `desktop/`,
  `docs/design/Savant Visual Workspace Architecture.md`,
  `docs/design/Cyberpunk Holographic WebGL Research.md`
- Gateway event contracts: `common/src/types/print-mode.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/`
- Existing primitives to reuse: durable goal engine
  (`packages/agent-runtime/src/run-agent-step/goal-driver.ts`), hook system
  (`docs/design/hook-system.md`), Composio integration (`sdk/src/composio.ts`),
  design-token pipeline (`packages/design-systems/`)
- Provider/model layer: `packages/llm-providers/`

Note: both repositories evolve continuously; where a crawled file conflicts with documents
attached to this prompt, the attachments reflect the current working state and win.

## Research questions

### A. Product & UX landscape

1. Survey the current (2025–2026) landscape of agent-messaging products (Grok's bot
   companion, OpenMausBot, ChatGPT tasks/scheduled agents, Claude/Anthropic surfaces,
   character-companion apps, Slack/Teams agent integrations). For each: interaction model,
   roster/channel structure, how they render tool activity and approvals, monetization, and
   documented user complaints.
2. What do users demonstrably expect from "talk to your agents like contacts"? Cite UX
   research, changelogs, community feedback (HN/Reddit/GitHub issues) — not speculation.
3. Patterns for project-scoped ↔ fleet-wide channel duality in one messaging surface (Slack
   workspace/DM models, Discord servers, Linear teams): data models and navigation patterns.
4. Best-in-class slide-over/contextual panel UX for "inspect what this specific agent is
   doing right now" anchored to a thread (IDE debugger panels? Vercel/Linear deployment
   drawers?).

### B. Computer-use subsystem (largest technical gap)

5. Compare 2026 computer-use stacks: Anthropic computer-use API, OpenAI Operator/CUA,
   trycua/cua (driver+VM images), browser-use, Playwright MCP, E2B/cloud sandboxes,
   Docker-desktop VM images, self-hosted VPS patterns. Score: determinism, safety,
   streaming screenshot latency, cost, Windows/Linux support, license (no GPL).
6. Live screen-preview streaming to a WebView: protocol choices
   (MJPEG/WebRTC/H.264-over-WS/frame diffing), typical latencies, and input-injection
   security models.
7. How should a desktop app safely broker "agent drives THIS machine" vs sandboxed VMs?
   Threat-model the host-control path (screen capture consent, per-action approval, kill
   switches) using Maus's documented approach and any superior published designs.

### C. Voice

8. 2026 TTS/voice-pipeline comparison (ElevenLabs, Cartesia, Deepgram Aura, OpenAI
   Realtime, Piper/local): latency, cost per minute, voice cloning quality, licensing,
   offline options.
9. Architectures for "call my agent" (barge-in, turn-taking, tool-narration while speaking)
   and for reading long markdown agent output aloud pleasantly (rewriting heuristics).
10. On-device dictation options on Windows + Linux (whisper.cpp, OS-native APIs) —
    accuracy/latency.

### D. Schedules, webhooks, triggers

11. Patterns mapping external triggers (cron schedules, inbound webhooks, email, CI events)
    onto an EXISTING durable-goal/task engine rather than a standalone scheduler — prior
    art, pitfalls (missed runs, dedup, replay, at-least-once semantics).
12. Local webhook receivers vs hosted relays (Tailscale Funnel, Cloudflare Tunnel, ngrok,
    smee): secret handling (bearer vs capability URLs), rotation, replay protection, and
    what ships in production agent products today.

### E. Mobile companion

13. Pairing protocols for phone↔desktop-local-app (QR + token, noise-prefixed handshakes,
    mDNS vs relay rendezvous) with NO cloud account backend — survey shipped
    implementations.
14. Push notification paths for a local-first app without always-on cloud (APNs/FCM via
    minimal relay vs polling vs self-hosted ntfy-class) and their tradeoffs.
15. Streaming live agent screen frames + approval actions to mobile: bandwidth, battery,
    security.

### F. Security & trust models

16. Consent-surface design for agent actions: evidence on approval-fatigue, smart
    batching/auto-allow policies with sensitive-command classifiers, audit-log UX. What
    survives hostile review?
17. Secret management for local-first agent apps (write-only APIs, redaction layers, OS
    keychains) — best published patterns beyond "config file with 0600".

## Decisions we need from you (recommendation matrix per item, with tradeoffs table)

- **D1 — Event transport:** extending one typed event union (single stream,
  schema-governed amendments) vs a parallel namespaced event channel over the same
  WebSocket — which pattern do comparable systems use, and which ages better under strict
  schema evolution rules?
- **D2 — Build-vs-buy/adapt per subsystem:** computer use, voice, webhook ingress, mobile
  pairing, screen streaming — with license compatibility constraints (Apache-2.0/MIT
  preferred, GPL excluded, "ideas-not-ports" discipline for Apache references).
- **D3 — Thread data model** supporting both project-scoped and fleet-wide conversations
  in one store.
- **D4 — Trigger attachment points:** where routines/webhooks should attach to an existing
  goal-engine + hooks substrate.

## Deliverable format

1. Executive summary (≤500 words) with a top-10 decisions list.
2. Section per capability class (A–F): landscape table with citations, recommended
   approach, second choice, and explicit anti-recommendations.
3. Decision matrices D1–D4 with scoring rubric (safety, maintainability, cost, DX,
   longevity).
4. Risk register: top 10 risks across the full build with mitigations.
5. Full source list with URLs; prefer primary docs/changelogs/code over blogspam; flag
   anything where evidence is thin (<2024 sources or vendor claims only).