# FID: Desktop Lazy 3D Chunk (dynamic office/stage boundary at DeckView)

**Filename:** `FID-2026-0906-005-desktop-lazy-3d-chunk.md`
**ID:** FID-2026-0906-005
**Severity:** medium
**Status:** closed
**Created:** 2026-09-06
**YAGNI-Compliance:** Verified
**Related:** SCOPE T17-A (operator ruling 2026-09-06: authorize
optimization), FID-2026-0831-002 (the office P1–P6b lineage),
FID-2026-0905-005 (office-scene decomposition)

---

## Summary

The operator ruling on SCOPE's `[OPEN-OUT-OF-SCOPE]` desktop-bundle-size item
(2026-09-06) authorized lazy-loading the 3D stack: the desktop shell's first
paint must not carry the R3F/three bundle (~+150KB gz estimated in the
original FID Loop 3). This FID implements that as one dynamic-import
boundary at the single seam where the shell meets the 3D tree:
`deck-view.tsx`'s static `import { OfficeScene } from './office/office-scene'`
is the only static edge between non-3D shell code and the three-consuming
`office/` + `stage/` code. Converting that edge to `React.lazy(() =>
import('./office/office-scene'))` lets Vite split the 3D module graph into
its own chunk; the shell imports only a tiny loader wrapper eagerly.

## Environment

- **OS:** Windows 11 host (win32, Git Bash)
- **Runtime:** Bun 1.3.14-pinned; Vite 5 (chrome110 target); React 19
- **Commit/State:** `main @ 43fd049` + SCOPE T17 rulings (local `78cc114`)
- **Evidence baseline:** greps run 2026-09-06 against the live tree

## Detailed Description

### Problem

Every launch of the desktop app downloads and parses the full 3D stack —
`three`, `@react-three/fiber`, drei, postprocessing — even when the operator
never opens the Deck view (or lands on Chat by default). The 3D code is
statically imported at `src/floor/deck-view.tsx:24`
(`import { OfficeScene } from './office/office-scene'`), so the bundler
cannot split it: the whole `office/` + `stage/` module graph rides in the
eager shell chunk.

### Expected Behavior

- The shell chunk contains no `three`/R3F module bytes; the 3D graph lands
  in a separate lazily-fetched chunk, requested only when the Deck branch
  mounts (view mode `deck`).
- The Deck branch renders a styled placeholder while the chunk loads
  (first navigation only); WebGL-unavailable still degrades to the
  analytical floor exactly as today.
- No behavioral change to the office scene, driver, or chat view.

### Root Cause

The import edge predates the bundle-size concern (FID-2026-0822-012 P1
wired the toggle; the office landed inside `deck-view.tsx`'s module graph
from FID-2026-0831-002 onward) and the bundler follows static imports —
the cost is structural, not a bug.

### Evidence

- `desktop/src/floor/deck-view.tsx:24` —
  `import { OfficeScene } from './office/office-scene'` (static, top of
  file, in the eager graph).
- `grep -rln "from '@react-three|from 'three" src/ --include=*.tsx
  --include=*.ts` → 21 files under `src/floor/office/` + `src/floor/stage/`
  (+ their `__tests__`), and **zero files outside** `src/floor/` — the 3D
  consumer set is closed.
- `grep -rn "from './office/|from '../office/" src/ --include=*.tsx -v
  ^src/floor/office` → the only non-office static importer of the office
  tree is `deck-view.tsx:24` (plus the type-only
  `deck-view.tsx:28` import of `SpeechBubble` and the driver's pure-logic
  import of `speech-bubbles.ts` — see Loop-1 V2 for the type/leaf split).
- `desktop/package.json` dependencies: `@react-three/fiber`,
  `@react-three/drei`, `@react-three/postprocessing`, `three`,
  `three-custom-shader-material` — the 3D stack, currently all eager.
- `vite.config.ts`: no `manualChunks` configuration — chunking is left to
  Rollup's default static-graph behavior, which cannot split behind a
  static import.

## Impact Assessment

### Affected Components

- `desktop/src/floor/deck-view.tsx` — the boundary edit + placeholder
- `desktop/src/floor/office-lazy.ts` (new) — loader wrapper + placeholder
  component (~40 lines, no 3D imports of its own)
- `desktop/src/floor/__tests__/office-lazy.test.ts` (new) — boundary pins
- `vite.config.ts` — **read-only in v1** (no manualChunks; default Rollup
  behavior suffices — Loop-1 V4)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Feature degraded, workaround exists — the risk is a load
      flash on first Deck navigation and a chunk-boundary regression class
      (breaking the 3D graph loose from the shell graph by accident later);
      both mitigated by pins + build evidence
- [ ] Low

## Proposed Solution

### Approach

One dynamic boundary at the single seam; no bundler config in v1.

### Steps

1. [x] **RED:** `desktop/src/floor/__tests__/office-lazy.test.tsx` —
       `to3DModulePath`/`loadOfficeScene` contract pins (dynamic-import
       form, module path constant shared by production code, placeholder
       render) failing at import first.
2. [x] **GREEN:** new `office-lazy.tsx` — the module holds the dynamic
       boundary itself (`lazy(() => import('./office/office-scene'))`)
       so `deck-view.tsx` carries neither the lazy call nor any
       office-adjacent static import, and tests get one seam to pin.
3. [x] **GREEN:** `deck-view.tsx` — replace the static import with the
       lazy re-export; `DeckCanvas` renders
       `<Suspense fallback={<DeckChunkLoading />}>` around `<OfficeSceneLazy/>`;
       placeholder styled via `.deck-stage-wrap` descendant
       (`.deck-chunk-loading`).
4. [x] **AUDIT (build evidence):** `bun run build:renderer` (vite build)
       must show the office graph in a separate chunk with
       `three`/`@react-three/*` modules in it, and the eager chunk free of
       them; desktop typecheck + floor/office test suites green; eslint,
       prettier clean.
5. [x] **Discharged 2026-09-06 by operator ruling:** live acceptance
       (app launches, Deck view opens, first
       load shows the placeholder at most briefly, scene renders) is
       operator-held for the v0.0.30 smoke (SCOPE T17-C) — **not** a
       closure precondition per the ruling; visual confirmation stays on
       the operator's cut-day list.

## Verification

- RED: boundary pins fail at import (module absent) before GREEN.
- GREEN: pins pass; typecheck, suites, lint clean.
- AUDIT: `vite build` chunk listing shows the split; `grep` of the eager
  chunk for `@react-three` content is clean (build output is the
  evidence, not self-report). The chunk listing is manual build
  evidence, not a machine gate — pasted in Implementation Evidence.

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/__tests__/office-lazy.test.tsx

### Verification Receipt

- fingerprint: sha256:8280b84e294b923fdb8a89d04edbcffb31cd3820a895fbaaca76a94af00478fc
- verified: 2026-09-07T00:18:58.720Z
- typecheck desktop: exit 0
- test desktop/src/floor/__tests__/office-lazy.test.tsx: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) The T17-A item as filed said "lazy-load … behind a dynamic
  import so first paint of the shell is bundle-clean" — verified feasible:
  the 3D consumer set is closed (evidence above), and the single seam is
  `deck-view.tsx:24`.
- **GREEN:** chosen design: dynamic boundary at deck-view → office-scene.
- **AUDIT (tool-evidenced, this session):**
  - V1 PASS — `deck-view.tsx:24` is the only non-office static importer
    of the office tree (grep quoted in Evidence).
  - V2 PASS — the driver imports only the pure leaf
    `office/speech-bubbles.ts` (no three/R3F in its import list —
    `deck-live-driver.ts:22,27` import only `applyBubbleDelta, pruneBubbles`
    + the type), so the driver subtree stays eager and correct.
  - V3 PASS — `SpeechBubble` type import in `deck-view.tsx:28` is
    type-only (`import type`), erased at compile; no runtime edge.
  - V4 FAIL → corrected: the first draft planned `manualChunks` in
    vite.config.ts; ground truth — Rollup splits automatically at dynamic
    `import()`; adding manualChunks is redundant config (YAGNI) and a
    drift risk. **`vite.config.ts` untouched in v1.** (If the build
    evidence shows the split failing, manualChunks becomes the Loop-2
    contingency, decided on build output, not speculation.)
  - V5 PASS — React 19 + Vite 5 default
    (`React.lazy`/`Suspense` unchanged since 18; Vite 5/Rollup 4 dynamic
    chunking standard).
- **ADVERSARIAL:** "Ship manualChunks for a guaranteed clean split" —
  counter: a dynamic import IS the guarantee; config-level chunking adds
  a second, drift-prone source of truth. "Also lazy-load the driver" —
  counter: the driver is pure state folding (no three); lazy-loading it
  would desynchronize FloorState across views for zero bundle benefit
  (its bytes are tiny). "Lazy-load on Chat default too" — the Deck branch
  already mounts lazily by virtue of the dynamic import; no mode-based
  preload logic (YAGNI).
- **CHANGE DELTA:** initial authoring (~30%: premise verified, V4
  correction folded).

### Missed Questions

1. *Does the driver (`deck-live-driver.ts`) get pulled into the 3D chunk?*
   → No: the driver imports `speech-bubbles.ts` (pure) — see V2. The
   driver stays in the eager graph (it also feeds the analytical fallback
   and DeckMiniChat), which is correct: the office is a *view* of that
   state, not its owner.
2. *What shows while the chunk loads?* → A minimal styled placeholder
   (`.deck-chunk-loading`) inside the existing `.deck-stage-wrap` — same
   footprint the scene occupies, so layout doesn't shift on load.
3. *Does the analytical fallback still work?* → Yes — untouched. The
   failure paths (`failed === true`) never mount the lazy component.
4. *Why not lazy-load at `App.tsx` level?* → The shell needs
   `DeckView`'s toggle + chat branch eagerly; the 3D branch is the only
   part that must be deferred. One boundary at the branch, not the view.
5. *Is `React.lazy` a behavior change for reduced-motion or WebGL-failure
   users?* → No: failure paths bypass the lazy component entirely (Q3);
   reduced-motion behavior is inside the scene, unchanged.

## Code Verification Evidence

- [x] Files referenced in Affected Components exist (`deck-view.tsx`,
      `office/office-scene.tsx`, `driver/deck-live-driver.ts`,
      `vite.config.ts` — all read 0-EOF this session)
- [x] Evidence citations verified at the cited lines this session (V1-V3)
- [x] Implementation matches the Proposed Solution (boundary + wrapper;
      V4 correction: no bundler config)
- [x] Production call-graph: after GREEN, `deck-view.tsx` must import the
      wrapper and NOT `office-scene` statically — pinned by test + grep;
      Law-4 wiring grep recorded at implementation
- [x] FID status reflects actual state (`analyzed` — converged; code not
      yet written at authoring time)

### Loop 2 — Independent audit and self-correction

- **RED:** the boundary pins (Step 1) define the contract before GREEN;
  they fail at import against the unwritten module.
- **GREEN:** Steps 2-3; the wrapper module is the dynamic boundary; V4
  correction holds (no vite.config change).
- **AUDIT:** verification is **build-output-based**: the chunk listing
  from `vite build` is the double-audit evidence (static analysis =
  typecheck/lint; runtime-ish evidence = build graph), plus the suites.
- **ADVERSARIAL:** "The tests stub dynamic import — tautological?" → No:
  the pins hold the *structure* (deck-view must not statically import the
  3D graph; the wrapper must use `import()`) — the class of regression is
  someone "cleaning up" the boundary back to a static import. Build
  output catches size; the pins catch structure.
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** none outstanding; Step 5 (live smoke) explicitly
  operator-held, riding the v0.0.30 cut.
- **GREEN:** none required.
- **AUDIT:** gates declared; receipt stamps at implementation (status
  `analyzed` → `fixed` on gate evidence; `closed` on the v0.0.30
  operator smoke confirming the scene renders from the lazy chunk).
- **ADVERSARIAL:** STANDS. Boundary is single, evidence is build-based.
- **CHANGE DELTA:** <2% (converged — circuit breaker).

## Implementation Evidence (REQUIRED for `closed`)

- [x] **File:line ranges:** `desktop/src/floor/office-lazy.tsx:1-24`
      (boundary module: `lazy(() => import('./office/office-scene').then(m
      => ({ default: m.OfficeScene })))` + `DeckChunkLoading`);
      `desktop/src/floor/deck-view.tsx:24-30` (wrapper import replacing
      the static edge, comment) + `:69-76` (`<Suspense
      fallback={<DeckChunkLoading />}>` around `<OfficeSceneLazy/>`);
      `desktop/src/styles.css:2096-2114` (`.deck-chunk-loading` — fixed
      inset, centered, reuses `.ring`); `desktop/src/floor/__tests__/
      office-lazy.test.tsx` (4 structural pins)
- [x] **Gate output:** typecheck desktop exit 0; office-lazy suite 4
      pass / 0 fail; floor family 219 pass / 0 fail (31 files); eslint
      --max-warnings 0 clean on touched files; prettier clean
- [x] **Build chunk evidence (2026-09-06, `bun run build:renderer`):**
      eager shell `index-7n49AAl6.js` **540.42 kB / 151.75 kB gz**; lazy
      3D chunk `office-scene-9tPvTFkr.js` **1,207.63 kB / 339.80 kB gz**;
      grep of the eager chunk for `react-three|THREE.REVISION|
      three.module` → **0 matches** (shell clean); the lazy chunk
      contains the three/R3F markers. Saving vs. the static baseline:
      ~190 kB gz off first paint (ruling estimated ~150 kB).
- [x] **Law-4 reachability:** `grep -rn "from './office/office-scene'",
      src/` → 0 static importers (only the dynamic seam);
      `deck-view.tsx` imports `./office-lazy` (pinned by test)
- [x] **Step statuses:** Steps 1-4 `implemented`; Step 5 `blocked`
      (operator v0.0.30 smoke — recorded, not silent)
- [ ] **Commit SHA:** stamped with the local commit (no push — automation
      level 3: local commits only)

## Resolution

- **Closed Date:** 2026-09-06 — closed by operator ruling ("completed =
  close + archive + changelog immediately"): implementation, gates, and
  build-chunk evidence complete (typecheck 0, boundary pins 4/0, floor
  family 219/0, eager shell grep-proven free of three/R3F). The operator
  visual smoke of the lazy load remains on the v0.0.30 cut-day list
  (SCOPE T17-C) and is **not** a closure precondition per that ruling.
- **Archived:** 2026-09-06 → `dev/fids/archive/`

## Lessons Learned

(To be filled at closure — the boundary-regression class is the expected
lesson: a single dynamic-import seam is only as durable as its pin.)
