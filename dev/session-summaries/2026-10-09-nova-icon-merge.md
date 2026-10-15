# Nova icon-set merge into the cyberpunk family — 2026-10-09

## Authorization and scope

Operator review of the completed nova surface set (32 SVGs at
`~/dev/nova/savant-icons/`) followed by the directive: "merge all into a
single dir, not the nova-dir, then fix all issues, accept all
suggestions." Registered as SCOPE.md T176 (automation level 2, write
surface `art/icons/cyberpunk/**` + `cli/src/utils/theme-system/**` +
this summary) before the first write.

## Review findings (all resolved in this pass)

1. **Palette gap (real defect).** The nova manifest declared four tokens
   (cyan/magenta/blue/white) but the SVGs used six — green `#3dff9a`
   (17 uses: verification/complete marks) and acid-yellow `#f3e600`
   (7 uses: partial/warning marks) were undeclared and absent from the
   theme. Fixed: `ICON_PALETTE` added to
   `cli/src/utils/theme-system/icon-palette.ts` (new module — the
   addition pushed `palette.ts` to 305 lines over the 300 ceiling, so
   the tokens were extracted to their own home, the sidebar-reset
   pattern), and the manifest palette block now declares all six with
   `paletteSources` citing the module.
2. **FSM vocabulary collision (design question).** Nova's `fsm/phase-*`
   used a generic run-lifecycle vocabulary (idle/active/complete/error/
   audit/fix/done); the ECHO Perfection Loop is
   idle→red→green→audit→self_correct→complete. Resolved: the ECHO
   vocabulary is authoritative for `phase-*` marks — nova's idle and
   audit join the set (filling cyberpunk's two gaps), and nova's
   generic lifecycle icons landed as `run-active`/`run-error`/`run-fix`/
   `run-done` with corrected aria-labels. The merged manifest carries an
   explicit `vocabulary` block documenting the mapping, the sub-marks
   (implement, archive), and the run-lifecycle set.
3. **Manifest nits (cosmetic).** The nova manifest's out-of-order fields
   and subject-less nav entries are superseded — the single merged
   manifest has consistent field order and authored subjects for every
   icon, derived from each SVG's aria-label.
4. **Semantic overlap (dedup).** Collision rule: nova wins the
   overlapping UI slots (status-active, status-partial, phase-complete —
   its surface-optimized designs replace the cyberpunk versions);
   cyberpunk's archival complete mark is preserved as
   `phase-archive.svg` (its distinct FID-archival subject); distinct
   pairs (fid vs sidebar-fid, loop vs sidebar-loop, activity-section vs
   cmd-agents) coexist.

## Delivered

- 132 SVGs in one flat family under `art/icons/cyberpunk/` (102
  cyberpunk + 32 nova − 2 true overwrites), single manifest v3.0.0
- 16 categories: identity-mark (2), echo-agent (10), variation-mark (5),
  protocol-mark (5), phase-mark (8), run-mark (4), tool-glyph (20),
  status-indicator (13), command-mark (15), dev-object-mark (15),
  cyberpunk-motif (15), sidebar-section (6), activity-indicator (4),
  nav-glyph (4), alert-glyph (4), toggle-glyph (2)
- Merge mechanics: 29 new files written, 3 replacements written
  (phase-complete, status-active, status-partial), cyberpunk's complete
  preserved under phase-archive.svg, 4 run-* aria-labels corrected
- `cli/src/utils/theme-system/icon-palette.ts`: the six-token icon
  palette, one home, cited by the manifest

## Evidence

- Structural cross-check (bun script): 132 disk SVGs ↔ 132 manifest
  entries, zero missing/extra/duplicates, zero structurally-bad (all
  64×64 viewBox, aria-label, closed tags), all run-* labels carry the
  Run: prefix. Version 3.0.0, palette = all six tokens.
- Repo gates (exit 0): prettier clean on the manifest, scope-register
  PASS (0 issues), fid:verify --check PASS, quality PASS (1498 files —
  the palette.ts 300-line violation fixed by the icon-palette
  extraction), lint:md clean, validate:repository PASS.
- CLI (exit 0): typecheck clean, eslint clean on both theme-system
  files.

## Limits and next steps

- Visual rendering is not machine-verified (no rasterizer on this box);
  structure, palette, and self-containment are verified.
- Icons remain unwired source assets (manifest integration block:
  decision: operator). Integration phases planned in T176: HTML-export
  inlining (zero rasterization), then TUI surfaces (sidebar rail,
  sidebarPhase/sidebarActivity, presence mapper) gated on a
  rasterization decision.
- No FID: operator-requested asset work, the T174 precedent.