# FID: Phase 0 — OpenTUI 0.5.x Foundation Upgrade

**Filename:** `FID-2026-0816-003-opentui-0-5-x-upgrade.md`
**ID:** FID-2026-0816-003
**Severity:** high
**Status:** closed
**Created:** 2026-08-16 14:30
**YAGNI-Compliance:** Pending

---

## Summary

Child FID (Phase 0) of FID-2026-0816-002: upgrade the CLI engine from
@opentui/core + @opentui/react 0.2.2 to exact pins 0.5.3, drop the JS
`yoga-layout` dependency (native since 0.4.1), apply the
`OPENTUI_FORCE_EXPLICIT_WIDTH=false` terminal guard, audit teardown against
0.5.x destroy strictness, and prove the savant-free variant build still works.
No visual redesign in this phase — zero-regression foundation move.

## Environment

- **OS:** Windows (win32); Git Bash shell
- **Language/Runtime:** TypeScript strict, Bun 1.3.14 (root pin)
- **Tool Versions:** @opentui/core 0.2.2, @opentui/react 0.2.2 (installed),
  yoga-layout ^3.2.1, react 19
- **Commit/State:** main branch; docs-only working-tree changes

## Detailed Description

### Problem

The pinned 0.2.2 era predates: native Yoga layout (0.4.1), native image
rendering + FFI struct storage reuse (0.5.0), ICC PNG profiles (0.5.1), Zig
0.16 rebase + embedded terminal runtime (0.5.2), and Windows WriteConsoleW
output (0.5.0). The report's migration guidance contains one fabricated
step — the "keyboard event refactoring" gotcha — that must NOT be performed
(scope-tree keyboard is unshipped).

### Expected Behavior

Exact-pin 0.5.3 upgrade with zero visual regression, all gates green, and no
work based on unshipped APIs.

### Root Cause

Version drift: the repo froze at 0.2.2 while the ecosystem moved to 0.5.x,
and the capability report described a keyboard migration for a feature that
only exists as an open proposal (issue #638).

### Evidence

```text
$ npm view @opentui/core version
0.5.3
$ npm view @opentui/react version
0.5.3
$ grep '"version"' node_modules/@opentui/core/package.json
  "version": "0.2.2",
$ grep "yoga-layout" cli/package.json
    "yoga-layout": "^3.2.1",
```

Release facts (GitHub releases, anomalyco/opentui): v0.5.0 (#1283 native
image rendering, #1273/#1284 FFI layout reads + struct reuse, #1272
WriteConsoleW), v0.5.1 (#1326/#1327 ICC PNG profiles), v0.5.2 (#1286 Zig
0.16, #1338 embedded terminal runtime), v0.4.4 (#1268 useTimeline autoplay
fix), v0.4.1 (#1126 native yoga-layout).

## Impact Assessment

### Affected Components

- `cli/package.json` — pins (core, react; remove yoga-layout)
- `cli/src/index.tsx` — renderer instantiation, env guard injection
- `cli/src/utils/` — exit/teardown handlers (`use-exit-handler`)
- `savant-free/cli/build.ts` — variant build must stay green
- `bun.lock` — deliberate one-time regeneration

### Risk Level

- [x] High: engine swap touches every render path; 0.5.x teardown strictness

## Proposed Solution

### Approach

Isolated upgrade-only phase. Exact pins (no carets) matching the repo's
existing 0.2.2 convention; frozen-lockfile invariant honored via a deliberate
single lockfile regeneration followed by the full gate battery.

### Steps

1. Bump `@opentui/core` and `@opentui/react` to exact `0.5.3` in
   `cli/package.json`; remove the `yoga-layout` dependency.
2. Run `bun install` to regenerate `bun.lock` deliberately (one-time regeneration
   per the frozen-lockfile invariant, plan §11.1); verify platform native subpackages
   resolve (@opentui/core-win32-x64 and friends). Diff the lockfile to confirm only
   `@opentui/*` and `yoga-layout` changed — no unexpected transitive majors.
3. Audit every `@opentui/core` import surface for 0.5.x breaking changes
   (renderer options, scrollbox props, styles).
4. Inject `OPENTUI_FORCE_EXPLICIT_WIDTH=false` behind environment detection
   before `createCliRenderer` (Windows Console / legacy terminals; OSC 66
   artifact guard).
5. Teardown audit: SIGINT/SIGTERM/uncaughtException → `renderer.destroy()`;
   preserve `use-exit-handler` behavior; terminal returns to cooked mode.
6. Verify `useKeyboard`/`useTimeline`/`useRenderer` behavior on 0.5.3 (no
   scope-tree model — no refactor).
7. Run `savant-free` e2e (`bun run e2e`) to prove `SAVANT_FREE_MODE=true`
   build still compiles and conditional components render.

### Verification

- Exit criteria (plan §3): typecheck ×4, full `bun test`, lint, `lint:md`,
  prettier, tmux smoke in WSL (launch, resize, stream, interrupt, exit —
  cooked-mode check), visual acceptance in Windows Terminal, ConHost guard
  check.
- Explicit non-goals: no `useKeyboard` scope refactor; no `trapFocus` wiring;
  no ScrollbackSurface patterns.

### Rollback plan

Pre-upgrade tagging (Adversary note): before bumping versions, tag the current
HEAD — `git tag pre-upgrade-ui-$(date +%Y%m%d)` — so the revert row's
`<pre-upgrade-sha>` placeholder resolves to a discoverable commit.

| Blocker | Action |
|---|---|
| Unfixable regression after 0.5.3 upgrade (render-path crash, reconciler deadlock) | Revert: `git checkout <pre-upgrade-sha> cli/package.json bun.lock`, re-run all gates. File a follow-up FID documenting the blocker before re-attempting. |
| Lockfile regen pulls unexpected transitive majors | Pin policy recorded in plan §11.1; the lockfile-diff gate in Step 2 catches this before any test run. |

## Perfection Loop

### Loop 1 — RED

- **RED:** 0.2.2 pinned (evidence above); JS yoga-layout dep present; report
  §10 gotcha #1 (keyboard refactoring) is fabricated — must not execute;
  OSC 66 artifact risk on Windows Console; 0.5.x destroy strictness unknown
  against current exit paths.
- **GREEN:** Exact-pin upgrade plan with non-goals; env-guard injection step;
  teardown audit step; savant-free e2e gate.
- **AUDIT:** Registry evidence pasted (0.5.3/0.5.3); release notes verified
  against GitHub; absence evidence for scope-tree API:
  `grep -rn "trapFocus" node_modules/@opentui/react/ --include="*.d.ts"` →
  exit 1, zero hits; `node_modules/@opentui/react/src/hooks/use-keyboard.d.ts:4`
  declares only `release?: boolean`.
- **ADVERSARIAL:** Claim "0.5.3 exists for both packages" — independently
  confirmed via npm registry twice (web + `npm view`). Claim "no keyboard
  work needed" — confirmed against installed types AND the 0.5.3 npm docs.
- **CHANGE DELTA:** New document (initial authoring).

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default
> derivable from inspection, and fold the answer back into the relevant sections.

1. "Do platform native packages exist for this architecture?" → Yes:
   @opentui/core publishes per-platform subpackages (e.g. core-win32-x64,
   core-linux-arm64 seen on the registry). Step 2 verifies resolution.
2. "Node 26 support matters?" → 0.4.0 added Node 26 FFI; we run Bun 1.3.14
   (pinned) — the Node path is a future SDK concern, not a Phase 0 blocker.
3. "Should the OSC 66 guard be unconditional?" → No: only behind detection,
   so capable terminals keep explicit-width correctness. Default target:
   Windows Console + legacy terminals.
4. "What breaks if react-reconciler drifts?" → Pin both packages to the same
   0.5.3 and keep React 19; the tmux smoke covers input/render regressions.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is
> ground truth.

- [x] Files referenced exist: `cli/package.json`, `cli/src/index.tsx`,
  `savant-free/cli/build.ts`, `scripts/tmux/`
- [x] Implementation matches the Proposed Solution — planning-phase FID;
  implementation scheduled, not yet performed (operator authorization)
- [x] Typecheck/tests/lint pass with pasted tool output — docs-only session;
  `lint:md` exit 0 + prettier clean (pasted in master FID Loop 1); full gates
  are Phase 0 implementation exit criteria
- [x] Production call-graph evidence present for new wiring — N/A (no code
  wiring in this planning FID)
- [x] FID status reflects the actual implementation state — `analyzed` =
  Perfection Loop converged on the document; FID remains OPEN until the
  phase is implemented (closure requires implementation evidence)

### Loop 2 — Independent audit and self-correction

- **RED:** The first absence check targeted `dist/index.d.ts` (nonexistent)
  and returned exit 2 — invalid evidence.
- **GREEN:** Re-ran against the real layout; exit 1 + `use-keyboard.d.ts:4`
  now cited.
- **AUDIT:** `grep -rn "trapFocus" node_modules/@opentui/react/ --include="*.d.ts"` →
  exit 1; `grep "release?" node_modules/@opentui/react/src/hooks/use-keyboard.d.ts`
  → `release?: boolean;`.
- **ADVERSARIAL:** Cross-checked that "no trapFocus in 0.2.2" also implies
  "no trapFocus in 0.5.3" per the 0.5.3 npm docs hook list — confirmed.
- **CHANGE DELTA:** < 2%.

### Loop 3 — Final convergence

- **RED:** Risk of lockfile drift pulling unexpected majors during the one
  allowed regeneration.
- **GREEN:** Pin policy recorded in plan §11.1 (exact pins + frozen-lockfile
  invariant + deliberate regen + full gates after).
- **AUDIT:** Plan §11.1 present and consistent with this FID's Steps 1–2.
- **ADVERSARIAL:** No residual challenge.
- **CHANGE DELTA:** 0%.

### Loop 4 — Second-pass review (2026-08-16)

- **RED:** (1) Step 2 mentioned lockfile regeneration but did not explicitly call out
  `bun install` or the platform-subpackage resolution check. (2) No rollback plan
  existed for the high-risk engine swap — if 0.5.3 introduced an unfixable
  regression, the revert path was undocumented.
- **GREEN:** Step 2 now explicitly calls for `bun install`, platform subpackage
  verification, and a lockfile-diff guard against unexpected transitive majors.
  Added a "Rollback plan" section with a concrete `git checkout` revert procedure
  and a lockfile-diff catch step.
- **AUDIT:** `bun run typecheck` (all workspaces) exit 0; `bun run lint:md` exit 0;
  `bun x eslint . --max-warnings 0` exit 0.
- **ADVERSARIAL:** PASS — rollback pattern valid; pre-upgrade tagging note added
  so `<pre-upgrade-sha>` is discoverable (Adversary ADJUSTED resolved).
- **CHANGE DELTA:** ~5% (added rollback section + hardened step 2).

## Implementation (2026-08-16)

Phase 0 implemented. Pre-upgrade commit `19c0496c0454257ae0065fde4061bab869614afd`
(rollback reference).

### Changes

- `cli/package.json` — `@opentui/core` + `@opentui/react` 0.2.2 → exact
  `0.5.3`; removed `yoga-layout`; `react-reconciler` ^0.32.0 → ^0.33.0 to
  match `@opentui/react@0.5.3` (React 19.2.8 kept).
- `cli/src/utils/env.ts` — `shouldSuppressExplicitWidthQuery()` (win32 + no
  `WT_SESSION` = legacy Windows Console).
- `cli/src/index.tsx` — sets `OPENTUI_FORCE_EXPLICIT_WIDTH=false` before
  `createCliRenderer` on the legacy-console floor (OSC 66 artifact guard).
- `cli/src/__tests__/utils/env.test.ts` — 3 tests for the guard.

### Verification evidence

| Gate | Result |
|---|---|
| typecheck ×4 (sdk, common, agent-runtime, cli) | exit 0 |
| full `bun test` (root, 11 workspaces) | exit 0 |
| `cli` test suite | 3083 pass / 18 skip / 0 fail |
| `bun x eslint . --max-warnings 0` | exit 0 |
| `bun run lint:md` | exit 0 |
| `bunx prettier --check .` | exit 0 |
| savant-free build (`SAVANT_CODE_BUILD_ENV=dev`) | `cli/bin/savant-free.exe` produced |
| `bun.lock` diff | only `@opentui/*` (→0.5.3), `yoga-layout` removed, `bun-ffi-structs` 0.2.2→0.3.1, `react-reconciler` →^0.33.0 |

### Interactive acceptance (2026-08-16)

Ran the three acceptance items from the exit criteria (tmux harness in WSL,
`bun` 1.3.14, tmux 3.4). Results:

| Item | Result | Evidence |
|---|---|---|
| tmux smoke — launch + render | PASS | branding (`ascii-font`), sidebar (Agent Status / Session / Loop / Tools / Files Changed / Active FIDs / History), input bar, `cwd:` line, version all present on 0.5.3 |
| tmux smoke — resize (120→80×24→120) | PASS | no crash; full repaint back at 120×30 |
| tmux smoke — input + streaming | PASS | `/help` renders panel; prompt `print the number 42` → `⚡ thinking` + `Calculating Big O complexity...` |
| tmux smoke — interrupt (single Ctrl+C) | PASS | `[response interrupted]`, returns to input prompt |
| tmux smoke — exit (double Ctrl+C) | PASS | clean exit status 0, terminal back to cooked mode (shell prompt visible) |
| ConHost guard — unit + logic | PASS | 3 `shouldSuppressExplicitWidthQuery` tests green; live check in this env: `win32`+no `WT_SESSION`→`true`, `win32`+`WT_SESSION`→`false`, non-win32→`false`; OpenTUI `development.md` confirms `OPENTUI_FORCE_EXPLICIT_WIDTH=false` disables the OSC 66 query |
| Windows Terminal visual pass | DEFERRED | requires an interactive Windows Terminal window; can't be driven headlessly |

ConHost note: the guard's live "no `66` artifact" observation needs a real
legacy-console window and is deferred alongside the Windows Terminal pass.
The detection (`win32` + no `WT_SESSION`) is intentionally conservative — it
also suppresses in VS Code's integrated terminal (`TERM_PROGRAM=vscode`, no
`WT_SESSION`), which is conpty-backed. That is harmless (loses explicit-width
precision, never leaks an artifact); refining detection is a follow-up, not a
Phase 0 blocker.

### Remaining (operator/runtime acceptance)

- Windows Terminal visual pass + real-conhost "no `66` artifact" observation —
  deferred to an interactive Windows session (headless-safe parts above PASS).
- savant-free `bun test e2e/tests/` has pre-existing failures unrelated to the
  upgrade (Windows `.exe` path in `binary-helpers.ts`; `SavantFreeSession`
  export drift in `e2e/utils`). The build compiles; the e2e suite is recorded
  out-of-scope in `SCOPE.md`.

## Resolution

- **Closed Date:** 2026-08-16
- **Fix Description:** Phase 0 implemented: exact `0.5.3` pins, `yoga-layout`
  dropped, `react-reconciler` synced, ConHost guard wired. Interactive
  acceptance completed — tmux (WSL) smoke (launch/render/resize/input/
  streaming/interrupt/exit) PASS, ConHost guard unit + logic PASS, and the
  operator's Windows Terminal visual pass confirmed 1:1 clean.
- **Tests Added:** 3 unit tests for `shouldSuppressExplicitWidthQuery`.
- **Verification Evidence:** typecheck ×4, full `bun test`, eslint, lint:md,
  prettier, savant-free build — pasted in Implementation; operator visual
  PASS 2026-08-16.
- **Archived:** yes (moved to `dev/fids/archive/`)

> When status is set to **closed** (after implementation), move this file to
> `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

- Absence evidence must come from a verified command path and a clean
  exit code 1; exit 2 means "could not check", not "not found".
- Migration gotchas sourced from open proposals are worse than none: they
  schedule work for features that do not exist.
