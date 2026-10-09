# Session Handoff — 2026-10-09

This file is a continuation cue, not a crash dump. If you are re-opening this
work in a different CLI tool, read this first, then the session summary it
points at.

## Where things stand

- Branch `main`, **ahead of `origin/main` by 9 commits** (all local-only per
  operator instruction — ask before pushing; a release push is planned).
- **Working tree: clean.** All work committed. Release pre-audit passes
  except one non-blocking warning (backup marker `f929e97846f6` behind HEAD —
  the staleness threshold is an open operator decision).
- **No active FID; no open register items from this session.** T176 (the nova
  icon merge) was closed and evicted from `SCOPE.md` in the closing pass;
  `dev/fids/` holds only archived records. The CLI icon-integration program
  (below) is the next work — it has no FID yet, by operator decision
  ("close this and make a handoff").
- The pre-push battery (credential scan, typecheck ×4 workspaces, full test
  suite, eslint, prettier) has **not** run against this tree — it fires at
  push time. Run it once before the release push.

## The icon family (the live asset thread)

- **132 hand-authored SVGs** in `art/icons/cyberpunk/`, one flat family,
  single manifest `manifest.json` v3.0.0 — 16 categories: identity-mark 2,
  echo-agent 10, variation-mark 5, protocol-mark 5, phase-mark 8, run-mark 4,
  tool-glyph 20, status-indicator 13, command-mark 15, dev-object-mark 15,
  cyberpunk-motif 15, sidebar-section 6, activity-indicator 4, nav-glyph 4,
  alert-glyph 4, toggle-glyph 2.
- **Palette contract:** `ICON_PALETTE` in
  `cli/src/utils/theme-system/icon-palette.ts` — six tokens (cyan/magenta/
  blue/white + green `#3dff9a` verification + acid `#f3e600` caveat).
  Enforced by `bun run icon-palette:check`
  (`scripts/icon-palette-check.ts`): every SVG uses only declared tokens and
  the manifest palette matches the module exactly.
- **FSM vocabulary** (documented in the manifest's `vocabulary` block): the
  ECHO Perfection Loop is authoritative for `phase-*` marks
  (idle → red → green → audit → self_correct → complete); `run-*` marks carry
  the generic run lifecycle (active/error/fix/done); `phase-implement` is the
  GREEN implementation sub-mark; `phase-archive` is the FID-archival duty.
- Merge evidence summary:
  `dev/session-summaries/2026-10-09-nova-icon-merge.md`

## The next work: CLI icon integration (no FID yet — create one)

The icons are **unwired source assets** (the manifest's integration block:
status "not yet wired into a CLI surface", decision: operator). The operator
asked for a FID for the full CLI integration ("it'll be a massive process")
and deferred it into this handoff. The map below is the RED-phase surface
census, verified against the live CLI this session — start the FID from here.

### The render-path constraint (decide first)

The CLI is an OpenTUI terminal UI — **SVG cannot render natively**.
`cli/src/utils/terminal-images.ts` detects iTerm2 / Kitty / sixel protocols
and emits escape sequences from **base64 PNG only**. So:

- **TUI surfaces need SVG→PNG rasterization.** `jimp` is a dependency but
  cannot parse SVG. Options: a new pure-WASM rasterizer dependency (e.g.
  `@resvg/resvg-js`), build-time PNG generation committed alongside the SVGs,
  or defer the TUI wiring.
- **HTML-export surfaces need nothing** — SVG inlines directly into HTML.
  That is the zero-friction first phase.

### Surface census (verified file paths)

| Icon family | Landing surface | Evidence |
|---|---|---|
| `sidebar/*` | The sidebar **already has an icon rail** — `cli/src/components/sidebar-rail.tsx`, `sidebar-rail-control.tsx`, breakpoint logic at `cli/src/chat/use-chat-derived.ts` ("the sidebar is now breakpoint-driven (icon rail…)") | direct structural fit |
| `activity/*`, `phase-*` | Pure display functions `sidebarActivity()` / `sidebarPhase()` in `cli/src/components/right-sidebar-display.ts` — currently text renderers, swap-in points | FSM vocabulary already resolved |
| `identity/logo*` | `cli/src/branding/constants.ts` (reads `art/savant-logo.png` — "single source of truth"), `cli/src/branding/utils.ts` (logo sheen), sidebar header `cli/src/components/right-sidebar-header.tsx` ("logo + tagline"), easter-egg wordmark `cli/src/components/savant-ui/easter-egg-logo.tsx` (currently ASCII art) | logo upgrade path |
| `status/*`, `alerts/*`, `toggles/*`, `nav/*` | Presence display via `cli/src/state/presence/presence-mapper.ts` (+ `presence-wire.ts`), agent stack `cli/src/components/savant-ui/echo/agent-stack.tsx`, `agent-status.tsx` | state-driven surfaces |
| all | `/export` HTML report — `cli/src/commands/export-conversation.ts` inlines the logo + Font Awesome as base64 today; graph-export HTML the same | `cli/src/constants/savant-logo.ts` (`SAVANT_LOGO_PNG_BASE64`) is the inlining pattern |

### Proposed phases

1. **Phase 1 — HTML export (zero rasterization).** Inline the SVGs into
   `/export` and graph-export HTML. Fastest visible integration, no new deps.
2. **Phase 2 — TUI surfaces.** Sidebar rail sections, `sidebarActivity` /
   `sidebarPhase`, presence mapper — gated on the rasterization decision
   above.
3. **Phase 3 — identity.** Logo into branding constants, sidebar header,
   easter-egg wordmark.

### Open decisions for the FID

1. **Rasterization:** new dependency (`@resvg/resvg-js`) vs build-time PNG
   generation vs TUI deferred to a later phase.
2. Palette, FSM vocabulary, and dedup are already resolved — see the
   manifest's `vocabulary` block and `ICON_PALETTE`.

## What this session did (arc)

1. Restored the operator's 2026-10-08 open-register repair from the
   scratchpad backup and resolved the T173/T174 collision (the KiosAPI
   window-table remainder vs the icon set) — commit `dbe37704`.
2. Landed the T174 icon-set milestone: the manifest rewritten to index all
   102 SVGs (v2.0.0), the session summary lint-fixed — commit `480d3e89`.
3. Cleared the dirty tree for the release with telemetry commits
   (`cf574b86`, `7ddf13c9`).
4. Reviewed the completed nova surface set — four findings: the palette gap
   (green/acid undeclared), the FSM vocabulary collision, manifest nits, and
   semantic overlap with the cyberpunk set.
5. Closed T176: merged all 32 nova icons into the single cyberpunk family
   (132 icons, manifest v3.0.0); fixed the palette gap via the
   `icon-palette.ts` extraction (the inline addition had pushed
   `palette.ts` to 305 lines, over the 300-line quality ceiling); resolved
   the vocabulary (`run-*` rename with corrected aria-labels,
   `phase-archive` preservation, nova winning the overlapping status
   slots) — commit `694ea34e`.
6. Resolved the Law-4 call-graph block on `ICON_PALETTE` with
   `scripts/icon-palette-check.ts` — the export now has a verified
   production consumer and the manifest's palette citation is
   machine-enforced — commit `fbe35029`.
7. Closed T176 (evicted from the register) and wrote this handoff.

Earlier in the session, also: FID-2026-1009-001/002/003 — the every-boot
"credentials changed" false positive, the context-meter zero reset, and the
auto-compact silent-before-overflow recovery — implemented in `f56020b7`,
G2-closed and archived in `462ce338`.

## Pending after handoff

1. **The release push** (operator-planned). The tree is clean and the
   pre-audit passes; run the pre-push battery once first, then push. The
   backup-marker staleness warning is non-blocking, but the operator may
   want to refresh the marker first.
2. **Create the CLI icon-integration FID** from the map above — the operator
   scoped it as "a massive process"; the rasterization decision is the
   first gate.
3. **Visual spot-check of the merged family** — structure, palette, and
   self-containment are machine-verified, but no rasterizer exists on the
   box, so pixel appearance has never been seen. Render a sample (logo,
   phase marks, sidebar sections) in a browser before the TUI phase.

## Recurring tool pain (carried forward)

- `str_replace` overlapping replacements corrupted files mid-batch — prefer
  `write_file` for whole-block rewrites.
- `run_readonly_command` rejects `;`, `||`, and `$()` — keep commands plain.
- The defence-in-depth hook blocks terminal file mutations (`cp`/`mv`) —
  use write tools; `git add`/`git commit` via basher work in green phase.
- The Law-1/Law-3 gates track `read_files` reads and direct-channel
  verification only — terminal `cat` does not register; run verification
  via `run_readonly_command` when the harness asks for credit.
- Large `write_file` payloads hit the output cap — write in chunks via
  `str_replace` appends.

## Pointers

- Merge evidence summary:
  `dev/session-summaries/2026-10-09-nova-icon-merge.md`
- Icon family: `art/icons/cyberpunk/` (132 SVGs + `manifest.json` v3.0.0)
- Palette contract: `cli/src/utils/theme-system/icon-palette.ts` +
  `bun run icon-palette:check`
- Governing protocol: `ECHO.md` (v0.2.0)
- Scope register: `SCOPE.md`
- FID ledger: `dev/fids/README.md`