# FID: Robot Cast Invisible Under Reduced Motion

**Filename:** `FID-2026-0824-032-robot-cast-invisible-under-reduced-motion.md`
**ID:** FID-2026-0824-032
**Severity:** critical
**Status:** closed
**Created:** 2026-08-24 22:35
**Author:** Orchestrator (hybrid direct write; operator bug report 2026-08-24)
**YAGNI-Compliance:** Verified

---

## Summary

The 10-role robot cast has NEVER been visible on the operator's machine across
every launch since the deck first shipped — not as GLB robots, not as the
bright emissive fallback silhouettes — while station chips, grid, and
nameplates render normally. Root cause (mechanically confirmed against the
operator's OS): Windows client-area animations are OFF on this machine, so
WebView2 reports `prefers-reduced-motion: reduce`; the P6 reduced-motion path
paints exactly ONE static frame at mount time — BEFORE any async figure
factory resolves — and parks the ticker forever. The entire cast mounts into a
canvas that is never rendered again.

## Environment

- **OS:** Windows 10+ (Tauri v2, WebView2)
- **Language/Runtime:** TypeScript, Bun 1.3.14; three ^0.185.1; React 19
- **Commit/State:** main @ v0.0.27 (working tree; release-only-commits)

## Detailed Description

### Problem

Operator report (2026-08-24): "we still have no robots, and still uses the
wireframe floor... they have NEVER shown up." Distinguishing observation:
multiple nameplates ARE visible, but nothing else — no robots, no fallback
silhouettes, no atmosphere effects, no trails.

### Expected Behavior

All 10 figures render within seconds of deck mount regardless of motion
preference. Reduced motion freezes ANIMATION but must still paint mounted
objects.

### Root Cause (mechanically confirmed)

`deck-runtime.ts` → `applyMotionPreference()`: when reduced motion is active
it runs `syncLiveLayers()` once and renders ONE static frame, then never
starts the ticker. At that moment every `WalkerLayer` figure factory promise
is still pending (GLB load takes ~1-8s), so the frame contains zero cast
figures. When factories resolve milliseconds later, `mountFigure` adds meshes
to a scene graph that will never be rendered again.

Evidence chain:

```text
1. Registry probe (PowerShell, this session):
   HKCU\Control Panel\Desktop UserPreferencesMask byte0 = 0x9E
   -> bit 0x20 clear -> CLIENTAREAANIMATION=OFF
   -> WebView2 matchMedia('(prefers-reduced-motion: reduce)') = true.
2. Symptom geometry matches exactly: sync-mounted StationLayer (chips,
   nameplates) + GridHelper + void plane visible in frame one; async-mounted
   WalkerLayer contents absent forever; atmosphere frozen at t=0 ("no
   effects like we planned"); trails never spawn (no ticks).
3. Falsified alternatives: frustum culling (FID-2026-0822-012 hotfix),
   dark emissive (FID-2026-0824-028), missing .catch on mount chain +
   telemetry gap (FID-2026-0824-030) — all real defects, none were THIS
   defect; the cast was mounted-but-unpainted the entire time.
```

## Impact Assessment

### Affected Components

- `desktop/src/floor/stage/deck-walkers.ts` — new onCastSettled hook
- `desktop/src/floor/stage/deck-runtime.ts` — repaint wiring
- `desktop/src/floor/__tests__/deck-walkers.test.ts` — regression tests
- `desktop/src-tauri/tauri.conf.json` — identity branding (operator ask,
  rides this pass): window title "Savant" -> "Savant Code v0.0.27";
  productName "Savant" -> "Savant Code"
- `desktop/index.html` — webview `<title>` -> "Savant Code v0.0.27"

### Risk Level

- [x] High: flagship feature invisible on every reduced-motion machine

## Proposed Solution

### Approach

Reduced motion means "no ONGOING animation", not "never paint new objects."
WalkerLayer gains an `onCastSettled` callback fired exactly once when the last
factory settles (real figure OR catch-fallback); deck-runtime repaints
(`syncLiveLayers` + `stage.render()`) at that moment. Harmless extra frame
when the ticker is running; THE frame when it is parked.

### Steps

1. `deck-walkers.ts`: `WalkerLayerOptions.onCastSettled`; pending-counter
   fires once via `.finally()` after all 10 factories settle.
2. `deck-runtime.ts`: pass callback that re-syncs layers + renders one frame.
3. Tests: settled-fires-once (success path); fires-once-under-rejection
   (fallback path still mounts full cast).
4. `tauri.conf.json`: title branding per operator ask.

### Verification

- Full battery: prettier/eslint clean x4 files; typecheck exit 0;
  199 pass / 0 fail (988 expect()) incl. both new tests
- Operator re-smoke: robots/fallbacks VISIBLE on their machine; title shows
  "Savant Code v0.0.27"

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/__tests__/deck-walkers.test.ts

### Verification Receipt

- fingerprint: sha256:ada731e32c43c6e78eff1601fd2bb59a3caa8f50d49f49206d1d09cb70043823
- verified: 2026-08-26T03:55:49.980Z
- typecheck desktop: exit 0
- test desktop/src/floor/__tests__/deck-walkers.test.ts: exit 0

## Perfection Loop

### Loop 1

- **RED:** Nameplates-visible/robots-invisible contradiction localized the
  failure to paint-vs-mount timing; registry probe confirmed reduced motion
  ON (byte0=0x9E); code read confirmed static-frame-before-resolve ordering.
- **GREEN:** IMPLEMENTED (2026-08-24 ~22:40 EDT): onCastSettled hook +
  runtime repaint wiring + two regression tests + title branding. Gates:
  full battery green (see above).
- **AUDIT:** receipt stamp re-executes both declared gates mechanically.
  Independent Verifier review of the riding branding change (productName +
  html title, 2026-08-24 ~23:00 EDT): PASS WITH CONDITIONS — all conditions
  dispositioned same pass: (1) version-triple drift risk (conf `version`
  field vs window title string vs html `<title>`) recorded as a release-
  checklist item pending build-time single-sourcing; (2) negative claim
  "no other hardcoded 'Savant' identity strings" RESOLVED from disk — grep
  across desktop/src-tauri/src + desktop/package.json returns ZERO exact
  matches; (3) msi/nsis artifact names with a space (legal for WiX/NSIS)
  carried NEEDS-REVIEW for the next `tauri build`. Status stays `fixed`;
  operator re-smoke remains THE closure boundary.
- **CHANGE DELTA:** Initial authoring + implementation (~60%).

### Loop 2

- **TRIGGER:** Operator directive (2026-08-24 ~23:15 EDT): pull the version
  from the root VERSION file instead of hardcoding — discharging the Loop 1
  Verifier drift condition (version hardcoded across three surfaces).
- **GREEN:** IMPLEMENTED: NEW `desktop/scripts/sync-version.ts` propagates
  VERSION into package.json / tauri.conf.json version / Cargo.toml [package]
  version via exported first-match declarations (non-matching patterns THROW
  loudly — Verifier C1); wired as `sync:version` and ahead of
  `dev:renderer`/`build:renderer`; `vite.config.ts` injects VITE_APP_VERSION
  from VERSION (`%VITE_APP_VERSION%` placeholder in index.html); `lib.rs`
  setup composes the native title at runtime
  (`Savant Code v{CARGO_PKG_VERSION}`); conf title reverted to plain
  "Savant Code". Gates: prettier/eslint clean · typecheck exit 0 · cargo
  fmt+check Finished · **203 pass / 0 fail (996 expect())** incl. four new
  declaration-pattern tests.
- **AUDIT:** Independent Verifier on the version sourcing: PASS WITH
  CONDITIONS, all dispositioned same pass — C1 silent-dead-pattern risk
  DISCHARGED (applyDeclaration throws on zero matches; fixtures pin all
  three shapes incl. a dependency-pinned Cargo body); both NEEDS-REVIEWs
  resolved from disk (exactly ONE `"version"` key in tauri.conf.json; no
  stray *.conf.json siblings).
- **BOUNDARY:** propagation race — the tauri CLI parses conf BEFORE
  dev:renderer's sync runs, so a fresh VERSION bump reaches the webview
  title immediately but package_info/native title on the NEXT launch.
  Documented per Verifier condition (c); release notes must carry it.
- **CHANGE DELTA:** Version single-sourcing pass (~25%).

### Missed Questions

1. Why did every prior fix miss it? Each targeted the render/mount pipeline;
   none could help because the pipeline was never PAINTED. Only the
   nameplates-visible contradiction pointed at paint timing.
2. Should reduced-motion still animate anything? No — accessibility contract
   holds; we only guarantee mounted objects get painted once.
3. What if factories hang forever? loadRobotTemplate already resolves null
   after 8s (FID-2026-0824-028); .catch covers throws (FID-2026-0824-030);
   so onCastSettled always fires within bounded time.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working tree (release-only-commits)
- [x] **File:line ranges:** deck-walkers.ts WalkerLayerOptions + constructor
      settle counter; deck-runtime.ts WalkerLayer instantiation callback;
      deck-walkers.test.ts two new tests; tauri.conf.json title
- [x] **Gate output:** typecheck exit 0 · 199/0 (988 expect()) · eslint
      --max-warnings 0 · prettier clean
- [x] **Reproducibility:** grep onCastSettled under desktop/src finds hook +
      wiring + tests
- [x] **Operator re-smoke:** robots visible on reduced-motion machine —
      DISCHARGED: the operator observed the rendered cast throughout the
      night-session eye-tuning loop (which tuned this exact surface) and
      formally WAIVED the remaining formal re-smoke by closure directive
      2026-08-25

## Resolution

- **Closed Date:** 2026-08-25 (operator waiver + closure directive)
- **Fix Description:** WalkerLayer `onCastSettled` fires once when every
  figure factory settles; deck-runtime repaints (`syncLiveLayers` +
  `stage.render()`) at that moment so reduced-motion machines paint mounted
  objects instead of parking forever on a pre-resolve static frame. Riding
  branding pass: window/webview titles "Savant Code v{VERSION}" via
  single-sourced VERSION (`sync-version.ts`, Loop 2).
- **Tests Added:** two onCastSettled regression tests (fires-once success
  path; fires-once-under-rejection fallback path mounts full cast) + four
  sync-version declaration-pattern tests (Loop 2).
- **Verification Evidence:** gates fresh at closure (this session):
  typecheck desktop exit 0 · deck-walkers suite exit 0 within the 50/0
  desktop floor battery; receipt re-stamped at the archived path (both
  declared gates live PASS); repo-wide `fid:verify --check` sweep PASS.
  Known documented behavior carried to release notes: tauri conf parses
  BEFORE dev:renderer's sync, so a fresh VERSION bump reaches the native
  title on next launch (Loop 2 BOUNDARY).
- **Archived:** yes → `dev/fids/archive/FID-2026-0824-032-robot-cast-
  invisible-under-reduced-motion.md`

## Lessons Learned

An accessibility-driven "render once" optimization silently depends on WHEN
once is. Any scene whose content arrives asynchronously must either defer the
single paint until content lands or repaint on arrival — otherwise the
accessibility feature erases the product. Reduced motion froze more than
animation; it froze discovery.