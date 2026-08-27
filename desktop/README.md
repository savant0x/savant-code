# Savant Desktop Shell

Tauri v2 workspace implementing FID-2026-0820-009 (Phase 2 of the desktop
program, master FID-2026-0820-007): a Rust supervisor that owns the
Bun-compiled agent-runtime sidecar lifecycle and hosts the React 19 renderer.

## Layout

| Path | Purpose |
| ---- | ------- |
| `src-tauri/` | Rust supervisor: sidecar spawn/backoff/shutdown/watchdog |
| `src/` | React 19 renderer entry (chat UI is FID-2026-0820-010 scope) |
| `scripts/build-sidecar.ts` | `bun build --compile` sidecar targets renamed to the Rust target triple |
| `scripts/generate-design-tokens.ts` | Materializes the design-system contract into renderer tokens (`gen:tokens`) |
| `src-tauri/src/webview_check.rs` | Pre-webview WebView2 detection + native recovery dialog (Windows) |

## Commands

> **Build the sidecar BEFORE any `cargo` command:** `tauri.conf.json` declares
> `bundle.externalBin`, so tauri-build hard-fails while
> `src-tauri/binaries/savant-sidecar-$TRIPLE[.exe]` is absent (the directory is
> gitignored). CI does this automatically.

```sh
bun run --cwd=desktop typecheck      # renderer + scripts typecheck
bun run --cwd=desktop test           # script unit tests + real-sidecar E2E (build:sidecar first)
cargo test --manifest-path src-tauri/Cargo.toml   # supervisor unit tests
bun run --cwd=desktop build:sidecar --entry <gateway-entry> --target bun-windows-x64
bun run --cwd=desktop gen:tokens     # rematerialize renderer design tokens
bun run --cwd=desktop tauri dev      # full shell in dev mode
```

## Security invariants

- The gateway bearer token is delivered to the sidecar via the
  `SAVANT_GATEWAY_TOKEN` environment variable only — never argv, never disk,
  never logs.
- The ephemeral gateway port is passed as the `--port=<ephemeral>` CLI arg.
- The renderer receives the port + token through Tauri IPC state only —
  never localStorage, never query strings.
- WebView CSP is restrictive (`tauri.conf.json` → `app.security.csp`); no
  arbitrary navigation.
- On Windows, a pre-webview gate checks the WebView2 Runtime before any JS;
  if absent, a native dialog offers the official installer page and the
  shell exits.

## Sidecar contract

The supervisor consumes the frozen FID-2026-0820-008 handshake contract:
JSON-RPC 2.0 over localhost WebSocket, `hello` first frame with
`protocolVersion: 1`, reserved error codes `-32001..-32004`. The gateway is
`cli/src/server-command.ts` (FID-2026-0820-008), compiled into the sidecar by
`scripts/build-sidecar.ts`; the parent-kill/handshake E2E lives in
`scripts/sidecar-e2e.integration.test.ts`.
