<!-- markdownlint-disable MD013 MD003 MD041 -->

---

title: Savant Command Center
date: 2026-08-09
author: Nova
status: planning
requested_by: Spencer
consumed_by: harness model (designs FIDs)
source_research: docs/design/ (3 Gemini Deep Research passes)
fids_emitted: []
---

# Build Order: Savant Command Center

**Date:** 2026-08-09
**Requested by:** Spencer
**Author:** Nova
**Status:** PLANNING — research complete, awaiting operator approval to enter Phase 1

---

## 1. Overview

The Savant Command Center is a Next.js localhost web dashboard that visualizes
the governance layer of Savant-Code's multi-agent AI coding harness. It is a
read-only observation tool — a "looking glass" — that transforms ECHO's
invisible enforcement into real-time visual evidence.

**Stack:** Next.js 15, React 19, TypeScript, Zustand, Tailwind CSS,
Sigma.js/Graphology, d3-dag, WebSocket (Bun), OpenTelemetry GenAI conventions.

**Non-negotiable constraints:**

- Localhost only. Zero cloud. Zero external services.
- Read-only. No approval buttons, no force-skip, no control of agent execution.
- ECHO is non-negotiable. No feature bypasses any of the 15 laws.
- If the dashboard crashes, the agent continues unaffected. Zero coupling.
- Cyberpunk aesthetic. Neon-on-dark, monospace, data-dense, chamfered HUD edges.

## 2. Research Foundation

Three Gemini Deep Research passes were completed and archived in
`docs/design/`:

| Document | Purpose |
|----------|---------|
| `Visual Workflows For Savant-Code.md` | Initial exploration of Kestra/n8n design philosophy for ECHO retrofit |
| `Savant Command Center Design Concept.md` | First-pass design: vision, 8 panels, cyberpunk palette, MVP scope |
| `Command Center Design Sprint.md` | Refined design: browser-only Next.js, 8 panels, 8 novel features, developer intelligence engine, export system, MVP definition |

The Design Sprint document is the authoritative baseline for all FIDs.

## 3. Phased Build Order

### Phase 1: Telemetry Pipeline + Governance Cockpit MVP (Weeks 1-3)

**Goal:** Prove that multi-agent governance is visible in real-time.

**FID-1A: Agent Runtime Telemetry Instrumentation**

- Instrument `agent-runtime` to emit OpenTelemetry GenAI spans
- Custom attributes: `gen_ai.agent.name`, `gen_ai.fsm.phase`,
  `gen_ai.system.state` (EHEL allow/deny)
- Spans emitted for: FSM transitions, tool calls (with EHEL decisions),
  agent spawns, token usage per phase
- Wire `tool-executor.ts` to emit allow/deny events with law citations

**FID-1B: WebSocket Telemetry Server**

- Bun-native WebSocket pub/sub server launched alongside CLI
- Topic-based routing: `ws/fsm` (phase changes), `ws/ehel` (tool decisions),
  `ws/telemetry` (token burn, agent activity)
- Zero-coupling: server is independent of agent execution lifecycle

**FID-1C: Next.js 15 Dashboard Shell**

- New workspace package: `packages/command-center/`
- Next.js 15 App Router with dark cyberpunk layout
- Design system: JetBrains Mono, color tokens (#050508, #00FBFF, #39FF14,
  #FF00FF, #FFB000, #FF003C, #8A8D98), chamfered clip-path geometry
- WebSocket client with exponential backoff reconnection
- Zustand store with requestAnimationFrame ring buffer (60Hz drain)
- React 19 concurrent rendering for non-critical panels

**FID-1D: Agent Roster Console Panel**

- 10-agent grid + 6 infrastructure helpers
- Active agents pulse with Neon Cyan; idle dim to Muted Chrome
- Each tile: role, FSM phase, token sparkline, active tool icons
- Hover tooltip: parent-child delegation tree

**FID-1E: EHEL Enforcement Inspector Panel**

- Scrolling virtualized ledger of every tool call attempt
- Color-coded: Electric Green (allowed), Amber Alert (denied), Neon Red (fatal)
- Bold ECHO law citation on denials
- Click-to-expand payload modal for denied entries
- DOM virtualization for burst scenarios (50+ rapid denials)

**FID-1F: Perfection Loop FSM DAG Panel**

- Horizontal d3-dag graph: IDLE → RED → GREEN → AUDIT → ADVERSARIAL →
  SELF-CORRECT → COMPLETE
- Current state pulses, edges illuminate history
- SELF-CORRECT loops highlighted in Amber Alert
- Iteration counter vs hard-stop of 10
- Click node → filter Execution Timeline (Phase 2)

**Deliverable:** Working localhost dashboard proving multi-agent operation,
FSM enforcement, and EHEL gating are all visible in real-time.

---

### Phase 2: Temporal Observation (Weeks 4-6)

**Goal:** Historical data visualization — see what happened and when.

**FID-2A: Execution Timeline Panel**

- Horizontal Gantt with swim lanes per agent
- Canvas/WebGL rendering for thousands of spans (60fps scrubbing)
- Color-coded by event type: reasoning, file mods, web research, adversarial
- Scroll-wheel zoom: macro session view to micro tool-call trace
- Click event → expand payload panel

**FID-2B: FID Kanban Panel**

- 5 columns: Created, RED, GREEN, AUDIT, Closed
- Cards: FID ID, severity, target file, iteration count
- Dependency edges as glowing SVG lines across columns
- Adversary override = flashing alert icon on card
- Filesystem watcher on `dev/fids/` for live updates

**FID-2C: Session Replay Engine**

- Record all OTel spans as JSONL during session
- Replay controls: play/pause/scrub/speed (1x, 2x, 5x, 10x)
- All panels sync during replay (FSM walks backward, kanban resets, etc.)
- `.savant-replay` file format: compressed OTel JSONL, drag-and-drop import
- Works offline without original codebase access

**Deliverable:** Full temporal observation — scrub through any session,
see exactly what happened when, replay complete agent reasoning chains.

---

### Phase 3: Codebase Topology (Weeks 7-10)

**Goal:** Connect governance to the physical code.

**FID-3A: Knowledge Graph Panel**

- Sigma.js/Graphology WebGL canvas
- SQLite data from `packages/knowledge-graph` piped into renderer
- ForceAtlas2 layout in Web Worker (non-blocking)
- Node coloring by recent agent activity
- Click node → see which agents touched it, which FIDs modified it

**FID-3B: Blast Radius Superposition**

- During RED phase, Detective's `query_blast_radius` projects heatmap
- Directly affected files: bright red glow
- 2nd/3rd degree dependencies: fading amber aura
- Visual impact prediction before Forge writes

**FID-3C: Law 4 Reachability Tracers**

- Verifier's call-graph grep visualized as animated tracers
- Tracers travel from modified function up through imports to entry points
- Dead end = path shatters in Neon Red (code is orphaned)
- Live proof of call-graph reachability compliance

**FID-3D: Code Universe Overlay**

- Extend existing 3D Code Universe with live telemetry
- Files pulse when modified by Forge
- Agent paths trace through 3D graph as comet particles
- Verifier reachability shown as animated edges

**Deliverable:** Full codebase visualization with governance overlay — see
which agents touched what, where code is reachable, and what the blast
radius of every change is.

---

### Phase 4: Intelligence and Advanced Features (Weeks 11-14)

**Goal:** Make the dashboard think, not just show.

**FID-4A: Adversarial Arbitration Matrix**

- THE ONE FEATURE. Split-screen during ADVERSARIAL phase.
- Left: Verifier claims in Neon Cyan with line citations
- Right: Adversary analysis streaming in Hot Magenta
- Physical strike-throughs on refuted claims
- Electric Green override badges on confirmed refutations

**FID-4B: Developer Intelligence Engine**

- Oscillation detection: circular fix-fail loops flagged
- Adversary efficacy benchmarking: override rate tracked per session
- Token burn anomaly: disproportionate reasoning flagged with tooltip
- Enforcement vulnerability heatmaps: which laws the model struggles with

**FID-4C: Export and Sharing System**

- Branded Code Universe HTML export (existing `/graph-export`)
- Execution Flow SVG generation (snapshot any panel as SVG)
- Compliance ledger export (CSV/JSON of EHEL enforcement log)
- `.savant-replay` files shareable via inbox/outbox system

**FID-4D: Context Window Topography Map**

- Stacked area chart of token distribution
- Categories: System Prompt, Tool Schemas, File Contents, Tool Results,
  Pruned Context
- Real-time compaction visualization across 4 progressive layers

**FID-4E: Additional Novel Features**

- Phantom Node Projection (semi-transparent future file nodes)
- Levenshtein Circuit Breaker Gauge (filling pressure gauge at 10% cap)
- Oscillation Web (edges thicken/vibrate on recursive loops)
- Sequential Logic Inspector (Thinker's branching thought tree)

**Deliverable:** Full Command Center with intelligence, novel features,
export system, and all 8 novel visualizations operational.

---

## 4. Governance Flags

No changes to ECHO.md are required. The Command Center is purely additive —
a new package that consumes existing telemetry. All 15 laws remain
non-negotiable. The dashboard enforces read-only observation by design
(no WebSocket messages from client → server except the initial connection).

If the telemetry pipeline requires new event types in the agent-runtime,
those are additive spans, not protocol changes.

## 5. Dependencies

**New packages:**

- `packages/command-center/` — Next.js 15 dashboard app

**New dependencies (command-center only):**

- `@d3/dag` — FSM and execution trace rendering
- `@react-sigma/core` + `@react-sigma/layout-forceatlas2` — knowledge graph
- `zustand` — high-frequency state management
- `sigma` + `graphology` — WebGL graph rendering
- Tailwind CSS (already in ecosystem)

**Leveraged existing packages:**

- `@savant-code/agent-runtime` — OTel span emission source
- `@savant-code/knowledge-graph` — SQLite graph data for Sigma.js
- `@savant-code/code-map` — tree-sitter AST data

## 6. Sequencing Notes

- Each FID within a phase can be implemented sequentially or in parallel
  (multiple Forge agents) per operator discretion.
- Phase 1 MVP must be fully operational before Phase 2 begins — it
  establishes the telemetry pipeline that all subsequent phases consume.
- Phase 3 depends on Phase 1 telemetry + Phase 2 timeline for the
  knowledge graph to have activity data to overlay.
- Phase 4 is additive features that can be deferred indefinitely —
  the Command Center is useful and complete after Phase 3.
