# Session Summary — Desktop App Research & Planning (2026-08-19)

**Date:** 2026-08-19
**Status:** In progress — research complete, plan presented for operator confirmation

## Initial state

- Repo: Savant-Code v0.0.26 (in development, unreleased) on `main`; active FID queue empty.
- Boot: single-agent ECHO v0.1.2 (`dev/echo-v0.1.2-single-agent.md`) read 0-EOF; protocol.config.yaml loaded; TypeScript standards loaded.

## Task

Build a desktop app for Savant-Code. Research three reference implementations first
(Hermes Desktop, OpenHands, AionUI), then produce a solid plan. Operator also floated
a self-contained Gemini deep-research prompt as an input to planning.

## Research findings (2026-08-19)

- **Hermes Desktop** (`resources/hermes-agent/apps/desktop`, Nous Research, MIT):
  the polished reference. Electron 40 + React 19 + Vite + Tailwind 4 +
  `@assistant-ui/react`. Backend = headless `hermes serve` process exposing a
  `tui_gateway` JSON-RPC/WebSocket API; renderer connects through `apps/shared`.
  Backend resolution ladder (env → checkout → managed install → PATH → Python →
  bootstrap installer). node-pty/xterm terminal, voice, file browser, previews,
  i18n ×4, built-in updater. electron-builder DMG/zip/NSIS/MSI/AppImage/deb/rpm.
- **OpenHands Agent Canvas** (`resources/OpenHands/electron`, MIT): the thin
  wrapper. Electron BrowserWindow loads `http://localhost:8000` (web UI);
  main process spawns agent-server (Python via uvx) + static server + ingress
  proxy. Frameless loading splash with boot-log IPC console + failure states.
  Bundles uv + a Node.js distro as extraResources and injects them into PATH.
  afterPack hook strips the ~600 MB hoisted node_modules and restores a ~200 KB
  runtime closure (final artifact ~10 MB). Graceful shutdown kills child process
  groups (Windows quirk handled via `process.emit('SIGTERM')`).
- **AionUI** (`resources/AionUi`, iOfficeAI, Apache-2.0): the heavyweight.
  Electron 37 + electron-vite + React 19 + UnoCSS + Arco; strict main/renderer
  split with preload IPC bridge. Built-in agent engine (AionCore/aionrs) PLUS
  external CLI agents (Claude Code, Codex, Hermes, OpenClaw…) driven over ACP
  (Agent Client Protocol). SQLite local store, WebUI remote mode, Telegram/Lark/
  DingTalk/WeChat channels, cron tasks, MCP management, preview panel, team mode.
- **Key constraint:** Savant's agent-runtime is **Bun-bound** (`bun:sqlite` in
  production: sqlite-adapter, graph-adapter, teacher store; database tools throw
  under Node). A desktop shell (Electron/Node) cannot embed the runtime
  in-process — the backend must run as a Bun subprocess with a JSON-RPC/WS bridge
  (Hermes model + OpenHands bundled-binary trick).

## Decisions (2026-08-19, operator)

- **Shell:** defer — run deep research first (Electron vs Tauri for this
  pattern) before committing.
- **V1 scope:** full chat app (Phases 0-4) — session gateway, Electron shell,
  React chat UI with tool activity/diff/terminal, packaging.
- **Research prompt:** yes, draft it. **Done** —
  `dev/scratchpad/desktop-app-deep-research-prompt.md` (self-contained;
  operator attaches ECHO.md / ARCHITECTURE.md / README.md / protocol.config.yaml).

## Planned work

1. Operator runs the deep-research prompt in Gemini Deep Research; brings
   back the verdicts.
2. Fold the research verdicts into the architecture FID + design doc.
3. [Post-approval] Begin Phase 1 (headless server mode / session gateway in
   the CLI).

## Dependencies / open questions

- Operator decisions: Electron vs Tauri vs alternative; v1 scope; deep-research
  prompt execution; Savant-Free relationship (desktop for the paid CLI only?).
- No FIDs created yet — planning-only phase; nothing implemented.
