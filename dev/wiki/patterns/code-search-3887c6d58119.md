# Pattern: code_search

> Auto-maintained by the session-end review (FID-2026-0912-003).
> Mechanical distillation of a recurring failure pattern — update-only;
> never auto-deleted. Not read into agent context at boot.

- **Tool:** code_search
- **Dedup key:** `sha256:3887c6d58119e8f8176bc9e91c1b659c49202addb3ba4da7b8b0775f0feb0b9b`
- **Sample line:** `Failed to execute ripgrep: ENOENT: no such file or directory, uv_spawn 'C:/Users/spenc/dev/savant-code/node_modules/@savant-code/sdk/dist/vendor/ripgrep/x64-win32/rg.exe'. Vendored ripgrep not found; ensure @savant-code/sdk is up-to-date or set SAVANT_CODE_RG_PATH.`
- **Recurrences (14d window):** 13 (total 13)
- **First seen:** 2026-09-10T06:24:22.507Z
- **Last seen:** 2026-09-17T17:34:03.712Z
- **Routing:** promote via FID when resolved+verified (hybrid routing rule)

## Evidence

- 2026-09-17 — recurrences 13 (total 13), first 2026-09-10, last 2026-09-17
