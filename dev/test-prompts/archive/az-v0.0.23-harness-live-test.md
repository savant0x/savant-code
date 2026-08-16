<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z v0.0.23 Harness Live Test — execute inside the running CLI

**Version:** 2.0.0
**Date:** 2026-08-12
**Target:** pending, unreleased `0.0.23` working-tree update
**Execution model:** THIS PROMPT RUNS INSIDE THE HARNESS. The agent currently
executing it IS the harness (`bun dev`, interactive CLI). Every test below must be
performed with the harness's own tools from the live session — slash commands in
this session, the harness terminal tool for commands, the harness file tools for
fixtures, and the harness browser tool for the offline export. Do NOT use tmux, do
NOT build a binary, do NOT create an isolated repository copy, and do NOT leave the
session for any phase. The local Ollama instance is the model backend; no provider
credentials are required or allowed.

**Purpose:** Close the previously `NEEDS-REVIEW` rows of the 118-row v0.0.23 ledger
(dev/scratchpad/v0.0.23-comprehensive-live-test-report.md) with real in-harness
evidence, and produce a fresh A–Z report. Rows already proven PASS by deterministic
gates are re-confirmed only where the command is cheap; the emphasis is the 70
`NEEDS-REVIEW` rows.

## 1. Execution contract

The orchestrator must:

1. Read this file completely before starting.
2. Create one todo per phase and update it as phases finish.
3. Record every test as `PASS`, `FAIL`, `NEEDS-REVIEW`, `OPERATOR-CONFIRMED`,
   or `SKIP`, with Type `LIVE` (observed behavior), `EXECUTABLE` (command run
   with direct exit), `STATIC` (source inspection only), or `OPERATOR`
   (interactive TUI/slash-command surface that the in-harness agent cannot
   drive from inside itself — see §3a).
3a. **Operator-confirmed tests.** The interactive TUI surface (slash commands,
   wizards, Ctrl+C, restart-persistence) cannot be driven by the in-harness
   agent from inside itself. For any such test: hand it to the operator to
   execute in the live CLI, then record the result as `OPERATOR-CONFIRMED` with
   type `OPERATOR` and note the operator's confirmation in the Evidence column.
   Never write `PASS`/`LIVE` for a test you did not observe yourself, and never
   leave a self-executable test as `OPERATOR-CONFIRMED`.
3b. **FSM routing.** `transition_phase` is a state machine: `green` may only go
   to `audit` (or `idle`); `complete` is reachable only from `audit`,
   `adversarial`, or `self_correct`. To finish, route `green → audit →
   complete → idle`. Do not attempt `green → complete`; it is invalid by design
   (see `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`).
4. Prefer observable behavior over source claims. Every `LIVE` result needs its
   command/output or captured UI/artifact evidence in the report.
5. Continue after individual failures; capture exact error text, exit status,
   duration, and last observable state.
6. Use the local Ollama backend (reachable at `http://localhost:11434`) for every
   model-dependent test. Record the exact model name from
   `curl -s http://localhost:11434/api/tags` in the environment table. If Ollama
   is unreachable or the model list is empty, mark those rows `NEEDS-REVIEW`
   with the reason — never invent a pass.
7. Never modify source files. Disposable fixtures go under `dev/scratchpad/az-fixtures/`
   (delete them before the final cleanup step) or the OS temp directory.
8. Do not push, publish, tag, commit, deploy, or touch release mutation modes.
9. Redact credentials, personal paths, and environment values in the report.
10. Leave the repository working tree exactly as it was at session start; verify
    with `git status --short` at the end.
11. Write the final report to
    `dev/scratchpad/az-v0.0.23-harness-live-test-report.md` per Section 13.

## 2. Environment and baseline

Record at start and end of the report:

| Field | Value |
| --- | --- |
| Date/time and commit/worktree identity | |
| OS/platform/architecture | |
| Bun version and package version | |
| CLI launch command (this session) | |
| Provider/model mode (Ollama model used) | |
| Ollama reachability (`curl -s http://localhost:11434/api/tags`) | |
| Ollama model used (name from the tags response, not just "reachable") | |
| Network availability | |
| Working-tree baseline (`git status --short`) | |
| Source-change check at end | |

## 3. Phase 0 — Identity, safety, and version

| ID | Test | Expected observable result |
| --- | --- | --- |
| AZ-001 | `git status --short` before anything else | Baseline captured; no clean-tree claim without evidence |
| AZ-002 | `bun --version` and `VERSION` file | Bun `1.3.14` pinned; working tree identifies `0.0.23` |
| AZ-003 | `cat cli/package.json \| grep '"version"'` and the other package manifests | Consistent `0.0.23` (or exact drift reported) |
| AZ-004 | Confirm no credential values are loaded into this session's context | No key/token printed anywhere in this run |
| AZ-005 | `git status --short` at the end of the entire run | Identical to baseline; source untouched |

## 4. Phase 1 — Static and executable gate matrix (in-session terminal)

Run each command with the harness terminal tool and record the DIRECT exit status
(no piping away exit codes; a `printf` marker after the command is acceptable to
capture the code). Group results in the report table:

| ID | Gate | Expected result |
| --- | --- | --- |
| AZ-010 | `bun run validate:repository` | Exit 0 |
| AZ-011 | `bun run quality:report` | Exit 0; measured growth ceilings current |
| AZ-012 | `bun run generate:protocol-bundle:check` | Exit 0; no drift |
| AZ-013 | `bun run generate:provider-docs:check` | Exit 0; no drift |
| AZ-014 | `bun run design-systems:check` | Exit 0; no drift |
| AZ-015 | `bun run learnings:check` | Exit 0 |
| AZ-016 | `bun run audit:evidence` | Exit 0; evidence labeled working-tree vs clean-certification |
| AZ-017 | `bun run release:public:preview` | Exit 0; mutation-free; no tag/commit/push/publish |
| AZ-018 | `bun run release:public:diagnose` | Exit 0; receipts bounded and redacted |
| AZ-019 | `bun x eslint . --max-warnings 0` | Exit 0 |
| AZ-020 | `bun run lint:md` | Exit 0 |
| AZ-021 | `bunx prettier --check .` | Exit 0 |
| AZ-022 | Typecheck × 4: `cd common && bun run typecheck`, `cd agents && bun run typecheck`, `cd packages/agent-runtime && bun run typecheck`, `cd cli && bun run typecheck` | Each exit 0 |
| AZ-023 | `cd scripts && bun test` | Exit 0 with counts |
| AZ-024 | `cd cli && bun test` | Exit 0 with counts |
| AZ-025 | `cd sdk && bun test src/` | Exit 0 with counts |

## 5. Phase 2 — FID governance, LEARNINGS, and metadata

| ID | Test | Expected observable result |
| --- | --- | --- |
| AZ-030 | Inventory active + archived FID paths with the harness file tools | Filesystem inventory agrees with `dev/fids/README.md` ledger; drift reported |
| AZ-031 | `bun test scripts/fid-ledger.test.ts` | Exit 0; filename/status/relationship/cycle checks pass |
| AZ-032 | `bun test scripts/learnings.test.ts` (or the learning validation suite path in `scripts/`) | Exit 0 with counts |
| AZ-033 | Create disposable LEARNINGS fixtures in `dev/scratchpad/az-fixtures/` for (a) future-date chronology, (b) superseded missing/cyclic target, (c) duplicate canonical rule | Invalid fixtures rejected; valid replacement resolves; no historical source touched |
| AZ-034 | `cat docs/embedded-learnings.md` (or its documented path) | No credential/identity leak; internal history distinct |
| AZ-035 | Confirm the no-signature policy on new/active governance artifacts | No `Author:` / `Verified By:` / `Signed by:` fields in current FIDs, session summaries, or CHANGELOG entries under test |

## 6. Phase 3 — Protocol boot, grounding, and session state (THIS session)

These tests use the live session and its own first-turn behavior. The session
already booted under the harness; capture what is observable now:

| ID | Test | Expected observable result |
| --- | --- | --- |
| AZ-040 | Inspect the current session's boot contract resolution (`protocolSource: 'local' \| 'embedded'`) in the session state / persisted run state | Local or embedded source identified; no crash. If session state is not directly inspectable, record STATIC evidence from the boot-contract resolver plus the persisted run-state field |
| AZ-041 | Confirm the session performed its grounding reads this turn | Required reads observable in tool-call history; no user-cwd injection. If the tool-call history is not self-inspectable, record STATIC evidence from the grounding-gate wiring |
| AZ-042 | Verify the tool gate is armed: attempt a non-read tool call before grounding in a fresh throwaway context if reproducible; otherwise confirm the armed gate via the enforcement factory state | Gate fires in the documented modes; cannot silently bypass. If not observable in-session, record STATIC evidence from `packages/agent-runtime/src/echo/enforcement.ts` and say so |
| AZ-043 | `/mode` | Lists available modes (HYBRID/STRICT/ANALYZE/SCAFFOLD/PLAN) and reports current mode |
| AZ-044 | Verify embedded protocol bundle marker via `grep -c` on the generated bundle file | Only harness grounding set present; single-agent marker absent from harness context |

## 7. Phase 4 — ECHO enforcement and runtime compliance (live turns)

Use the live session with disposable source files under `dev/scratchpad/az-fixtures/`.

| ID | Test | Expected observable result |
| --- | --- | --- |
| AZ-050 | Ask the agent to write a visual file (e.g. `dev/scratchpad/az-fixtures/theme.json`) with complete final content and compliant tokens | Write succeeds; no false design violation |
| AZ-051 | Ask the agent to write a visual file with an unauthorized color/spacing/font literal | STRICT blocks or HYBRID returns explicit `DESIGN_CONTRACT_NEEDS_REVIEW`; objective receipt/error captured |
| AZ-052 | Repeat with a patch/replacement workflow touching the same file | Scanner evaluates reconstructed final content; classification distinct from ECHO Law 15 |
| AZ-053 | Trigger an execution-policy check: confirm `devMode === true` is not a blanket bypass | Only explicitly authorized policy fields affect the override |
| AZ-054 | Confirm bounded correction: provoke a repeated enforcement finding (within reason) | No infinite loop; actionable steering returned |
| AZ-055 | Confirm turn-end lifecycle: scanners execute once at the documented point | Observable via receipts/transcripts |

## 8. Phase 5 — Design-system library (slash commands, live)

Execute each in THIS session. Record the exact output.

| ID | Test | Expected observable result |
| --- | --- | --- |
| AZ-060 | `/design current` | Reports documented default or active selection and scope |
| AZ-061 | `/design list` | Lists systems without crashing; count matches manifest |
| AZ-062 | `/design use <known-id>` then `/design current` | Selection succeeds; current identifies the selected ID/scope |
| AZ-063 | `/design use <invalid-id>` and a path traversal reference | Actionable rejection; no outside read or silent fallback |
| AZ-064 | `/design create` with valid values through the wizard | Validates, previews, requires explicit save confirmation |
| AZ-065 | Cancel the wizard before save and after preview | No active mutation; bounded draft behavior |
| AZ-066 | Save without activation, then activate explicitly | Saved system exists; activation follows explicit choice |
| AZ-067 | `/design import` and `/design validate` with a valid disposable file | Success for valid input; exit/capture evidence |
| AZ-068 | `/design import` with malformed/unsafe/outside input | Rejected without partial activation or uncontrolled read |
| AZ-069 | `/design drafts`, `/design resume`, `/design discard` | Draft is bounded, non-active, resumable, removable |
| AZ-070 | `/design reset` in isolated scope | Requested selection removed; resulting precedence observable |
| AZ-071 | Confirm restart persistence of an active project selection | Record the active selection, restart the session (the operator may do this or the orchestrator may use a second disposable session), and confirm the selection reloads from the persistence store; objective pre/post evidence required |
| AZ-072 | Ask the agent a natural-language design-create intent (narrow) | Asks for confirmation; ordinary design discussion does not write |
| AZ-073 | Ask the agent to write a visual file (unauthorized) and then correct it | Receipt/error objective; subsequent correction evidenced |

## 9. Phase 6 — Provider registry and local configuration

| ID | Test | Expected observable result |
| --- | --- | --- |
| AZ-080 | `/provider` (or `/health`) | Reports Ollama reachability, current model preference, permission mode, provider mode; no secret leak |
| AZ-081 | Inspect `common/src/providers/registry.ts` and the generated provider reference | Provider IDs, ordering, setup labels, and model catalog derive consistently from the registry |
| AZ-082 | Attempt to configure an unknown provider/model via the settings seam (disposable copy of settings) | Actionable rejection; no fallback to an unintended provider |
| AZ-083 | Confirm provider docs + `.env.example` contain no live credentials | Static privacy check passes |
| AZ-084 | Live first turn through Ollama (this session's messages already do this) | Transcript proves routing through the selected local backend; no key used |

## 10. Phase 7 — Knowledge graph and offline Code Universe

| ID | Test | Expected observable result |
| --- | --- | --- |
| AZ-090 | `/graph refresh` | Index refresh completes with progress; no stale lock left behind |
| AZ-091 | Generate graph export twice with normalized timestamps (`/graph-export` or the documented command) | Deterministic content/hash contract observed |
| AZ-092 | Verify export artifact size and embedded resources | Self-contained; size recorded |
| AZ-093 | Open the export through `file://` in the harness browser tool | No runtime network request; no console errors |
| AZ-094 | In the browser: search an exact/prefix/path-segment/contains term | Ranked results appear; selection works |
| AZ-095 | In the browser: navigate region/folder/file; open document/image/unavailable fallback | Navigation, containment, rendering, fallback correct |
| AZ-096 | In the browser: breadcrumbs, prev/next, wrap, font-size, copy controls | Controls act on intended document; contained |
| AZ-097 | In the browser: minimize/maximize/close, Escape staging, taskbar restore | Panel state and selected document preserved |
| AZ-098 | In the browser: tree keyboard navigation and expand/collapse all | ARIA/focus and visible tree stay synchronized |
| AZ-099 | In the browser: reduced-motion/offline/resource-budget path | No unsafe external dependency; explicit fallback |

## 11. Phase 8 — SDK, RunState, bounded propagation, and headless

| ID | Test | Expected observable result |
| --- | --- | --- |
| AZ-100 | `cd sdk && bun run typecheck` | Exit 0 |
| AZ-101 | `cd sdk && bun test src/` | Exit 0 with counts |
| AZ-102 | Deserialize a representative prior RunState fixture (create one under `dev/scratchpad/az-fixtures/` from the documented schema, or use an existing fixture) | Backward-compatible fields survive without data loss |
| AZ-103 | Exercise bounded child fan-out/depth with a disposable fixture (bounded-subagent test path) | Limits enforced fail-closed with actionable diagnostics |
| AZ-104 | `bun cli/src/headless-run.ts --print "echo hello"` (or the documented headless invocation) against Ollama | Exit 0 output or classified provider/environment limitation |
| AZ-105 | Headless invalid/timeout path (e.g. empty or malformed prompt) | Non-zero exit bounded; stderr safe |
| AZ-106 | Pass active design metadata through a supported session path | Active contract identity/hash survives into runtime evidence |
| AZ-107 | Verify SDK embedder without boot contract preserves legacy behavior | Gate arming scoped; no unexpected universal gate for non-ECHO embedder (STATIC if not reproducible in-session) |

## 12. Phase 9 — CLI commands, modes, and recovery UX (live, this session)

| ID | Test | Expected observable result |
| --- | --- | --- |
| AZ-110 | `/help` | Usable command list; no crash |
| AZ-111 | `/diagnostics` | Usable diagnostics; no state corruption |
| AZ-112 | `/new` then continue | New session starts; state preserved/cleared per contract |
| AZ-113 | `/history` | Usable history output |
| AZ-114 | `/permissions` | Shows permission mode; change and restore it |
| AZ-115 | Invalid slash command (e.g. `/nonsense`) | Actionable usage/error; no crash |
| AZ-116 | `/mode strict` then `/mode hybrid` | Mode switches and reports back; session usable |
| AZ-117 | Cancellation during an interactive operation (Ctrl+C where safe) | Prompt returns to usable state; no partial mutation |
| AZ-118 | Rapid successive input | Queue/cancel/recovery bounded and visible |
| AZ-119 | Terminal cleanup after normal and error exit | Alternate screen/raw mode restored (verify at session end when the operator exits) |

## 13. Report contract

Write the final report to:

```text
dev/scratchpad/az-v0.0.23-harness-live-test-report.md
```

using the template at `dev/test-prompts/az-v0.0.23-harness-live-test-report.template.md`
(if present) or the same structure. The report must contain:

1. Environment, version, worktree identity, Ollama model used, and source-change confirmation.
2. Complete result table:

   ```text
   | Test ID | Domain | Status | Type | Duration | Evidence | Notes |
   ```

3. Summary counts: total, pass, fail, needs-review, skip, static-only.
4. Exact commands, stdout/stderr, exit codes, and error messages for failures.
5. Timing observations where measured (startup, `/design list`, graph refresh/export, headless runs).
6. Findings classified: `PRODUCT-BLOCKER`, `REGRESSION`, `SECURITY/PRIVACY`, `GOVERNANCE`,
   `UX-FRICTION`, `PERFORMANCE-REGRESSION`, `PACKAGING`, `AGENT-FEEDBACK`, `ENVIRONMENT`, `NEEDS-REVIEW`.
7. Verdicts:

   - `LIVE FUNCTIONAL VERDICT`
   - `LIVE UX/PERFORMANCE VERDICT`
   - `RELEASE-SAFETY VERDICT`
   - `IMPLEMENTATION/STATIC GATE VERDICT`
   - `CLEAN-RELEASE CERTIFICATION: NOT ESTABLISHED BY THIS TEST`

8. Overall verdict using exactly one:

   - `PASS — v0.0.23 live update verified in-harness`
   - `PASS WITH CAVEATS — named limitations remain`
   - `NEEDS-REVIEW — live evidence incomplete`
   - `FAIL — reproducible update defect requires correction`

Rows closed by this run should note the ledger row(s) they supersede (e.g.
"supersedes V023-201"). Rows that remain impossible from inside the session
(tmux-only e2e, clean-clone certification) are `SKIP` with the exact reason.

## 14. Cleanup checklist

Before ending:

- [ ] Remove `dev/scratchpad/az-fixtures/` and all disposable exports/databases.
- [ ] Restore any settings/session changes made by the tests (`/permissions`, `/mode`, `/design reset`, provider settings).
- [ ] Confirm no source files changed (`git status --short` identical to baseline).
- [ ] Confirm no credentials written or exposed.
- [ ] Confirm no git commit/tag/push/publish/deploy occurred.
- [ ] Keep only the final report as the deliverable.
