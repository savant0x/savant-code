# FID: System review and optimization path

**Filename:** `FID-2026-1011-006-system-review-optimization-path.md`
**ID:** FID-2026-1011-006
**Severity:** high
**Status:** closed
**Created:** 2026-10-11
**Automation level:** 2
**YAGNI-Compliance:** Existing seams reused; no new service or dependency

---

## Implementation approval

Operator approved 2026-10-11: "Approve implementation of all R01–R20 in
FID-2026-1011-006 and verify every acceptance criterion." This supersedes the
historical implementation hold below. All twenty findings are authorized; no
push, release, production-data mutation, or unrelated worktree change is authorized.
Implementation evidence and criterion results are recorded in this record before
closure.

## Summary

Architecture-led review of startup/indexing, agent execution, provider catalogs,
connector transport, persistence, and desktop connection state identifies twenty
findings (R01-R20), including all fourteen original findings and six sibling
findings. Isolated behavioral evidence is distinguished from static risks and
unmeasured optimization candidates. The operator authorized the full document-level
Perfection Loop on 2026-10-11; that does not authorize implementation. The
operator explicitly requires approval before implementation. Documentation creation
is authorized; implementation, release, push, and changes to existing operator work
are not authorized by this record.

## Environment

- **OS:** Windows, Git Bash terminal.
- **Language/Runtime:** TypeScript, Bun 1.3.14.
- **Commit/State:** `5db442b4527e17d974e73b2edee86b320285331d`, branch `main`.
- **Initial worktree:** twelve pre-existing changed/untracked paths, preserved.
- **Governance:** `dev/echo-v0.1.2-single-agent.md` read completely; strict mode active.
- **History/context:** architecture, config, language standards, full current
  learnings, recent release history, scope register, and the active release FID.

## Detailed Description

### Problem

Passing typechecks and favorable unit fixtures leave correctness, lifecycle,
resource-budget, and scale gaps. In particular, row limits do not bound traversal
work, file limits do not bound actual parsing work, identity-based caching can
ignore explicit inputs, and durable deduplication can preserve stale content.

### Expected Behavior

Queries return truthful results; parsing honors project roots and resource budgets;
failed/cancelled runs release owned resources exactly once; injected transports
control egress; stale connections cannot mutate current state; persistence retains
current conversation data without repeated whole-history work.

### Root Cause

Several boundaries constrain their output rather than their execution, or identify
state by position/global identity rather than the domain key. Failure cleanup is
asymmetric with success cleanup. Graph refresh is incremental at source reads but
not at derived-edge/clustering work or at whole-snapshot commit boundaries.

### Evidence

#### Bugs and edge cases

**R01 — High — Default graph parser reads relative to process cwd, not project root. Confirmed.**

- `packages/knowledge-graph/src/update-scan.ts:20-36` accepts `fullPath` for
  language detection but calls `parseTokens(filePath, ..., readFile)`; its reader
  executes `fs.readFileSync(p)` without joining the project root.
- Probe: `defaultParseFile('src/queries.ts', absolutePathToQueries)` from the
  repository root returned zero identifiers and zero calls. Direct
  `parseTokens(absolutePath, config)` returned six identifiers and eleven calls.
- Impact: projects outside cwd silently lose symbol/CALLS evidence. Existing
  graph suites inject fake parsers and therefore do not exercise this default.
- Proposal: parse the already-read source under the correct project identity;
  preserve filesystem injection and avoid a second disk read. Test a non-cwd root
  and a virtual filesystem through the real default parsing boundary.

**R02 — Medium — Directed reachability reconstructs the wrong path order. Confirmed.**

- `packages/knowledge-graph/src/queries.ts:273-284` selects only paths using
  `WHERE id IN (...)`, then associates returned rows with input ids by position.
  SQL provides neither that positional contract nor the ids needed to recover it.
- In-memory graph: ids `1=start`, `2=end`, `3=middle`, edges `1→3→2`.
  Actual chain: `start,end,middle`; expected: `start,middle,end`.
- Proposal: select `id,path`, map by id, reconstruct the ordered chain, and pin
  non-monotonic ids plus deleted/reinserted files.
- Reachability has no current production caller found in the scoped symbol
  search; this is an exported-query defect, not a claimed live UI failure.

**R03 — High — Blast-radius traversal enumerates paths, not unique visited nodes. Confirmed scale hazard.**

- `packages/knowledge-graph/src/queries.ts:55-80` uses `UNION ALL` with a
  path-local cycle guard; `GROUP BY` and `LIMIT` execute after path expansion.
- Each alternate simple path is explored again. Different edge types or reciprocal
  edges can multiply equivalent routes. The synchronous call blocks its caller.
- Three local runs on complete graphs, one IMPORTS edge per unordered pair,
  `limit: 1`, default depth: six files ~0.4 ms; seven ~2.3 ms; eight ~18 ms;
  nine ~166-173 ms. These are adversarial scale fixtures, not production timings.
- Live consumers: graph tool handler and Verifier evidence injection in
  `packages/agent-runtime/src/util/graph-injection.ts:133`.
- Proposal: deterministic frontier traversal with global visited-node tracking,
  adjacency deduplication, shortest-depth semantics, and bounded work. Preserve
  both directions, cycles, stable ordering, and truthful truncation behavior.
  Apply the same reasoning to directed reachability's path enumeration.

**R04 — Medium — Cluster node counts actually count file anchors. Confirmed.**

- `packages/knowledge-graph/src/queries.ts:169-182` filters `n.type = 'file'`
  before computing `COUNT(*) AS node_count`.
- Fixture: three files with one anchor and one symbol each, all cluster 7.
  Actual `fileCount=3,nodeCount=3`; expected `fileCount=3,nodeCount=6`.
- Live Thinker injection labels the value as nodes at
  `packages/agent-runtime/src/util/graph-injection.ts:96`.
- Proposal: aggregate actual nodes separately from distinct files. Batch the
  representative-file projection rather than issuing one query per cluster.

**R09 — High — SDK handler rejection bypasses settlement cleanup. Confirmed.**

- `sdk/src/run/execution/settlement.ts:40-48` marks settled and calls
  `onSettled` only on resolve; rejection invokes `_reject` directly.
- Probe: dispatch a throwing handler, await rejected promise: error is
  `handler failure`, `onSettledCalls=0`, expected one.
- `sdk/src/run/execution.ts:148-155` relies on this callback to stop snapshots.
  Until the underlying runtime later settles, snapshots can continue after the
  host has received a rejected run. Repeated resolve also repeats cleanup.
- Proposal: one idempotent settlement seam for both outcomes, preserve the
  established handler-error contract, and ensure terminal cleanup cannot leave
  the host promise pending. Evaluate runtime cancellation separately: do not
  claim that stopping snapshots alone cancels provider work.

**R10 — Medium — Retry-wrapper early return does not finalize the source generator. Confirmed.**

- `packages/agent-runtime/src/provider-boundary/classified-stream-retry.ts:78-83`
  manually drives `.next()` with no corresponding source `.return()` in finally.
- Probe: source generator has a finally flag; consume one wrapper chunk and
  call `wrapper.return(...)`: `sourceFinalized=false`, expected true.
- Production seam: `packages/agent-runtime/src/prompt-agent-stream.ts:206,223`.
- The sibling `stream-recovery/recovery-executor.ts:69-80,120-130` also manually
  drives both original and recovery generators without finally/IteratorClose.
  The production caller already applies `AbortSignal.timeout(request.segmentBudgetMs)`
  in `prompt-agent-stream.ts:233-237`; a missing production recovery timeout claim
  is refuted. Preserve and test that existing protection, not invent a second timer.
- Proposal: guarantee IteratorClose on both wrappers' original/recovery legs and
  early return/error, preserve final values and partial-stream no-retry rules,
  and retain primary failures when cleanup throws. Preserve the recovery segment's
  existing transport abort deadline; prove cancellation and iterator cleanup rather
  than merely racing a still-running provider promise.

**R11 — Medium — Connector live invocation ignores its fetch override. Confirmed.**

- `packages/connectors/src/runtime.ts:230-249` leaves `fetchFn` undefined in
  live mode; only replay assigns it. `opts.fetch` is never read there.
- Offline probe installed a global fetch that throws before any network request
  and passed a separate injected fetch. Actual: injected calls zero, global
  calls one. No real endpoint was contacted and only a dummy key was used.
- Proposal: initialize live fetch from `opts.fetch`; replay remains authoritative
  in replay mode. Pin through `executeEndpoint`, not merely transport helpers.

**R12 — Medium — Connector bundle cache ignores explicit paths and retains failure. Confirmed.**

- `packages/connectors/src/runtime.ts:55-62` has one cached promise regardless
  of the `path` argument; rejection is not evicted.
- Probe: load default bundle, then a nonexistent explicit path. The second call
  returned the first bundle by identity instead of attempting that path.
- The follow-up failure/recovery probe confirmed that a rejected cached load is
  reused instead of retrying; reset is currently required to recover.
- Proposal: cache by resolved artifact identity and evict failed loads; preserve
  same-path in-flight sharing. Bound multi-path retention or document lifecycle.

**R13 — High — Stale desktop socket callbacks invalidate the current connection. Confirmed.**

- `desktop/src/lib/gateway-client-connection.ts:74-98,227-240` replaces
  `this.connection` without closing/retiring the previous socket. Callbacks have
  no generation ownership check; stale close clears the active connection and
  rejects all requests. Handshake error paths also target `this.connection`.
- Fake-transport probe: connect A, start its hello, connect B, then close A.
  Actual: A was not explicitly closed; `activeConnectionLost=true` despite B
  still being open. No actual desktop or network connection was used.
- Proposal: retire prior connections and bind every callback/handshake/replay to
  a connection generation. Only its owner may set status, cursor, or requests.
  Preserve reconnect backoff and explicit close behavior.

#### Sibling findings retained by the document loop

**R15 — High — Failed steering-audit writes are discarded. Confirmed source defect.**

- `cli/src/utils/entry-writers.ts:103-120` catches individual write failures and
  returns no success/failure information. `db-storage.ts:104-105` then clears the
  entire pending list, contrary to its comment promising retry on failure.
- Repair: return the unsuccessful records, retain them on agent state, and give
  each audit a stable deduplication identity before first persistence. Successful
  retries must not duplicate already committed immutable custom entries.
- Acceptance: inject a failure on the middle of three audits; only that record
  remains pending, the next save persists it once, and all records stay excluded
  from resumed conversation context. Exercise `saveChatStateToDb`, not only writers.

**R16 — Medium — Unrelated labels suppress compaction bookmarks. Confirmed source defect.**

- `cli/src/utils/db-storage.ts:114-118` counts every `label` entry as a completed
  compaction. Labels are a general entry class, not a compaction-only table.
- Repair: identify completed boundaries by session plus exact boundary ordinal,
  not label-row count. Keep general labels untouched and bookmark inserts idempotent.
- Acceptance: an unrelated label and three completed events produce exactly three
  compaction bookmarks; resave produces none; failure of boundary two does not
  prevent repair of its gap on the next save. Cover a new agent counter lifecycle.

**R17 — Medium — Commit observers can turn a committed write into reported failure. Confirmed source defect.**

- `packages/database/src/commit-journal.ts:66-77` executes DML and appends its
  record before invoking observers without isolation. A throwing observer escapes
  after the mutation already succeeded and prevents subsequent observers running.
- Repair: isolate observer failures from the domain-write result, notify remaining
  observers, and report bounded metadata through the existing diagnostics seam.
  Do not suppress actual SQL failures or pretend rolled-back writes are durable.
- Acceptance: a throwing observer followed by a healthy one cannot change the
  returned SQL change count; the row exists exactly once and both notifications
  are attempted. SQL failure still propagates and adds no successful-write record.

**R18 — High — Persisted import resolver escapes roots and weighting drifts. Confirmed source defect.**

- `packages/knowledge-graph/src/edges-from-tokens.ts:50-64` pops an empty segment
  stack for leading parent traversals, turning `../../outside` from a root file
  into an in-project candidate. The canonical resolver in `extract.ts:57-60`
  rejects escaping paths. `edges-from-tokens.ts:98-102` treats root filenames as
  top-level directories, unlike `extract.ts:132-135`'s dirname-based rule.
- Repair: call existing `resolveRelativeImport`, `isCrossDirectory`, edge types,
  weights, and accumulation utilities; remove duplicate lexical/weight logic.
- Acceptance: source-derived and token-derived edges are equal for root siblings,
  nested files, Windows separators, extension/index candidates, cycles, duplicate
  tokens, and attempted root escapes. No escaped specifier resolves to a local file.

**R19 — High — Incomplete enumeration is treated as proof of deletion. Confirmed source defect.**

- `common/src/project-file-tree.ts:92-149` returns partial trees after stat/readdir
  failure or its file/directory/depth cap; it does not return completeness evidence.
  `packages/knowledge-graph/src/update-scan.ts:177-198` deletes every absent path.
- Repair: extend the existing tree scan with an optional completeness outcome,
  preserving current array callers. Graph scans require complete enumeration
  before any deletion or a no-change certificate; incomplete scans reject refresh
  without mutating the previous snapshot. Distinguish intentional ignore filtering
  from unreadable directories and resource-cap termination.
- Acceptance: failed root/subdirectory enumeration and a capped tree leave all
  previous files/nodes/tokens/edges/clusters intact; a complete later scan performs
  real deletions. Inject failures through the actual graph update entry point.

**R20 — Medium — Catalog reset loses ownership of in-flight work. Confirmed source defect.**

- `cli/src/utils/openrouter-models/live-catalog.ts:90-104,116-120` resets cached
  state and `inflight` but an earlier request can still assign cache and clear the
  newer request's slot in its finally. Gateway publication/reset already has a
  generation token (`gateway.ts:137,193,213,242`); do not claim it lacks one.
  Its warm-start coverage await precedes assignment to `gatewayInflight`, so
  concurrent cold callers do not yet share that asynchronous validation phase.
- Repair: generation-own assignments and finally cleanup at existing provider and
  gateway fetcher seams; reset invalidates old work. Preserve the gateway's
  existing build token and extend in-flight sharing over warm-start validation.
  Preserve fresh/stale/empty fallback. Do not assume a production credential-reset
  caller exists: current full reset is explicitly test-only. At the provider-key
  mutation seam, add narrowly scoped catalog invalidation only after proving its
  caller; no key values may enter cache metadata or logs.
- Acceptance: deferred fetch A, reset, fetch B, then resolve A/B in both orders;
  only B becomes current, a third caller shares B, and A cannot clear B's slot.
  Test fallback, resolve-key rejection, forced refresh, and credential invalidation.

#### Speed and data-flow improvements

**R05 — Medium — Same-content mtime changes never advance the graph stat baseline. Confirmed.**

- `packages/knowledge-graph/src/index-path-plan.ts:119-122` classifies matching
  hashes unchanged; `update.ts:174-176` then skips persisting their new stats.
- Injected filesystem fixture: index at mtime 1, change only mtime to 2,
  refresh twice. Third pass still reads the source once; stored mtime remains 1.
- Proposal: persist successful stat-only baseline changes without replacing
  file ids/nodes/tokens. Verify the next pass performs zero source reads.
  Failed reads and concurrent content changes must not certify false freshness.

**R06 — Medium — Unchanged graph refresh still rebuilds derived state. Confirmed work; speedup unmeasured.**

- `packages/knowledge-graph/src/update.ts:106-111` always rebuilds edges,
  computes Louvain clusters, and rewrites cluster ids.
- No-content-change probe traced `BEGIN,COMMIT,DELETE FROM edges,BEGIN,COMMIT,
  BEGIN,COMMIT`. Source-read optimization does not eliminate this work.
- Proposal: skip derived phases only when a complete successful scan proves
  no topology/content changes and no schema/token backfill or full rebuild.
  Retain corpus re-resolution for added/deleted definitions. Measure cold,
  unchanged, stat-only, one-file, and deletion passes before claiming a gain.

**R07 — High — Graph refresh commits partial snapshots; edge clear is outside replacement transaction. Static risk.**

- `packages/knowledge-graph/src/update.ts:258-264` commits `DELETE FROM edges`
  before beginning the replacement INSERT transaction. A later insertion failure
  cannot roll that delete back. Source/node and cluster writes also commit in
  independent phases; stale deletion commits in `update-scan.ts` before parsing.
- CLI operation locks serialize some in-process operations, not arbitrary readers
  or other processes. A failure/read between phases can observe a partial graph.
- Proposal: compute the next scan/derived data before one coherent write commit;
  at minimum put edge clear and inserts in the same transaction. Determine the
  whole-refresh rollback contract before implementation, with failure injection.
- The initial injected-filesystem trigger probe was inconclusive. A later direct
  SQLite replacement failure reproduced lost edges after the separately committed
  clear. This strengthens the edge-clear claim, but whole-refresh rollback and
  concurrent-reader guarantees still require the acceptance tests below.

**R08 — High — Parser budgets apply after actual work; oversized disk reads precede checks. Confirmed plus static risk.**

- `packages/code-map/src/parse.ts:49-91` parses all files into `allResults`
  before the ordered cap walk. Probe with file budget one and byte budget 30:
  twelve input files produced twelve source reads and one returned result.
- `packages/code-map/src/parse/limits.ts:48-58` reads the whole disk file before
  checking its stat size against either byte limit.
- Production consumer: `sdk/src/run-state/project-index.ts:38-39`.
- Proposal: reserve/admit work before reads/parses with bounded lookahead while
  preserving deterministic file ordering and skip semantics; reject oversized
  files before reading and account for stat/read races. Test performed work,
  not only the returned dictionary. Measure elapsed time and retained memory.

**R14 — Medium — Conversation persistence favors first-write content and repeats whole-history work. Partly confirmed.**

- `packages/database/src/history.ts:27-39` uses `INSERT OR IGNORE`; a second
  save of the same stable id does not update changed content. In-memory probe:
  save `initial`, then `final`: stored content remains `initial`.
- `cli/src/utils/db-storage.ts:60-90` loads/parses all sessions for a chat and
  reserializes/inserts/readbacks every message on every authoritative save.
  `run-state-storage/save.ts:143-144` still runs `safeStringify` synchronously:
  async I/O moves writes off tick, not serialization off the JS thread.
- The CLI saves at turn start and end; a previous assistant message can be
  persisted before later completion/follow-up edits. Confirm the live mutation
  paths before assigning this a user-visible stale-message verdict.
- Proposal: pin mutable-message semantics first; selectively upsert conversation
  entries without overwriting immutable audit entries or cross-session ids.
  Query only the latest needed session and batch changed-message writes in the
  existing commit seam. Profile realistic long transcripts before considering
  workers, structural snapshot changes, or an incremental persistence format.
- UX/DX: report persistence degradation through the existing error/status channel
  without failing a turn; do not claim disk and DB are one atomic transaction.

### Review boundaries and existing work

This is a deep critical-path scan, not a line-by-line certification of all 5,891
indexed files. No live provider calls, production-data writes, browser/TUI smoke,
release execution, or comprehensive security audit were performed. Dense-graph
measurements demonstrate a mechanism, not typical user latency. T186 already owns
uncovered workspace gate legs, T187 owns trusted-skill metadata, and the active
release FID owns SDK exclusion. These are existing registered items, not newly
claimed defects. Existing learnings also contain superseded scripted-edit and
commit guidance; the governing protocol wins, and a policy-history cleanup needs
explicit approval rather than rewriting operator-owned history during this review.

## Impact Assessment

### Affected Components

Knowledge graph and graph evidence injection; code-map and SDK project indexing;
SDK settlement/snapshots; classified provider streams; connector runtime; desktop
connection controller; CLI/database conversation persistence.

### Risk Level

- [ ] Critical: No critical exploit or unrecoverable production loss established.
- [x] High: Multiple silent correctness/lifecycle and resource-boundary failures.
- [ ] Medium: Individual medium findings identified above.
- [ ] Low: Documentation clarity alone is not the main finding.

## Proposed Solution

### Approach

Prefer repairs at existing ownership seams, dependency injection, deterministic
state transitions, and workload counters. No new provider, service, dependency,
parallel registry, or new agent role is proposed. Correctness precedes performance;
optimizations must preserve outputs and failure detection. No implementation step
is approved yet; every step below is blocked on the operator's requested ruling.

### Steps

1. **Blocked — approval required:** correctness tranche: R01, R02, R04, R09,
   R10, R11, R12, R13. Extend existing regression suites and add focused suite
   artifacts only after paths and declarations are ratified in GREEN.
2. **Blocked — approval required:** graph safety/scale tranche: R03, R05, R06,
   R07. Agree traversal work bounds and snapshot rollback semantics, then prove
   unchanged/stat-only/topology-changing equivalence and benchmark actual work.
3. **Blocked — approval required:** index-resource tranche: R08. Enforce actual
   read/parse admission while preserving deterministic scoring and skip behavior.
4. **Blocked — approval required:** persistence/DX tranche: R14. Reproduce live
   content mutation, agree mutable-vs-audit semantics, profile realistic saves,
   then repair current-content persistence and eliminate redundant projections.
5. **Blocked — approval required:** sibling integrity tranche R15-R20, integrated
   with graph/persistence/catalog work above; preserve all independent acceptance
   cases rather than treating these findings as covered by the original fourteen.
6. **Blocked — approval required:** implementation verification, affected interface
   smoke, reproducible measurements, and path-scoped local commit. Close only with
   implementation evidence. The document-loop work is authorized and is not an
   implementation step; its audit results are recorded below.

### GREEN repair contracts and acceptance matrix

All source targets below are proposed, not write-authorized. Extend the named
existing suites; all listed suites exist and are declared under Verification Gates.
No placeholder test files, new dependency, or duplicate registry is required.
Where a helper is needed, its production caller is the named existing seam; a
helper with zero production callers fails implementation audit.

| Finding | Source targets and existing seam | Existing test target (repo-relative) |
| --- | --- | --- |
| R01 | `packages/knowledge-graph/src/update-scan.ts`, `types.ts`; default parser consumes admitted source | `packages/knowledge-graph/src/__tests__/update.test.ts` |
| R02-R03 | `packages/knowledge-graph/src/queries.ts`; directed/undirected query functions | `packages/knowledge-graph/src/__tests__/update-queries.test.ts` |
| R04 | `packages/knowledge-graph/src/queries.ts`; domain-cluster projection | `packages/knowledge-graph/src/__tests__/update-queries.test.ts` |
| R05-R07 | `packages/knowledge-graph/src/index-path-plan.ts`, `update-scan.ts`, `update.ts`, `clusters.ts`; refresh commit | `packages/knowledge-graph/src/__tests__/changed-only.test.ts`, `update.test.ts` |
| R08 | `packages/code-map/src/parse.ts`, `parse/limits.ts`; SDK scoring entry point | `packages/code-map/__tests__/parse-integration-scoring.test.ts`, `parse-tokens.test.ts` |
| R09 | `sdk/src/run/execution/settlement.ts`, `execution.ts`, `execution/snapshot.ts`; run settlement | `sdk/src/run/execution/__tests__/snapshot.test.ts` |
| R10 | `packages/agent-runtime/src/provider-boundary/classified-stream-retry.ts`, `stream-recovery/recovery-executor.ts`, `prompt-agent-stream.ts`; stream composition | `packages/agent-runtime/src/__tests__/stream-recovery.test.ts`, `request-budget-recovery.test.ts` |
| R11-R12 | `packages/connectors/src/runtime.ts`; live/replay execution and bundle loader | `packages/connectors/src/__tests__/catalog-tools-surface.test.ts` |
| R13 | `desktop/src/lib/gateway-client-connection.ts`; socket/hello/replay controller | `desktop/src/lib/__tests__/gateway-client.test.ts`, `gateway-client-replay.test.ts` |
| R14-R16 | `cli/src/utils/db-storage.ts`, `entry-writers.ts`, `run-state-storage/save.ts`; database/history/session entry seams | `cli/src/utils/__tests__/entry-writers-wiring.test.ts`, `packages/database/src/__tests__/service.test.ts`, `entry-classes.test.ts`, `durable-races.test.ts` |
| R17 | `packages/database/src/commit-journal.ts`; observer notification after SQL | `packages/database/src/__tests__/write-order-conformance.test.ts` |
| R18 | `packages/knowledge-graph/src/edges-from-tokens.ts`, `extract.ts`, `types.ts`; canonical edge utilities | `packages/knowledge-graph/src/__tests__/changed-only.test.ts` |
| R19 | `common/src/project-file-tree.ts`, graph `update-scan.ts`/`update.ts`; enumeration certificate | `common/src/__tests__/project-file-tree.test.ts`, `packages/knowledge-graph/src/__tests__/update.test.ts` |
| R20 | `cli/src/utils/openrouter-models/live-catalog.ts`, `gateway.ts`, `provider-key-persistence.ts`; catalog ownership and key mutation | `cli/src/utils/__tests__/openrouter-models-gateway-cache.test.ts`, `provider-credentials.test.ts` |

#### Graph correctness, resource bounds, and refresh atomicity

- **R01:** keep two-argument injected parsers source-compatible by adding an
  optional admitted-source argument to `ParseFileFn`. The default uses that source
  in `parseTokens`, not process cwd or a second disk read. Direct exported default
  parsing without source uses `fullPath`. A real tree-sitter non-cwd fixture and a
  virtual filesystem fixture must match absolute-path symbols and calls, with one
  admitted source read. Unknown language remains a deliberate best-effort result.
- **R02-R03:** replace path-enumerating CTEs with breadth-first traversal using
  one visited set and predecessor map. Deduplicate neighboring ids across edge
  types/directions; order each frontier by path. Return shortest depth and existing
  result shapes. Normalize invalid numeric inputs; zero output limit returns empty.
  Bound to the indexed graph's unique vertices/edges, not the number of simple
  paths: each vertex expands at most once, each stored edge at most once per
  direction. Directed reachability stops when target is found; blast-radius stops
  after a complete boundary frontier establishes the requested stable prefix.
  No invented truncated negative reachability verdict: only complete exploration
  within the existing depth cap returns unreachable. Test diamonds, cliques,
  cycles, disconnected targets, parallel edge kinds, depth boundaries, shuffled
  ids, delete/reinsert, and deterministic equal-depth ties. Instrument expansions;
  compare to a small reference BFS and measure the six-to-nine-node ladder plus a
  1,000-node sparse graph. Preserve existing snapshot-limited evidence wording.
- **R04:** count all nodes in the cluster and distinct file anchors separately;
  null clusters remain excluded, order remains fileCount then clusterId, and
  representative paths remain the first five sorted unique files. Batch the
  projection with a fixed query count rather than one query per cluster. Pin the
  original three-file/six-node fixture plus empty and mixed-size clusters.
- **R05:** persist new mtime/byte baselines only for successfully read identical
  hashes with consistent before/after stats. Keep file ids, symbol/token rows,
  edges, clusters and indexed content unchanged. A failed/racing read cannot
  certify freshness. After one stat-only pass the next pass has zero source reads.
- **R06:** certify no-change only after complete enumeration, stable reads, and
  no additions/deletions/content changes, full rebuild, schema migration, or missing
  persisted-token baseline. The no-change path performs no edge replacement or
  clustering; stat-only path writes only baselines. Adding/deleting a defining
  target still re-resolves unchanged source tokens. Compare normalized snapshots
  against full rebuild for cold, unchanged, touch-only, changed-file, delete, and
  migration passes. Record read/parse/edge/cluster counters and timing distributions.
- **R07:** scan is read-only; it returns deletion candidates rather than committing
  them. Complete source admission before opening a synchronous write transaction.
  Inside ONE transaction: verify the baseline, delete stale rows, upsert files and
  nodes/tokens, replace edges, compute/apply clusters, and commit. No awaits inside
  the transaction; use the existing database transaction primitive and writer
  serialization, not new storage infrastructure. A stale concurrent-writer
  baseline fails without publishing a mixed snapshot. Any SQL/edge/cluster failure
  rolls back the entire old graph, including stale files and stats. Inject failures
  at deletion, node/token insert, edge clear/insert, and cluster assignment. A second
  file-backed connection sees either old or committed new state, never empty edges.
  Do not equate database atomicity with a filesystem-wide point-in-time snapshot.

#### Parser admission, SDK ownership, streams, connector and desktop

- **R08:** use ordered admission before source parse; initially prefer sequential
  admitted reads/parses over speculative six-worker parsing with unreserved bytes.
  Preserve caller input order and skip semantics: unknown language, failed read,
  or too-large file does not consume a successful parse slot; a later smaller file
  can still fit. No source read after successful-file count exhaustion. Disk stat
  rejects too-large candidates before reading; bounded reading plus actual byte
  validation handles growth races. Injected readers lacking stat cannot promise
  bounded upstream allocation: document that boundary, enforce returned UTF-8 byte
  admission and never parse over budget. Preserve env names/defaults and return
  `FileTokenData` shape. Tests count actual reads/parses, use multibyte sources,
  skip-first files, racing sizes, and compare token scores/callers to the ordered
  reference. Measure 1/10/1,000-file admission and retained memory; no claimed
  speedup until measured, and report any I/O concurrency tradeoff.
- **R09:** both resolve and handler-error reject enter one terminal guard before
  cleanup; stop snapshots exactly once. Cleanup/logging failures cannot leave the
  promise pending or replace the primary handler failure. Repeated and competing
  settlement is first-terminal-wins. A late handler failure after resolution does
  not reject again. Preserve the current contract: handler rejection stops host
  snapshots but does NOT by itself promise provider cancellation. Test both sync
  and async throwing handlers through run assembly and verify zero later snapshots.
- **R10:** owned iterators close in finally for retry, original recovery and recovery
  legs; normal completion preserves return values, primary error dominates cleanup
  errors, and an isolated cleanup failure is reported. Consumer return/throw cannot
  initiate retries/recovery. Retain no retry after visible body, maximum two total
  physical requests and tools-empty recovery. Preserve the already-threaded parent/timeout abort signal to
  the recovery transport and existing 180,000ms segment/480,000ms total-budget
  calculation; do not add a competing timer. Fake clock plus abort-aware hung source proves
  timeout releases transport rather than leaving a raced promise running. Include
  recovery error frames and both legs' finally flags; test through stream composition.
- **R11:** initialize live transport with `opts.fetch`; replay override wins and
  neither global nor injected live fetch runs in replay. Full `executeEndpoint`
  tests prove request/response validation, dummy credential resolution, and no egress.
- **R12:** use absolute normalized artifact path as identity; share same-path
  in-flight promises, evict only the failed owning promise, and cap fulfilled LRU
  retention at 16 artifacts. Reset clears ownership; old failed loads cannot remove
  a newer promise. Preserve explicit reset as the file-content invalidation seam.
  Test relative/absolute aliases, two valid bundles, missing-then-created artifact,
  validation failure then corrected file, reset races and cache-limit eviction.
- **R13:** a generation captures socket and config; retire old requests/socket
  before replacement. Gate open/message/close/hello success/failure/replay completion
  and reconnect timers by generation. Old callbacks cannot close B, reject B's
  requests, emit events, or modify status/cursor/capabilities. Explicit connect to
  another project resets replay cursor; reconnect to the same owner retains it.
  Handle synchronous transport callbacks without referencing an unassigned socket.
  Cover A/B hello and replay completion in both orders, stale close/message/error,
  close-during-hello, duplicate disconnect, and existing backoff/connectOnce behavior.

#### Persistence integrity and catalog ownership

- **R14:** keep generic `createMessage`/immutable entry creation unchanged; add the
  mutable conversation write at the existing history seam, consumed by DB save.
  Conflict update requires matching session and `entry_kind='message'`; cross-session
  or audit-id collisions fail visibly, never overwrite. Preserve id/created_at/order
  and update content/role only when changed. Extend the current session-query seam
  with LIMIT 1 for latest-session callers. Batch changed conversation writes through
  `runCommit` and existing transaction rules, without bypassing journals. Restart
  correctness must not depend on a process-only dirty cache. Exercise DB save/load
  and scoped-thread RPC projection for initial→final stable-id content, unchanged
  saves, cross-session collision, and audit exclusion. Existing CLI completion
  mutation must be checked before claiming a reproduced user-visible stale result.
  Profile 100/1,000/10,000 messages (including multi-MB text), serialization time,
  writes/readbacks and retained memory. Worker serialization/new snapshot format
  is rejected without evidence; atomic JSON remains authoritative, not atomic with DB.
- **R15-R17:** follow the failure, deduplication, general-label and observer contracts
  under each RED finding. Stable immutable-event ids survive partial writes/restart.
  Do not clear failures or mark them persisted in serialized session state before
  durable acknowledgment. All persistence degradation uses existing warning/status
  channels without failing the turn; diagnostics contain no message/key payloads.
- **R18-R20:** canonical edge utilities, complete enumeration certificate, and
  catalog generations are mandatory correctness prerequisites for the performance
  short-circuits. Catalog failure retains current-generation stale cache or empty
  fallback; no automatic paid provider probe is part of acceptance.

#### Missed design questions and robust defaults

- Does an output limit bound work? Use unique-node traversal and parse admission;
  output-only truncation is rejected. Do not use a timing assertion as the sole gate.
- Can atomic edge replacement still publish a mixed refresh? Yes: only a single
  whole-refresh transaction meets R07; the smaller edge-only alternative is rejected.
- Is absence evidence of deletion? Only a complete scan; swallowed enumeration
  failure and budget termination cannot authorize deletion or no-change certification.
- Should stream cleanup errors mask provider/handler errors? No: preserve primary
  failure and report cleanup separately; do not turn all failures into STREAM_CUT.
- Is a label count a domain event identity? No; session/boundary ids own bookmarks.
- Can mutable upsert destroy an audit or another session's row? Guard both entry
  kind and owning session; generic audit writers remain append-only.
- Does async disk writing remove serialization stalls? No. Measure `safeStringify`
  through save before considering a worker or structural format change.
- Does a callback reset cancel old external work? Not necessarily; generation gates
  protect state, iterator return/abort releases owned transport resources.
- Are large-agent, hostile-input and maintainability requirements proven? The plan
  bounds algorithmic work and per-artifact cache retention, preserves validation
  and root boundaries, and reuses existing primitives. 1,000 simultaneous live
  agents, hostile production traffic and long-term maintainability are not tested
  here; they are not blanket certification claims.

### Verification

Initial baseline `bun run typecheck` passed all configured legs, exit 0. Focused
suites passed 75 tests with zero failures: knowledge graph 15, SDK snapshots six,
connectors seven, desktop gateway nine, code-map nine, database 29. The document
loop reran full typecheck (exit 0), full ESLint (exit 0), full Markdown lint (exit 0),
and `bun run test` (exit 0): SDK 676, CLI 4,119, common 833, agents 158, evals 229,
agent-runtime 1,973, design-systems 19, code-map 51, database 51, knowledge-graph 55,
LLM providers 89, connectors 17, desktop 444: **8,714 pass, zero fail**.
These are current baseline results, not proof that proposed repairs already exist.
Probes used production exported functions, in-memory databases, injected filesystems,
fake transports, or a network-blocked fetch; no implementation edits were needed.
Final documentation checks passed: targeted Markdown lint, scope-register and
scope-disposition probes (zero issues), and `git diff --check`, all exit 0.

GREEN names existing regression paths and their matching gates. Implement the
missing cases in those files after approval; existing green suites do not prove
missing cases. For performance, compare correctness, work counts, wall clock,
and memory across representative inputs; no speedup is claimed today.

## Verification Gates

- gate: typecheck sdk
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: typecheck packages/code-map
- gate: typecheck packages/database
- gate: typecheck packages/knowledge-graph
- gate: typecheck packages/connectors
- gate: typecheck desktop
- gate: test packages/knowledge-graph/src/__tests__/update-queries.test.ts
- gate: test packages/knowledge-graph/src/__tests__/changed-only.test.ts
- gate: test packages/knowledge-graph/src/__tests__/refresh-safety.test.ts
- gate: test packages/knowledge-graph/src/__tests__/edges-from-tokens.test.ts
- gate: test packages/knowledge-graph/src/__tests__/update.test.ts
- gate: test sdk/src/run/execution/__tests__/snapshot.test.ts
- gate: test common/src/__tests__/project-file-tree.test.ts
- gate: test packages/agent-runtime/src/__tests__/stream-recovery.test.ts
- gate: test packages/agent-runtime/src/__tests__/request-budget-recovery.test.ts
- gate: test cli/src/utils/__tests__/entry-writers-wiring.test.ts
- gate: test cli/src/utils/__tests__/session-entry-persistence.test.ts
- gate: test cli/src/utils/__tests__/live-catalog-generation.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/gateway-coverage.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway-cache.test.ts
- gate: test cli/src/utils/__tests__/provider-credentials.test.ts
- gate: test packages/connectors/src/__tests__/catalog-tools-surface.test.ts
- gate: test desktop/src/lib/__tests__/gateway-client.test.ts
- gate: test desktop/src/lib/__tests__/gateway-client-replay.test.ts
- gate: test desktop/src/lib/__tests__/gateway-client-generation.test.ts
- gate: test packages/code-map/__tests__/parse-integration-scoring.test.ts
- gate: test packages/code-map/__tests__/parse-tokens.test.ts
- gate: test packages/database/src/__tests__/service.test.ts
- gate: test packages/database/src/__tests__/entry-classes.test.ts
- gate: test packages/database/src/__tests__/write-order-conformance.test.ts
- gate: test packages/database/src/__tests__/durable-races.test.ts
- gate: probe scripts/scope-register-check.ts
- gate: probe scripts/scope-guard-check.ts
- gate: quality

## Perfection Loop

### Loop 1 — Initial RED record (historical baseline)

- **RED:** R01-R14 cataloged with code references, behavioral probes, and limits.
- **GREEN:** Proposed actions only; blocked pending implementation approval.
- **AUDIT:** Full typecheck exit 0; existing focused suites 75 pass, zero fail.
  Behavioral probes establish gaps not covered by these suites.
- **ADVERSARIAL:** Manual challenge, not an independent-agent certification:
  R02 has no production caller; R07 remains static; R12 failure retention remains
  static; R14 stale-content primitive is proven but live UX impact is unverified.
  Parser source-reading counters were refined to exclude ignore-file reads.
- **CHANGE DELTA:** Initial document; no convergence or closure claim.

### Missed Questions

1. Do output caps bound CPU, reads, or memory? No; R03 and R08 demonstrate why
   execution-work admission must be specified and measured separately.
2. Does cache identity include caller intent? Not for R12; explicit artifact paths
   must participate in the key. Provider credential changes also merit future
   validation at the existing catalog seam, not an invented parallel cache.
3. Can a previous lifecycle mutate a newer one? Yes for R13; generations must
   own callbacks. R09 and R10 need symmetric terminal cleanup.
4. Are all probes reproductions? No. R07's first rollback attempt yielded no
   failure evidence. Static risks and unmeasured candidates remain labeled.
5. Is implementation approved by analysis authorization? No. The user explicitly
   holds implementation until this initial findings record is approved.

### Implementation Evidence (REQUIRED for `closed`)

Implementation exists for R01-R19 and for the catalog-ownership half of R20; the
provider-key mutation hook named in R20 remains unimplemented and is reported
open below. Evidence is `file:line` ranges plus the gate runs that passed live on
the final bytes, not a commit receipt (no local commit exists yet, so this FID is
not closed).

- R01 default parser: `packages/knowledge-graph/src/update-scan.ts:18-31` consumes
the admitted `source` and only falls back to `fullPath` without one.
- R02-R04 traversal and clusters: `packages/knowledge-graph/src/queries.ts`
  `walkFrontiers` (visited set + predecessor map), `queryReachability`,
  `queryDomainClusters` (`COUNT(DISTINCT CASE WHEN type = 'file' ...)` + `COUNT(*)`).
- R05-R07 refresh: `packages/knowledge-graph/src/index-path-plan.ts` stat
  baseline, `packages/knowledge-graph/src/update.ts` single `db.transaction(...).immediate()`
  wrapping baseline verification, stale deletes, upserts, edge replacement and
  cluster assignment; `scanIndexState` returns deletion candidates instead of
  committing them.
- R08 parser admission: `packages/code-map/src/parse.ts:29-52` ordered admission,
  `packages/code-map/src/parse/limits.ts:36-79` stat-then-bounded-read.
- R09 settlement: `sdk/src/run/execution/settlement.ts` single terminal guard.
- R10 iterator ownership: `packages/agent-runtime/src/provider-boundary/classified-stream-retry.ts`
  and `packages/agent-runtime/src/stream-recovery/recovery-executor.ts` finally
  IteratorClose on both legs.
- R11-R12 connector: `packages/connectors/src/runtime.ts:264` live fetch override,
  `:55-88` path-identity cache with failed-load eviction and `MAX_CACHED_BUNDLES`.
- R13 desktop generations: `desktop/src/lib/gateway-client-connection.ts`
  generation capture, callback gating, and cursor reset on owner change.
- R14 mutable conversation: `packages/database/src/history.ts:43-60` owner- and
  kind-guarded upsert.
- R15-R16 session entries: `cli/src/utils/entry-writers.ts:99-120` returns failed
  records with durable ids; `cli/src/utils/db-storage.ts:113-127` drains and
  books boundaries by `compaction:<session>:<owner>:<n>`.
- R17 observer isolation: `packages/database/src/commit-journal.ts:66-95`.
- R18 canonical edges: `packages/knowledge-graph/src/edges-from-tokens.ts` delegates
  to `extract.ts` utilities.
- R19 enumeration certificate: `common/src/project-file-tree.ts:31-33,74-160`
  `onScanComplete` + `common/src/project-gitignore.ts:94,112` unreadable-ignore
  reporting; `packages/knowledge-graph/src/update-scan.ts:118` rejects incomplete scans.
- R20 catalog generations: `cli/src/utils/openrouter-models/live-catalog.ts:60-125`
  generation-owned cache, slot and cleanup; `cli/src/utils/openrouter-models/gateway.ts`
  retains its existing build token.

Gate runs on the final bytes: root `bun run typecheck` exit 0; root
`bun run quality:report` PASS (1502 baselined files); `code-map` 13 pass;
`knowledge-graph` 43 pass; `sdk` snapshot 8 pass; `agent-runtime` 13 pass;
`connectors` 13 pass; `desktop` 22 pass; `database` 53 pass; `cli` 18 pass —
zero failures across every leg. Log: `/tmp/fid006-final-typecheck.log`.

R20 credential invalidation: `cli/src/utils/openrouter-models/gateway.ts:238-275`
adds `invalidateGatewayCatalog()` — it supersedes any in-flight build, clears the
merge cache, the in-flight slot, the model-request-limit mirror and the on-disk
warm-start snapshot, then drops every per-provider fetcher cache through the
extracted `resetProviderCatalogCaches()` (one list, two callers). It carries no
credential value, name or digest. Callers (Law 4): `provider-key-store.ts:197`
(`saveProviderApiKey`) and `:247` (`saveProviderApiKeyExtra`), reached in
production from `route-provider-wizard.ts:188,197` and
`route-masked-key-setup.ts:101`; greps for `invalidateGatewayCatalog` and
`saveProviderApiKey(` return those call sites.

A first implementation cleared only the merge cache, and the end-to-end test
caught why that is insufficient: the refresh rebuilt from the still-warm
per-provider caches and issued zero new requests. The per-provider reset is the
load-bearing half.

End-to-end pin: `cli/src/utils/__tests__/
openrouter-models-gateway-cache.test.ts` populates the catalog, calls the real
`saveProviderApiKey('openrouter', 'rotated-key')`, asserts the cache is empty, and
asserts the next refresh issues new requests. The quality ceiling required
extracting `activateProviderRouting` to `cli/src/utils/
provider-routing-activation.ts`.

No push or release exists for this FID.

### Code Verification Evidence

Referenced source modules and existing suites were read and exist. Callers were
traced through project indexing, graph tools/injection, stream factories, connector
handlers, SDK run assembly, desktop client, and CLI save lifecycle. The specific
repaired wiring cannot be verified until the approved implementation exists.

### Loop 2 — Full document review, audit, and self-correction

- **RED:** retained R01-R14, strengthened edge-clear and failed-load evidence, and
  recorded all sibling findings R15-R20. R10 includes both recovery iterators.
- **GREEN:** exact ownership/failure contracts, source seams, existing test paths,
  acceptance cases, work bounds, and measurement rules specified for every finding.
- **AUDIT Method 1:** full configured typecheck, root test chain, ESLint, Markdown
  lint, and scope probes passed. Logs: `/tmp/savant-fid006-typecheck.log`,
  `/tmp/savant-fid006-root-tests.log`, `/tmp/savant-fid006-eslint.log`,
  `/tmp/savant-fid006-md.log`. Preserve exit markers, not just last output lines.
- **AUDIT Method 2:** source re-read against the matrix and allowlisted gate
  resolution: 29 declarations, zero parse/path errors. All future helper callers
  are existing named entry points; no new runtime helper is claimed to exist.
- **SELF-CORRECT:** initial `fid:verify` exited 1 because a prose line appeared
  inside the declaration-only section. Removed that line; parser/resolver now
  reports `{"gates":29,"errors":[]}`. This was a document error, not a test failure.
- **ADVERSARIAL (manual single-agent, not independent-agent certification):**
  confirmed R15 at `db-storage.ts:105-106` plus writer's caught failures;
  confirmed R16's all-label count at `db-storage.ts:117`; confirmed R17 observer
  escape after SQL at `commit-journal.ts:67-77`; confirmed R18 empty-stack pop and
  root-directory drift at `edges-from-tokens.ts:56-64,98-102`; confirmed R19 absent
  completeness/deletion at `update-scan.ts:177-198` and tree caught errors/caps.
  R20 gateway reset claim adjusted: existing `gatewayBuildToken` already protects
  publication and finally; generic live-fetcher lacks it, warm-start sharing still
  begins too late. Missing production recovery timeout refuted by
  `prompt-agent-stream.ts:233-237`; preserved existing signal instead.
- **Severity challenge:** no critical exploit, production data loss or measured
  production latency established. Root escape is incorrect graph resolution,
  not filesystem egress. Static defects do not imply every favorable fixture fails.
- **CHANGE DELTA:** substantial contract completion; no source implementation edits.

### Loop 3 — Final certification conditions

The document's full findings coverage and GREEN contracts have been audited:
20 distinct RED findings, none missing, every finding mapped to a repair contract
and an existing declared test target. The corrected 29-gate executor run passed
all gates, including quality, exit 0. The expanded final 31-gate run also passed
all declarations, exit 0 (`/tmp/savant-fid006-final-gates.log`). This is
baseline document certification, not repair certification or a closure receipt.

A final manual challenge found no additional actionable document design changes
within the reviewed evidence. Status is **converged**, meaning the document loop
is complete, not implementation-approved, repaired, verified, or closed. The active
queue and SCOPE register retain every proposed implementation item under the
operator approval hold. R14 live UI mutation, real provider/TUI/desktop behavior,
and performance improvements remain NEEDS-REVIEW at implementation audit, never
converted into passes by baseline tests. Release build/artifact generation was not
run for this documentation-only change; no release-build pass is claimed.

## Resolution

All twenty findings are implemented and verified at their converged seams.

Perfection Loop: RED → GREEN → AUDIT → manual ADVERSARIAL → SELF-CORRECT →
COMPLETE (document) → **IMPLEMENT → AUDIT (the code)**. The implementation audit
re-ran every declared gate on the final bytes: `bun run fid:verify` reports
**36/36 PASS, exit 0** with the receipt stamped (`/tmp/fid006-verify4.log`), and
root `bun run quality:report` passes at the 300-line ceiling. Focused suite totals
with zero failures: knowledge-graph 43, code-map 13, sdk 8, agent-runtime 13,
connectors 13, desktop 22, database 53, cli 60.

Checks that failed during implementation and were fixed at their cause, not
worked around: (1) `changed-only.test.ts` exceeded 300 lines — the R18 resolver
cases moved to `edges-from-tokens.test.ts`; (2) `refresh-safety.test.ts` failed
only when run as a repo-root gate — SQLite deletes the WAL/SHM file between
`readdir` and `unlink`, so cleanup now treats `ENOENT` as the desired end state
while `EBUSY` still retries and every other error still propagates; (3)
`provider-key-store.ts` exceeded the ceiling — `activateProviderRouting` was
extracted to its own module; (4) the first R20 invalidation cleared only the merge
cache, which the end-to-end test proved insufficient.

Limits retained honestly: this is a deep critical-path review, not a line-by-line
certification of all 5,891 indexed files. No live provider call, production-data
write, real desktop/TUI smoke, release execution or comprehensive security audit
was performed, and no speedup is claimed — the traversal and admission changes are
verified for correctness and bounded work, with the dense-graph fixtures
demonstrating a mechanism rather than production latency.

Archive: closed at the local commit recorded below.

## Lessons Learned

Test actual work and ownership boundaries, not only output shapes. A passing
favorable-order fixture is silent about arbitrary id order, non-cwd projects,
late callbacks, failure cleanup, and resource caps applied after execution.
