# FID: Robot Cast Never Renders — Diagnosis and Recovery

**Filename:** `FID-2026-0824-028-robot-cast-never-renders-recovery.md`
**ID:** FID-2026-0824-028
**Severity:** critical
**Status:** fixed
**Created:** 2026-08-24 19:30
**YAGNI-Compliance:** Verified

---

## Summary

The 10-role robot cast has NEVER rendered on the deck across every launch since
the asset pass landed — the operator sees floating nameplate chips over empty
floor ("they have literally never loaded once"). The first hypothesis
(skinned-mesh frustum culling, fixed in the visibility hotfix) was FALSIFIED by
the operator's next review: still no robots. This FID runs the honest
diagnosis the defect deserves, identifies the two remaining viable failure
modes, and lands a recovery that makes BOTH impossible to experience silently:
a hung GLB load now times out into a bright fallback, and every mounted figure
glows clearly at standby. Permanent console diagnostics name which path fired
so "invisible robots" can never again be a zero-evidence mystery.

## Environment

- **OS:** Windows 10+ (Tauri v2 shell, WebView2 renderer)
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned); three ^0.185.1; React 19
- **Tool Versions:** three ^0.185.1, @types/three ^0.185.4
- **Commit/State:** main @ v0.0.27 (working tree; release-only-commits)

## Detailed Description

### Problem

Across every `bun run tauri dev` launch since the asset pass, the deck shows:
the grid, six station pedestals, drifting motes, and the floating nameplate
chips — but ZERO robot figures. The operator has never seen a single robot.
Additionally, the WebView2 app instance has crashed/vanished repeatedly
(WSL/host instability, 5+ recycles on 2026-08-24 alone), which repeatedly
destroyed review sessions mid-examination.

### Expected Behavior

All 10 cast figures (Savant at the console, nine specialists on their pads)
stand visibly on the floor in dim standby glow, brightening and walking to
pedestals on live agent traffic.

### Root Cause

UNDETERMINED between two viable failure modes — deliberately, because the
available evidence cannot separate them and the recovery neutralizes both:

- **H1 — GLB load hangs in WebView2:** `loadRobotTemplate` resolves ONLY via
  GLTFLoader's success/error callbacks. If the WebView2 fetch neither
  completes nor errors (proxy/interceptor/cache pathology), the promise never
  settles, `.then()` never runs, and NO figure (and no agent nameplate) ever
  mounts. The loader also failed SILENTLY — zero console evidence by design.
- **H2 — figures mount but are visually imperceptible:** the hologram chassis
  is near-black (#0b1116 albedo) on the void floor (#050508) and standby
  emissive was 0.32 — at camera distance ~34 a 1.7-unit figure at that level
  can be effectively invisible, while nameplate sprites (depthTest off,
  renderOrder 999) stay crisp. The operator would report exactly
  "nameplates floating over nothing."

FALSIFIED along the way: skinned-mesh frustum culling (frustumCulled=false
landed in the visibility hotfix; robots still absent — the fix was correct
hygiene but not the cause).

### Evidence

```text
1. Asset integrity (grep, 2026-08-24): robot.glb and RobotExpressive.glb are
   BYTE-IDENTICAL (463,988 bytes each) — the vendored asset IS the three.js
   RobotExpressive model, and `grep -ac '"skins"'` finds the skins marker:
   a real rigged, animated GLB. The asset is not the bug.
2. Lighting rig present (deck-stage.ts:86-89): hemisphere 0.9 + key 1.4 +
   fill 0.35 — lit materials are not rendering black by absence of lights.
3. Nameplate split: station chips AND (per operator report) agent chips
   render — sprites are unlit and depthTest-off, so they draw regardless of
   the figures' state; they prove nothing about the mesh path.
4. frustumCulled=false (visibility hotfix) did NOT make robots appear —
   hypothesis falsified by operator review.
5. The browser-console evidence channel (browser-use over the vite dev
   server) is BLOCKED by the harness (custom chrome-devtools extension tools
   declare unsupported local side effects) — console evidence must come from
   in-app diagnostics instead.
6. WSL/host instability: 5+ VM recycles on 2026-08-24 killed dev instances
   mid-review (environmental; tracked separately from this FID's fix).
```

## Impact Assessment

### Affected Components

- `desktop/src/floor/stage/deck-robots.ts` — loader timeout + diagnostics +
  emissive levels
- `desktop/src/floor/__tests__/deck-robots.test.ts` — contract updates + NEW
  asset regression test
- `desktop/src/floor/__tests__/deck-stations.test.ts` — untouched
- Operator trust in the deck surface ("flagship feature renders nothing")

### Risk Level

- [x] High: the flagship visual feature renders nothing, no console evidence,
      and every prior fix attempt failed

## Proposed Solution

### Approach

Multi-hypothesis recovery: make H1 and H2 BOTH impossible to experience
silently, and leave permanent diagnostics that name whichever path fired.

### Steps

1. `loadRobotTemplate`: race the GLTFLoader against an 8-second timeout that
   resolves null (a hung load can no longer starve the cast forever), and log
   ONE honest console line naming the outcome (loaded with N clips / failed /
   timed out).
2. Brighten the cast: STANDBY_EMISSIVE 0.32 → 0.7 and ACTIVE_EMISSIVE
   0.95 → 1.2 — figures glow unmistakably at standby while keeping the
   standby→active contrast.
3. Brighten the fallback silhouette to the same levels (it must be plainly
   visible whenever the GLB path fails — it is the H1 recovery surface).
4. Asset regression test: parse the GLB's JSON chunk in bun and pin that the
   vendored asset carries skins, meshes, and animations (a corrupt/empty
   asset can never ship silently again).
5. Update the deck-robots contract tests for the new emissive levels.

### Verification

- `bun run --cwd=desktop typecheck` exit 0
- `bun run --cwd=desktop test` all green (incl. the new asset + emissive
  contract cases)
- eslint `--max-warnings 0` + prettier clean on touched files
- Operator webview re-smoke (Adversary-sharpened): robots (GLB or bright
  fallback) VISIBLE **plus the verbatim `[deck] robot template …` console
  line** (loaded / failed / TIMED OUT) — the line names which hypothesis
  fired; "something is visible" alone leaves the GLB question open

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/__tests__/deck-robots.test.ts

### Verification Receipt

- fingerprint: sha256:17709d659eb2264c0bdda0d4826532165f03bda7bc8e5d514ae3f52213d37eb9
- verified: 2026-09-03T00:17:54.624Z
- typecheck desktop: exit 0
- test desktop/src/floor/__tests__/deck-robots.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Defect cataloged with evidence (see Evidence): robots never render
  across all launches; asset verified good; lights verified present;
  frustumCulled falsified; console channel blocked; two viable failure modes
  identified (H1 hang, H2 imperceptible-dark).
- **GREEN:** IMPLEMENTED (2026-08-24 ~19:45 EDT): `loadRobotTemplate` races
  the GLTFLoader against an 8s timeout and reports ONE honest console line
  per outcome (`[deck] robot template loaded (N clips) / failed / TIMED
  OUT`); STANDBY_EMISSIVE 0.32 → 0.7, ACTIVE_EMISSIVE 0.95 → 1.2 (both the
  GLB cast and the fallback share the constants — the fallback is now
  plainly visible, discharging H2); NEW asset regression test parses the
  GLB JSON chunk and pins skins/meshes/animations (a corrupt asset can
  never ship silently). Gates: desktop typecheck exit 0 · full suite 194
  pass / 0 fail (978 expect()) · eslint --max-warnings 0 + prettier clean
  on both touched files.
- **AUDIT:** Independent Verifier PASS WITH CONDITIONS (2026-08-24
  ~19:50 EDT) — (a) timeout race PASS (settled guard + cleared timers,
  post-timeout late-success is a safe no-op); (b) emissive consistency
  PASS (GLB cast + fallback share the constants, proven by the 194/0
  suite); (c) CWD-independence PASS (the first stamp attempt FAILED from
  the repo root and the import.meta.dir fix PASSED — proven by the gate
  itself); (d) no silent-failure paths remain. Conditions C1 (missing
  Author field), C2 (failed load cached null forever — no retry), C3
  (unfilled line ranges) DISCHARGED in self_correct; H2 visibility
  discharge correctly carried as the operator re-smoke boundary.
- **ADVERSARIAL:** Verdict STANDS (2026-08-24 ~19:55 EDT, disk-read) —
  the timeout+settled race has no double-resolve/never-resolve path (all
  four outcomes route through the `settled`-guarded finish); clearing
  `templatePromise` on failure audited safe (independent closures, worst
  case one redundant fetch). Two additions recorded: (1) the closure
  boundary now requires the console-line verdict (Verification section
  updated); (2) the loader timeout race has ZERO test coverage — recorded
  follow-up (injectable loader + fake timers). Cosmetic: post-timeout
  late-success discards silently (the TIMED OUT line already names it).
- **CHANGE DELTA:** Initial authoring + implementation pass (~60% of the
  document: gates section realized, Loop 1 + evidence sections filled).

### Missed Questions

1. Why did no console evidence exist for five launches? — Because
   `loadRobotTemplate` resolved null SILENTLY on error and the fallback
   mounted without any log. Fixed: one outcome line per load, always.
2. Why not verify in Chrome via browser-use first? — Attempted; the harness
   blocks the chrome-devtools extension tools (unsupported local side
   effects). The recovery instead makes the app self-reporting.
3. Should the fallback look like a robot? — v1 keeps the capsule silhouette
   (honest minimal shape) but makes it GLOW; a richer fallback model is a
   follow-up, not this recovery.
4. Is the WSL crash instability part of this FID? — No: environmental
   (host-side VM recycles), tracked separately; it only destroyed review
   sessions, not the renderer.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working tree (release-only-commits — lands untracked
      until the next release sweep)
- [x] **File:line ranges:** deck-robots.ts — STANDBY_EMISSIVE :43 /
      ACTIVE_EMISSIVE :44 / TEMPLATE_LOAD_TIMEOUT_MS :56 /
      reportTemplateOutcome :59 / loadRobotTemplate :65 / finish :71;
      deck-robots.test.ts — emissive contract updates (burn 1.2, freeze
      0.7) + GLB asset regression case (import.meta.dir-resolved)
- [x] **Gate output:** desktop typecheck exit 0 · suite 194 pass / 0 fail
      (978 expect()) · eslint --max-warnings 0 · prettier clean
- [x] **Reproducibility:** grep TEMPLATE_LOAD_TIMEOUT_MS / STANDBY_EMISSIVE
      under desktop/src/floor finds the changes
- [x] **Step statuses:** Steps 1-5 all `implemented` (loader timeout +
      diagnostics; standby 0.7; active 1.2; bright fallback shares the
      constants; asset regression test; contract tests updated)

### Code Verification Evidence

- Asset integrity: robot.glb == RobotExpressive.glb, 463,988 bytes,
  skins marker grep PASS (2026-08-24).
- Lighting rig: deck-stage.ts:86-89 (hemisphere/key/fill) — disk-verified.
- Loader silence: deck-robots.ts resolved null with zero logging before this
  FID — disk-verified.
- 2026-08-24 Loop 1 GREEN: implementation landed — loader timeout +
  diagnostics, emissive 0.7/1.2, asset regression test; gates green (see
  Implementation Evidence). Status advances `created` → `fixed`. The
  operator webview re-smoke (robots VISIBLE) remains THE closure boundary.

## Resolution

- **Closed Date:** pending
- **Fix Description:** pending
- **Tests Added:** pending
- **Verification Evidence:** pending
- **Archived:** pending

## Lessons Learned

A silent fallback is indistinguishable from a missing feature — every
degradation path must log one honest line naming itself, and every "it
renders nothing" report deserves a scene-level telemetry answer before the
second hypothesis is tried. Brightness is a feature: a dark object on a dark
floor does not exist, no matter how correct its transform chain is.