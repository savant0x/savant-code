<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z Agent-Steering Teacher Live Test — execute inside the running CLI

**Version:** 1.0.0
**Date:** 2026-08-13
**Target:** the implemented + archived Agent-Steering Teacher (`FID-2026-0813-011..020` base feature) and the live read-only sidebar surface (`FID-2026-0813-022`).
**Execution model:** THIS PROMPT RUNS INSIDE THE HARNESS. The agent currently executing it IS the harness (`bun dev`, interactive CLI). Every test below must be performed with the harness's own tools from the live session — slash commands in this session (operator-driven, see §3a), the harness terminal tool for commands, and the harness file tools for fixtures/static inspection. Do NOT use tmux, do NOT build a binary, do NOT create an isolated repository copy, and do NOT leave the session for any phase. The live teacher Forge runs through the authenticated Savant Code SDK client; no provider credentials are required beyond the existing session auth (see §0 for the honest `unavailable` boundary).

**Purpose:** Prove the full teacher feature in-harness with live evidence: the `/learn` lifecycle (Forge → sandbox → graders → critique), the read-only `Teacher` sidebar panel, the per-attempt ZTAP receipt, versioned progression persistence, and the zero-authority/private-pack boundary. Deterministic gates are re-confirmed cheaply; the emphasis is the live surface and the interactive panel that unit tests cannot observe.

## 0. The honest `unavailable` boundary (read first)

The live Forge drives the real SDK client (`cli/src/teacher/forge.ts` →
`getSavantCodeClient({ headless: true })`). That client requires an auth token
(`getAuthTokenDetails()`). Two outcomes are valid and both must be recorded
truthfully, never conflated:

1. **Authenticated session** — the full pipeline runs: steering → `teacher-forge`
   (model `deepseek/deepseek-v4-pro`) → sandbox → equivalence + detection
   graders → `learner_critique` wait. Record `LIVE`/`OPERATOR-CONFIRMED` evidence.
2. **Unauthenticated session** — the Forge throws `Teacher Forge unavailable: not
   authenticated`, and the exercise must surface `unavailable` (fail-closed, no
   partial result, no progression write). That is the *correct* behavior, not a
   defect: mark the full-pipeline rows `SKIP` with the reason, and mark the
   fail-closed `unavailable` row a **PASS** with the observed message.

The sandbox (`subprocessSandboxBackend`, `node:vm` in a subprocess) and the
graders run locally without auth; only the live Forge needs the client. Never
invent a passing live Forge if the session is unauthenticated. The lifecycle
logic itself is headless-provable — see §3c for the provided driver path that
closes the former `NEEDS-REVIEW` rows without the operator.

## 1. Execution contract

The orchestrator must:

1. Read this file completely before starting.
2. Create one todo per phase and update it as phases finish.
3. Record every test as `PASS`, `FAIL`, `NEEDS-REVIEW`, `OPERATOR-CONFIRMED`,
   or `SKIP`, with type `LIVE` (observed behavior), `EXECUTABLE` (command run
   with direct exit), `STATIC` (source inspection only), or `OPERATOR`
   (interactive TUI/slash-command surface the in-harness agent cannot drive
   from inside itself — see §3a).
3a. **Operator-confirmed tests.** The interactive TUI surface (slash commands,
   the sidebar panel, focus/focusability, Ctrl+C) cannot be driven by the
   in-harness agent from inside itself. For any such test: hand it to the
   operator to execute in the live CLI, then record the result as
   `OPERATOR-CONFIRMED` with type `OPERATOR` and note the operator's
   confirmation in the Evidence column. Never write `PASS`/`LIVE` for a test
   you did not observe yourself, and never leave a self-executable test as
   `OPERATOR-CONFIRMED`.
3b. **FSM routing.** `transition_phase` is a state machine: `green` may only go
   to `audit` (or `idle`); `complete` is reachable only from `audit`,
   `adversarial`, or `self_correct`. To finish, route `green → audit →
   complete → idle`. Do not attempt `green → complete`; it is invalid by design.
3c. **Trigger paths — how every NEEDS-REVIEW row is closed.** A prior run
   recorded 19 rows as `OPERATOR`/`NEEDS-REVIEW` ("not driven / not observed").
   That was a process gap, not an evidence boundary: the runtime is headlessly
   drivable via its dependency-injection seams and the panel renders from a
   store slice, so almost every row has a deterministic path. Use these paths;
   never mark a row `NEEDS-REVIEW` when a path below exists.

   | Row(s) | Path | Type |
   | --- | --- | --- |
   | TCH-005 | `bun dev/test-prompts/az-teacher-driver.ts` (reports auth presence) | EXECUTABLE |
   | TCH-042, TCH-045, TCH-047, TCH-050, TCH-053, TCH-055, TCH-060 | `bun dev/test-prompts/az-teacher-driver.ts` (stub Forge + in-memory store + store mirror) | EXECUTABLE |
   | TCH-041, TCH-044 | STATIC: `learn.ts` `handleStart`/`handleCritique` usage guards (no steering / no statement) | STATIC |
   | TCH-043 | `bun test cli/src/teacher/__tests__/runtime.test.ts` (reset-on-start + snapshot-copy) | EXECUTABLE |
   | TCH-046 | `bun dev/test-prompts/az-teacher-driver.ts` (readTeacherProgress) + STATIC `learn-progress.ts` empty→"no records" | EXECUTABLE |
   | TCH-048 | `bun dev/test-prompts/az-teacher-driver.ts` (exit clears store) | EXECUTABLE |
   | TCH-049 | `git status --short` before/after (only the gitignored `.savant/` store may change) | EXECUTABLE |
   | TCH-051 | driver store-slice assertion + STATIC `learn-overlay.tsx` field render | EXECUTABLE+STATIC |
   | TCH-052 | STATIC: `grep -n "focusable={false}" cli/src/components/right-sidebar.tsx` | STATIC |
   | TCH-054 | STATIC: TCH-033/034 absence greps | STATIC |
   | TCH-061 | `bun test cli/src/teacher/__tests__/runtime.test.ts` (vague critique fails; cancelled → no record) | EXECUTABLE |
   | TCH-040, TCH-042-live, TCH-045-live | Operator runs `/learn ...` in the authenticated CLI (explicit prompts in §7) | OPERATOR |

   Only the **authenticated live Forge** (real SDK client + real model) and the
   **pure-visual TUI focus/color** check remain operator-owned; every other row
   must be closed by its path above.
4. Prefer observable behavior over source claims. Every `LIVE` result needs its
   command/output or captured UI/artifact evidence in the report.
5. Continue after individual failures; capture exact error text, exit status,
   duration, and last observable state.
6. Do not modify source files. Disposable fixtures (if any) go under
   `dev/scratchpad/az-fixtures/` and are deleted before the final cleanup step.
7. Do not push, publish, tag, commit, deploy, or touch release mutation modes.
8. Redact credentials, personal paths, and environment values in the report.
9. Leave the repository working tree exactly as it was at session start; verify
   with `git status --short` at the end. A completed exercise writes only to the
   project-scoped progression store (`.savant/teacher-progression.sqlite`,
   gitignored) — it must never touch source files.
10. Write the final report to
    `dev/scratchpad/az-teacher-live-test-report.md` per Section 12.

## 2. Environment and baseline

Record at start and end of the report:

| Field | Value |
| --- | --- |
| Date/time and commit/worktree identity | |
| OS/platform/architecture | |
| Bun version and package version | |
| CLI launch command (this session) | |
| Auth state (authenticated Savant Code client or not) | |
| Model backend used for the live Forge (`deepseek/deepseek-v4-pro` per the agent definition, or observed) | |
| Working-tree baseline (`git status --short`) | |
| Source-change check at end | |

## 3. Phase 0 — Identity, safety, and version

| ID | Test | Expected observable result |
| --- | --- | --- |
| TCH-001 | `git status --short` before anything else | Baseline captured; no clean-tree claim without evidence |
| TCH-002 | `bun --version` and `VERSION` file | Bun `1.3.14` pinned; working tree identifies `0.0.24` |
| TCH-003 | Confirm no credential values are loaded into this session's context | No key/token printed anywhere in this run |
| TCH-004 | `git status --short` at the end of the entire run | Identical to baseline; source untouched |
| TCH-005 | Confirm the auth state that will govern the live Forge (`getAuthTokenDetails()` presence, not the value) | Authenticated or not, recorded explicitly — drives §0 |

## 4. Phase 1 — Deterministic gate matrix (in-session terminal)

Run each command with the harness terminal tool and record the DIRECT exit status.

| ID | Gate | Expected result |
| --- | --- | --- |
| TCH-010 | `cd cli && bun test src/teacher/ src/components/savant-ui/teacher/ src/state/__tests__/chat-store-teacher.test.ts src/commands/__tests__/learn.test.ts` | Exit 0; **38 pass / 0 fail across 5 files** |
| TCH-011 | `cd cli && bun test src/teacher/__tests__/runtime.test.ts` | Exit 0; snapshot-copy regression present (two `getTeacherSessionState()` calls return distinct-but-equal `events`) |
| TCH-012 | `cd cli && bun test src/teacher/__tests__/render.test.ts` | Exit 0; shared helpers + purity scan pass |
| TCH-013 | `cd cli && bun test src/components/savant-ui/teacher/__tests__/learn-overlay.test.ts` | Exit 0; reducer + zero-control + private-pack scans pass |
| TCH-014 | `cd cli && bun test src/state/__tests__/chat-store-teacher.test.ts` | Exit 0; store set/clear/reset pass |
| TCH-015 | `cd common && bun run typecheck && cd ../packages/agent-runtime && bun run typecheck && cd ../../cli && bun run typecheck && cd ../sdk && bun run typecheck` | Each exit 0 |
| TCH-016 | `bun x eslint . --max-warnings 0` | Exit 0 |
| TCH-017 | `bun run lint:md` | Exit 0 |
| TCH-018 | `bunx prettier --check .` | Exit 0 |
| TCH-019 | `bun run validate:repository` | Exit 0 |

## 5. Phase 2 — FID governance

| ID | Test | Expected observable result |
| --- | --- | --- |
| TCH-020 | `bun test scripts/fid-ledger.test.ts` | Exit 0; filename/status/relationship/cycle checks pass |
| TCH-021 | Inventory `dev/fids/` (active) vs `dev/fids/archive/` with the harness file tools | Active queue is empty; `FID-2026-0813-022` lives in `archive/` with `Status: closed` and `Closed Date: 2026-08-13` |
| TCH-022 | Inspect `dev/fids/README.md` and `dev/fids/archive/README.md` | Active ledger reports an empty queue; archive index has the teacher closure entries (011–021 + 022) |
| TCH-023 | Confirm the no-signature policy on new/active governance artifacts | No `Author:` / `Verified By:` / `Signed by:` fields in the teacher FIDs or archive index entries |
| TCH-024 | Confirm ZTAP P2–P4 are surfaced as planning-only (not closed FIDs) in `dev/fids/README.md` | Planning-only table lists P2/P3/P4; no FID claims them as implemented |

## 6. Phase 3 — Static zero-authority + private-pack boundary (STATIC)

| ID | Test | Expected observable result |
| --- | --- | --- |
| TCH-030 | `grep -n "LearnOverlay" cli/src/components/right-sidebar.tsx` | The sidebar mounts `LearnOverlay` (production call site), conditionally on `teacherState?.challenge != null` |
| TCH-031 | `grep -n "setTeacherState\|clearTeacher" cli/src/commands/learn.ts` | `setTeacherState` called at every mutation point; `clearTeacher` on exit |
| TCH-032 | `grep -n "events: \[\.\.\.events\]" cli/src/teacher/runtime.ts` | Snapshot copy is present in `getTeacherSessionState()` (load-bearing memo fix) |
| TCH-033 | `grep -rn "knownGoodSource\|hiddenTests\|mutationContract" cli/src/components/savant-ui/teacher/ cli/src/components/right-sidebar.tsx` | Matches appear **only in test files** asserting absence, never in component source |
| TCH-034 | `grep -rn "node:fs\|node:child_process\|node:crypto\|import(" cli/src/components/savant-ui/teacher/*.tsx cli/src/components/right-sidebar.tsx` | No filesystem/spawn/crypto/dynamic-import path in the UI surface |
| TCH-035 | Inspect the `import/no-restricted-imports` rule in `eslint.config.js` | Rule targets `savant-ui/teacher/*.tsx` + `right-sidebar.tsx` and **excludes** `cli/src/teacher/runtime.ts` (the legitimate runtime bridge) |

## 7. Phase 4 — Live `/learn` lifecycle (driver-first, then operator)

Run the headless driver first (`bun dev/test-prompts/az-teacher-driver.ts`) and
record its checks as `EXECUTABLE`/`LIVE` — it closes TCH-042, TCH-045, TCH-047,
and TCH-060 (plus the store-mirror rows in §8). Then hand ONLY the
authenticated live-Forge rows to the operator with the explicit prompts below;
record exact chat output. If the session is unauthenticated, apply §0.

Operator prompts (authenticated live Forge only):
- `/learn` — expect the lifecycle + command overview.
- `/learn start` (no text) — expect the usage message.
- `/learn start "implement a function that sums an array of numbers"` — expect
  `steering_submitted → forge_running → sandbox_running → equivalence_review →
  detection_review → learner_critique`, then the critique prompt.
- `/learn critique "<statement>" --location "<line>"` — expect the adjudication
  result + a ZTAP receipt line.
- `/learn progress` — expect the versioned record (or "no records" if empty).
- `/learn cancel` / `/learn exit` — expect cleanup and restored chat.

| ID | Test | Expected observable result |
| --- | --- | --- |
| TCH-040 | `/learn` | Overview lists the lifecycle and commands; no crash |
| TCH-041 | `/learn start` with no steering text | Usage message; no exercise starts |
| TCH-042 | `/learn start "implement a function that sums an array of numbers"` | Authenticated: lifecycle events stream (`steering_submitted → forge_running → sandbox_running → equivalence_review → detection_review → learner_critique`). Unauthenticated: honest `unavailable` surfaced, no partial result |
| TCH-043 | During an active exercise, `/learn start` again | Replaces/restarts the attempt cleanly (no dangling engine, no stale events) — or reports an active exercise per the command contract; record the exact behavior |
| TCH-044 | `/learn critique` with no statement | Usage message; no grading |
| TCH-045 | `/learn critique "the solution ignores empty-array edge cases" --location "<line>"` | Authenticated + correct concept: passes with equivalence + detection results and a ZTAP receipt line. Otherwise records the grader's actual verdict honestly |
| TCH-046 | `/learn progress` | Empty store → "no records" message; after a passed attempt → versioned competency record with per-skill state, counts, receipt status, and version metadata |
| TCH-047 | `/learn cancel` during an active exercise | Cleanup runs, no credit, `CANCELLED` state, no progression write |
| TCH-048 | `/learn exit` | Leaves the teacher; prior chat restored unchanged; no repo mutation |
| TCH-049 | `git status --short` immediately after a full exercise | Source tree unchanged; only the gitignored progression store may have been written |

## 8. Phase 5 — Live sidebar panel (store-slice + static, one visual pass)

The panel renders exclusively from the zustand `teacherState` slice, so the
driver already proves its content (TCH-050 mirror-on-start, TCH-053 terminal
receipt/persistence rows, TCH-055 clear-on-exit). TCH-051 (field render) is
STATIC via `learn-overlay.tsx`; TCH-052 (focusability) is STATIC via
`grep -n "focusable={false}" cli/src/components/right-sidebar.tsx`; TCH-054
(private-pack leak) is STATIC via TCH-033/034. One optional visual pass
remains — hand it to the operator with this explicit prompt:

> Start an exercise (`/learn start ...`), then inspect the right sidebar. The
> `Teacher` section appears below `Session` and above the Perfection Loop,
> shows the objective/prompt/guidance/phase/bounded event log, is not
> focusable or selectable (arrow keys/Tab do nothing inside it), shows the
> receipt + progression rows after a terminal attempt, and disappears after
> `/learn exit`. Record `OPERATOR-CONFIRMED`.

| ID | Test | Expected observable result |
| --- | --- | --- |
| TCH-050 | Start an exercise, then inspect the right sidebar | A `Teacher` section appears (below `Session`, above the Perfection Loop) while `challenge` is non-null |
| TCH-051 | Inspect the panel content | Shows objective, prompt, visible guidance (truncated ~80 chars), color-coded phase, bounded event log (≤20), completion state |
| TCH-052 | Try to focus/select inside the panel (arrow keys, Tab, mouse) | No focusable or selectable elements; the panel is observational only |
| TCH-053 | After a terminal attempt, inspect the receipt/progression rows | Receipt row (`signed by teacher over sha256:<truncated>` or `local-unverified`) and progression status are rendered |
| TCH-054 | Inspect the panel for private-pack leakage | Never shows known-good source, hidden tests, mutation contracts, or raw critique text |
| TCH-055 | `/learn exit` then inspect the sidebar | `Teacher` section disappears; no stale render |

## 9. Phase 6 — Progression, ZTAP, and no-mutation (harness + operator)

| ID | Test | Expected observable result |
| --- | --- | --- |
| TCH-060 | After a **passed** attempt, run `/learn progress` | Versioned competency record present; per-skill state and attempt/evidence counts increment |
| TCH-061 | After a **failed** or **cancelled** attempt, run `/learn progress` | No false progression: failed may record an attempt without competency advance; cancelled records nothing |
| TCH-062 | Confirm the ZTAP receipt semantics | Signed only when the attempt completed with a `TeacherAttemptReceipt`; otherwise `local-unverified` — never silently upgraded |
| TCH-063 | Confirm no telemetry/network path from the teacher | STATIC: `grep -rn "telemetry\|fetch(\|http" cli/src/teacher/ cli/src/components/savant-ui/teacher/` returns no teacher data egress |
| TCH-064 | Confirm progression is project-scoped + gitignored | The store lives under `.savant/` (project data dir); `.savant` is gitignored; `git status` shows no new tracked file |

## 10. Phase 7 — Cleanup and recovery

| ID | Test | Expected observable result |
| --- | --- | --- |
| TCH-070 | Remove `dev/scratchpad/az-fixtures/` and any disposable artifacts | Nothing left behind |
| TCH-071 | Restore session state (exit any active exercise, restore mode/permissions) | Prior chat and settings unchanged |

## 11. Findings classification

- `PRODUCT-BLOCKER` — the teacher cannot be used as documented
- `REGRESSION` — a previously working surface broke
- `SECURITY/PRIVACY` — private pack, credential, or teacher-data egress
- `GOVERNANCE` — FID/ledger/signature-policy drift
- `UX-FRICTION` — panel or command UX issue
- `PERFORMANCE-REGRESSION` — exercise or panel latency regression
- `PACKAGING` — shipping/gitignore/release-surface issue
- `AGENT-FEEDBACK` — Forge/graders behavior issue
- `ENVIRONMENT` — auth/model/sandbox environment limitation
- `NEEDS-REVIEW` — evidence boundary cannot be evaluated; permitted ONLY when no §3c trigger path exists

## 12. Report contract

Write the final report to:

```text
dev/scratchpad/az-teacher-live-test-report.md
```

using the same structure as the v0.0.23 A–Z template
(`dev/test-prompts/az-v0.0.23-harness-live-test-report.template.md`). The report
must contain:

1. Environment, version, worktree identity, auth state, model backend used, and
   source-change confirmation.
2. Complete result table: `| Test ID | Domain | Status | Type | Duration | Evidence | Notes |`.
3. Summary counts: total, pass, operator-confirmed, fail, needs-review, skip.
4. Exact commands, stdout/stderr, exit codes, and error messages for failures.
5. Timing observations for `/learn start` (Forge latency, sandbox, graders),
   `/learn progress`, and panel render where measured.
6. Findings classified per Section 11.
7. Verdicts:
   - `LIVE FUNCTIONAL VERDICT`
   - `LIVE UX/PERFORMANCE VERDICT`
   - `RELEASE-SAFETY VERDICT`
   - `IMPLEMENTATION/STATIC GATE VERDICT`
   - `CLEAN-RELEASE CERTIFICATION: NOT ESTABLISHED BY THIS TEST`
8. Overall verdict using exactly one:
   - `PASS — teacher feature verified in-harness`
   - `PASS WITH CAVEATS — named limitations remain` (e.g. unauthenticated Forge)
   - `NEEDS-REVIEW — live evidence incomplete`
   - `FAIL — reproducible teacher defect requires correction`

## 13. Cleanup checklist

Before ending:

- [ ] Remove `dev/scratchpad/az-fixtures/` and all disposable exports/databases.
- [ ] Exit any active exercise; restore session settings/mode/permissions.
- [ ] Confirm no source files changed (`git status --short` identical to baseline).
- [ ] Confirm no credentials written or exposed.
- [ ] Confirm no git commit/tag/push/publish/deploy occurred.
- [ ] Keep only the final report as the deliverable.
