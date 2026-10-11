# FID: Sidebar cyberdeck HUD modernization with safe asset integration

**Filename:** `FID-2026-1009-008-sidebar-cyberdeck-hud-modernization.md`
**ID:** FID-2026-1009-008
**Severity:** medium
**Status:** analyzed
**Created:** 2026-10-09
**Automation level:** 1
**YAGNI-Compliance:** Pending

---

## Summary

Modernize the OpenTUI CLI sidebar as an expressive cyberdeck HUD, using the
existing 132-icon Savant family while preserving the basic sidebar layout,
information authority, responsive behavior and user interactions. The operator
selected Expressive HUD, primarily uses Cursor, and requires compatibility
with the public npm package's other terminal hosts. Full FID planning and the
Perfection Loop are authorized; production implementation is approval-gated.
This record does not replace or alter concurrent FIDs 004 through 007.
Operator refinement: heavily use the cyberpunk icons, author additional SVGs
where needed, and include terminal-command presentation while keeping traffic
lights. This is approved planning scope, not approval to alter production.

## Environment

- **OS:** Windows; commands executed through bash.
- **Language/Runtime:** strict TypeScript, React 19, Bun 1.3.14.
- **Tool Versions:** OpenTUI core/react 0.5.3, resvg 2.6.2 dependency range.
- **Commit/State:** shared main working tree with concurrent uncommitted work.
- **Platform:** terminal CLI; Cursor is the primary operator host, not the
  only supported distribution target. A shell is not a graphics capability.
- **Timestamp:** baseline census recorded 2026-10-10T02:27:08.315Z (UTC);
  record date follows the session's 2026-10-09 work sequence.

## Detailed Description

### Problem

The sidebar's visual presentation does not communicate the sophistication of
its underlying system. Adding SVGs to the current accordion alone would not
solve hierarchy, composition, density or cross-terminal consistency. A previous
redesign regressed the operator's sidebar, so preservation needs executable
acceptance criteria and visual checkpoints before production integration.

### Expected Behavior

The basic layout remains: branded top region, scrollable operational detail,
context/version footer, and a centered folded navigation rail. The operator
can change the visual language of headers, arrows, framing and controls without
losing information, sections, state, navigation or readable terminal fallback.

### Root Cause

This is a design enhancement, not a claim that the entire sidebar is broken.
Current section chrome is a repeated neutral accordion. Rich asset plumbing
exists but does not cover section and rail marks, and the status detail-only
composition bypasses the existing activity-heading/icon presentation. Graphics
support and OpenTUI rendering cannot be inferred from an SVG or escape string.

### Evidence

- `cli/src/components/right-sidebar.tsx:212-213` mounts the single status home:
  `<SidebarSection title="Activity detail" id="Status" defaultExpanded>` and
  `<AgentStatus lifecycle={props.lifecycle} detailOnly />`.
- `cli/src/components/savant-ui/primitives/sidebar-section.tsx:40-44` reuses
  `useFoldCollapse` and `useSidebarControl`; preserve these behavior owners.
- `cli/src/components/savant-ui/echo/agent-icons.ts:63,73,125` maps `bash` and
  `read`, then falls back to the generic tool mark. Actual tool-call names
  such as `run_terminal_command` and `read_files` need semantic aliases.
- `cli/src/utils/terminal-images.ts:25,31,37,196` detects iTerm2, Kitty and
  Sixel; the Sixel rendering branch returns null. Cursor/Windows Terminal
  graphics are not enabled by this detection path.
- `cli/scripts/generate-savant-icons.ts:19,61,94-95` uses existing Resvg and
  a 256px raster target. Read-only census: manifest 132, SVG files 132;
  generated CLI module 1,635,673 bytes. This is source size, not measured
  packaged size, startup overhead or a performance regression.
- Manifest integration prose says unwired; production consumers already
  exist. Treat manifest prose as stale discovery metadata, not proof of reach.
- Historical preservation requirements were inspected in archived
  `FID-2026-1008-006-sidebar-command-console-visual-redesign.md`.

## Impact Assessment

### Affected Components

Candidate production touchpoints, not an implementation authorization:

- `cli/src/components/right-sidebar.tsx`, `right-sidebar-header.tsx`,
  `right-sidebar-sections.tsx`, `right-sidebar-summary.tsx`,
  `right-sidebar-rail-control.tsx`, `sidebar-rail.tsx`.
- Existing `savant-ui/primitives/sidebar-section.tsx`,
  `savant-ui/echo/agent-status.tsx`, `echo/agent-stack.tsx`,
  `echo/agent-icons.ts`, `savant-ui/savant-mark.tsx`.
- Existing `cli/src/hooks/use-savant-raster.ts`,
  `cli/src/utils/terminal-images.ts`, `cli/src/utils/glyphs.ts`.
- `cli/scripts/generate-savant-icons.ts` and the source manifest only if the
  approved rendering investigation establishes a need. Generated modules
  change through existing tooling, never by hand.
- `cli/src/components/terminal-command-display.tsx`,
  `cli/src/components/traffic-light-panel.tsx` and their existing tests for the
  terminal-command slice. Preserve `traffic-lights.tsx` behavior and colors.
- `art/icons/cyberpunk/` for approved additional authored SVGs and manifest
  entries, following the existing family grammar and build-time generation.
- Existing acceptance suites declared below; design evidence and session record.
- Dependencies, lockfile, release configuration and theme ownership require
  an explicit impact presentation before any change to those surfaces.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Layout, interaction or content regression during redesign
- [ ] Low: Cosmetic-only isolated change

Shared-tree clobbering, image ghosting after scroll/fold, lost footer context,
inaccessible controls and excessive chrome are the principal risks. No resets,
global formatting, bulk transforms or concurrent sidebar edits are authorized.

## Proposed Solution

### Approach

#### Immutable behavior; flexible presentation

Preserve section identities, content, conditional panels and data sources.
Keep Activity detail as the single home of runtime activity, phase, model,
mode and cost; do not restore a duplicate fixed status block. Preserve the
S identity, wordmark click interaction, centered rail, reachable fold control,
footer context/version placement and honest unknown/zero/error semantics.
F6 traversal, Enter/Space activation, Ctrl+B draft guard, Ctrl+G pass-through,
scroll reveal, manual fold stickiness and resize/theme state survive.

The visual appearance of fold arrows/buttons is explicitly changeable. Do not
mistake an older geometry/style assertion for an immutable product requirement.
Replace a style-specific assertion only after approval of the replacement,
retaining semantic click, focus, visibility and safe hit-area coverage.

#### Expressive HUD composition

- Operator supersedes old dimension budgets: size artwork, rows and sidebar
  to match the intended visual. Preserve basic topology and folding, not
  40/14-column dimensions. Production responsiveness needs a new approved
  geometry contract after design selection.
- Strong brand masthead using the S mark and existing wordmark; controlled
  circuit corner accents rather than a large new banner consuming detail space.
- Activity detail becomes an intentional instrument panel: activity mark and
  readable heading, bounded target/detail, then phase/model/mode rows. Runtime
  activity and FSM phase remain distinct. Avoid repeating the selected model
  as both a thinking detail and Model row when they are the same fact.
- Section headers share a chevron/control lane, semantic icon lane, title and
  right-aligned real count. Thin partial rules and corner ticks create the HUD
  grammar; do not frame every row with a full nested box.
- Agents use role marks plus separate active/inactive text or status indicators;
  artwork cannot replace the state signal currently carried by the glyph.
- Folded rail stays centered and labeled. Mark plus short label/count is the
  navigation grammar; do not make the rail an unexplained icon-only strip.
- Context/version footer remains anchored in spacious mode and reachable at
  the end of detail in short mode. Match existing density budgets before
  increasing header or footer height; retain at least six detail rows at 20.
- Semantic theme tokens own text, focus, warning and phase colors. Authored
  neon asset colors are decorative identity, not substitutes for phase truth.
  Light themes, custom themes and motion-disabled mode receive explicit checks.

#### Asset integration contract

Reuse SVG sources, Resvg build-time PNGs, generated names, existing raster
resolver and glyph fallback. Establish one semantic mapping for section/rail
slots, and reuse existing role/activity/tool mapping rather than parallel lists.

Suggested slots: Activity -> sidebar-activity; Session -> sidebar-session;
Trust -> sidebar-trust-matrix; FIDs -> sidebar-fid; History -> sidebar-history;
Loop -> sidebar-loop; Agents -> cmd-agents; Tools -> activity-tool;
Files -> obj-file. Brand uses logo-s at small size and logo only at a proven
larger footprint. Motifs are limited to masthead/separators, never every row.
Heavy coverage includes section headers, rail navigation, role/activity/tool
rows, FID/history indicators and terminal-command chrome; do not reduce the
operator's request to a handful of accents. New semantic SVGs are permitted
when the family lacks a suitable mark, using the same palette and geometry.
Terminal-command presentation is an approved planning slice: use tool-bash or
obj-terminal in its header, obj-folder for cwd and obj-clock for timeout,
without placing decoration inside raw command output or copied text. Keep the
existing TrafficLights, three-dot order/colors and right-aligned title bar.
TerminalCommandDisplay already uses TrafficLightPanel in both output branches;
extend that shared seam if needed instead of inventing a second terminal card.
Retain copy fidelity, status/exit-code truth, streaming and output expansion.
Other command-menu rollout requires separate presentation before implementation.
A phase-adversarial SVG can be authored if approved as the missing semantic mark;
its text/color still comes from the canonical phase mapping.

Original recognizable icons are mandatory. Operator rejected colored blocks,
re-created glyphs and monochrome areas as substitutes. Design mockups must use
unchanged original SVG bytes at readable sizes, preserving geometry and color.
A faithful high-resolution PNG conversion may serve a supported terminal pixel
protocol, but blocks/text do not satisfy the requested asset appearance. If
Cursor cannot deliver pixel art, report that incompatibility before integration;
do not silently choose a substitute. Browser concepts are explicitly design
mockups, not proof of terminal delivery.

Local OpenTUI 0.5.3 already provides ImageRenderable and React `<image>`.
Its native protocol resolver supports auto/kitty/sixel/blocks; NativeImage accepts
PNG bytes, not SVG as a declared image format. Prefer the existing build-time
SVG-to-PNG output through this native component over escape strings in text.
A probe decoded the actual logo-s PNG, selected blocks for a non-graphics host,
and rendered 32 visible cells at 8x4 after awaiting loadPromise. Destroying the
mark cleared all cells. The first premature frame was blank; loading/failure
states must preserve geometry and readable fallback. Native lifecycle-managed
images remove the need to invent a plugin just to establish asset rendering.
Tiny-mark legibility and actual Cursor graphics/appearance remain NEEDS-REVIEW.
A plugin is justified only by a measured missing capability and must be presented
with compatibility, maintenance, packaging and fallback costs. No dependency is
selected or installed yet. Graphics
must handle image lifetime on scroll, resize, fold, theme change and exit. Unknown
or failed capability returns text without raw escape leakage or cursor disruption.

No runtime rasterization, filesystem reads or network fetches for decorative
icons. Measure packaged bytes, representative redraw traffic and startup before
optimizing asset organization; the generated source size alone proves no slowdown.
Never transmit an entire 256px image on each token update as a design default.

### Steps

1. **completed (planning evidence only):** review source, inventory assets and
   run preservation baseline. No changed-code implementation is claimed.
   Visual Cursor baseline still needs a current capture.
2. **completed (ownership):** operator confirmed sidebar files are released.
   Fresh native preview captures are authorized; production baseline comparison
   remains required before integration.
3. **approved, executing:** operator selected Compare both previews. Build
isolated preview concepts (Loop 6 superseded the native block designs; the
   shipped browser concepts are Circuit Command Deck, Neon Observatory and
   Mission Control),
   using identical synthetic state, actual generated PNGs and native blocks.
   Production design selection remains approval-gated after comparison.
4. **blocked:** approve the detailed GREEN specification after document AUDIT,
   adversarial challenge and self-correction. Blocker: review checkpoints above.
5. **approved preview only:** implement the bounded comparison under
   cli/scripts/hud-preview*. No production component replacement, dependencies,
   generated-source edits or provider calls. Promotion requires visual approval.
6. **blocked:** integrate approved section/rail/activity assets and any measured
   renderer extension, preserving existing data/behavior seams. Same approval
   boundary; dependency changes additionally require a presented impact decision.
7. **blocked:** run final static/runtime/native/package gates and present actual
   before/after evidence. Blocker: implementation has not been authorized.
8. **blocked:** close/archive and update CHANGELOG only after live gates and
   authorized committed evidence. Blocker: implementation and commit authorization.

### Verification

Extend existing suites rather than duplicating them. Preserve actual native
renderer tests, not static markup as proof of layout or store state. Tests that
pin old styling must be reviewed against the approved new style without removing
behavior assertions. Asset name, fallback, tool aliases and role state remain
covered by existing icon/raster/agent suites listed below.

Capture full/folded/peek at 50x19, 99x24, 100x24, 120x12, 120x20 and 160x40;
cover dark/light, Unicode/ASCII, long/wide text, idle/tool/research/subagent,
connecting/retrying/paused, error/unknown values, motion off, populated and
empty/loading sections, conditional Teacher/Trust/Drive, repeated folds and
scroll to final content. Record cells/ANSI plus native visual captures. Cursor
appearance is NEEDS-REVIEW until checked in Cursor; Kitty/iTerm2 and other host
claims require their own evidence. Synthetic fixtures make no provider calls.

Run root typecheck and zero-warning lint, CLI regression, quality, markdown and
format checks, scope check and FID contract checks. Check the local distributable
from an unrelated working directory with no repository asset dependency; never
publish or deploy to perform verification. A passing test proves its assertions,
not graphics support, perceived polish, release readiness or all host coverage.

## Verification Gates

- gate: test cli/scripts/hud-preview.test.tsx
- gate: typecheck cli
- gate: test cli/src/components/__tests__/right-sidebar-single-home.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-responsive.test.tsx
- gate: test cli/src/components/__tests__/sidebar-rail-navigation.test.tsx
- gate: test cli/src/components/__tests__/right-sidebar-phase-color.test.tsx
- gate: test cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx
- gate: test cli/src/hooks/__tests__/sidebar-motion.test.ts
- gate: test cli/src/components/savant-ui/echo/__tests__/agent-icons.test.ts
- gate: test cli/src/utils/__tests__/savant-raster.test.ts
- gate: test cli/src/utils/__tests__/glyphs.test.ts
- gate: probe scripts/scope-register-check.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED, GREEN and document challenge

- **RED:** evidence above identifies incomplete semantic asset coverage, short
  tool-name mapping, detail-only activity bypass and unverified host graphics.
  Baseline behavioral tests pass; no global sidebar failure is asserted.
- **GREEN:** expressive HUD contract preserves the basic topology and behavior,
  allows revised fold visuals, keeps text-mode complete, and requires preview
  approval before production integration. Reuse existing asset generation.
- **AUDIT:** source/read-only census supports asset count and wiring findings.
  Native tests: 23 pass, 0 fail, 160 assertions across six files, exit 0.
  Development-mode SSR emitted React host-prop warnings; re-run the affected
  suite with the configured NODE_ENV=production: 10 pass, 0 fail, exit 0,
  without those warnings. No changed-code or fresh visual PASS is claimed.
- **ADVERSARIAL:** image support detection is not rendering evidence; the
  detailOnly path bypasses the icon; a role mark may erase state; older tests
  can freeze unwanted styling; decorative frames can consume the viewport.
  GREEN explicitly addresses all five, and gates retain behavioral assertions.
- **CHANGE DELTA:** initial record creation, no production changes.

### Missed Questions

1. What must remain? Basic layout and behavior, not old arrows or low-effort
   styling; current operator clarification supersedes earlier visual freezes.
2. Does Cursor show the existing images? Not established; default to complete
   text-mode and require an actual host capture before claiming artwork there.
3. Are dependencies needed? Not yet demonstrated; investigate local renderer
   first and present any extension before installation or runtime changes.
4. How heavy is asset coverage? The operator requests heavy cyberpunk coverage,
   including terminal-command chrome and permitted new SVGs. Semantic slots
   cover those surfaces; motifs support framing without obscuring information.
5. Can concurrent work be overwritten? No; re-read and compare current bytes
   before each edit, serialize ownership, never restore a whole older file.
6. Does a successful test approve design? No; operator visual approval and
   host evidence remain separate from behavioral/static gates.

### Loop 2 — Convergence boundary

- **RED / SELF-CORRECT:** the operator explicitly expanded asset coverage and
  terminal-command presentation. The earlier accent-only framing was too narrow.
- **GREEN:** heavy semantic coverage, optional authored SVGs and terminal-command
  chrome are included above. Existing traffic lights and raw output/copy remain
  invariant. Fold control appearance remains flexible with behavior protected.
- **AUDIT:** source inspection confirms TerminalCommandDisplay imports and mounts
  TrafficLightPanel in both branches; TrafficLightPanel mounts TrafficLights in
  its right-aligned title bar. Document checks follow scope registration. The
  detailed rendered design has not been selected.
- **ADVERSARIAL:** an illustrative text sketch cannot certify an expressive HUD.
  Missing native preview and operator selection block implementation convergence.
- **STATE:** analyzed, not converged, verified or closed. Continue the loop after
  ownership and visual checkpoints; no fabricated independent-agent review.

### Loop 3 — Native renderer capability audit

- **RED:** the earlier renderer strategy relied too heavily on the project's
  environment-only escape-string helper and underestimated native OpenTUI.
- **GREEN:** prefer ImageRenderable / React image using existing generated PNG
  bytes, native capability selection and blocks fallback. No plugin required
  for this first path. Heavy asset coverage remains an explicit design goal.
- **AUDIT:** installed core/react package versions are 0.5.3. Evidence:
  `node_modules/@opentui/core/renderables/Image.d.ts:7-15` declares source,
  fit, protocol, onLoad and onError; `types.d.ts:48` declares auto/kitty/sixel/
  blocks; React `src/types/components.d.ts:55` exports ImageProps.
  Native read-only probe: decoded 256x256 PNG; effective protocol blocks;
  8x4 rendered 32 nonblank cells; removal returned zero. Probe exited 0.
- **SELF-CORRECT:** first capture before load completion was blank. Awaiting
  loadPromise fixed the probe; no assertion was weakened. Production preview
  must handle async image load and errors without hiding essential content.
- **ADVERSARIAL:** a visible 8x4 logo does not establish recognizability at 2x1,
  color appearance in Cursor, clipping under scrolling or package behavior.
  Those remain required native/host/package checks, never inferred passes.
- **STATE:** analyzed. Native preview and operator design selection still
  precede implementation convergence. Production files remain unchanged.

### Loop 4 — Isolated preview specification convergence

- **GREEN:** operator approved Compare both previews and released sidebar files.
  Preview-only modules: hud-preview-components.tsx (native images and two
  compositions), hud-preview.tsx (capture/live runner), hud-preview-report.ts
  (local HTML report from captured native spans), hud-preview.test.tsx.
  Artifacts: dev/fixtures/sidebar-hud-comparison.html and matching JSON.
  Synthetic labels make no claims about real runs. Native images use generated
  PNG bytes with blocks protocol. No plugin or production edits required.
- **AUDIT:** use the same theme tokens, 40-column full sidebar and 14-column rail.
  Native preview must render activity, model, phase and footer, actual nonblank
  artwork, and three success/warning/error traffic dots. Sections toggle with
  Enter or click; basic live preview keys are documented, not advertised as
  production shortcut parity. Capture waits for native image loading.
- **ADVERSARIAL:** HTML is only a colored reproduction of native character spans,
  not browser DOM design and not a screenshot of Cursor. Short-height layout,
  image cleanup and artifact contents must be checked. Full product acceptance
  remains distinct; no preview can prove production state preservation.
- **CONVERGED:** bounded isolated preview specification has no remaining
  implementation blocker and is authorized. This does not converge or authorize
  production integration; the parent FID remains analyzed pending selection.

### Loop 5 — Preview implementation audit and self-correction

- **AUDIT:** preview native suite: 5 pass, 0 fail, 37 assertions, exit 0;
  cli typecheck exit 0; scoped ESLint zero warnings. Capture runner generated
  eight native records and HTML/JSON artifacts at the approved paths.
- **SELF-CORRECT:** preserve section choices in a parent-controlled Map across
  whole-sidebar remount. Native mouse/keyboard test now proves fold/unfold,
  14/40 widths, remembered section choice and context recovery. Mock keyboard
  uses pressEnter and literal space, not typing key-name strings.
- **ADVERSARIAL:** preview is not production parity. Small 4x2 artwork may be
  too coarse; repeated colorful marks consume height. The report exposes that
  tradeoff for operator selection rather than claiming visual perfection.
  HTML reproduces native spans but cannot prove Cursor font/graphics support.
  Traffic lights reuse the unchanged production primitive. No native capture
  implies command execution; all preview content is labeled synthetic.
- **STATE:** production specification remains analyzed; operator review next.
  Whole-sidebar and section fold options are explicitly retained.

### Loop 6 — Rejected previews and corrected design contract

- **RED:** operator screenshot shows colored blobs rather than recognizable
  authored icons. Nonblank-cell assertions prove rendering, not visual fidelity.
  Both native block concepts are rejected as design candidates.
- **GREEN:** author three interactive browser design concepts using original
  source SVGs as byte-preserving data URLs, not generated glyphs or block art.
  Preserve basic sidebar layout, sidebar/section folding and traffic lights.
  Old dimension budgets yield to recognizable artwork. Report artifact replaces
  the rejected comparison at dev/fixtures/sidebar-hud-comparison.html.
- **AUDIT specification:** verify each image's decoded SVG exactly equals its
  source file; browser-check loaded dimensions, visible original artwork,
  sidebar fold/unfold, section fold preservation, traffic lights and overflow.
  Use installed Playwright for local artifact verification, no new dependency.
- **ADVERSARIAL:** browser SVG support cannot be sold as Cursor terminal support.
  Label every concept and synthetic value honestly. A screenshot and operator
  review must assess recognizability; byte equality alone does not prove polish.
- **CONVERGED preview correction:** operator authorized trying several designs
  with 30 minutes left. The bounded comparison spec is ready; production FID
  remains analyzed. No production integration or terminal support is approved.

### Loop 7 — Asset-faithful concept verification

- **AUDIT:** three original-SVG browser concepts generated at the comparison
  HTML path. Source suite: 6 pass, 0 fail, 71 assertions; decoded SVG bytes
  equal source files. CLI typecheck and scoped ESLint pass. Local Chrome
  checks all three concepts: 47 loaded SVGs each, minimum visible size 24px,
  fold widths 110/116/112px, remembered section folds, keyboard activation,
  rail navigation, traffic lights, no horizontal overflow at 640px, no errors.
- **SELF-CORRECT:** Bun browser launch stalled; stop that task and run the
  installed Playwright checker under Node. Wait for fold transition geometry;
  reduced-motion screenshots produce settled evidence. No checks removed.
- **ADVERSARIAL:** image byte equality and loaded dimensions prove source
  fidelity and availability, not operator approval. Browser screenshots are
  design evidence only; Cursor delivery still unverified. Historical native
  block evidence is hidden and labeled rejected; the HTML headline cannot
  misrepresent these concepts as native rendering.
- **STATE:** analyzed; three bounded browser concepts ready for review.
  Production design, final resource measurements and terminal integration
  remain blocked on operator selection and faithful rendering capability.

### Loop 8 — Perfection pass over the planning record (2026-10-10)

- **RED (read-only tool output):**
  - `right-sidebar.tsx` mounts `Activity detail` with `AgentStatus detailOnly`
    (`cli/src/components/right-sidebar.tsx`, `SidebarSection id="Status"`).
    Confirmed.
  - `agent-icons.ts` maps `bash` and `read` to `ICON_ToolBash` / `ICON_ToolRead`.
    Confirmed.
  - `terminal-images.ts` detects iTerm2 and Kitty, and the Sixel branch
    returns null. Confirmed.
  - Baseline hashes for the six listed paths match the current tree exactly.
    Confirmed.
  - Gate test files named in Verification Gates all exist. Confirmed.
  - `docs/design/sidebar-cyberdeck-hud.md` does not exist. SCOPE T182 and the
    session summary both list it as a write target. **Defect.**
  - `.prettierignore` contains no `hud-preview` or `sidebar-hud` entry, and
    `dev/fixtures/` is untracked. The preview artifacts are not format-exempt.
    **Defect against the T179 format-clean claim.**
  - `cli/scripts/generate-savant-icons.ts` carries an uncommitted diff of
    +128/-2. It adds `EXPORT_ICON_SLOTS` / `savantExportIconSvg` and a desktop
    emission to `desktop/src/icons.generated.ts`. That belongs to the T177 /
    FID-2026-1009-004 surface, not this FID, and this FID's Steps say generator
    edits are unauthorized. **Unattributed change in a file this record names.**
  - `cli/scripts/generate-cytoscape.ts` also has an uncommitted comment-only
    diff. Unattributed, outside this FID's surface.
- Comparison HTML image counts (corrected after AUDIT): `grep -o '<img'` finds
    178 tags and `grep -o 'data-source='` finds 178 attributes. An earlier `grep
    -c` reported 74, but that counted matching lines, not elements, and is
    withdrawn. The browser checker records 47 loaded images per design, 141 across
    three panels. The 178 total includes the labelled rejected block-art appendix
    and any non-design sections, so the figures are not yet reconciled per design.
    **NEEDS-REVIEW.**
  - Prettier on `dev/fixtures/sidebar-hud-comparison.html`,
    `cli/scripts/hud-preview.tsx` and `cli/scripts/hud-preview-components.tsx`
    reports `[warn]` for all three (summary: "Code style issues found in 3 files").
    The T179 format-clean claim does not cover these files. **Defect.**
  - Sixel branch: confirmed by tool output. `cli/src/utils/terminal-images.ts`
    `renderInlineImage` has `case 'sixel':` returning `null`, and `grep -n -i
    sixel` lists the detection (line 37) and the null branch (line 196). A
    separate AUDIT grep that reported no matches was against the wrong string and
    is not evidence either way.
- **GREEN (document corrections only, no code):**
  - Step 3 design names corrected to the shipped concepts (above).
  - The missing design document is a blocker. It must be authored under
    `docs/design/` before any step that cites it can close.
  - The generator diff is blocked for attribution. It is not authorized as part
    of this FID and must be attributed to FID-2026-1009-004 or reverted by the
    operator before Step 6.
  - Element-level count reconciliation is added as a pre-Step-4 check.
- **AUDIT:** Verifier pass (2026-10-10). Each claim below is backed by tool output
  in this session:
  - Activity-detail mount, bash/read icon mapping, missing `docs/design` file,
    `.prettierignore` gap, generator diff and baseline hashes: confirmed by
    command output recorded above.
  - Prettier: `[warn]` on three files (basher output). Defect, not PASS.
  - Image counts: reconciled to 178 and corrected; per-design count still open.
- Verifier-flagged items without visible output (the `ls` of gate test files,
    the baseline `sha256sum` output, and the "74" count) are NOT re-verified in
    this pass. They stay NEEDS-REVIEW until re-run. The earlier Sixel "no match"
    report came from a grep the Verifier misread; the file read above is the
    evidence. No PASS is claimed for any production behavior.
  - Remaining ADVERSARIAL item "Bun launch stall" has no tool output in this
    session. It stays NEEDS-REVIEW, operator-reported.
- **ADVERSARIAL:** the browser evidence JSON may be stale if the comparison HTML
  was regenerated after the checker ran. That cannot be ruled out without
  re-running the checker, which the operator-observed Bun launch stall
  complicates. The `.prettierignore` defect is real only if the format gate
  scans `dev/fixtures/`; this was not run in this pass.
- **STATE:** analyzed. The loop cannot converge: Steps 4 through 8 remain blocked
  on operator selection and commit authorization, and the three defects above
  are open. No production files changed in this pass.

### Implementation Evidence (REQUIRED for closed)

No production implementation or commit is claimed by this FID. Step statuses
above explicitly name approval and environment blockers. Existing icon work
belongs to its existing record, not to this modernization FID.

### Code Verification Evidence

Baseline source fingerprints and test output are recorded in the session
summary. Fresh production call-graph, final changed-code audit, renderer evidence
and gate receipt are required after implementation; none is pre-certified here.

## Resolution

- **Archived-Declined:** operator-approved 2026-10-11 — "alright so im not
  doing the deck, the sidebar was canclled as well because we could not
  complete it. I tried it earlier today and it failed."
- **Disposition:** Operator cancelled this cyberdeck/sidebar redesign after
  the attempted sidebar experience failed. No production integration is
  claimed. The planning record and rejected/failed preview evidence are
  retained here; the feature is not active work.

**Historical operator approval (2026-10-10; superseded by the 2026-10-11
cancellation above):** design 8 (Holo Frame, magenta accents, raised
inner panels, centered header with logo, "Savant" and version beneath) is the
approved direction. Decisions: keep the ASCII `S` fallback; design 8 is first
class; first section is Session; `docs/design/sidebar-cyberdeck-hud.md` is
authored as the design record. Generator diff and preview formatting remain
open Loop 8 defects, not part of this change.

Historical planning state before cancellation: Loop 8 (2026-10-10) corrected stale naming and recorded three
open defects: a missing design document, an unexempted preview fixture set, and an
unattributed generator diff. The element-level image count is unreconciled. The
operator retains design and implementation approval. No production/sidebar files
changed in this pass.

## Lessons Learned

Preserve product behavior, not accidental styling. A redesign should earn visual
approval in the real renderer while regression tests protect the operational
contract; neither evidence source can stand in for the other.
