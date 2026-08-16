<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z v0.0.24 Harness Live Test — execute inside the running CLI

**Version:** 0.0.24
**Date:** 2026-08-15
**Target:** the pending, unreleased `0.0.24` working tree — ZTAP provenance
(`FID-2026-0813-001..010`), the Agent-Steering Teacher (`011..020` + live
sidebar `022`), the canonical version-bump tool (`021`), the harness
observability/integrity remediation (`023`), the live sidebar surfaces
remediation (`FID-2026-0814-001`), the five-child remediation program
(`FID-2026-0814-002..007` — durable goal mode, hook system, harness frictions +
project-wide model unification, Trust Matrix `no_verdict` resolution, and
compaction freshness + visible feedback), the follow-on records
(`FID-2026-0814-008..013` — A–Z coverage extension, inter-agent prompt
coherence + project-wide paid-model reconciliation, paid-build model
conflation, and the compaction-trigger follow-ons), and the full 2026-08-15
program (`FID-2026-0815-001..015` — hot-path remediation, trace-writer async
append, grounding date/time, React Rules-of-Hooks, and CLI crash recovery).
**Execution model:** THIS PROMPT RUNS INSIDE THE HARNESS. The agent currently
executing it IS the harness (`bun dev`, interactive CLI). Every test must be
performed with the harness's own tools from the live session. Do NOT use tmux,
do NOT build a binary, do NOT create an isolated repository copy, and do NOT
leave the session for any phase.

**Purpose:** Prove the full 0.0.24 delta deterministically, with a concrete
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
3a. **Operator-confirmed tests.** The interactive TUI surface (slash commands,
   sidebar panels, Ctrl+C, restart-persistence) cannot be driven by the
   in-harness agent from inside itself. For any such test: hand it to the
   operator to execute in the live CLI, then record `OPERATOR-CONFIRMED` with
   type `OPERATOR` and the operator's confirmation. Never write `PASS`/`LIVE`
   for a test you did not observe yourself, and never leave a self-executable
   test as `OPERATOR-CONFIRMED`.
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
10. Write the final report to `dev/scratchpad/az-v0.0.24-harness-live-test-report.md`
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
| V024-001 | `git status --short` before anything else | Baseline captured; no clean-tree claim without evidence |
| V024-002 | `bun --version` and `cat VERSION` | Bun `1.3.14`; working tree identifies `0.0.24` |
| V024-003 | `bun run version:check` | Exit 0; `VERSION` + 16 manifests + `protocol.config.yaml project.version` agree |
| V024-004 | Confirm no credential values are loaded into this session's context | No key/token printed anywhere in this run |
| V024-005 | `git status --short` at the end of the entire run | Identical to baseline; source untouched |

## 4. Phase 1 — Static and executable gate matrix (in-session terminal)

Run each command with the harness terminal tool and record the DIRECT exit
status. Group results in the report table:

| ID | Gate | Expected result |
| --- | --- | --- |
| V024-010 | `bun run validate:repository` | Exit 0 (includes the `savantCode$1` absence scan) |
| V024-011 | `bun run version:check` | Exit 0; no drift |
| V024-012 | `bun run generate:protocol-bundle:check` | Exit 0; no drift |
| V024-013 | `bun run generate:provider-docs:check` | Exit 0; no drift |
| V024-014 | `bun run design-systems:check` | Exit 0; no drift |
| V024-015 | `bun run learnings:check` | Exit 0 |
| V024-016 | `bun run audit:evidence` | Exit 0 |
| V024-017 | `bun x eslint . --max-warnings 0` | Exit 0 |
| V024-018 | `bun run lint:md` | Exit 0 |
| V024-019 | `bunx prettier --check .` | Exit 0 |
| V024-020 | Typecheck ×4: `cd sdk && bun run typecheck`, `cd common && bun run typecheck`, `cd packages/agent-runtime && bun run typecheck`, `cd cli && bun run typecheck` | Each exit 0 |

## 5. Phase 2 — Feature-focused test suites (the 0.0.24 delta)

Each row is a deterministic executable path. Record counts and exit codes.

### 5a. ZTAP provenance (FID-001..010)

| ID | Test | Expected result |
| --- | --- | --- |
| V024-100 | `cd common && bun test src/crypto/__tests__/crypto.test.ts` | Exit 0 (SHA-256/JCS/HKDF/Ed25519) |
| V024-101 | `cd common && bun test src/provenance/__tests__/provenance.test.ts` | Exit 0 |
| V024-102 | `cd packages/agent-runtime && bun test src/provenance/__tests__/` | Exit 0 (session + pure-helpers) |
| V024-103 | `cd cli && bun test src/commands/__tests__/attest.test.ts src/commands/attest/__tests__/clean-process-audit.test.ts` | Exit 0 (`/attest` + clean-process independence) |
| V024-104 | `cd cli && bun test src/components/savant-ui/echo/__tests__/trust-matrix.test.ts` | Exit 0 (signed row, all-unsigned placeholder, key stability) |
| V024-107 | `cd cli && bun test src/components/savant-ui/echo/__tests__/trust-matrix-live.test.ts` | Exit 0 (live footer: store append → `reduceTrustMatrixEvents` row count increment — closes the former V024-P3-3 headlessly) |
| V024-105 | `cd common && bun test src/util/__tests__/protocol-config.test.ts` | Exit 0 (`provenance.mode` off/record/enforce + invalid fallback) |
| V024-106 | `grep -rn 'savantCode\\$1' --include='*.ts' --include='*.tsx' sdk cli common packages agents` | 0 matches (absence-shaped corruption scan) |

### 5b. Agent-Steering Teacher (FID-011..020 + 022)

| ID | Test | Expected result |
| --- | --- | --- |
| V024-110 | `cd common && bun test src/teacher/__tests__/contracts.test.ts` | Exit 0 (types + zod + trust-boundary parsers) |
| V024-111 | `cd packages/agent-runtime && bun test src/teacher/sandbox/__tests__/sandbox.test.ts` | Exit 0 (capability sandbox, fail-closed `unavailable`) |
| V024-112 | `cd packages/agent-runtime && bun test src/teacher/exercise/__tests__/engine.test.ts` | Exit 0 (lifecycle FSM, cancellation/cleanup, evidence hashing) |
| V024-113 | `cd packages/agent-runtime && bun test src/teacher/grading/__tests__/grading.test.ts` | Exit 0 (equivalence + mutation/detection graders) |
| V024-114 | `cd packages/agent-runtime && bun test src/teacher/progression/__tests__/progression.test.ts` | Exit 0 (versioned SQLite record, `local-unverified` fallback) |
| V024-115 | `cd packages/agent-runtime && bun test src/teacher/corpus/__tests__/corpus.test.ts` | Exit 0 (content-addressed packs, private-answer isolation) |
| V024-116 | `cd packages/agent-runtime && bun test src/teacher/__tests__/integration-audit.test.ts` | Exit 0 (cross-cutting trust boundaries) |
| V024-117 | `cd cli && bun test src/teacher/__tests__/runtime.test.ts src/teacher/__tests__/render.test.ts` | Exit 0 (forge adapter + `resolveTeacherForgeAgent` + snapshot copy + render helpers) |
| V024-118 | `cd cli && bun test src/commands/__tests__/learn.test.ts` | Exit 0 (`/learn` start/critique/cancel/exit/progress) |
| V024-119 | `cd cli && bun test src/state/__tests__/chat-store-teacher.test.ts` | Exit 0 (teacher slice set/clear/reset) |
| V024-120 | `bun dev/test-prompts/az-teacher-driver.ts` | Exit 0 (headless full lifecycle, 8/8) |
| V024-123 | `cd cli && bun test src/components/savant-ui/teacher/__tests__/learn-overlay.test.ts` | Exit 0 (compact single-bullet event rows, `CANCELLED` terminal state via the forwarded `completionState` prop, zero-control audit) |
| V024-121 | `grep -rnF -e knownGoodSource -e hiddenTests -e mutationContract cli/src/components/savant-ui/teacher/ cli/src/components/right-sidebar.tsx` | 0 matches (no private-pack leakage in UI source) |
| V024-122 | `grep -rnE 'node:fs|node:child_process|node:crypto|import\(' cli/src/components/savant-ui/teacher/ cli/src/components/right-sidebar.tsx` | 0 matches (zero-authority boundary) |

### 5c. Canonical version-bump tool (FID-021)

| ID | Test | Expected result |
| --- | --- | --- |
| V024-130 | `bun test scripts/bump-version.test.ts` | Exit 0 (13/13) |
| V024-131 | `bun run version:check` | Exit 0 (writer/validator agree) |
| V024-132 | `bun install --frozen-lockfile --dry-run` (or the documented frozen check) | No lockfile changes |

### 5d. Harness observability & integrity (FID-023)

| ID | Test | Expected result |
| --- | --- | --- |
| V024-140 | `cd sdk && bun test src/__tests__/run-pause-error.test.ts` | Exit 0 (name-based pause contract, no dead field branch) |
| V024-141 | `cd cli && bun test src/utils/__tests__/settings.test.ts` | Exit 0 (`savantCodeModelPreferenceLegacy` migration restored) |
| V024-142 | `grep -n compactionStatus packages/agent-runtime/src/run-agent-step/context-tokens.ts cli/src/hooks/helpers/send-message-monitors.ts cli/src/components/right-sidebar.tsx` | Three sites: runtime emit, store forward, sidebar row |
| V024-143 | `grep -n 'loadSavantCodeModelPreference\\|useSavantFreeModelStore.getState' cli/src/components/right-sidebar.tsx` | 0 matches in the render body (no render-time I/O) |
| V024-144 | `grep -n 'contextTokensMax' cli/src/state/chat-store/sidebar-actions.ts` | Reset in `resetSidebarData` and `reset` |
| V024-145 | `grep -n 'Governance' cli/src/components/help-banner.tsx` | Legend present: Perfection Loop phases, compaction legend `idle · ✓ micro · ⚙ compacting… · ✓ pruned · ⚠ N% of window`, Trust Matrix, commands |
| V024-146 | `grep -n compactionStatus agents/savant/handle-steps.ts packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts` | `compacting` emit at the pruner spawn (handle-steps) + `pruned`/`warning` writes + `lastPrunerCompletionAt` stamp at the spawn-agent-inline boundary (FID-2026-0814-001) |

### 5e. FID-2026-0814-002..007 — goal engine, hooks, harness frictions + model unification, Trust Matrix resolution, compaction feedback

| ID | Test | Expected result |
| --- | --- | --- |
| V024-150 | `cd packages/agent-runtime && bun test src/run-agent-step/__tests__/goal-engine.test.ts src/tools/handlers/tool/__tests__/goal-tools.test.ts src/__tests__/goal-driver.test.ts` | Exit 0 (state machine, budgets, tools, continuation driver — DI-seamed, no module mocking) |
| V024-151 | `cd packages/agent-runtime && bun test src/hooks/__tests__/runner.test.ts src/hooks/__tests__/engine.test.ts` | Exit 0 (fail-open runner + allow/block engine) |
| V024-152 | `cd packages/agent-runtime && bun test src/context-compactor-micro.test.ts` | Exit 0 (exit-code-preserving placeholder, pressure gate, keep-recent) |
| V024-153 | `cd cli && bun test src/state/__tests__/savant-free-model-store.test.ts` | Exit 0 (one-model invariant: no run path constructs a paid model when the store resolved free) |
| V024-154 | `cd cli && bun test src/state/__tests__/chat-store-compaction.test.ts` | Exit 0 (bounded `CompactionSignal` lifecycle events) |
| V024-155 | `cd agents && bun test __tests__/context-pruner-phase3.test.ts` | Exit 0 (H-07: `keepRecentTokens`/ratios threaded as baked literals) |
| V024-156 | `cd packages/agent-runtime && bun test src/provenance/__tests__/provenance.test.ts` | Exit 0 (`finalize` resolves open receipts to `no_verdict` with a signed system-role annotation) |
| V024-164 | `cd packages/agent-runtime && bun test src/tools/handlers/__tests__/run-readonly-command.test.ts` | Exit 0 (H-02: quote/character-class-aware shell filter) |
| V024-165 | `cd sdk && bun test src/run/execution/__tests__/snapshot.test.ts` | Exit 0 (FID-006: snapshot emits on status/context change, identity-skip preserved) |

Static presence/absence greps (same phase):

| ID | Grep | Expected result |
| --- | --- | --- |
| V024-157 | `grep -rn 'update_goal\|get_goal' common/src/tools/constants.ts agents/savant/savant.ts` | Registered + on the main agent template |
| V024-158 | `grep -n 'PreToolUse' packages/agent-runtime/src/tools/tool-executor/native.ts` | Gate wired as an *additional* project gate (composes with EHEL `beforeToolCall`) |
| V024-159 | `grep -n 'no_verdict' common/src/types/provenance.ts packages/agent-runtime/src/provenance/session.ts` | `ReceiptStatus` includes `no_verdict`; `finalize` sets it |
| V024-160 | `grep -rn 'CompactionSignal' cli/src/components/compaction-signal.tsx cli/src/chat/panels.tsx` | Component defined + mounted at the transcript bottom |
| V024-161 | `grep -n 'contextWindow\|compression' sdk/src/run/execution.ts` | Threaded across the SDK boundary (no silent 200k fallback) |
| V024-162 | `grep -rn 'deepseek/deepseek-v4-pro' cli/src/teacher cli/src/headless-run.ts` | 0 matches (no paid hardcode in the run path) |
| V024-163 | `grep -rn 'parseHookConfigs\|hooks' common/src/util/protocol-config.ts` | `hooks:` block parsed; invalid entries dropped fail-safe |
| V024-166 | `grep -n 'classifyFileKind' packages/agent-runtime/src/util/echo-compliance.ts` | H-03 code-vs-docs write classification present |
| V024-167 | `grep -rn 'inheritParentModel' agents/` | No `false` escape (only removal-reference comments remain) |

### 5f. FID-2026-0814-009 / -010 — prompt coherence + paid-model reconciliation + paid-build model conflation

| ID | Grep | Expected result |
| --- | --- | --- |
| V024-168 | `grep -n 'savantCodePreference ?? DEFAULT_SAVANT_CODE_MODEL_ID' cli/src/state/savant-free-model-store.ts` | Present — the paid boot branch resolves only from the `/model` selection (`openrouter/free` fallback), never the savant-free preference |
| V024-169 | `grep -n 'saveSavantCodeModelPreference(model)' cli/src/state/savant-free-model-store.ts` | Present — `switchModel` persists build-aware (paid → savant-code key; free → savant-free key) |
| V024-170 | `grep -rn 'minimax/minimax-m3\|deepseek/deepseek-v4-pro\|openai/gpt-5\|anthropic/claude' agents --include="*.ts" \| grep -v savant-free` | 0 matches (no paid model literal in any non-savant-free agent source — FID-009 B-07/B-08) |
| V024-171 | `grep -n "model: 'minimax/minimax-m3'" cli/src/agents/bundled-agents.generated.ts` | Only `savant-free-*` root agents remain; `librarian` + `tmux-cli` reconciled to `openrouter/free` (FID-010 B-10) |
| V024-172 | `grep -rn 'thinker-gpt' agents/ cli/src/commands/prompt-builders.ts` | 0 matches (pre-rebrand variant deleted; `/plan` + `/review` delegate to `@thinker` — FID-009 B-05) |
| V024-173 | `grep -rn 'Do not use any tools' agents/basher.ts` | 0 matches (basher two-phase contract rewritten — FID-009 B-01) |

### 5g. FID-2026-0814-011 — auto-compaction trigger single authority

| ID | Grep / test | Expected result |
| --- | --- | --- |
| V024-174 | `grep -n 'agentState.autoCompactDue = autoCompactCheck.shouldCompact' packages/agent-runtime/src/run-agent-step/context-tokens.ts` | Present — the proven `shouldAutoCompact` verdict is recorded every step (single trigger authority) |
| V024-175 | `grep -n 'const autoCompactDue = agentState.autoCompactDue === true' agents/savant/handle-steps.ts` | Present — the serialized savant handleSteps consumes the signal as the primary proactive trigger (ratio arithmetic is only a fallback) |
| V024-176 | `grep -n 'resolvedMaxContextLength' agents/savant/handle-steps.ts` | Present — fail-loud guard; the baked `maxContextLength` fallback is never silently adopted |
| V024-177 | `grep -c 'autoCompactDue' cli/src/agents/bundled-agents.generated.ts` | 13 (every savant variant carries the new logic) |
| V024-178 | `cd agents && bun test __tests__/context-pruner-phase3.test.ts` | Exit 0 (17 pass — incl. the `toString→eval` round-trip and the no-silent-fallback source assertion) |

### 5h. FID-2026-0815-001..015 — hot-path remediation, grounding, hooks, crash recovery

Executable rows (one path per FID where a dedicated suite exists):

| ID | Test | Expected result |
| --- | --- | --- |
| V024-180 | `cd packages/agent-runtime && bun test src/templates/__tests__/strings.test.ts src/util/__tests__/token-counter.test.ts` | Exit 0 (FID-001: `formatPrompt` placeholder-skip + `countTokensJsonCached` 18/0) |
| V024-182 | `cd cli && bun test src/utils/__tests__/trace-writer.test.ts` | Exit 0 (FID-003: async append + `flush`, 6/0) |
| V024-184 | `cd packages/agent-runtime && bun test src/util/__tests__/messages.test.ts` | Exit 0 (FID-004: `expireMessages` fast-path) |
| V024-186 | `cd packages/agent-runtime && bun test src/context-compactor.test.ts` | Exit 0 (FID-006: O(n) walks + `getThresholds` alias) |
| V024-190 | `cd packages/code-map && bun test && cd ../knowledge-graph && bun test` | Exit 0 (FID-009: bounded-parallel indexing) |
| V024-191 | `cd common && bun test src/util/__tests__/dates.test.ts` | Exit 0 (FID-010: `formatCurrentDateTime`) |
| V024-201 | `bun x eslint cli/src --max-warnings 0` | Exit 0 (FID-014: `rules-of-hooks` error, zero violations) |
| V024-204 | `cd packages/agent-runtime && bun test src/util/__tests__/activity-tracking.test.ts` | Exit 0 (FID-015 F-2: frozen-state heartbeat no-throw + `clearActivityIdleTimer`, 5/0) |
| V024-205 | `cd cli && bun test src/components/__tests__/error-boundary.test.tsx` | Exit 0 (FID-015 F-1: class boundary contract, 6/0) |
| V024-206 | `cd packages/database && bun test src/__tests__/service.test.ts` | Exit 0 (FID-015 F-3: cyclic-safe save omits timer/provenance) |
| V024-207 | `cd sdk && bun test src/__tests__/run-state-serialization.test.ts` | Exit 0 (FID-015 F-4: `provenance` omitted from transport) |

Static presence/absence greps (same phase):

| ID | Grep | Expected result |
| --- | --- | --- |
| V024-181 | `grep -n 'prompt.includes(varName)' packages/agent-runtime/src/templates/strings.ts` | Present — lazy placeholder-provider skip (FID-001) |
| V024-183 | `grep -n 'appendFile' cli/src/utils/trace-writer.ts && grep -n 'flush' cli/src/utils/trace-writer.ts` | Async `appendFile` + `flush()` (FID-003) |
| V024-185 | `grep -n 'captureSnapshot' packages/agent-runtime/src/tools/handlers/tool/checkpoint-store.ts` | `async` at `:147`, `closeTurn` flushes to disk (FID-005) |
| V024-187 | `grep -n 'getThresholds' packages/agent-runtime/src/context-compactor.ts` | `getThresholds(): Thresholds` at `:162` (FID-006) |
| V024-188 | `grep -n 'FID-2026-0815-007' cli/src/utils/openrouter-models/gateway.ts` | Present — on-disk warm-start gateway cache (FID-007 F-09) |
| V024-189 | `grep -n 'Object.is' cli/src/state/chat-store/sidebar-actions.ts` | No-op re-render guards at `:62/:68/:142` (FID-008) |
| V024-192 | `grep -n 'formatCurrentDateTime' common/src/util/dates.ts; grep -n 'Current date and time:' agents/savant/system-prompt.ts` | `dates.ts:22` + `system-prompt.ts:56` (FID-010) |
| V024-193 | `grep -c 'Current date and time:' cli/src/agents/bundled-agents.generated.ts` | 13 (every savant variant) |
| V024-194 | `grep -rn 'Current date:' cli/src/agents/bundled-agents.generated.ts \| grep -v 'time:'` | 0 matches (old ungrounded format gone) |
| V024-195 | `grep -n 'systemTokens' packages/agent-runtime/src/run-agent-step/context-tokens.ts` | Computed once (`:72`), returned `:255` (FID-011 E-01) |
| V024-196 | `grep -n "tier === 'all_15'" packages/agent-runtime/src/echo/pre-write-gates.ts` | Present (`:74`) — `existsSync` gated (FID-011 E-03) |
| V024-197 | `grep -n 'MAX_READ_PATTERNS = 256' packages/agent-runtime/src/util/echo-compliance.ts` | Bounded FIFO at `:55` (FID-011 E-04) |
| V024-198 | `grep -n 'SENSITIVE_KEY_SUBSTRINGS' cli/src/utils/logger/sanitize.ts` | Hoisted at `:26` — no per-key realloc (FID-012 G-03) |
| V024-199 | `grep -n 'messageCount' packages/agent-runtime/src/run-agent-step/step.ts` | Debug payload trimmed to scalars (FID-012 G-01) |
| V024-200 | `grep -n 'messagesWithStepPrompt' packages/agent-runtime/src/run-agent-step/context-tokens.ts` | Built only in the hosted branch (`:111`), sole consumer `:119` (FID-013) |
| V024-202 | `grep -n "react-hooks/rules-of-hooks" eslint.config.js` | `error` (`:214`) — crash class enforced (FID-014) |
| V024-203 | `grep -n "react-hooks/exhaustive-deps" eslint.config.js` | `off` (`:217`) — non-blocking (FID-014) |
| V024-208 | `grep -n 'clearActivityIdleTimer(initialAgentState)' packages/agent-runtime/src/run-agent-step/loop.ts` | Cleared in `finally` (`:398`) — no live timer over frozen state (FID-015 F-2) |
| V024-209 | `grep -n 'unhandledRejection' cli/src/utils/renderer-cleanup.ts` | Log-and-continue (non-fatal background async) (FID-015 F-5) |
| V024-210 | `grep -n 'getDerivedStateFromError' cli/src/components/error-boundary.tsx` | Real class boundary (no no-op passthrough) (FID-015 F-1) |

## 6. Phase 3 — Live operator prompts (the only non-automated surface)

The interactive TUI rows still need the operator's eyes, but each has an
explicit prompt and an observable target:

1. **Teacher `/learn` lifecycle** — in an authenticated live CLI: `/learn start
   "…"` streams Forge → sandbox → graders → seeded-defect review, then
   `/learn critique` (with `--location`/`--witness`) returns a pass/fail +
   ZTAP receipt line, `/learn progress` shows the versioned competency record,
   `/learn cancel` aborts without credit (the sidebar panel flips to the
   terminal `CANCELLED` badge via the forwarded `completionState`, not a
   perpetual in-progress state), `/learn exit` clears the sidebar panel.
2. **Teacher sidebar panel** — during an active exercise, the read-only
   `Teacher` panel appears below `Session` and disappears on exit; it renders
   objective/prompt/phase/events/receipt/progression and no focusable control.
   Event rows render as compact single-bullet lines (no per-event vertical
   gaps — FID-2026-0814-001), and after `/learn cancel` the panel shows the
   terminal `CANCELLED` badge instead of staying in-progress.
3. **Trust Matrix real-time** — with `provenance.mode: record`, trigger a signed
   write + verdict in-session → the `Adversarial Trust Matrix` panel gains a
   row and the `N signed event(s) this session` footer increments; in `off`
   mode (or with unsigned receipts) it shows the placeholder plus
   `N unsigned/unmatched event(s) hidden`, never a blank titled section.
   Executable proxy (headless, closes the former NEEDS-REVIEW gap):
   `bun test cli/src/components/savant-ui/echo/__tests__/trust-matrix-live.test.ts`
   — store append → `reduceTrustMatrixEvents` row count increment, plus the
   runtime `recordWriteReceipt` emission covered by the agent-runtime
   provenance suite.
4. **`/attest` export** — `/attest` writes the authoritative JSON plus an
   offline trust-receipt HTML; verify the artifact loads via `file://` with no
   network request and discloses the honest trust boundary.
5. **Compaction status** — run a session past the resolved context window → the
   Session `Compaction` row transitions `idle` → `compacting…` → `✓ pruned
   (−N tokens)` (micro-compact shows `✓ micro −N`; near/over the window the
   warning is `⚠ N% of window`). The `compacting…` phase is emitted by the
   savant handleSteps pruner spawn and the `✓ pruned` result by the
   spawn-agent-inline history-replacement boundary. Proactive spawns are
   cooldown-gated (≥30s since the last pruner completion); the hard-overflow
   force path still fires regardless. The spawn is driven by the single
   `shouldAutoCompact`-derived `autoCompactDue` signal (FID-2026-0814-011),
   so the trigger can never silently diverge from the warning. The in-stream
   transcript signal
   (`CompactionSignal`) additionally shows `⚙ Compacting context…` →
   `✓ Compaction complete (−N tokens)` → `⚠ Compaction ineffective` below the
   transcript during a full pruner run (bounded, render-only).
6. **Help overlay** — press `?` (or run `/help`) → the Governance legend lists
   the Perfection Loop phases, the compaction-status legend, the Trust Matrix
   legend, the goal-mode and hook-system entries, and the key commands.
7. **Durable goal mode** — `/goal refactor the state layer --budget turns=2`
   starts a durable, budgeted run: the sidebar goal row appears (state +
   consumption), the agent runs continuation turns until the budget or a block,
   and `/goal status` shows the goal + budget. `/goal cancel` terminates it and
   the sidebar row clears.

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

1. The model-source wiring: does every sub-agent (including `teacher-forge`)
   actually resolve the operator's active model, or does any surface still
   hardcode a model?
2. The `savantCodeModelPreference` vs `savantFreeModelPreference` divergence —
   is it fully reconciled, or still split across the Model row / billing?
3. Any new `NEEDS-REVIEW`/`FAIL`/`SKIP` rows this run produced — why, and what
   path (if any) would close them deterministically next time.
4. Any ECHO-law, zero-authority, or trust-boundary weakening observed at
   source, with the exact citation.
5. The durable-goal continuation driver — runaway-turn risk, budget
   enforcement (`turns=N` grants exactly N turns), and whether any non-main
   surface still hardcodes a model.
6. The hook `PreToolUse` gate — denial-of-service surface (30s default timeout,
   10,000-char output cap) and confirmation that fail-open holds under
   spawn-failure, timeout, and malformed output.
7. The `CompactionSignal` block — render-only (no history mutation, no
   tool/write path) and the one-window invariant (display denominator, warning
   threshold, and pruner trigger all agree).
8. The crash-recovery boundary (FID-015) — under a live render error or a
   background rejection, the session degrades to the fallback / log-and-continue
   rather than `process.exit(1)`; and the trace-writer `flush()` drains without
   dropping steps under load.

The Agent View is a required section, not optional prose. If the agent found
nothing beyond the scripted rows, it must say so explicitly and state what it
checked to conclude that — a blank Agent View is a FAIL of this prompt.

## 8. Report contract

Write the final report to:

```text
dev/scratchpad/az-v0.0.24-harness-live-test-report.md
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
   - `PASS — v0.0.24 working tree verified in-harness`
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
