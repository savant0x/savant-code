# Pattern: code_search

> Auto-maintained by the session-end review (FID-2026-0912-003).
> Mechanical distillation of a recurring failure pattern — update-only;
> never auto-deleted. Not read into agent context at boot.

- **Tool:** code_search
- **Dedup key:** `sha256:df4380614e9c1497717f7e4c771255ecb758fc0e52f236f52fa8c3d4a3b34eab`
- **Sample line:** `Failed to execute ripgrep at "…": ENOENT: no such file or directory, uv_spawn 'C:/Users/spenc/dev/savant-code/node_modules/@savant-code/sdk/dist/vendor/ripgrep/x64-win32/rg.exe'. Repair with 'bun run --cwd=sdk fetch-ripgrep' or set SAVANT_CODE_RG_PATH.`
- **Recurrences (14d window):** 4 (total 4)
- **First seen:** 2026-10-02T02:02:44.455Z
- **Last seen:** 2026-10-04T21:58:52.035Z
- **Routing:** promote via FID when resolved+verified (hybrid routing rule)

## Evidence

- 2026-10-05 — recurrences 4 (total 4), first 2026-10-02, last 2026-10-04
