# Full-system data-flow audit — 2026-10-02

## Request and execution contract

Audit the full data flow throughout Savant-Code and produce a detailed report
of defects and optimization opportunities. Single-agent ECHO v0.1.2, strict
mode, automation level 3. The audit examines the current working tree,
including the earlier October 2 corrections. Historical reports are leads;
current source and fresh checks are the evidence for this report.

## Intended work and impact

Trace ingress, state ownership, model request construction, tool dispatch,
external connector boundaries, persistence, indexing and output delivery.
Exercise local deterministic checks where they establish a failure mechanism.
The authorized deliverables are the report and supporting audit evidence.
This is an inspection task; remediation recommendations will name their
implementation and verification requirements.

## Audit decisions

**Plan:** 3 steps. Subject: establish full-system data-flow evidence.

### Thought 1

Use production entry points and callers to identify every principal pipeline;
follow data identities, validation, cancellation and persistence across each
boundary. Include the desktop gateway and connector engine alongside CLI/SDK.

### Thought 2

Check suspected defects against complete owning modules and their callers.
Distinguish reproduced defects, source-confirmed mechanisms and measurements
from untested external behavior. Treat existing tests as evidence of their
specific assertions, not proof of the entire flow.

### Thought 3

Rank recommendations by user impact and measured or structurally established
cost. Coverage and reproduction limits accompany the findings; every finding
must identify its source and affected production route.

### Final

Deliver a current-source flow map, prioritized findings, optimization options,
and a verification record that another engineer can reproduce.

## Environment and baseline

Windows, Bun 1.3.14, TypeScript strict monorepo. Audit baseline is the current
working tree: HEAD `997ce946` plus the uncommitted October 2 enforcement,
code-search and token-budget implementation (Tasks T111/T112, FIDs
`FID-2026-1002-002` / `-003`, both status `verified`). No commit is
authorized. The parallel T111 audit report
(`dev/session-summaries/2026-10-02-system-data-flow-audit.md`) covered the
CLI send → SDK → runtime → state/sidebar loop in depth; this pass extends to
the surfaces T111 did not own — the desktop session gateway and its Rust
supervisor, the connectors engine, knowledge-graph indexing, the SQLite and
checkpoint persistence layers, and the headless/free entry points — and
re-verifies the October 2 corrections at their integration points.

## Flow map

The system has four ingress surfaces feeding one agent runtime:

1. **Interactive CLI (TUI).** `sendMessage` (`cli/src/hooks/helpers/
   send-message-fn.ts`) → prepare (`send-message-prepare.ts`: free-session
   guard, message prep, client init, streaming context, run lifecycle open)
   → run config (`send-message-run-config.ts` → `cli/src/utils/
   create-run-config.ts`: aborted-event fencing, sensitive-file filter,
   active-FID paths, compression/context-window threading) → SDK run.
2. **Desktop session gateway.** Tauri shell (`desktop/src-tauri/src/lib.rs`)
   spawns the compiled sidecar (`savant-code server`) via `spawn_sidecar`
   (`supervisor.rs:214`), which binds a loopback WebSocket JSON-RPC server
   (`cli/src/server/gateway.ts`). `user_message` (`cli/src/server/gateway/
   run-lifecycle.ts:13`) drives the same SDK through the `runPrompt` DI seam
   (`default-run-prompt.ts`), batching PrintModeEvents into 50 ms flushes
   (`state.ts:93`). The renderer's connection controller
   (`desktop/src/lib/gateway-client-connection.ts`) speaks hello-first
   handshake, exponential-backoff reconnect, and typed frame dispatch.
3. **Headless / print.** `runHeadlessPrint` (`cli/src/headless-run.ts`)
   runs one prompt with a hard timeout, optional NDJSON framing
   (`headless-ndjson.ts`) and a control-plane tap for steering.
4. **SDK embedders.** `run()` (`sdk/src/run/execution.ts`) normalizes
   previous-run state, assembles the wired runtime
   (`buildWiredAgentRuntime`), and starts snapshotting before
   `callMainPrompt` (`packages/agent-runtime/src/main-prompt.ts`).

Inside the runtime: `mainPrompt` (`main-prompt-run.ts`) demotes stale
goal/drive records, fires SessionStart hooks, and enters `loopAgentSteps`
(`run-agent-step/loop.ts`), which iterates `runLoopIteration` until turn end.
Model dispatch crosses `getModelForRequest` (`sdk/src/impl/model-provider.ts:58`)
— the single wrapping point where the T112 request-token budget middleware
(`model-provider/request-budget.ts:134`) is applied over the OAuth, prefixed
registry, and bare-slug routes. Tool calls cross `executeToolCall`
(`tools/tool-executor/native.ts`) through the ordered EHEL gate chain, then
into the typed handler registry (`tools/handlers/list.ts`, including the four
connector meta-tools). Connector egress is sealed: `executeEndpoint`
(`packages/connectors/src/runtime.ts:157`) validates → seals → runs, with
credential values resolved only through the engine's env seam. Persistence
fans out to the turn checkpoint store (`sdk/src/impl/... openTurn/closeTurn`
driven by `cli/src/hooks/helpers/send-message-lifecycle.ts`), coalesced chat
state saves, and SQLite (`packages/database/src/index.ts`, WAL +
fail-open-to-memory). The knowledge-graph indexer
(`packages/knowledge-graph/src/update.ts`) refreshes incrementally from the
CLI `/graph refresh` command and feeds graph export.

## Findings

Severity, trigger, consequence, evidence, and remediation per finding.
"Source-confirmed" means the mechanism is established by reading the
production modules named; a live reproduction is stated where it exists.

### D1 — High. The desktop sidecar anchors to its inherited cwd; no project path ever crosses the desktop→sidecar boundary

- **Evidence (source-confirmed):** `desktop/src-tauri/src/gateway.rs:76-83`
  (`build_spawn_spec` carries only `--port=<n>` and the token);
  `desktop/src-tauri/src/supervisor.rs:214-236` (`spawn_sidecar` sets env and
  stdio but never `.current_dir(...)`); `cli/src/server-command.ts:47-58`
  (`resolveServerProjectRoot`: `SAVANT_PROJECT_ROOT` override →
  `findGitRoot(cwd)` → cwd fallback). A full-tree grep finds zero
  project-path plumbing in `desktop/src` (the renderer receives only port +
  token, `desktop/src/lib/gateway-config.ts`). The gateway, run path, worktree
  capture (`packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts:44`
  — `process.cwd()`), FID rail (`server-command.ts:97-98`), and per-project
  data dir all derive from that one root.
- **Trigger:** any desktop session where the shell's inherited cwd is not
  inside the target repository. In dev this is protected by accident of
  layout (FID-2026-0901-004: the sidecar inherits `desktop/src-tauri`, which
  the enclosing repo rescues via `findGitRoot`). A release GUI launch
  (Start Menu / Explorer) inherits the install directory — not a git repo —
  so the fallback makes the install directory the project root: runs, file
  tools, Law 15 worktree baselining, the FID rail, and sensitive-file
  filtering all operate on the wrong tree.
- **Consequence:** in a non-dev desktop session the agent reads, indexes, and
  potentially writes relative to the wrong root; the FID rail is empty; chat
  storage keys off the wrong basename.
- **Remediation:** the supervisor already owns the project surface — pass the
  user-selected project path as `SAVANT_PROJECT_ROOT` in `build_spawn_spec`
  (env-only, like the token, honoring the frozen-v1 argv rule), and have the
  sidecar fail closed at `runServerCommand` when release builds resolve no
  explicit root. The env seam already exists and is tested
  (`cli/src/server/__tests__/gateway-server-command.test.ts:39-47`); only the
  supervisor leg is missing.
- **Verification limits:** the anchoring mechanism is established by reading
  the spawn path end to end; no release desktop shell was available in this
  session to reproduce the GUI launch live. The env-var seam and the
  git-root resolution are exercised by existing suites.

### D2 — Medium. Turn-end baseline advance uses `process.cwd()` while reconciliation uses the captured root

- **Evidence (source-confirmed):** `packages/agent-runtime/src/echo/enforcement/
  turn-end.ts:56` reconciles against
  `checkpoint?.worktreeBaselineRoot ?? process.cwd()`, but the same function
  advances the baseline at `turn-end.ts:117-120` with `repoRoot:
  process.cwd()`. `advanceWorktreeBaseline` silently drops any path outside
  the passed root (`worktree-capture.ts:236-238` — the
  `startsWith(rootCanonical + '/')` filter), and `resetForNewTurn` clears the
  verified set regardless (`turn-end.ts:126`).
- **Trigger:** the process cwd changing between baseline capture and a later
  turn end. The production chdir sites exist:
  `cli/src/components/app-with-async-auth.tsx:76` (project open/switch) and
  `cli/src/init/init-app.ts:26`. Capture seeds from `process.cwd()`
  (`tool-pipeline.ts:44`), so a capture taken before a switch and a turn end
  after it reconcile against the OLD root (correct) but advance against the
  NEW root.
- **Consequence:** every path verified in that turn fails the advance
  prefix check and is never absorbed into the baseline; the verified set is
  still wiped; the next turn-end reconciliation then re-flags those files as
  mutated-vs-baseline and, in strict mode, blocks the turn again — a
  repeated re-flag loop for already-verified work. This is the same
  root-drift class FID-2026-1002-002 corrected for the reconcile leg; the
  advance leg retains the old behavior.
- **Remediation:** advance against the captured root, mirroring the reconcile
  line: `repoRoot: checkpoint?.worktreeBaselineRoot ?? process.cwd()`. The
  turn-end comment that "behavior is identical" holds only while cwd is
  stable for the session's lifetime — the invariant the chdir sites already
  break.
- **Verification limits:** latent today in single-project CLI sessions
  (capture and advance share the stable cwd); the mechanism is pinned by
  source, not yet by a failing test. A regression test would chdir between
  capture and turn end with injected roots (the module takes `repoRoot` as a
  parameter, so the test seam exists).

### D3 — Medium. Gateway RPC dispatch has no error containment, and the async run handler is `void`-ed

- **Evidence (source-confirmed):** `cli/src/server/gateway/
  handshake-rpc.ts:115` dispatches `user_message` as
  `void handleUserMessage(...)`; neither `dispatch` nor the websocket
  `message` handler (`gateway.ts:159-167`) wraps handlers in try/catch.
  Inside `handleUserMessage`, the pre-try statements —
  `loadMostRecentChatState` (`run-lifecycle.ts:24`) and the acceptance
  `send` (`:37`) — sit outside the try block that guards the run itself.
  `handleHello` also sends from a detached `setTimeout`
  (`handshake-rpc.ts:69-77`).
- **Trigger:** a `send` on a socket closing mid-frame (Bun `ws.send` on a
  closed socket), or a storage read throwing during reconnect recovery.
- **Consequence:** the exception escapes the handler; for the `void`-ed async
  path it becomes an unhandled promise rejection on the sidecar process. An
  in-flight run whose completion `send` fails never delivers
  `run_complete`; the desktop client sits on a dead run until its own
  reconnect and the next user message.
- **Remediation:** wrap the dispatch body so every handler failure becomes a
  JSON-RPC error frame on the (live) socket or a logged drop, and give
  `handleUserMessage` an outer catch that emits
  `run_complete { ok: false }` for any pre-run failure. The bounded,
  test-seamed shape matches the existing `gateway-interrupt-reconnect`
  harness.
- **Verification limits:** the uncontained paths are identified by reading
  the dispatch surface; no fault-injection run was executed in this audit
  (the existing suites pin the happy path and the designed fail-closed
  approvals, not handler throws).

### D4 — Low/Medium. The gateway approval-lifecycle contract contradicts its implementation

- **Evidence (source-confirmed):** `cli/src/server/gateway/state.ts:78-80`
  documents pending approvals as surviving socket disconnects, and the
  gateway header (`gateway.ts:20-23`) repeats "pending approvals survive a
  socket disconnect/reconnect (in-process state-sync)". The implemented
  behavior denies every pending approval on ANY socket close
  (`gateway.ts:186-193` — `close(ws)` → `denyPendingApprovals(ctx)`) and the
  claim that "the desktop can re-approve after reconnect" has no
  implementation: the approvalId is deleted and the ask_user tool result is
  recorded as skipped.
- **Trigger:** any mid-approval disconnect (window reload, sleep/wake).
- **Consequence:** a consumer programming against the documented contract
  will build a re-approve flow that cannot work; the run settles as
  skipped instead of waiting. This is the same comment-vs-behavior drift
  class the register's FID-2026-0906-006 lesson warns about (a ruling or
  contract is only as fresh as its evidence).
- **Remediation:** either implement survival keyed to the approval lifetime
  (deny on gateway shutdown only, not on socket close — `denyPendingApprovals`
  is already the single owner called from both) or correct both comments to
  state deny-on-close. One-line contract decision; the tests
  (`gateway-approvals.test.ts`) pin the implemented behavior either way.

### D5 — Low. The gateway event flush timer is perpetual once armed

- **Evidence (source-confirmed):** `cli/src/server/gateway/state.ts:106-109`
  — `ensureFlushTimer` starts a 50 ms interval that nothing self-stops; only
  the facade `stop()` clears it (`gateway.ts:198-201`). After the first event
  of the session, an idle sidecar wakes every 50 ms indefinitely and
  `flushEvents` no-ops on the empty buffer.
- **Consequence:** minor CPU/energy cost on long-lived desktop sessions; a
  wake-per-50ms heartbeat that also masks "events stopped flowing" signals.
- **Remediation:** self-clear the timer when a flush drains the buffer empty
  (push re-arms); the batching contract (one frame per flush tick) is
  unchanged.

### D6 — Low (documented v1 boundary). Event batches are dropped when no socket is connected; reconnect has no replay

- **Evidence (source-confirmed):** `cli/src/server/gateway/state.ts:93-104`
  — `flushEvents` swaps the buffer and sends to `connectedSockets`, an
  possibly-empty set; the gap-loss is accepted by design
  (`gateway.ts:20-24`, "live full-resync ... explicitly OUT of v1 scope"),
  with reconnect continuation only via `previousRun` on the next
  `user_message` (`run-lifecycle.ts:30-45`).
- **Consequence:** a desktop client that disconnects mid-run loses every
  streamed event (tokens, tool activity, cost) and cannot reconstruct the
  run; combined with D3, even `run_complete` can be missed. Listed here so
  the v2 resync work has a named anchor, not as new scope.
- **Remediation direction:** a per-socket replay buffer with sequence
  numbers, or a "you missed N events" gap signal the renderer can act on.

### D7 — Low. Per-project data directories are keyed by directory basename only

- **Evidence (source-confirmed):** `cli/src/project-files.ts:53-59` —
  `getProjectDataDir()` joins `getConfigDir()/projects/<basename(root)>`.
- **Trigger:** two projects whose directories share a basename (e.g.
  `~/work/api` and `~/clients/api`).
- **Consequence:** both projects share one chats/checkpoints/logs namespace:
  `getMostRecentChatDir` can resume the other project's conversation, and
  trace/log sinks mix transcripts.
- **Remediation:** key by a stable hash of the resolved root (or
  `<basename>-<shorthash>`), migrating existing directories on first run
  after the change.

## Optimization opportunities

### O1 — Medium. The knowledge-graph refresh reads and retains the full corpus in memory on every pass

- **Evidence (source-confirmed + measured):** `update-scan.ts:155-168` reads
  every file under the 1 MB cap into the `sources` map (plus a SHA-256 of
  each file) on every `updateKnowledgeGraph` call, including incremental
  refreshes where zero files changed; `update.ts:197-217` then feeds ALL
  database file rows into `buildAllEdges`, which consumes `sources` for
  IMPORTS/EXTENDS regex extraction for unchanged files too
  (`extract.ts:151-156`). In this repository that is ~5,110 tracked files /
  ~28 MB read and retained per refresh (measured: `git ls-files` count +
  byte total), regardless of the changed-file count.
- **Optimization:** persist per-file import/extend tokens at change time,
  mirroring the existing `file_calls` pattern (the CALLS layer already
  rebuilds from persisted tokens for exactly this reason — see the
  incremental-invariant comment at `update.ts:158-162`), so the edge pass
  never needs unchanged sources; additionally, an mtime+size pre-filter
  before hashing avoids re-reading unchanged files between refreshes in one
  session. Determinism is preserved: the ordered walk and pre-sorted symbol
  index stay authoritative.
- **Expected effect:** refresh IO and memory drop from O(corpus) to
  O(changed); on this repo, from ~28 MB per refresh to near-zero on a clean
  tree.

### O2 — Low. The T112 budget middleware re-estimates the prompt on every dispatch

- **Evidence (source-confirmed):** `sdk/src/impl/model-provider/
  request-budget.ts:69-70` — `dispatchBudgetedRequest` calls
  `countRequestInputTokens(params)` before every generate/stream call. The
  counting is the conservative tokenizer over the final V2 prompt; for
  multi-step agent loops this re-counts an almost-identical prompt each
  step. The cost is bounded (pure CPU, no IO), and the correctness contract
  (count the FINAL prompt, never trust stale counts) is exactly what
  FID-2026-1002-003 requires.
- **Optimization direction (only if profiling shows it matters):** memoize
  the count keyed by the prompt's structure deltas between steps (append-only
  history makes suffix counting tractable), keeping the full re-count on any
  prune/compaction boundary. Do not weaken the contract to save the work;
  treat this as a measured-need-only follow-up.

### O3 — Low. Active-FID paths are re-read from disk at most every 30 s, but still synchronously on the send path

- **Evidence (source-confirmed):** `cli/src/utils/create-run-config.ts:87-99`
  — the TTL cache bounds the cost, but the first send after TTL expiry (and
  every send when the mode is active) still performs sync
  `readdir`+`readFile` on the render/input thread (`fid-loader.ts`). T111
  already removed the archive-IO component (70–76 ms → 0.35–1.06 ms);
  what remains is one active-directory scan per 30 s.
- **Optimization direction:** piggyback on the existing FID watcher
  (`cli/src/utils/fid-watcher.ts`, already running for the sidebar and the
  gateway FID bus) to invalidate a cached list instead of TTL-expiring into
  a sync read. Small win; only worth touching alongside other
  submission-path work.

## Prior-work integration spot-check (October 2 uncommitted implementation)

The T111/T112 corrections were re-verified at their integration points in
this pass, reading the current working tree:

- Budget enforcement is wired at the single model boundary:
  `sdk/src/impl/model-provider.ts:58` wraps `resolveModelForRequest` with
  `applyModelRequestBudget`; the wrapper's retry path re-reads observed
  limits from the store BEFORE recomputing (`request-budget.ts:41-46`), so a
  provider-reported smaller window corrects even an unknown-capability route.
  The compaction classifier consumes the same parser
  (`packages/agent-runtime/src/context-compactor/phases.ts:77`), so the
  recorded combined-limit wording triggers reactive compaction on the live
  path, not only in tests.
- Active-only FID loading reads only its own directory at the submission
  caller (`cli/src/utils/create-run-config.ts:143` → `fid-loader.ts:206`),
  matching the measured 0.35–1.06 ms claim in the T111 report.
- Run-lifecycle ownership guards are present as specified:
  snapshot-guard-before-sidebar-write (`send-message-lifecycle.ts:147-149`),
  post-drain identity rechecks (`:239, :256`), aborted event/chunk fencing at
  run-config dispatch (`create-run-config.ts:197-203`).
- Code-search fail-loud: unusable payloads are accounted drops
  (`sdk/src/tools/code-search/executor.ts` + `match-collector.ts`); the
  StringDecoder crosses chunk boundaries; the anomaly path never renders a
  "Found 0 matches" success line.

## Verification coverage and limits

- **Method:** every finding cites production modules read in full this
  session; line numbers are from the current working tree. D1 additionally
  rests on a measured negative (zero project-path references in
  `desktop/src`) and the measured corpus size for O1 (~5,110 files /
  ~28 MB). No project file was modified by script; the only writes this
  session made are this report and the SCOPE register update.
- **Executed checks:** corpus measurement (`git ls-files` + byte total);
  markdown lint and Prettier on this report; the SCOPE register probe after
  the register update. Full workspace gates were NOT re-run for this report:
  the audit made no code changes, and the working tree's gates were run and
  receipt-stamped by the T111/T112 verifications this same day (repository
  tests 7,760 pass / zero fail; ten declared gates exit 0 — see the two
  FIDs' receipts). No live release-desktop session, live provider call, or
  fault-injection run was executed; D1's release-launch trigger, D3's
  send-failure trigger, and D2's chdir trigger are established by source
  mechanism, with their reproduction paths named in each remediation.
- **Honest limits:** this report does not re-audit the evals workspace, the
  teacher subsystem, or the desktop 3D renderer data paths; it traces the
  operator-facing data flow the task named (CLI, SDK, desktop/gateway, free
  entry points, agents, providers, tools, connectors, persistence, indexing,
  event delivery). `savant-free` is a build wrapper over the same CLI
  (`savant-free/cli/build.ts`) and shares the audited paths; its free-session
  guard was verified at the ingestion layer (`send-message-prepare.ts:87-97`).

## Record

Task T113's deliverable is this report; findings D1–D7 and O1–O3 are
recommendations, not committed work — remediation ownership stays with the
register's standing rules. The SCOPE register is updated on completion per
its open-items-only rule; this file is the evidence record.
