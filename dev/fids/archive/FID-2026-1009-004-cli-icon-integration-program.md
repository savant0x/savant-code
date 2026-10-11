# FID: CLI icon-integration program — wire the cyberdeck SVG family into product surfaces

**Filename:** `FID-2026-1009-004-cli-icon-integration-program.md`
**ID:** FID-2026-1009-004
**Severity:** medium
**Status:** verified
> Historical implementation and test notes follow. The operator cancelled this FID
> on 2026-10-11 because the TUI cannot use SVGs; no acceptance is claimed.
**Created:** 2026-10-09 16:40
**Automation level:** 3
**YAGNI-Compliance:** Pending

---

## Summary

The completed `art/icons/cyberpunk/` family — 132 hand-authored SVGs + manifest
v3.0.0 (T174/T176, commits `480d3e89`, `694ea34e`, `fbe35029`) — is unwired:
no production surface renders a single family file (manifest `integration.status`
= "source assets — not yet wired into a CLI surface"). This FID carries the
operator-approved program to wire them in — **the CLI TUI first** (operator
directive 2026-10-09, verbatim: *"i want the icons in the cli. That's the
entire point of making them"*), realized as raster art via the existing
base64-PNG image protocols plus glyph-fallback neighbors, then the `/export`
HTML report, Discord Rich Presence assets, and the desktop Tauri renderer.
Inline TUI indicators stay the glyph system except where the raster decision
names a slot. Operator decisions recorded 2026-10-09: full plan accordions,
base64-constant embedding, **rasterization = `@resvg/resvg-js` (build-time
codegen, no runtime dep)**, FA replacement strategy full replacement (Q1
default), and the CLI-first directive quoted above.

## Operator rulings (recorded verbatim, 2026-10-09)

- **CLI-first (implementation order):** *"i want the icons in the cli. That's
  the entire point of making them"* — the TUI raster surface is the headline
  deliverable, ahead of the export/presence/desktop phases.
- **Full plan:** the FID covers export + presence + desktop in one record.
- **Embedding:** base64/data-URI constants (no runtime art/ reads).
- **Q1 (FA strategy): full replacement** — all 21 export call sites map to
  family icons; `fontawesome.ts` is deleted. Recorded as the adopted default:
  the plan already proposed it and the operator's CLI-first directive did not
  amend it; any site that cannot honestly map is surfaced at its own step
  rather than silently kept.
- **Q2 (presence rasterizer): `@resvg/resvg-js` as a devDependency** —
  build-time rasterization, no runtime dependency, reused for the TUI phase.
  *(Superseded forPhase 2 by the presence ruling below — the rasterizer stays
  for Phase 0/1 surfaces where it already ran.)*
- **Q3 (desktop order):** deferred to a desktop RED pass at its own step (no
  operator constraint named).
- **Presence images OFF LIMITS Phase-2 kill (2026-10-09, verbatim):**
  *"the agents image is the savant logo....it's literally the name of the
  agent. Considering that's the only thing we show image wise on discord,
  mark that as off limits"* — the Discord Rich Presence imagery is the
  official Savant logo and stays untouched. **Phase 2 (per-agent/mode PNG
  derivation for Rich Presence) is dropped by this operator ruling** — the
  ruling itself is the operator approval Law 2 requires. No presence code
  was changed (verified: `presence-mapper.ts`/`presence-ipc.ts` untouched in
  this program; the asset keys remain byte-identical).

## Environment

- **OS:** Windows (Git Bash), Bun ≥ 1.3.11 (root pins `1.3.14`)
- **Language/Runtime:** TypeScript strict, React 19 / OpenTUI 0.5.3 (CLI),
  React 19 renderer (desktop, Tauri v2)
- **Tool Versions:** `@xhayper/discord-rpc` (presence), `jimp` (PNG only,
  no SVG parse — measured in handoff, re-verified below)
- **Commit/State:** `main` @ `5e4de61e` (clean tree; local-only, 171 commits
  ahead of origin/main)

## Detailed Description

### Problem

132 finished SVG assets have zero production consumers. Meanwhile the exported
HTML report carries a third-party icon stack — Font Awesome Free 6.7.2 inlined
as base64 CSS (`cli/src/constants/fontawesome.ts`: the stylesheet body alone is
~1.23 MB on line 21) — and its ~21 icon call sites render generic FA glyphs
instead of the product's own icon language. Discord presence resolves
`agent_*`/`mode_*` asset keys (`cli/src/state/presence/presence-mapper.ts:32,68`)
that must be uploaded externally as PNGs, but no pipeline produces those PNGs
from the family. The desktop renderer can consume SVG natively and is listed in
the manifest's `integration.candidatePaths` but has no seam.

### Expected Behavior

Product surfaces express the icon vocabulary the manifest already documents:
the export report renders Savant SVGs (fallback chain preserved), presence
assets derive from the same family, the desktop app reuses them directly, and
the TUI keeps its proven glyph fallback chain unchanged.

### Root Cause

The family was authored as a standalone asset program (T174/T176 closed before
any integration phase was approved); the render-path constraint (OpenTUI is a
text renderer; `cli/src/utils/terminal-images.ts` emits base64-PNG escapes only)
made TUI adoption the wrong first target, so integration never began.

### Evidence

**Asset inventory (verified on disk):** `ls art/icons/cyberpunk/` = 133 files
(132 SVGs + `manifest.json`). Manifest v3.0.0, viewBox `0 0 64 64`, six-token
palette (`ICON_PALETTE` in `cli/src/utils/theme-system/icon-palette.ts`,
machine-enforced by `bun run icon-palette:check`). Categories: identity-mark 2,
echo-agent 10, variation-mark 5, protocol-mark 5, phase-mark 8, run-mark 4,
tool-glyph 20, status-indicator 13, command-mark 15, dev-object-mark 15,
cyberpunk-motif 15, sidebar-section 6, activity-indicator 4, nav-glyph 4,
alert-glyph 4, toggle-glyph 2.

**Icon absence in the export (grep evidence, per code_search 2026-10-09):**
21 `fa-*` class call sites across `cli/src/commands/export-conversation/`:

- `template.ts:74-75,117-119` — copy buttons, expand/collapse, toolbar
- `render-message.ts:59,68,70,74` — attachments, user/warning markers, copy
- `render-blocks.ts:26,31,40,47,68,81,119,123` — tool badges (fa-terminal ×2),
  input/output summaries, agent header (fa-share-nodes), plan (fa-list-check),
  image + users notices
- `render-text.ts:14` — thinking icon (fa-brain)
- `drive-report.ts:129,142` — Auto Drive (fa-gauge-high), Run Log (fa-list-ol)
- `template-css-part2a.ts:59` — fa-terminal sizing rule

**FA payload in every export:** `cli/src/constants/fontawesome.ts` —
`FONT_AWESOME_ALL_CSS`, full `all.min.css` with all webfonts as base64; ~1.23 MB
on the constant's single line (measured `awk 'NR==21' | wc -c` = 1,233,108; line
20 = 51,300). Inlined by `template.ts` into `<style>` on every `/export`.

**Export seam (verified):** `cli/src/commands/export-conversation/template.ts`
builds the report via `buildExportHtml`; brand logo inlines through
`cli/src/commands/export-conversation/branding.ts` (`LOGO_DATA_URI` ←
`cli/src/constants/savant-logo.ts` `SAVANT_LOGO_PNG_BASE64` — the base64
constant pattern the operator selected). Renderer entry:
`cli/src/commands/export-conversation.ts` (`handleExportConversationCommand`).

**TUI glyph system (verified, unchanged by this FID):**
`cli/src/utils/glyphs.ts` — `GLYPH_TABLE` (30 names × 3 tiers), session-cached
tier detection; `cli/src/components/savant-ui/icon.tsx` renders named glyphs
with theme color. FSM/activity/status maps live in
`cli/src/components/savant-ui/echo/phase-info.ts` (`PHASE_MAP`, `ACTIVITY_MAP`,
`STATUS_MAP`) consumed by `right-sidebar-display.ts`, `agent-status.tsx`,
`phase-indicator.tsx`, `stepper.tsx`, `transition-phase.tsx`,
`render-ui-display-widgets.tsx`.

**Discord presence seam (verified):**
`cli/src/state/presence/presence-mapper.ts` — `AGENT_ASSET_MAP` (10 agents,
key `agent_<name>`), `MODE_ASSET_MAP` (4 modes, key `mode_<hybrid|strict|scaffold|analyze>`);
`presence-ipc.ts` logs in via `@xhayper/discord-rpc` and calls
`client.user?.setActivity({...largeImageKey...})`. Asset keys reference
Discord application assets uploaded out-of-band as PNGs — the code consumes
keys only, so this phase produces the PNGs + upload instructions (no RPC change
is required, and none is proposed).

**TUI raster path (verified; see the blocked TUI raster work item):**
`cli/src/utils/terminal-images.ts` — `renderInlineImage(base64Data)` requires
base64 PNG; sixel returns null; callers are image/markdown content blocks only
(`image-block.tsx`, `markdown-image.tsx`, `image-card.tsx`).

**Packaging gap (verified, drives the embedding decision):**
`cli/src/branding/constants.ts:29` reads `art/` at runtime via
`join(import.meta.dir, '..', 'art', 'savant-text-graf.md')`; no `files`/`includes`
entry for `art/` was found in `cli/package.json`/root `package.json`. Base64-constant
embedding (operator decision) avoids any new runtime asset dependency in the
export path.

## Impact Assessment

### Affected Components

- `cli/src/commands/export-conversation/*` (template, render-*, drive-report, template-css part2a)
- `cli/src/constants/` (new SVG-icons module; `fontawesome.ts` retirement pending Q1)
- `cli/scripts/generate-*` (new asset-codegen in the `generate*-image.ts` tradition)
- `scripts/` (presence PNG derivation; `icon-palette:check` unchanged)
- `desktop/` (Phase 3 adoption surface; separate workspace typecheck/tests)
- `docs/` providers-adjacent surfaces untouched; export docs may note the change

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: feature/branding work, no runtime correctness risk; the TUI path
      is untouched, presence is upload-side, export is additive with a
      regression-safe fallback strategy per surface
- [ ] Low

## Proposed Solution

### Approach

Three operator-approved phases, each independently verifiable and shippable.
Embedding is base64/data-URI constants generated from the SVG sources by a
codegen script (single source of truth stays `art/icons/cyberpunk/`; the CLI
never reads art/ at runtime for these icons).

**Phase 1 — `/export` HTML report (zero new dependencies).**

1. Codegen: `cli/scripts/generate-savant-icons.ts` (name TBD per convention)
   reads `art/icons/cyberpunk/*.svg` + manifest and emits
   `cli/src/constants/savant-icons.ts`: per-icon inline-SVG string (or data URI)
   + stable `SAVANT_ICON_NAME` union + manifest palette notes. Re-run triggers
   on manifest version change (same review discipline as
   `fontawesome.ts`'s "do not edit by hand" header).
2. Mapping table: FA call site → icon name (one truth table in the new module:
   `terminal→tool-terminal`-style mapping for all 21 sites; message user/warning
   → identity/`alert-*`; thinking → `activity-thinking`; drive → `run-*`;
   plan/copy → `tool-*` family). Every mapping cites the manifest category.
3. Renderer swap per site: `<i class="fa-solid fa-*">` → inline `<svg>` spans
   (`class="svg-ico"`) with `currentColor` mapping; the six-token neon palette
   is applied through CSS custom properties, not hardcoded hex (theme colors
   stay in the export CSS; `ICON_PALETTE` remains the palette truth).
4. Add agents + phases to the report: agent-headers gain the 10 echo-agent
   icons; the Drive/Run Log section gains phase marks via the manifest's
   `phaseMarkMapping` (idle→red→green→audit→self_correct→complete).
5. FA strategy per Q1 (proposed default: full replacement — drop
   `FONT_AWESOME_ALL_CSS` and the 1.2 MB payload; keep FA license attribution
   only if any site remains). If any site is judged Hard to map, it keeps FA
   and the CSS stays — but `fa-*` call sites drop to zero only under the
   full-replacement outcome.
6. Verification: rendered export fixture opened via `file://` in a browser
   (Chrome, operator/host verified); structural tests pin the mapping table +
   every swap site; grep proves zero `fa-solid` references remain (or a
   recorded remainder list per the chosen Q1 outcome).

**Phase 2 — Discord presence assets (DROPPED by operator ruling 2026-10-09).**

The operator ruled the presence imagery off limits: the agent image on
Discord IS the official Savant logo — the only image Discord shows — and it
stays exactly as-is. Verbatim: *"the agents image is the savant
logo....it's literally the name of the agent. Considering that's the only
thing we show image wise on discord, mark that as off limits."* The prior
plan (below) is retained as record only; nothing in it was implemented and
none of it will be.

1. ~~Derive `agent_<name>.png` (10) + `mode_<mode>.png` (4) from the family
   SVGs as build-time artifacts~~ — dropped (operator ruling above).
2. ~~`docs/` runbook page: Discord Developer Portal upload steps per key~~ —
   dropped. `presence-mapper.ts` keys stay byte-identical (no code change
   was ever made; verified by grep — this program touched no presence file).
3. ~~Verification: file-existence/size pins + palette check on the PNGs~~ —
   not applicable; no artifacts exist and none will be produced.

**Phase 3 — Desktop adoption (Tauri renderer, SVG-native).**

1. The desktop renderer (`desktop/`) consumes the same SVG sources at build
   time (import or copy step); identity logo, status/alerts/toggles, agent
   stack, nav glyphs land first (matching existing desktop surfaces — scoped
   by a desktop RED pass at GREEN).
2. No palette drift: desktop theming defers tokens to the same
   `ICON_PALETTE`/manifest palette contract; a shared constant module is
   emitted per workspace by the Phase 1 codegen (dedup down one source).
3. Verification: desktop workspace typecheck + its own test battery; visual
   spot-check needs the operator or a rasterizer.

**Phase 0 (headline, operator directive 2026-10-09) — TUI raster art in the
CLI.** The formerly blocked item is now the first implementation step:

1. Codegen: `cli/scripts/generate-savant-icons.ts` reads
   `art/icons/cyberpunk/*.svg` + manifest → emits
   `cli/src/constants/savant-icons.ts` (inline-SVG strings + `SAVANT_ICON_NAME`
   union + manifest palette notes) AND rasterizes via `@resvg/resvg-js`
   (devDependency) → emits base64-PNG constants for the raster surfaces
   (identity logo marks first). One source of truth; both outputs reviewed
   like generated constants.
2. TUI consumers via `cli/src/utils/terminal-images.ts`
   (`renderInlineImage`): the boot splash / header and any large-art slot
   where a 64-64 raster reads cleanly; protocol detection + graceful
   degradation ('none' → compact glyph/ASCII brand block; never an error).
3. Inline indicators remain glyphs (text-cell slots; unchanged).

### Steps

1. Phase 1 codegen + constants module — **implemented 2026-10-09** (Phase 0
   + Phase 0.5 TUI surfaces committed `a6f04079`; Phase 1 codegen map in
   working tree)
2. Phase 1 mapping table + 21-site swap — **implemented 2026-10-09**
   (working tree; zero `fa-*` verified by grep)
3. Phase 1 agents/phases in the report + Q1 outcome — **implemented
   2026-10-09** (`fontawesome.ts` deleted; fixture 111,593 bytes, −93%)
4. Phase 1 regression pins + export fixture — **implemented 2026-10-09**
   (23/23 tests across 4 suites + `dev/fixtures/export-icon-phase1.html`)
5. Phase 2 PNG derivation + runbook — **dropped by operator ruling
   2026-10-09** (presence imagery off limits; see verbatim ruling above)
6. Phase 3 desktop RED pass + adoption — **implemented 2026-10-09**
   (working tree; desktop RED pass recorded in Loop 3 below; desktop
   typecheck + 403/403 tests green, including the new Phase 3 drift-guard
   suite `desktop/src/components/__tests__/savant-icons.test.tsx`)
7. CHANGELOG + manifest `integration.status` update — pending closure with
   the local path-scoped commit. Under the 2026-10-11 G1 ruling, the commit
   needs no separate authorization; push remains gated. The separate TUI
   rasterization ruling remains unresolved.

### Verification

Every implemented step carries pasted tool-output evidence; test artifacts are
declared below. Export fixtures open via `file://` in Chrome (verified present
on the operator host) for the visual leg. The TUI battery must remain green
(this program must not touch `right-sidebar*`, `savant-ui/*`, `presence-mapper`
keys, or `glyphs.ts`).

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path and appear as a declared
> `- gate: test <path>` below. `fid:verify` enforces this for fixed/verified.
>
> Gate-list ratchet: Phase 2 would add `scripts/` ground when its artifacts
> exist; **Phase 3 added the desktop workspace gates 2026-10-09** (Loop 3) —
> the desktop typecheck, the new Phase 3 drift-guard suite, and the
> PhaseStepper pin. The gate list is ratcheted, not front-loaded.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/commands/__tests__/export-conversation-render.test.ts
- gate: test cli/src/utils/__tests__/savant-icons.test.ts
- gate: probe scripts/icon-palette-check.ts
- gate: quality
- gate: typecheck desktop
- gate: test desktop/src/components/__tests__/savant-icons.test.tsx
- gate: test desktop/src/components/chat/__tests__/phase-stepper.test.tsx

### Verification Receipt

- fingerprint: sha256:6657f036fbf3ccdeabdc81779582df5ebb9c40cf2eee6e6e783bbc4ed1562a0a
- verified: 2026-10-11T04:31:40.999Z
- typecheck cli: exit 0
- test cli/src/commands/__tests__/export-conversation-render.test.ts: exit 0
- test cli/src/utils/__tests__/savant-icons.test.ts: exit 0
- probe scripts/icon-palette-check.ts: exit 0
- quality: exit 0
- typecheck desktop: exit 0
- test desktop/src/components/__tests__/savant-icons.test.tsx: exit 0
- test desktop/src/components/chat/__tests__/phase-stepper.test.tsx: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** unwired family (manifest `integration.status`); 21 third-party icon
  call sites in the export; ~1.23 MB FA payload per export; presence asset PNGs
  produced by no pipeline; desktop candidate path dormant. All sites enumerated
  with file:line above (grep + code_search output).
- **GREEN:** phased solution above (P1 export, P2 presence PNGs, P3 desktop;
  TUI glyph chain untouched).
- **AUDIT:** record-level gates run live 2026-10-09 on the authoring tree —
  `lint:md` exit 0 (10 findings fixed: one MD013 wrap, three MD032 list
  spacings, six MD033 angle-bracket placeholders → plain text),
  `scope-register` PASS (0 issues), `fid:verify --check` PASS,
  `quality: PASS (1498 baselined files)`, `icon-palette:check` PASS
  (132 SVGs / 6 declared tokens). Implementation gates (typecheck cli, the two
  declared test files, export fixture) remain pending — they fire at
  implementation, per the ratcheted gate list.
- **ADVERSARIAL:** record-level challenge live 2026-10-09 — (1) the 21 `fa-*`
  sites re-grepped, none missed, `template-css-part2a.ts:59` correctly
  classified as a CSS rule that dies with the FA payload under full
  replacement; (2) desktop RED pass census: `desktop/src/` renderer has zero
  icon/`fa-*`/symbol imports — phase identity is purely color tokens
  (`floor/stations.ts` `phaseAccent` + `DECK_TOKENS`; chat components
  `PhaseStepper.tsx`, `RosterRail.tsx`, `TrafficLights.tsx` confirm), so
  Phase 3 surfaces are real and there is no desktop icon stack to migrate;
  (3) palette-drift risk is covered by the recorded per-icon `currentColor`
  decision at GREEN; (4) the Code Verification Evidence checkbox for desktop
  file existence is now evidenced by the census above, not asserted.
  Findings: none blocking convergence of the record.
- **CHANGE DELTA:** n/a (document authored + loop-corrected; no code pass yet)

### Missed Questions

1. **Do we replace Font Awesome entirely?** Open question Q1 below; proposed
   default: full replacement (all 21 sites map to family icons; the FA payload
   and its 1.2 MB export cost disappear). Fallback if any site has no honest
   family equivalent: hybrid (keep FA CSS for the remainder) — recorded, not
   deferred silently.
2. **Does the TUI switch to raster/icons?** Inline TUI indicators stay on the
   glyph chain (OpenTUI is a text renderer; the 3-tier fallback chain is a
   working Law 14 pattern) — that is a design fact, not a disposition. The
   boot-screen raster surface is a **separate blocked item**, its specific
   blocker being the operator's rasterization ruling (see the Companion work
   item above); it is recorded, never dropped.
3. **Where does `art/` live for the published package?** It does not need to:
   the export path embeds constants; the attention this surfaces for
   `branding/constants.ts`'s `art/` runtime read is recorded as a separate
   candidate improvement (not changed in this FID; no silent scope claim).
4. **Who uploads Discord assets?** The operator (external system, level 1);
   this FID produces the PNGs + instructions, never the upload.
5. **Does palette theming conflict with dark/light export themes?** SVGs ship
   with their canonical neon palette; volume emphasis maps to `currentColor`
   where the report needs theme-relative contrast (per-icon decision recorded
   in the mapping table).

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending — local path-scoped commit not yet recorded
      (Phase 0/0.5 committed as `a6f04079`; Phase 1 + Phase 3 are in the
      working tree). G1 permits the commit without separate authorization;
      push remains explicitly authorization-gated. The separate TUI
      rasterization ruling remains unresolved.
- [x] **File:line ranges:** Phase 1 — `cli/src/commands/export-conversation/export-icons.ts`
      (new `ico(slot)` helper), `cli/src/constants/savant-icons.ts`
      (regenerated, 3,407 lines, `SAVANT_EXPORT_ICON_MAP` 18 slots),
      `render-blocks.ts` / `render-message.ts` / `render-text.ts` /
      `drive-report.ts` / `template.ts` / `template-css-part2a.ts`
      (21-site swap); Phase 3 — `desktop/src/components/SavantIcon.tsx`,
      `desktop/src/components/icon-names.ts`,
      `desktop/src/icons.generated.ts`, `desktop/src/SplashScreen.tsx:74-78`,
      `desktop/src/components/chat/PhaseStepper.tsx:76,80-82`,
      `desktop/src/components/chat/RosterRail.tsx:27-52`,
      `desktop/src/styles.css:2621-2681`
- [x] **Gate output:** pasted in Loop 2 (Phase 1) and Loop 3 (Phase 3)
      AUDIT sections — typecheck cli + desktop exit 0; cli 7/7; desktop
      403/403; eslint 0/0; icon-palette PASS; quality PASS; lint:md,
      scope-register, validate:repository, fid:verify --check all PASS
- [x] **Reproducibility:** `bun cli/scripts/generate-savant-icons.ts`
      regenerates both constant modules from `art/icons/cyberpunk/`
      (single source of truth); the drift-guard suites fail on any
      codegen/manifest/roster drift
- [x] **Step statuses:** 1-4 `implemented`; 5 `deferred` — operator-approved
      2026-10-09 (verbatim ruling recorded above); 6 `implemented`;
      7 pending closure — local commit permitted under G1; TUI rasterization
      ruling remains unresolved

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (verified 2026-10-09:
      all `cli/src/...` paths named above were read or grepped this session;
      desktop surfaces censused — `desktop/src/components/chat/` with
      `PhaseStepper.tsx`, `RosterRail.tsx`, `TrafficLights.tsx`,
      `CompactionStatusBar.tsx`, `AutoDriveDashboard.tsx` et al.;
      `desktop/src/floor/stations.ts` carries `phaseAccent`)
- [x] Implementation matches the Proposed Solution: verified 2026-10-09 —
      Phase 1 (export swap, FA deletion, agents/phases marks) and Phase 3
      (splash/phase/roster adoption) both match the converged plan; the
      two Loop-3 audit findings were fixed in place
- [x] Typecheck/tests/lint pass with pasted tool output: verified
      2026-10-09 (Loop 2 + Loop 3 AUDIT sections)
- [x] Production call-graph evidence for new wiring: verified 2026-10-09 —
      `ico()` imported by render-blocks/render-message/render-text/
      drive-report/template (reachable from `buildExportHtml` on every
      export); `SavantIcon` imported by SplashScreen/PhaseStepper/
      RosterRail; `phaseIcon`/`rosterIcon` consumed by PhaseStepper/
      RosterRail; `icons.generated.ts` emitted by the codegen script
- [ ] FID status reflects the actual implementation state: pending — the
      status flips at closure, which is blocked on the G2 commit

### Loop 2 — Independent audit and self-correction (Phase 1 + Phase 0 implementation, 2026-10-09)

- **RED:** 21 `fa-solid` call sites re-censused live on the implementation
  tree (`grep -rn "fa-solid" cli/src/commands/export-conversation/`):
  drive-report 2, render-blocks 10, render-message 4, render-text 1,
  template 4 (incl. 2 JS flashCopied branches) — matches the FID census;
  plus `template-css-part2a.ts:59` sizing rule and the
  `cli/src/constants/fontawesome.ts` payload (~1.23 MB on line 21).
- **GREEN:** Phase 1 implemented in full: (1) `SAVANT_EXPORT_ICON_MAP` —
  18 semantic slots, each citing its manifest category — now emitted by
  `cli/scripts/generate-savant-icons.ts` into the generated family module;
  (2) all 21 call sites swapped to inline family SVGs via the new
  `cli/src/commands/export-conversation/export-icons.ts` `ico(slot)` helper
  (Law 14: unknown slot renders empty, never throws); the copy-state flash
  injects `COPY_SUCCESS_SVG`/`COPY_FAILURE_SVG` as JS constants; (3)
  `fontawesome.ts` **and** `generate-fontawesome.ts` deleted (Q1 full
  replacement outcome: zero `fa-*` in production code, the ~1.23 MB payload
  and its 1,895-backslash escaping problem are gone); (4) `.svg-ico` CSS
  rules replace the `.fa-terminal` rule (sizing per surface: tool badge
  0.85em, row marker 1.2em, headers 1.1em); (5) subject/agent headers carry
  the family marks (agent header = Orchestrator echo-agent mark, plan =
  Scope, Auto Drive = Run Active, Run Log = Loop). Honest-mapping note per
  Q1: `fa-copy` had no clipboard mark in the family — mapped to the
  document mark (obj-file), recorded in the mapping module and pinned by
  test. Test assertions updated to pin the new reality (render, export,
  drive-report suites) + new drift guard `savant-icons.test.ts` per the
  declared gate list. (Phase 0 TUI raster work shipped separately in
  commit `a6f04079`.)
- **AUDIT (live evidence, final files):** cli typecheck exit 0; bun test —
  savant-icons 4/4, export-conversation-render 4/4, export-conversation
  3/3, drive-report 12/12 (23 pass / 0 fail across the 4 affected suites);
  eslint 0 errors / 0 warnings on all touched files; zero-FA grep
  `grep -rn "fa-solid|fa-regular|fa-brands|fa-terminal|FONT_AWESOME"
  cli/src cli/scripts` → only a stale comment (fixed: generate-cytoscape.ts
  now cites the export-path embedding pattern); quality:report PASS after
  re-freezing the generated module at 3,407 lines (was 3,353 — the export
  map added ~54); validate:repository PASS; scope-register PASS; lint:md
  exit 0. Call-graph: `ico()` imported by render-blocks/render-message/
  render-text/drive-report/template (`export-icons.ts` is reachable from
  `buildExportHtml` on every export). Export fixture regenerated
  (`dev/fixtures/export-icon-phase1.html`): **111,593 bytes with 0 `fa-solid`
  and 14 svg-ico spans — vs ~1.6 MB pre-swap (−93%)**; opens via `file://`
  (operator visual leg per plan).
- **ADVERSARIAL:** challenge on the remaining FA surface — none found: no
  `fa-*` class, no `font/woff2`, no jsdelivr, and the deleted files leave no
  import references (grep + typecheck both prove). Challenge on the
  `4499-line commit` claim vs this pass: the Phase 1 pass is a separate
  work item; local commit is permitted under G1 and push remains gated.
  One test-regex subtlety surfaced and fixed at cause: 'copyFailure'
  contains 'fa' as a substring, so the no-FA assertion targets the `fa-`
  class prefix pattern, not a bare substring. Verdict: Phase 1 is complete
  and clean; no blocking findings.
- **CHANGE DELTA:** new — `cli/src/commands/export-conversation/export-icons.ts`,
  `cli/src/utils/__tests__/savant-icons.test.ts`, fixture HTML; modified —
  `generate-savant-icons.ts` (+mapping emitter), `savant-icons.ts`
  (regenerated, 3,407 lines), `render-blocks.ts`, `render-message.ts`,
  `render-text.ts`, `drive-report.ts`, `template.ts`,
  `template-css-part2a.ts`, render/export test assertions,
  `dev/quality-baseline.json` (re-freeze); deleted — `fontawesome.ts`,
  `generate-fontawesome.ts`.

### Loop 3 — Final convergence (Phase 3 desktop adoption + closure audit, 2026-10-09)

- **RED (desktop RED pass, per the Phase 3 GREEN step):** census of
  `desktop/src/` renderer surfaces — the deck is identity-by-color
  (`floor/stations.ts` `phaseAccent` + `DECK_TOKENS`), the chat rail
  components (`PhaseStepper.tsx`, `RosterRail.tsx`, `TrafficLights.tsx`,
  `CompactionStatusBar.tsx`, `AutoDriveDashboard.tsx`) carry zero icon
  imports, and `SplashScreen.tsx` is text-only. Adoption surfaces chosen:
  splash identity mark, FSM phase chips, roster agent marks — the three
  places a 64×64 mark reads cleanly at DOM scale. Audit of the Phase 3
  implementation tree found two defects: (1) `ROSTER_ICON_MAP` carried a
  dead `orchestrator` key — the deck cast is closed at `DECK_ROLE_IDS`
  (10 roles, `savant` is the center-piece orchestrator), so the key was
  unreachable from every consumer; (2) `RosterRail.tsx` called
  `rosterIcon(entry.roleId)` twice and bridged the null check with an
  `as NonNullable<...>` cast — a Law 6 type-safety shortcut.
- **GREEN:** (1) dead key removed — the map is now pinned 1:1 against
  `DECK_ROLE_IDS` by the new drift guard (`ICON_Orchestrator` stays in the
  family and in use on the export path, so no asset is orphaned); (2)
  `RosterRail` resolves the mark once into a local and renders
  `mark ? <SavantIcon name={mark} …/> : <presence dot>` — no cast, no
  double call. New Phase 3 drift-guard suite
  `desktop/src/components/__tests__/savant-icons.test.tsx` (11 tests):
  family identity (132 icons, viewBox), phase-map coverage over the FSM
  vocabulary, roster-map 1:1 with the closed cast, honest degradation
  (`phaseIcon(null)` → idle, unknown → null; `SavantIcon` unknown name →
  empty decorative span, never throws), and integration pins (every FSM
  chip carries `fsm-mark`; every roster row carries `roster-icon` and the
  presence dot is fully replaced).
- **AUDIT (live evidence, final tree, 2026-10-09):** cli typecheck exit 0;
  desktop typecheck exit 0; cli declared suites 7 pass / 0 fail
  (export-conversation-render + savant-icons); desktop battery **403 pass /
  0 fail** across 64 files (392 pre-existing + 11 new); eslint 0 errors /
  0 warnings repo-wide; `icon-palette:check` PASS (132 SVGs / 6 declared
  tokens); `quality:report` PASS (1503 baselined files); `lint:md` exit 0;
  `scope-register` PASS (0 issues); `validate:repository` PASS;
  `fid:verify --check` PASS. Call-graph: `SavantIcon` is imported by
  `SplashScreen.tsx`, `PhaseStepper.tsx`, `RosterRail.tsx` (grep-verified
  production consumers); `phaseIcon`/`rosterIcon` are imported by
  `PhaseStepper.tsx`/`RosterRail.tsx` respectively; the generated module
  `desktop/src/icons.generated.ts` is emitted by
  `cli/scripts/generate-savant-icons.ts` (single source of truth
  `art/icons/cyberpunk/`). Pre-existing condition noted, not introduced:
  `bunx prettier --check .` fails on 159 committed files (114 missing the
  final newline, 45 `art/icons/cyberpunk/*.svg` attribute wraps) — zero of
  them in this program's changed set; registered in SCOPE.md.
- **ADVERSARIAL:** challenge on the Phase 3 surface — (1) the presence-dot
  removal is total (the integration pin asserts `not.toContain('roster-presence')`,
  so a partial revert fails the suite); (2) the `adversarial` phase shares
  the audit mark — verified honest: the family has no separate
  adversarial-phase mark and the manifest's `phaseMarkMapping` is the
  authority, the sharing is documented at the map; (3) palette drift —
  the desktop CSS applies no `currentColor` recoloring (single-truth
  palette contract, SVGs keep authored neon), and `icon-palette:check`
  passes on the sources; (4) the dead-key finding was re-verified against
  `state/roster.ts` (`roleId: (typeof DECK_ROLE_IDS)[number]` — the type
  is closed, the key was unreachable). Verdict: no blocking findings;
  Phase 3 complete and clean.
- **CHANGE DELTA (Phase 3, this pass):** new —
  `desktop/src/components/SavantIcon.tsx`,
  `desktop/src/components/icon-names.ts`,
  `desktop/src/icons.generated.ts` (codegen-emitted),
  `desktop/src/components/__tests__/savant-icons.test.tsx`; modified —
  `desktop/src/SplashScreen.tsx`, `desktop/src/components/chat/PhaseStepper.tsx`,
  `desktop/src/components/chat/RosterRail.tsx` (+ the two audit fixes),
  `desktop/src/styles.css` (+61 lines of `.savant-icon` rules),
  `cli/scripts/generate-savant-icons.ts` (+desktop emission).

## Open Questions — RESOLVED 2026-10-09 (see Operator rulings above)

1. **Q1 — FA strategy:** RESOLVED — full replacement (all 21 sites map;
   `fontawesome.ts` deleted).
2. **Q2 — Presence rasterizer:** RESOLVED — `@resvg/resvg-js` devDependency,
   build-time rasterization only.
3. **Q3 — Desktop order:** still open at implementation; requires a short
   desktop RED pass before Phase 3 lands.

## Resolution

- **Archived-Declined:** operator-approved 2026-10-11 — "this can be completed as well" with the operator's clarification: "also the sidebar cannot use svgs so this is cancelled as well."
- **Disposition:** Operator cancelled this icon-integration FID because the TUI cannot use SVGs. Existing implementation and test notes are retained as history; no TUI SVG support or successful acceptance is claimed.
- **Closed Date:** not closed (operator-declined 2026-10-11)
- **Archived:** 2026-10-11 as operator-declined; no completion claim

## Lessons Learned

Placeholder — completed at closure.
