# Sidebar cyberdeck HUD planning — 2026-10-09

## Intent and approvals

The operator requests an expressive HUD redesign preserving the basic sidebar
layout, not its existing low-effort styling. Fold controls may change. Heavy
cyberpunk icon coverage and additional authored SVGs are requested, including
terminal-command presentation while retaining traffic lights. Cursor is the
primary host; the public npm package must retain cross-terminal fallbacks.
Full FID and Perfection Loop planning are authorized. Production changes and
native preview implementation remain approval-gated under automation level 1.

## Durable record

- Active FID: `dev/fids/FID-2026-1009-008-sidebar-cyberdeck-hud-modernization.md`.
- Register item: T182 in SCOPE.md; planning-only write targets.
- Status: analyzed. Initial RED/GREEN/document challenge and operator-driven
  SELF-CORRECT are recorded; no convergence or implementation PASS claimed.
- Other session owns in-flight work. Confirm sidebar ownership before edits,
  re-read current bytes and preserve their changes. No resets or bulk formatting.

## Baseline evidence

Native test command from cli workspace:

```text
bun test src/components/__tests__/right-sidebar-single-home.test.tsx
  src/components/__tests__/right-sidebar-responsive.test.tsx
  src/components/__tests__/sidebar-rail-navigation.test.tsx
  src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx
  src/components/__tests__/right-sidebar-phase-color.test.tsx
  src/hooks/__tests__/sidebar-motion.test.ts
23 pass; 0 fail; 160 assertions; six files; exit 0.
```

Development-mode static-markup suite emitted React host-prop warnings. Re-run
with the CLI package's configured production test environment:

```text
NODE_ENV=production bun test
  src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx
10 pass; 0 fail; 40 assertions; exit 0; no React host-prop warnings.
```

These are preservation baselines, not final design, graphics or package gates.

Read-only census: manifest 132 entries, directory 132 SVGs; generated CLI
module 1,635,673 bytes. No startup or packaging performance conclusion drawn.
Existing generator uses Resvg build-time PNGs; no new dependency needed yet.
Graphics detection covers Kitty/iTerm2; Sixel renderer returns null. Cursor
SVG-derived image presentation remains NEEDS-REVIEW in the actual host.

Baseline hashes at 2026-10-10T02:27:08.315Z UTC:

```text
right-sidebar.tsx
77c897a71664b74af44cbdaf4854e550cba3bb1737ab032fffe9a14ee463c666
sidebar-rail.tsx
4e16b4779b209af5b6e45abe24a8c485c16abdf416b8147e78a4addb8e6cbd87
right-sidebar-header.tsx
61f547c289d55affab51806f82e8baa5d9ae3f37214c10486df3b3456cec3dc0
savant-ui/echo/agent-status.tsx
0187e531f98d925f1c99f8578f39078623156a8634434aa67a42df33bd85b269
savant-ui/primitives/sidebar-section.tsx
 a2bdf2245f825933150daf635e07f7991c570d6f571dab2eec344161f445a559
cli/src/utils/terminal-images.ts
 d6bfef71222008503efdf790458e40c0d1779fb253be90b9e293e4959582ecca
```

First five paths are under cli/src/components/. Hashes are change-detection
references, not authority to restore old versions over concurrent work.

## Proposed composition

Retain brand/top, scrollable details, bottom context/version and centered rail.
Use coordinated instrument-panel activity, icon lanes, semantic counts, partial
circuit rules and redesigned accessible fold controls. Heavy semantic asset
coverage is required; a logo plus a few icons does not satisfy the request.
Keep activity/phase/model/mode in one home, all existing conditional panels,
truthful data and phase colors. Preserve focus, drafts, scroll/folds and density.
TrafficLightPanel remains the terminal-card owner; preserve its right-aligned
TrafficLights and raw output/copy semantics. Additional SVGs follow the family.

## Resume — native image capability finding

Installed OpenTUI core/react 0.5.3 exposes NativeImage, ImageRenderable and
React image. Native protocols include auto, kitty, sixel and blocks. This is
a stronger integration seam than the project's environment-only text escape
helper and needs no additional graphics plugin for the first preview.

Read-only native probe, using the actual generated logo-s PNG:

```text
Decoded: 256x256 PNG, alpha true.
Non-graphics host auto resolution: blocks.
First frame before async image loading completed: blank.
After awaiting loadPromise: 8x4 mark, 32 nonblank character cells.
After destroy and render: zero nonblank cells.
Exit 0; no production files changed.
```

The blank initial frame was corrected by awaiting image loading, not by
weakening a check. This does not prove tiny-icon legibility or actual Cursor
color appearance. Native preview must cover geometry, load/error fallback,
scroll clipping, resize and cleanup; host review remains explicit.
FID Loop 3 records the capability audit and revised integration strategy.

## Authorized comparison preview — resume

Operator selected Compare both previews and confirmed sidebar files are released.
The preview-only specification converged in FID Loop 4 before code was written.
Both whole-sidebar and individual-section folding remain required.

Created isolated modules under cli/scripts/hud-preview*. Production sidebar and
terminal components were not edited; TrafficLightPanel is reused unchanged.
Actual generated PNGs render through native image blocks; text-only variants
retain labels. The native report is a span reproduction, not a Cursor screenshot.

Verification after corrections:

- Native suite: 5 pass, 0 fail, 37 assertions, exit 0. Includes mouse section
  fold, mouse whole fold, keyboard unfold, section choice preserved through
  remount, keyboard section re-expansion and footer recovery.
- CLI typecheck: exit 0 after preview implementation.
- Scoped ESLint: zero errors/warnings after import-order correction.
- Capture interface: generated 8 native frames, full/folded, blocks/text,
  100x40 and 100x24, for both designs.
- Actual artifacts: dev/fixtures/sidebar-hud-comparison.html (191,493 bytes at
  this capture) and sidebar-hud-comparison.json, eight records verified.
- Native capture defects corrected: async image loading awaited; unspecified
  border created unintended framing, so circuit headers omit borderColor when
  border is false; parent-controlled fold map preserves choices across remount.
- Mock key input must use pressEnter() or literal space: typing the word
  enter/space is not a keyboard Enter/Space event. Assertions were retained.

Live interface (from cli): NODE_ENV=production bun run scripts/hud-preview.tsx
--live. Keys: 1/2 select design, b folds sidebar, a toggles blocks/text, q exits.
Mouse toggles sections and folds; native keyboard activation is test-covered.
Live host appearance, final design polish, tiny-image recognizability, light
variants, full repository gates and distribution packaging are not certified.

## Original-SVG correction — three concepts

Operator rejected both native block concepts: the actual authored icons must
be recognizable, not re-created or reduced to colored areas. Old dimensions
are not a design constraint. The 30-minute remaining-session directive
authorized trying several replacement designs; FID Loop 6 converged the
bounded browser-mockup correction before source changes.

The comparison HTML now contains Circuit Command Deck, Neon Observatory and
Mission Control. Every icon image embeds unchanged source SVG bytes; source
unit checks compare decoded bytes against art/icons/cyberpunk/. No asset files
or production sidebar components were changed. Browser mockups are explicitly
not terminal screenshots or proof of Cursor support. The rejected block frame
is hidden under a labeled evidence appendix, not a current concept.

Final verification:

- Unit/native suite: 6 pass, 0 fail, 71 assertions, exit 0, including original
  SVG byte equality for 25+ unique files and retained native fold baselines.
- CLI typecheck exit 0; scoped ESLint zero warnings.
- Actual local Chrome/Playwright check: three designs, 47 loaded SVG images
  each, smallest visible image 24px; sidebar folds settle to 110/116/112px;
  section state survives folds; keyboard Enter and rail History reveal work;
  three traffic dots per panel; 640px report has no horizontal overflow;
  zero browser page errors. These are browser design checks only.
- Bun browser launch hung; it was stopped. Node execution of the same
  locally compiled checker succeeded. An animation timing assertion was
  corrected by waiting for the actual folded geometry, retaining the check;
  final screenshots use reduced-motion mode for stable evidence.
- Saved six full/folded concept PNGs under dev/fixtures/sidebar-hud-*.png and
  sidebar-hud-browser-evidence.json. HTML embeds original SVGs without external
  asset dependencies. The matching comparison JSON remains historical native
  block evidence, not a claim that browser concepts are native frames.

Browser-check reproduction from cli workspace: build
scripts/hud-preview-browser-check.ts with bun build --target node --packages
external into ../dev/scratchpad/hud-browser-check.mjs, then run that file with
node. The checker uses the local Chrome installation; no dependency installed.

## Next checkpoints

1. Review the three original-SVG concepts and choose/refine the direction.
2. Continue FID AUDIT/self-correction to production specification convergence.
3. Verify actual Cursor appearance and integrate only after explicit approval.
4. Run final product preservation, native, repository and package gates.

No production files, dependencies or generated icon assets were changed here.
Preview source and comparison artifacts were created under approved T182 targets.
No commit, push, publish or release was performed.
