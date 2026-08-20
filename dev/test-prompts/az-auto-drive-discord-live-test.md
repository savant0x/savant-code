<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z Auto Drive + Discord Rich Presence Live Test — execute inside the running CLI

**Version:** 0.0.25 (post-release delta, unversioned)
**Date:** 2026-08-18
**Target:** the two remaining **active** FIDs — `FID-2026-0818-001` (master,
step 8 program certification) and `FID-2026-0818-009` (Discord Rich Presence,
step 5 live smoke). Children `002`–`008` and the docs FID `010` are already
`closed` + archived; Nova issued PASS on planning, implementation, and the
009/010 hardcode + docs revision. This prompt is the operator-gated live-smoke
gate that closes master step 8 and 009 step 5.
**Execution model:** THIS PROMPT RUNS INSIDE THE HARNESS. The agent executing
it IS the harness (`bun dev`, interactive CLI). Drive the TUI surfaces you can
drive yourself; the operator-owned surfaces (real Discord client, the visual
`/auto` confirmation flow, the crash kill) are handed to the operator as
`OPERATOR` rows per §3a. Do NOT use tmux to fake the CLI, do NOT build a
release binary, do NOT leave the session.

**Purpose:** Prove the Auto Drive + Discord delta deterministically, with a
concrete trigger path per row, and produce a fresh A–Z report including the
mandatory **Agent View** (§7).

## 1. Execution contract

1. Read this file completely before starting.
2. Create one todo per phase and update it as phases finish.
3. Record every test as `PASS`, `FAIL`, `NEEDS-REVIEW`, `OPERATOR-CONFIRMED`,
   or `SKIP`, with Type `LIVE` | `EXECUTABLE` | `STATIC` | `OPERATOR`.
3a. **Operator-confirmed tests.** The visual `/auto` confirmation flow, the
   live Discord client presence, and the mid-run crash kill cannot be driven
   by the in-harness agent from inside itself. Hand those to the operator,
   then record `OPERATOR-CONFIRMED` with type `OPERATOR` and the operator's
   confirmation. Never write `PASS`/`LIVE` for a test you did not observe.
4. Prefer observable behavior over source claims; every `LIVE` result needs
   its command/output or captured evidence.
5. Continue after failures; capture exact error text, exit status, duration.
6. Never modify source files. Disposable fixtures under
   `dev/scratchpad/az-fixtures/` (delete before cleanup) or the OS temp dir.
7. Do not push, publish, tag, commit, deploy, or touch release mutation modes.
8. Redact credentials, personal paths, and environment values.
9. Leave the working tree exactly as it was at start; verify `git status --short`.
10. Write the final report to
    `dev/scratchpad/az-auto-drive-discord-live-test-report.md` per §8,
    including the Agent View (§7).

## 2. Environment and baseline

Record at start and end: date/time + commit/worktree identity, OS/platform,
Bun version, active model, network availability, `git status --short`
baseline, and a source-change check at the end.

## 3. Phase 0 — Identity, safety, and version

| ID | Test | Expected observable result |
| --- | --- | --- |
| AD-001 | `git status --short` before anything else | Baseline captured |
| AD-002 | `bun --version` | Bun `1.3.14` |
| AD-003 | `bun run validate:repository` | Exit 0 |
| AD-004 | Confirm no credential values loaded into session context | No key/token printed |
| AD-005 | `git status --short` at the very end | Identical to baseline |

## 4. Phase 1 — Static + executable gate matrix (re-run for the record)

| ID | Gate | Expected result |
| --- | --- | --- |
| AD-010 | `bun run validate:repository` | Exit 0 (ratchet ratified for Auto Drive + presence growth) |
| AD-011 | `bun x eslint . --max-warnings 0` | Exit 0 |
| AD-012 | `bun run lint:md` | Exit 0 |
| AD-013 | `bunx prettier --check .` | Exit 0 |
| AD-014 | Typecheck ×4 (sdk, common, agent-runtime, cli) | Each exit 0 |
| AD-015 | `cd packages/agent-runtime && bun test` | 1053 pass / 0 fail (or higher) |

## 5. Phase 2 — Feature-focused suites (the Auto Drive + Discord delta)

### 5a. FID-2026-0818-002 — drive-mode entry

| ID | Test | Expected result |
| --- | --- | --- |
| AD-100 | `cd common && bun test src/util/__tests__/drive-directives.test.ts` | Exit 0 (round-trip + escaping + stripped set) |
| AD-101 | `grep -n 'DRIVE_STRIPPED_TOOL_NAMES' common/src/util/drive-directives.ts` | `ask_user` / `suggest_followups` / `end_turn` present |
| AD-102 | `grep -n 'parseDriveLockDirective' packages/agent-runtime/src/run-agent-step/loop-context.ts` | Present — the `<drive-lock>` parse + tool strip boundary |
| AD-103 | `grep -n 'STRICT' cli/src/commands/auto-drive.ts` | Present — `/auto` pins the STRICT agent |

### 5b. FID-2026-0818-003 — decomposition engine

| ID | Test | Expected result |
| --- | --- | --- |
| AD-110 | `cd packages/agent-runtime && bun test src/run-agent-step/decomposition/__tests__/manifest-check.test.ts` | Exit 0 (5 cases) |
| AD-111 | `grep -n 'DriveManifest' common/src/types/auto-drive.ts` | Present |

### 5c. FID-2026-0818-004 — drive-loop supervisor

| ID | Test | Expected result |
| --- | --- | --- |
| AD-120 | `cd packages/agent-runtime && bun test src/run-agent-step/__tests__/auto-drive-driver.test.ts src/run-agent-step/__tests__/auto-drive-loop.test.ts` | Exit 0 (27 cases) |
| AD-121 | `cd packages/agent-runtime && bun test src/echo/__tests__/fid-validator-phase-evidence.test.ts` | Exit 0 (8 cases) |
| AD-122 | `grep -n 'driveAutoTurns' packages/agent-runtime/src/main-prompt.ts` | Present — the supervisor is wired into the main loop |
| AD-123 | `grep -n 'archiveCompletedFid' packages/agent-runtime/src/run-agent-step/auto-drive-loop.ts` | Present — COMPLETE archive move + CHANGELOG |

### 5d. FID-2026-0818-005 — self-healing ladder

| ID | Test | Expected result |
| --- | --- | --- |
| AD-130 | `cd packages/agent-runtime && bun test src/run-agent-step/__tests__/ladder-router.test.ts` | Exit 0 (5 cases) |
| AD-131 | `grep -n 'appendRunLogEvent' packages/agent-runtime/src/run-agent-step/run-log.ts` | Present — master FID `## Run Log` writer |

### 5e. FID-2026-0818-006 — completion certification

| ID | Test | Expected result |
| --- | --- | --- |
| AD-140 | `cd packages/agent-runtime && bun test src/run-agent-step/__tests__/goal-conformance.test.ts` | Exit 0 (7 cases) |
| AD-141 | `cd cli && bun test src/commands/export-conversation/__tests__/drive-report.test.ts` | Exit 0 |
| AD-142 | `grep -n 'DriveCertification' common/src/types/auto-drive.ts` | Present |

### 5f. FID-2026-0818-007 — observability + long-session bounds

| ID | Test | Expected result |
| --- | --- | --- |
| AD-150 | `cd cli && bun test src/utils/__tests__/bounded-arrays.test.ts src/utils/__tests__/keyboard-actions.test.ts` | Exit 0 (trim bounds + drive-interrupt Esc) |
| AD-151 | `grep -n 'demoteStaleActiveDrive' packages/agent-runtime/src/run-agent-step/auto-drive-driver.ts packages/agent-runtime/src/main-prompt.ts` | Present — crash-resume demotion at run start |
| AD-152 | `grep -n 'shouldBoundaryCompact' packages/agent-runtime/src/run-agent-step/auto-drive-driver.ts packages/agent-runtime/src/run-agent-step/context-tokens.ts` | Present — FID-boundary compaction checkpoint |
| AD-153 | `grep -n 'DriveStatusPanel' cli/src/components/right-sidebar.tsx` | Present — sidebar drive panel wired |

### 5g. FID-2026-0818-008 — headless CLI mode

| ID | Test | Expected result |
| --- | --- | --- |
| AD-160 | `cd cli && bun test src/utils/__tests__/auto-headless.test.ts src/utils/__tests__/auto-drive-headless.test.ts` | Exit 0 (17 cases) |
| AD-161 | `grep -n '"--auto <goal>"' cli/src/cli-args.ts` | Present — the headless mode flag |
| AD-162 | `grep -n 'runHeadlessAutoDrive' cli/src/index.tsx` | Present — bypasses the TUI on `--auto` |
| AD-163 | `grep -n 'completionExitCode' cli/src/utils/auto-drive-headless.ts` | Present — exit 0 only on zero open FIDs |

### 5h. FID-2026-0818-009 — Discord Rich Presence

| ID | Test | Expected result |
| --- | --- | --- |
| AD-170 | `cd cli && bun test src/state/presence/__tests__/presence.test.ts` | Exit 0 (18 cases: redaction/mapper/rate-limit/pipeline/IPC state machine) |
| AD-171 | `grep '"@xhayper/discord-rpc"' cli/package.json` | Present |
| AD-172 | `grep -n 'Usage: /presence' cli/src/commands/presence.ts` | `[status|enable|disable]` only — no `client` subcommand |
| AD-173 | `cd cli && bun test src/state/presence/__tests__/client-id-reachability.test.ts` | Exit 0 (6 cases: hardcoded-id reachability guard) |
| AD-174 | `grep -n 'SAVANT_DISCORD_CLIENT_ID = ' cli/src/utils/settings/preferences.ts` | Present — `'1539431002089328710'` hardcoded |
| AD-175 | `grep -n 'bootPresence' cli/src/init/init-app.ts` | Present — boot hook wired (enabled by default) |

## 6. Phase 3 — Live operator prompts (operator-owned surfaces)

1. **TUI `/auto-drive` end-to-end (002 + 007).** In the interactive CLI run
   `/auto-drive "<goal>"` (aliases `/auto` `/drive` `/autodrive`). Observe:
   clarity → pre-build `<drive-plan>` → Confirm/Revise/Cancel pane
   (inline-editable plan) → on Confirm the `DriveBanner` locks input → the
   sidebar **Auto Drive** panel shows goal/active FID/phase/open-count/
   Run-Log-count → Esc once pauses (banner changes), Esc again stops →
   `/auto-drive resume` re-enters. Record `OPERATOR-CONFIRMED`.
2. **Headless `--auto` (008).** Run
   `savant-code --auto "<full spec>" --spec ./spec.md --plan-file plan.md --plan-only`
   → a plan file is written and the process exits 0. Then
   `savant-code --auto "<full spec>" --spec ./spec.md --plan-file plan.md --approve`
   → the drive runs to completion, prints stdout progress, writes
   `dev/exports/auto-drive-report.md`, and exits 0 only when zero FIDs remain
   open. Record the exit code + report path.
3. **Crash resume (007 + 008).** Kill the headless run mid-drive
   (`Ctrl+C`/SIGKILL), then `savant-code --auto "<full spec>" --spec ./spec.md --approve --continue`
   → the queue re-scans `dev/fids/` and resumes from the paused drive.
   Record `OPERATOR-CONFIRMED`.
4. **Discord presence (009).** The Discord application + asset uploads are
   already configured by the operator. With Discord desktop open, run
   `/presence status` (reads enabled by default) then `/presence enable` →
   the operator's Discord profile shows the sanitized activity (project
   basename + model + phase + active agent, no file paths/args) under the
   hardcoded Savant application (`1539431002089328710`) → `/presence disable`
   clears it. Confirm the id is not changeable: `/presence client <id>` must
   be rejected with `Usage: /presence [status|enable|disable]`. Record
   `OPERATOR-CONFIRMED`.

## 7. Agent View — mandatory additional-findings section

Catalog every additional defect/risk/observation not covered by a scripted
row. Each entry: finding id + severity (`P0`/`P1`/`P2`), classification
(`PRODUCT-BLOCKER`/`REGRESSION`/`SECURITY/PRIVACY`/`GOVERNANCE`/`UX-FRICTION`/
`PERFORMANCE-REGRESSION`/`PACKAGING`/`AGENT-FEEDBACK`/`ENVIRONMENT`/
`NEEDS-REVIEW`), `file:line` evidence or exact command + output, impact,
recommended fix, reproduction notes.

At minimum re-examine (extend or refute with evidence):

1. **Drive-loop turn cap** — does `MAX_DRIVE_TURNS = 200` terminal-block
   (rung 7) rather than hang, and does the sidebar/`/auto status` reflect the
   `blocked` status?
2. **Interactive-tool strip** — with drive locked, are `ask_user` /
   `suggest_followups` / `end_turn` truly absent from the model-facing set,
   or can a subagent re-introduce one?
3. **Esc precedence** — while the approval pane is open (`awaiting_confirmation`),
   Esc must reach the normal cancel path (never swallowed); while driving, Esc
   must route to `drive-interrupt`. Confirm both branches.
4. **Headless fail-closed** — does `--auto` without `--approve`/`--plan-only`
   exit non-zero *before* any SDK call, and does an underspecified goal exit
   non-zero before any work?
5. **Presence privacy** — does a path-separator in `details`/`state` fall back
   to the safe payload (Zod fail-closed) rather than leak, and does the
   redaction survive a composed multi-agent snapshot?
6. **Presence hardcode guard** — is `SAVANT_DISCORD_CLIENT_ID` the only id the
   transport can receive (Law-4 `client-id-reachability.test.ts`), and is the
   `/presence client <id>` surface gone end-to-end (no settings/env fallback)?
7. **Quality ratchet** — was the re-baseline honest (only raised, never
   lowered; `approvedGrowth.maxLines >= trackedFiles` everywhere)?
8. Any new `NEEDS-REVIEW`/`FAIL`/`SKIP` rows and what path closes them.

A blank Agent View is a FAIL of this prompt.

## 8. Report contract

Write to `dev/scratchpad/az-auto-drive-discord-live-test-report.md`:

1. Environment, version, worktree identity, active model, source-change
   confirmation.
2. Result table: `| Test ID | Domain | Status | Type | Duration | Evidence | Notes |`.
3. Summary counts: total / pass / fail / needs-review / skip / static-only /
   operator-confirmed.
4. Exact commands, stdout/stderr, exit codes, error messages for failures.
5. Timing observations where measured.
6. Findings classified per §7.
7. **Agent View** (§7) — mandatory.
8. Verdicts: `LIVE FUNCTIONAL VERDICT`, `LIVE UX/PERFORMANCE VERDICT`,
   `RELEASE-SAFETY VERDICT`, `IMPLEMENTATION/STATIC GATE VERDICT`,
   `CLEAN-RELEASE CERTIFICATION: NOT ESTABLISHED BY THIS TEST`.
9. Overall verdict using exactly one:
   - `PASS — Auto Drive + Discord delta verified in-harness`
   - `PASS WITH CAVEATS — named limitations remain`
   - `NEEDS-REVIEW — live evidence incomplete`
   - `FAIL — reproducible defect requires correction`

## 9. Cleanup checklist

- [ ] Remove `dev/scratchpad/az-fixtures/` and disposable exports/databases.
- [ ] Restore `/permissions`, `/mode`, `/presence`, and provider settings.
- [ ] Confirm no source files changed (`git status --short` identical to baseline).
- [ ] Confirm no credentials written or exposed.
- [ ] Confirm no git commit/tag/push/publish/deploy occurred.
- [ ] Keep only the final report as the deliverable.
