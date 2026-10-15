<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Planning Sign-off Request — FID-2026-0815-002 and Children 004–009 (Harness Speed Remediation)

**Date:** 2026-08-15
**Scope:** Planning review of the harness-speed remediation program (master `FID-2026-0815-002`) and its six converged-but-unimplemented children `004`–`009`. Each child ran the Perfection Loop (RED → GREEN → AUDIT → SELF-CORRECT) with grep-verified Law-4 evidence and **no code written** (Law 2 — Present Before Act). Two sibling children (`001` prompt-format, `003` trace-writer) are already implemented and closed/archived; they are **not** reopened by this request.
**Status:** REQUESTED
**Priority:** High (operator-directed exhaustive harness-speed remediation; all 12 findings F-01…F-12 in scope — "nothing is out of scope unless the operator says so").

## Request

Please independently audit the **planning** of the records below and return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request**. A PASS verifies each plan's ground-truth claims against the repo (the cited `file:line` sources exist and describe what the FID says they describe). It does **not** authorize implementation, closure, commit, push, release, publication, or deployment. Implementation (and a separate implementation-audit request per child) follows operator approval.

Governing protocol: `dev/echo-v0.1.2-single-agent.md` (single-agent ECHO, `strict_mode: true`). Approved-scope audit trail: `SCOPE.md`.

## Records under review

| Record | Findings | Current status | Fix surface |
|---|---|---|---|
| `dev/fids/FID-2026-0815-002-harness-speed-remediation-master-plan.md` | catalog F-01…F-12 | `analyzed` (planning-converged) | coordination master — no code |
| `dev/fids/FID-2026-0815-004-per-step-history-copy-reduction.md` | F-03 | `analyzed` | `packages/agent-runtime/src/run-agent-step/step.ts` + `util/messages/history.ts` |
| `dev/fids/FID-2026-0815-005-per-write-overhead-checkpoint-and-law1-gate.md` | F-04, F-05 | `analyzed` | `checkpoint-store.ts`, `write-gate.ts`, `native.ts` (async I/O on write hot path) |
| `dev/fids/FID-2026-0815-006-context-compactor-micro-optimizations.md` | F-06, F-07, F-08 | `analyzed` | `packages/agent-runtime/src/context-compactor.ts` |
| `dev/fids/FID-2026-0815-007-cli-startup-model-catalog-and-registry-io.md` | F-09, F-10 | `analyzed` | `cli/src/utils/openrouter-models/*`, `sdk/src/skills`, `sdk/src/agents` |
| `dev/fids/FID-2026-0815-008-ui-re-render-store-noop-guards-and-profiling.md` | F-11 | `analyzed` | `cli/src/state/chat-store/sidebar-actions.ts` + monitors |
| `dev/fids/FID-2026-0815-009-code-map-knowledge-graph-indexing.md` | F-12 | `analyzed` | `packages/code-map/src/parse.ts`, `packages/knowledge-graph/src/{update,extract}.ts` |

Already closed (not under review): `FID-2026-0815-001` (F-01), `FID-2026-0815-003` (F-02) — both archived in `dev/fids/archive/`.

## What each record claims (verify each at source)

### Master 002

- All 12 findings map to a child FID; none dropped or reclassified out of scope (operator directive honored).
- The master re-ran its AUDIT after the children converged and now awaits operator approval to implement children 004–009, then a final re-audit.

### Child 004 — per-step history copy reduction (F-03)

| ID | Claim | Cited source |
|---|---|---|
| C-01 | Step-start construction `buildArray(...expireMessages(history, 'agentStep'), stepPrompt && userMessage(...))` performs three full-history allocations (filter → spread-collect → falsey-filter) per step. | `packages/agent-runtime/src/run-agent-step/step.ts:117-134` |
| C-02 | `expireMessages` always allocates a new array via `.filter()`, even when nothing expires. | `packages/agent-runtime/src/util/messages/history.ts:14-26` |
| C-03 | Step-end `expireMessages(history, 'agentStep')` adds a fourth full pass to remove the transient step prompt. | `step.ts:280-283` |

Plan: fast-path `expireMessages` (return input unchanged when nothing expires) + replace `buildArray` with a conditional append. Net 4 allocations/step → 2 (1 when `stepPrompt` absent). The structural mutable-array alternative is explicitly **raised separately, not absorbed**.

### Child 005 — per-write overhead (F-04, F-05)

| ID | Claim | Cited source |
|---|---|---|
| C-01 | `captureSnapshot` reads the whole pre-edit file via `fs.readFileSync` before each distinct write, called synchronously from the write gate. | `packages/agent-runtime/src/tools/handlers/tool/checkpoint-store.ts:154`; call site `packages/agent-runtime/src/tools/tool-executor/write-gate.ts:139-144` |
| C-02 | `closeTurn` persists with `mkdirSync`/`writeFileSync` + a `prune()` doing `readdirSync`/`readFileSync`/`rmSync`. | `checkpoint-store.ts:215-222`, `:235-255` |
| C-03 | Law-1 gate does `fs.existsSync(resolvedWritePath)` per write to detect brand-new files. | `packages/agent-runtime/src/tools/tool-executor/native.ts:400-401` |

Plan: async `captureSnapshot` (awaited in `runWriteGate`, already async) with an in-flight per-path promise map to preserve first-wins dedupe under concurrency; async `closeTurn` persistence; replace `existsSync` with awaited `access`/`stat`. The FID's AUDIT already corrected two wrong `file:line` citations via SELF-CORRECT (call site is `write-gate.ts:139-144`, not `:165-171`; `closeTurn` persistence is `:215-222`, not `:217-228`).

### Child 006 — compactor micro-optimizations (F-06, F-07, F-08)

| ID | Claim | Cited source |
|---|---|---|
| C-01 | `reactiveCompact` does three `filter` passes plus `indexOf`/`includes` membership scans (O(n²)). | `packages/agent-runtime/src/context-compactor.ts` (reactiveCompact) |
| C-02 | `microCompact` computes `keepRecent.includes(idx)` inside a `filter` (O(n·k)). | `context-compactor.ts` (microCompact) |
| C-03 | `getThresholds()` returns a fresh `{...this.thresholds}` spread on every call (once/step); the field is assigned once and never mutated. | `context-compactor.ts` (getThresholds); consumers `run-agent-step/context-tokens.ts`, `loop-context.ts` read-only |

Plan: single-pass `reactiveCompact` with `Set` membership; `keepRecentSet = new Set(keepRecent)`; return `this.thresholds` directly (or freeze if any consumer mutates — resolved by grep before implementation).

### Child 007 — CLI startup (F-09, F-10)

| ID | Claim | Cited source |
|---|---|---|
| C-01 | `fetchGatewayModels` fetches live OpenRouter + NVIDIA NIM + Nous catalogs at boot, cached only in-process. | `cli/src/utils/openrouter-models/gateway.ts:66-118`; boot call `cli/src/index.tsx` |
| C-02 | Skill discovery walks each dir with `readdirSync` + per-entry `statSync` + `readFileSync`. | `sdk/src/skills/load-skills.ts` (discoverSkillsFromDirectory) |
| C-03 | Agent discovery recursively walks `.agents` with `readdirSync(..., { withFileTypes: true })`. | `sdk/src/agents/load-agents.ts` (getAllAgentFiles) |

Plan: disk cache for the combined gateway catalog (same `CATALOG_TTL_MS`, best-effort write); convert both discovery walks to `fs.promises`. FID's Law-4 grep already found `loadSkillsSync` has no production sync caller (re-exported at `sdk/src/index.ts:88`, called only by async `loadSkills`); its disposition is presented, not silently dropped.

### Child 008 — UI re-render (F-11)

| ID | Claim | Cited source |
|---|---|---|
| C-01 | The 2s heartbeat writes `updateContextTokens` + `setCompactionStatus` unconditionally every tick. | `cli/src/hooks/helpers/send-message-monitors.ts:72-92` |
| C-02 | `onStateSnapshot` writes `updateContextTokens` + `updateSessionCost` every ~5s with no guard. | `cli/src/hooks/helpers/send-message-lifecycle.ts:158-170` |
| C-03 | The store actions always `set` through immer — no no-op on an equal value. | `cli/src/state/chat-store/sidebar-actions.ts:38-56,112-115` |
| C-04 | Remaining hot spots need a profiling pass to quantify before further change. | `cli/src/components/right-sidebar.tsx`, `savant-ui/echo/*` |

Plan: `Object.is` equality guards in the four actions (root fix); optional cheap call-site guard; a profiling pass (render counts / `bun --cpu-prof`) with findings recorded and follow-up FIDs for anything material.

### Child 009 — code-map / knowledge-graph indexing (F-12)

| ID | Claim | Cited source |
|---|---|---|
| C-01 | `getFileTokenScores` iterates files sequentially, awaiting `getLanguageConfig` + tree-sitter parse per file. | `packages/code-map/src/parse.ts` |
| C-02 | `updateKnowledgeGraph` reads sources and re-parses changed files one-at-a-time in a single loop. | `packages/knowledge-graph/src/update.ts` |
| C-03 | `resolveSymbolDefiningFile` sorts the candidate list on every call. | `packages/knowledge-graph/src/extract.ts` |
| C-04 | `updateKnowledgeGraph` hashes each file twice (scan loop + upsert loop). | `packages/knowledge-graph/src/update.ts` |

Plan: bounded-concurrency pool (4–8) for reads + parses with order-independent `Map` collection; pre-sort candidate lists once; reuse the scan-loop hash in the upsert loop. Determinism preserved by iterating existing ordered structures; `MAX_PARSE_FILES` / `MAX_TOTAL_PARSE_BYTES` caps applied to the deterministic pre-selected set.

## Hard questions Nova must verify at source

### Master 002

1. Confirm every finding F-01…F-12 maps to exactly one child FID, and no finding was reclassified out of scope.
2. Confirm the master adds no code and authorizes no implementation on its own (Law 2).

### Child 004

1. Confirm `step.ts:117-134` is the `buildArray(...expireMessages(...), stepPrompt && ...)` construction the FID describes (three allocations).
2. Confirm `history.ts:14-26` is the unconditional `.filter()` allocation.
3. Confirm the conditional-append plan does not change mutation behavior: no caller mutates the `expireMessages` return in place (callers reassign `messageHistory` and append via spread copies).
4. Confirm the structural mutable-array alternative is **raised, not silently absorbed**.

### Child 005

1. Confirm `captureSnapshot` is a synchronous `readFileSync` at `checkpoint-store.ts:154` and its production caller is `write-gate.ts:139-144` (the FID's corrected citation — the file is 148 lines; `:165-171` would be invalid).
2. Confirm `runWriteGate` is already `async` and awaited at `native.ts:195`, so an awaited async `captureSnapshot` is ordered before dispatch.
3. Confirm the in-flight promise map preserves the "first capture wins" invariant (CKR-1/CKR-2 in FID-2026-0803-004) — concurrent same-path captures coalesce onto one read.
4. Confirm the only public-surface change is `closeTurn`'s return type becoming `Promise<...>` (call sites updated), with no new store/authority.

### Child 006

1. Confirm the three `filter` passes + `indexOf`/`includes` scans exist in `reactiveCompact`, and `microCompact`'s `keepRecent.includes` is inside a `filter`.
2. Confirm `getThresholds()` returns a fresh spread and `this.thresholds` is never mutated after construction.
3. Confirm the single-pass rewrite preserves the exact output ordering (`firstMessage`, 10% middle, re-added preserved, last 20%) and the `tokensSaved`/`messagesRemoved` arithmetic asserted by `context-compactor.test.ts` + `context-compactor-micro.test.ts`.
4. Confirm the aliasing decision (return `this.thresholds` vs freeze) is resolved by grepping consumers for mutation **before** implementation — not assumed.

### Child 007

1. Confirm `gateway.ts:66-118` is `fetchGatewayModels` with in-memory-only caching, and the boot call is at `cli/src/index.tsx`.
2. Confirm the disk cache reuses `CATALOG_TTL_MS` (single source of truth) and that a stale cache is indistinguishable from a cold start (same background refresh).
3. Confirm `loadSkillsSync` has no production sync caller (re-exported at `sdk/src/index.ts:88`; only async `loadSkills` is called at `sdk/src/run-state/initial-state.ts:138`), and its disposition is presented, not silently dropped.
4. Confirm parallel agent-import is a **stretch goal**, flagged not silently dropped; serialization is the conservative default.

### Child 008

1. Confirm the four actions (`updateContextTokens`, `updateContextTokensMax`, `updateSessionCost`, `setCompactionStatus`) are the only writers of those state fields.
2. Confirm the `Object.is` guard is behavior-preserving (a real change passes the inequality check; only identical writes are dropped).
3. Confirm the `setCompactionStatus` reference-equality choice is resolved against the runtime's actual emit behavior (new object per transition vs rebuilt-equal-object per heartbeat) — with a shallow field-compare fallback, decided with a regression test.
4. Confirm the profiling pass is read-only and its findings are recorded in the FID's AUDIT (no code change authorized by profiling alone).

### Child 009

1. Confirm `getFileTokenScores` (`parse.ts`) and `updateKnowledgeGraph` (`update.ts`) are sequential loops, and `resolveSymbolDefiningFile` (`extract.ts`) sorts on every call.
2. Confirm the double-hash exists (scan loop + upsert loop) in `update.ts`.
3. Confirm determinism is preserved: parallel fan-out collects into path-keyed `Map`s and downstream assembly iterates the pre-existing ordered structures (determinism invariant FID-2026-0806-002).
4. Confirm `MAX_PARSE_FILES` / `MAX_TOTAL_PARSE_BYTES` are applied to the deterministic pre-selected set **before** fan-out (identical cap boundary).

## Adversarial checks already run in the children's Perfection Loops

- 004: aliasing safety (no caller mutates the returned array); `buildArray`'s falsey-filter only ever removed the absent `stepPrompt` case.
- 005: concurrency cannot corrupt dedupe (in-flight map coalesces same-path reads); async conversion does not change *when* the checkpoint reads the file (still before dispatch).
- 006: aliasing `this.thresholds` risk resolved by grep-before-implementation (freeze if any mutation); single-pass rewrite preserves membership, only the algorithm changes.
- 007: staleness bounded identically to today (same TTL); `loadSkillsSync` disposition surfaced rather than dropped.
- 008: a no-op guard cannot hide a real update; reference-equality fallback to shallow field compare decided with a regression test; the 2s poll is kept (removing it would freeze the token meter).
- 009: parallelism cannot change the index output (order-independent collection + ordered assembly); Louvain clustering runs after assembly on the unchanged edge set.

## Authorization boundary

This request authorizes no implementation, closure, commit, push, release, publication, or deployment. A PASS marks each plan converged and code-grounded; operator approval is then required before any code is written, and a separate implementation-audit request must precede each child's closure. The two already-closed children (001, 003) are not reopened, and the broader uncommitted 0.0.24 worktree changes predating this session are out of scope for this review.

## Expected response

1. Overall verdict.
2. Verdict per master and child record.
3. Verdict per hard question with `path:line` + quoted code/command output.
4. Any missing citation, scope contradiction, or unverified claim.
5. Explicit confirmation this is planning review only and does not authorize production changes or release activity.
