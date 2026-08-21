# FID: Chat UI (Structured, No Terminal)

**Filename:** `FID-2026-0820-010-chat-ui-structured-no-terminal.md`
**ID:** FID-2026-0820-010
**Severity:** high
**Status:** created
**Created:** 2026-08-20 19:04
**Parent:** FID-2026-0820-007

---

## Summary

Implement the React 19 chat UI: structured event rendering, native diff viewers, ECHO governance
visualization, and inline approvals. NO xterm.js, NO PTY — verification output renders as structured
transcript blocks. Phase 3.

## Environment

- **Renderer:** React 19, Tailwind CSS v4, Zustand + Immer state sync over the WS bridge
- **Bridge:** FID-2026-0820-008 gateway (JSON-RPC/WS). Renderer-side counterpart of the 2026-08-21
  security fold-in: the port + token arrive via Tauri IPC setup state ONLY — never localStorage, never
  query strings; the WS client connects only to `ws://127.0.0.1:<port>` from the platform WebView origin
  registered by FID-009 (`tauri://localhost` / `http://tauri.localhost` / dev origin), which FID-008's
  server-side allowlist expects
- **Commit/State:** main @ v0.0.26 (working tree)

## Detailed Description

### Problem

The desktop app needs a chat UI that renders streaming multi-agent transcripts, tool-call cards, diffs,
approval prompts, and ECHO governance state — entirely from structured events, with no terminal emulation
(operator requirement).

### Expected Behavior

- Streaming assistant text with markdown + syntax highlighting; virtualized message list for long sessions
- Structured tool-call cards (inputs/outputs); verification command output (typecheck/lint/test) rendered as
  styled transcript blocks, NOT a terminal emulator
- Native side-by-side/unified diff viewer (added/removed line tinting per the design system)
- Perfection Loop phase stepper (RED/GREEN/AUDIT/ADVERSARIAL/COMPLETE) with per-agent visual identity
- Inline approval cards for Law 2 + anti-deferral gate (Approve/Reject buttons; stream halts until
  resolved). Cards surface the FID-008 approval lifecycle: pending approvals are restored on reconnect
  via state-sync, and a gateway shutdown resolves them fail-closed (deny + recorded)
- Thinker sequential-thinking accordion (thought timeline, revisions, branches)
- EHEL intervention cards; context-compaction progress indicator
- Auto Drive dashboard (dependency graph of FIDs, emergency halt)
- Three-pane layout per the design doc: left sidebar (sessions), center canvas (chat), right sidebar (governance telemetry)
- Neon Slate design system (near-black #050508 + cyan #18faf9) ported to CSS

### Root Cause

No chat UI exists. The canonical blueprint defines the full UI architecture and explicitly discards PTY/terminal rendering.

### Evidence

- Design doc: `docs/design/Savant Desktop App Architecture.md` — UI, governance visualization,
  and interactive-elements sections
- Operator decision (2026-08-20): no terminal interface

## Impact Assessment

### Affected Components

- `desktop/src/renderer/` — components, hooks, stores
- Repo gates — every new TSX file subject to the 300-line absolute ceiling, max 50-line functions,
  eslint --max-warnings 0; decompose by design

### Risk Level

- [x] High: complex UI state, React 19 concurrent edge cases, quality-ceiling discipline across many new files

## Proposed Solution

### Approach

Build the Zustand/Immer store synced to the WS gateway; map each event schema to a dedicated component.
Enforce the 300-line ceiling by splitting per-component from the start.

### Steps

1. Renderer scaffold (React 19 + Tailwind v4 + Zustand/Immer WS sync)
2. Chat thread: markdown renderer, syntax highlighting, virtualization
3. Tool-call cards + structured verification transcript blocks
4. Diff viewer component
5. Phase stepper + agent identity visuals
6. Approval cards (Law 2 + anti-deferral halt)
7. Thinker accordion, EHEL cards, compaction indicator
8. Auto Drive dashboard + emergency halt
9. Component + interaction tests

### Verification

- `bun run --cwd=desktop typecheck` passes; eslint/prettier clean
- Quality report: zero new 300-line violations from desktop files
- Interaction tests: approval flow halts/resumes stream; phase stepper transitions; diff rendering
- App-level E2E follows the master FID-007 driver matrix (Loop 2, 2026-08-21): `tauri-driver` on
  Windows/Linux, `@wdio/tauri-service` on macOS; the tests in this FID stay renderer-local (component +
  interaction) and do not own the desktop E2E harness

## Perfection Loop

### Loop 1 — RED

- **Pre-RED review fold-in (2026-08-21):** operator-requested review amendments applied before RED:
  renderer-side token handling (Tauri IPC only — Environment), approval cards surface the FID-008
  approval lifecycle (Expected Behavior), E2E ownership cross-reference (Verification), folded decisions
  recorded below. RED/GREEN/AUDIT/ADVERSARIAL remain not yet run and will audit this amended spec. Master
  FID-007 Loop 2 records the Manifest Sync.
- **RED:** Not yet run — this FID awaits its implementation-planning session.
- **GREEN:** Not yet run.
- **AUDIT:** Not yet run.
- **ADVERSARIAL:** Not yet run.
- **CHANGE DELTA:** N/A — no document edits beyond planning scaffolding + the pre-RED fold-in above.

### Missed Questions

Not yet conducted — the Loop 1 RED/GREEN missed-questions pass runs with the
implementation-planning session. Questions already answered at authoring
time: Tailwind CSS v4 must be declared in `package.json` before GREEN (it is
absent from every workspace today — master ISSUE-007); the 300-line absolute
ceiling applies to every new desktop TSX file with no exemptions; the event
surface consumed is the FID-2026-0820-008 gateway schema family.

Folded in 2026-08-21 (operator-review, pre-RED): the renderer receives the
gateway port + token via Tauri IPC setup state only (never localStorage or
query strings) and connects from the platform WebView origin registered in
FID-009; approval cards render the FID-008 approval lifecycle (halt until
resolved, restored on reconnect, fail-closed on gateway shutdown); app-level
E2E ownership and the driver matrix live in the master FID-007 Verification
section (tauri-driver on Windows/Linux, @wdio/tauri-service on macOS), not
here.

### Code Verification Evidence

Planning-stage record — status `created`: no implementation exists yet.

- Renderer prerequisites verified against the working tree 2026-08-20:
  React 19 (`cli/package.json:49`) and Zustand 5 (`cli/package.json:62`) are
  present; Tailwind CSS v4 is declared in this FID but absent from every
  checked `package.json` (master FID-007 Loop 1 tool evidence) — the
  dependency-declaration rule applies before GREEN.
- Gate output: none yet — `bun run --cwd=desktop typecheck`, eslint, and the
  quality report (zero new 300-line violations from desktop files) become
  the implementation AUDIT gates.

## Step Status

- [ ] Renderer scaffold + WS store
- [ ] Chat thread + virtualization
- [ ] Tool cards + transcript blocks
- [ ] Diff viewer
- [ ] Phase stepper + approvals
- [ ] Thinker/EHEL/compaction visuals
- [ ] Auto Drive dashboard
- [ ] Tests passing

## Resolution

Not closed. This FID is in the authored state (status `created`); its
Perfection Loop and implementation are gated on the master FID-2026-0820-007
Commit Gate (design doc + five suite FIDs committed to main). This section
records the closed date, fix description, tests added, and verification
evidence when the phase closes.
