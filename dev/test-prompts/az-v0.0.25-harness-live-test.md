<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z v0.0.25 Harness Live Test — execute inside the running CLI

**Version:** 0.0.25
**Date:** 2026-08-17
**Target:** the pending, unreleased `0.0.25` tree (committed, not yet published) —
the full Savant UI overhaul (`FID-2026-0816-002..012` — OpenTUI 0.5.3 foundation,
near-black/cyan design tokens, animation engine, native-renderable evaluation,
layout/responsiveness, easter egg, diff/phase-bar redesign, polish backfill,
rich terminal output, trust-matrix + tool-call recovery) plus the release-incident
remediation (`FID-2026-0816-001` — `@noble/hashes` declaration, cli-bundle-resolution
gate, dispatch-ref guardrails).
**Execution model:** THIS PROMPT RUNS INSIDE THE HARNESS. The agent currently
executing it IS the harness (`bun dev`, interactive CLI). Every test must be
performed with the harness's own tools from the live session. Do NOT use tmux,
do NOT build a binary, do NOT create an isolated repository copy, and do NOT
leave the session for any phase.

**Purpose:** Prove the full 0.0.25 delta deterministically, with a concrete
trigger path per row so no row degrades to `NEEDS-REVIEW` when a path exists,
and produce a fresh A–Z report including the **Agent View** section (§7) that
hands the coding agent every out-of-band finding discovered during the run.

## 1. Execution contract

The orchestrator must:

1. Read this file completely before starting.
2. Create one todo per phase and update it as phases finish.
3. Record every test as `PASS`, `FAIL`, `NEEDS-REVIEW`, `OPERATOR-CONFIRMED`,
   or `SKIP`, with Type `LIVE` (observed behavior), `EXECUTABLE` (command run
   with direct exit), `STATIC` (source inspection only), or `OPERATOR`
   (interactive TUI/slash-command surface the in-harness agent cannot drive
   from inside itself — see §3a).
3a. **Operator-confirmed tests.** The interactive TUI surface (the visual
   design language, the easter-egg prank, the sidebar fold, the phase-bar and
   diff-viewer rendering) cannot be fully driven by the in-harness agent from
   inside itself. For any such test: hand it to the operator to execute in the
   live CLI, then record `OPERATOR-CONFIRMED` with type `OPERATOR` and the
   operator's confirmation. Never write `PASS`/`LIVE` for a test you did not
   observe yourself, and never leave a self-executable test as
   `OPERATOR-CONFIRMED`.
4. Prefer observable behavior over source claims. Every `LIVE` result needs its
   command/output or captured UI/artifact evidence in the report.
5. Continue after individual failures; capture exact error text, exit status,
   duration, and last observable state.
6. Never modify source files. Disposable fixtures go under
   `dev/scratchpad/az-fixtures/` (delete them before the final cleanup step) or
   the OS temp directory.
7. Do not push, publish, tag, commit, deploy, or touch release mutation modes.
8. Redact credentials, personal paths, and environment values in the report.
9. Leave the repository working tree exactly as it was at session start; verify
   with `git status --short` at the end.
10. Write the final report to `dev/scratchpad/az-v0.0.25-harness-live-test-report.md`
    per Section 8, **including the Agent View section** (Section 7).

## 2. Environment and baseline

Record at start and end of the report:

| Field | Value |
| --- | --- |
| Date/time and commit/worktree identity | |
| OS/platform/architecture | |
| Bun version and package version (`VERSION`) | |
| CLI launch command (this session) | |
| Provider/model mode (active model) | |
| Network availability | |
| Working-tree baseline (`git status --short`) | |
| Source-change check at end | |

## 3. Phase 0 — Identity, safety, and version

| ID | Test | Expected observable result |
| --- | --- | --- |
| V025-001 | `git status --short` before anything else | Baseline captured; no clean-tree claim without evidence |
| V025-002 | `bun --version` and `cat VERSION` | Bun `1.3.14`; working tree identifies `0.0.25` |
| V025-003 | `bun run version:check` | Exit 0; `VERSION` + manifests + `protocol.config.yaml project.version` agree |
| V025-004 | Confirm no credential values are loaded into this session's context | No key/token printed anywhere in this run |
| V025-005 | `git status --short` at the end of the entire run | Identical to baseline; source untouched |

## 4. Phase 1 — Static and executable gate matrix (in-session terminal)

Run each command with the harness terminal tool and record the DIRECT exit
status. Group results in the report table:

| ID | Gate | Expected result |
| --- | --- | --- |
| V025-010 | `bun run validate:repository` | Exit 0 (ratchet ratified for FID-001..012 growth) |
| V025-011 | `bun run version:check` | Exit 0; no drift |
| V025-012 | `bun run generate:protocol-bundle:check` | Exit 0; no drift |
| V025-013 | `bun run generate:provider-docs:check` | Exit 0; no drift |
| V025-014 | `bun run design-systems:check` | Exit 0; no drift |
| V025-015 | `bun run learnings:check` | Exit 0 |
| V025-016 | `bun run audit:evidence` | Exit 0 (working-tree evidence, all 7 sub-gates) |
| V025-017 | `bun x eslint . --max-warnings 0` | Exit 0 |
| V025-018 | `bun run lint:md` | Exit 0 |
| V025-019 | `bunx prettier --check .` | Exit 0 |
| V025-020 | Typecheck ×4: `cd sdk && bun run typecheck`, `cd common && bun run typecheck`, `cd packages/agent-runtime && bun run typecheck`, `cd cli && bun run typecheck` | Each exit 0 |

## 5. Phase 2 — Feature-focused test suites (the 0.0.25 delta)

Each row is a deterministic executable path. Record counts and exit codes.

### 5a. FID-2026-0816-001 — release-incident remediation (phantom dependency + gates)

| ID | Test | Expected result |
| --- | --- | --- |
| V025-100 | `grep '"@noble/hashes"' common/package.json` | Present — the formerly-undeclared import is now a declared dependency |
| V025-101 | `bun build cli/src/index.tsx --production --target=bun --external '@opentui/core-*' --outdir cli/bin/.resolution-check` | Exit 0 (cli-bundle-resolution gate — resolves every import except the runtime-loaded `@opentui/core-*` platform binaries; the exact phase that failed in CI for v0.0.24) |
| V025-102 | `grep -n 'cli-bundle-resolution\|cliBundleResolution' scripts/validation-manifest.ts scripts/public-release.ts` | Present — the gate is wired into release validation |

### 5b. FID-2026-0816-002 — master queue closure

| ID | Test | Expected result |
| --- | --- | --- |
| V025-110 | `ls dev/fids/*.md` | Only `README.md` — the active queue is empty (all 002..012 archived) |

### 5c. FID-2026-0816-003 — OpenTUI 0.5.3 foundation upgrade

| ID | Test | Expected result |
| --- | --- | --- |
| V025-120 | `grep '"@opentui/core"' cli/package.json` | `"@opentui/core": "0.5.3"` (exact pin) |
| V025-121 | `grep '"@opentui/react"' cli/package.json` | `"@opentui/react": "0.5.3"` (exact pin) |
| V025-122 | `grep -n 'yoga-layout' cli/package.json` | 0 matches (JS yoga-layout dropped; native since 0.4.1) |
| V025-123 | `cd cli && bun test src/__tests__/utils/env.test.ts` | Exit 0 (3 `shouldSuppressExplicitWidthQuery` tests: non-win32→false, win32+`WT_SESSION`→false, win32+no-`WT_SESSION`→true) |
| V025-124 | `grep -n 'OPENTUI_FORCE_EXPLICIT_WIDTH' cli/src/index.tsx` | `process.env.OPENTUI_FORCE_EXPLICIT_WIDTH = 'false'` set before `createCliRenderer` |

### 5d. FID-2026-0816-004 — design tokens + visual identity

| ID | Test | Expected result |
| --- | --- | --- |
| V025-130 | `cd cli && bun test src/components/savant-ui/__tests__/theme.test.ts src/utils/__tests__/theme-config.test.ts src/utils/__tests__/syntax-theme.test.ts` | Exit 0 |
| V025-131 | `cd packages/design-systems && bun test src/__tests__/default.test.ts` | Exit 0 (savant-cyberpunk: primary `#18faf9`, background `#050508`) |
| V025-132 | `grep -rn '#0f172a\|#1e293b\|#94a3b8\|#e2e8f0' cli/src packages/design-systems/src` | 0 matches (navy slate palette purged — brand is near-black + cyan) |
| V025-133 | `grep -n 'phaseAdversarial' cli/src/types/theme-system.ts` | Present (`#c084fc` dark / `#7c3aed` light) |

### 5e. FID-2026-0816-005 — animation engine adoption

| ID | Test | Expected result |
| --- | --- | --- |
| V025-140 | `grep -rln 'setInterval(' cli/src/components` | Only `elapsed-timer.tsx` + `status-bar.tsx` (the 2 allowlisted 1 Hz wall-clock timers) |
| V025-141 | `cd cli && bun test src/hooks/__tests__/animation-timeline-loop.test.ts` | Exit 0 (default options halt at 1 s; `loop: true` + `duration: Infinity` keeps playing) |
| V025-142 | `grep -n 'useBlur\|targetFps' cli/src/hooks/use-animation-budget.ts` | Present — blur → 15 fps budget; scissor-hidden suspension |
| V025-143 | `ls cli/src/hooks/use-animation-timeline.ts cli/src/hooks/use-animation-budget.ts cli/src/hooks/use-typewriter.ts cli/src/hooks/use-fold-collapse.ts cli/src/hooks/use-scroll-management.ts` | All present |

### 5f. FID-2026-0816-006 — native renderables evaluated; custom renderer retained

| ID | Test | Expected result |
| --- | --- | --- |
| V025-150 | `grep -n '<diff' cli/src/components/tools/diff-viewer.tsx` | 0 matches (no native `<diff>` JSX — custom line renderer) |
| V025-151 | `ls cli/src/utils/tree-sitter-highlight.ts` | Absent (removed after the production-blank regression) |
| V025-152 | `grep -n 'parseDiffLines' cli/src/utils/diff-stats.ts` | Present (custom diff line parser, sign + gutter) |
| V025-153 | `cd cli && bun test src/components/tools/__tests__/diff-viewer.test.tsx` | Exit 0 |

### 5g. FID-2026-0816-007 — layout / responsiveness (sidebar rail + fold)

| ID | Test | Expected result |
| --- | --- | --- |
| V025-160 | `cd cli && bun test src/state/chat-store/__tests__/sidebar-collapse.test.ts` | Exit 0 (3/3 — default expanded, set/toggle, persists across reset) |
| V025-161 | `ls cli/src/components/sidebar-rail.tsx cli/src/hooks/use-fold-collapse.ts` | Both present |
| V025-162 | `grep -n 'sidebarCollapsed' cli/src/state/chat-store/types.ts cli/src/state/chat-store/initial-state.ts cli/src/state/chat-store/sidebar-actions.ts` | Present — store field + setter + manual-fold precedence |
| V025-163 | `grep -n 'WIDTH_BREAKPOINTS' cli/src/hooks/use-terminal-breakpoints.ts` | Exported (single source of truth for the narrow threshold) |

### 5h. FID-2026-0816-008 — Savant logo easter egg

| ID | Test | Expected result |
| --- | --- | --- |
| V025-170 | `cd cli && bun test src/hooks/__tests__/use-easter-egg.test.ts src/components/savant-ui/__tests__/easter-egg-logo.test.tsx` | Exit 0 (state machine `idle → nag-1..3 → glitch → takeover → frozen → idle`) |
| V025-171 | `grep -n 'EasterEggProvider' cli/src/app.tsx` | Present — authed surface wrapped; overlays mount at app root |
| V025-172 | `grep -rn 'child_process\|execSync\|spawn(' cli/src/hooks/use-easter-egg.ts cli/src/components/savant-ui/easter-egg-logo.tsx` | 0 matches (purely cosmetic — no shell/tool-executor authority) |

### 5i. FID-2026-0816-009 — diff viewer + phase-transition bar redesign

| ID | Test | Expected result |
| --- | --- | --- |
| V025-180 | `cd cli && bun test src/utils/__tests__/diff-stats.test.ts` | Exit 0 (hunk line-numbering, header path, relative-luminance) |
| V025-181 | `cd cli && bun test src/components/tools/__tests__/transition-phase.test.tsx` | Exit 0 (filled-chip fill, inverted text, violet ADVERSARIAL) |
| V025-182 | `grep -n 'relativeLuminance' cli/src/utils/diff-stats.ts` | Present (WCAG 2.x luminance; 0.25 floor for inverted text) |
| V025-183 | `grep -n 'adversarial' cli/src/components/savant-ui/echo/phase-info.ts` | Present (ADVERSARIAL phase mapping no longer falls back to IDLE) |

### 5j. FID-2026-0816-010 — post-009 polish backfill (cyan strokes + reactive trust matrix)

| ID | Test | Expected result |
| --- | --- | --- |
| V025-190 | `cd cli && bun test src/components/savant-ui/echo/__tests__/trust-matrix.test.ts src/__tests__/unit/segmented-control.test.ts` | Exit 0 |
| V025-191 | `grep -n 'theme.primary' cli/src/components/agent-mode-toggle.tsx cli/src/components/segmented-control.tsx cli/src/components/build-mode-buttons.tsx cli/src/components/load-previous-button.tsx cli/src/components/chatgpt-connect-banner.tsx` | Present (hover/highlight strokes are brand cyan) |
| V025-192 | `grep -n 'hasPending' cli/src/components/savant-ui/echo/trust-matrix.tsx` | Present — section mounts only while a receipt is pending, unmounts on completion |

### 5k. FID-2026-0816-011 — rich terminal command output

| ID | Test | Expected result |
| --- | --- | --- |
| V025-200 | `cd cli && bun test src/components/tools/__tests__/run-terminal-command.test.ts` | Exit 0 (exitCode extraction number/null/undefined, status badge, panel smoke, registry reuse) |
| V025-201 | `grep -n 'exitCode' cli/src/components/tools/run-terminal-command.tsx` | Present — `parseTerminalOutput` forwards `exitCode` (was parsed-then-discarded) |
| V025-202 | `grep -n 'run_readonly_command' cli/src/components/tools/registry.ts` | Present — aliased to the shared `RunTerminalCommandComponent` |
| V025-203 | `grep -n 'UNDERLINE' cli/src/components/terminal-command-display.tsx` | 0 matches (web-style underline link removed — terminal toggle only) |

### 5l. FID-2026-0816-012 — native tool-call recovery hardening + trust-matrix label fix

| ID | Test | Expected result |
| --- | --- | --- |
| V025-210 | `grep -n 'NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES' packages/agent-runtime/src/run-agent-step/constants.ts` | `= 3` (was a hard 2) |
| V025-211 | `grep -n 'NATIVE_TOOL_CALL_STEERING_MESSAGE' packages/agent-runtime/src/run-agent-step/constants.ts packages/agent-runtime/src/tools/stream-parser.ts` | Present — split-guidance for large-payload tools |
| V025-212 | `cd packages/agent-runtime && bun test src/__tests__/loop-agent-steps-part-f.test.ts` | Exit 0 (3-strike exhaustion contract, steering present/absent, drift warn, streak-reset) |
| V025-213 | `grep -rn 'lastIncompleteToolName' packages/agent-runtime/src/run-agent-step/types.ts packages/agent-runtime/src/tools/stream-parser.ts packages/agent-runtime/src/run-agent-step/step.ts packages/agent-runtime/src/run-agent-step/loop-iteration.ts` | Threaded through the full chain |
| V025-214 | `grep -n 'awaiting audit' cli/src/components/savant-ui/echo/trust-matrix.tsx` | 0 matches (stale label removed; rows now read "signed") |

## 6. Phase 3 — Live operator prompts (the only non-automated surface)

The interactive TUI rows still need the operator's eyes, but each has an
explicit prompt and an observable target:

1. **Design identity** — launch the CLI: the chrome is near-black (`#050508`)
   with cyan (`#18faf9`) accents — no navy/slate cast on any panel, popup, or
   banner. The sidebar, status bar, and input bar share the token set.
2. **Sidebar manual fold** — at a wide terminal, the right sidebar shows a
   raised `»` edge button straddling the fold line; Ctrl+B folds to the icon
   rail (sticky — it does not auto-expand on hover), `«` (or Ctrl+B) restores
   it; clicking a rail item expands in place; at <60 cols the rail auto-collapses.
3. **Phase-transition bar** — trigger a `transition_phase` tool call: it renders
   as a full-width **filled chip** (solid phase color, luminance-inverted text —
   black on bright fills, white on red, gray+black idle) with a `SAVANT CODE`
   title bar, identical in truecolor and ANSI-16 fallback terminals.
4. **Diff viewer** — run an apply-patch/edit tool that emits a diff: a bordered
   rounded panel with a file-path header, `+N −M` counters, dual old/new line
   numbers, sign column, and full-width tinted hunk bars.
5. **Rich terminal** — run a shell command (`run_terminal_command` or
   `run_readonly_command`): a bordered panel with `● ● ●` traffic lights, a
   green `$` command row with a `✓`/`✗`/`⏳` status badge, `📁 cwd` + `⏱ timeout`
   pills, and a line-number gutter (hidden below 50 cols).
6. **Easter egg** — click the Savant wordmark once per message: nags 1–3 show a
   centered bubble; the 4th click plays the glitch → full-screen "DELETED"
   takeover in cyan-on-near-black, then auto-resets to baseline.
7. **Trust matrix** — with `provenance.mode: record`, trigger a signed write:
   the sidebar "Trust Matrix" mounts only while a receipt is pending, shows a
   live status dot, and unmounts on completion (no "awaiting audit" label).

## 7. Agent View — mandatory additional-findings section

The A–Z rows above are the scripted contract. They are not the whole job. The
executing agent MUST also produce an **Agent View** section in the report: a
catalog of every additional defect, risk, or observation the agent encountered
while running the test that is **not** already covered by a scripted row.

Each Agent View entry must be evidence-backed and actionable by a coding agent:

- **Finding id + severity** (`P0`/`P1`/`P2`), classified as
  `PRODUCT-BLOCKER` / `REGRESSION` / `SECURITY/PRIVACY` / `GOVERNANCE` /
  `UX-FRICTION` / `PERFORMANCE-REGRESSION` / `PACKAGING` / `AGENT-FEEDBACK` /
  `ENVIRONMENT` / `NEEDS-REVIEW`.
- **Evidence** — `file:line` citation(s) with quoted code, or the exact command
  + output/exit code that revealed it. Absence-shaped findings paste the exact
  no-match search.
- **Impact** — what breaks, and for whom (operator, embedder, free tier, …).
- **Recommended fix** — concrete, minimal, with a proposed priority ordering.
- **Reproduction notes** — the exact steps a coding agent runs to re-observe it.

At minimum, the Agent View must re-examine (and extend or refute with evidence):

1. The **animation budget** — does any looping animation leak a live loop when
   its component unmounts or is scissor-hidden (`dropLive` balance)?
2. The **timeline-loop regression** — is every looping component constructed
   with `loop: true` + unbounded `duration` (the 1-second-freeze class)?
3. The **ConHost guard** — does `shouldSuppressExplicitWidthQuery` suppress in
   VS Code's conpty-backed terminal (no `WT_SESSION`) and is that acceptable
   precision loss, or a follow-up?
4. The **easter egg** — re-confirm it has zero shell/tool-executor authority and
   cannot trap the session (every phase auto-advances).
5. The **trust matrix** — does the reactive mount/unmount leave any dangling
   sidebar section or status dot after a session ends without a verdict?
6. The **tool-call recovery** — under a truncated native call, does the steering
   fire only for the `WriteToolName` set + `read_files`, and does an unknown-tool
   incomplete call log a drift `warn` rather than steering?
7. The **clean-release certification** — `audit:evidence --clean` cannot run in
   this dev tree (ignored files present); confirm the evidence gap is recorded
   and the certification is deferred to a fresh-clone run.
8. Any new `NEEDS-REVIEW`/`FAIL`/`SKIP` rows this run produced — why, and what
   path (if any) would close them deterministically next time.

The Agent View is a required section, not optional prose. If the agent found
nothing beyond the scripted rows, it must say so explicitly and state what it
checked to conclude that — a blank Agent View is a FAIL of this prompt.

## 8. Report contract

Write the final report to:

```text
dev/scratchpad/az-v0.0.25-harness-live-test-report.md
```

The report must contain:

1. Environment, version, worktree identity, active model, and source-change
   confirmation.
2. Complete result table:

   ```text
   | Test ID | Domain | Status | Type | Duration | Evidence | Notes |
   ```

3. Summary counts: total, pass, fail, needs-review, skip, static-only,
   operator-confirmed.
4. Exact commands, stdout/stderr, exit codes, and error messages for failures.
5. Timing observations where measured.
6. Findings classified per §7.
7. **Agent View** (§7) — mandatory.
8. Verdicts:
   - `LIVE FUNCTIONAL VERDICT`
   - `LIVE UX/PERFORMANCE VERDICT`
   - `RELEASE-SAFETY VERDICT`
   - `IMPLEMENTATION/STATIC GATE VERDICT`
   - `CLEAN-RELEASE CERTIFICATION: NOT ESTABLISHED BY THIS TEST`
9. Overall verdict using exactly one:
   - `PASS — v0.0.25 tree verified in-harness`
   - `PASS WITH CAVEATS — named limitations remain`
   - `NEEDS-REVIEW — live evidence incomplete`
   - `FAIL — reproducible defect requires correction`

## 9. Cleanup checklist

Before ending:

- [ ] Remove `dev/scratchpad/az-fixtures/` and all disposable exports/databases.
- [ ] Restore any settings/session changes made by the tests (`/permissions`, `/mode`, provider settings).
- [ ] Confirm no source files changed (`git status --short` identical to baseline).
- [ ] Confirm no credentials written or exposed.
- [ ] Confirm no git commit/tag/push/publish/deploy occurred.
- [ ] Keep only the final report as the deliverable.
