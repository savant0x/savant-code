<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Sign-off Request — FID-2026-0815-004..009 (Harness Speed Remediation)

**Date:** 2026-08-15
**Scope:** Implementation audit of the six harness-speed remediation children `004`–`009` (findings F-03…F-12) under master `FID-2026-0815-002`. The planning sign-off already returned **PASS** (`dev/nova/outbox/2026-08-15-fid-2026-0815-002-004-009-planning-audit-verdict.md`); the operator approved implementation, and all six children are now implemented, verified, closed, and archived in `dev/fids/archive/`. Two sibling children (`001` prompt-format, `003` trace-writer) were already closed/archived earlier and are **not** reopened by this request.
**Status:** REQUESTED
**Priority:** High (operator-directed exhaustive harness-speed remediation; all 12 findings F-01…F-12 in scope).

## Request

Please independently audit the FID-2026-0815-004..009 **implementation** at source and return one of:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation audit only**. It does **not** authorize closure, commit, push, release, publication, or deployment. Operator closure remains a separate decision after your PASS.

Governing protocol: `dev/echo-v0.1.2-single-agent.md` (single-agent ECHO, `strict_mode: true`). Approved-scope audit trail: `SCOPE.md`.

## What changed (per child)

### Child 004 — per-step history copy reduction (F-03)

- `expireMessages` (`packages/agent-runtime/src/util/messages/history.ts`) gained a no-allocation fast-path: scan once, return the input array unchanged when nothing expires.
- `step.ts` replaced the `buildArray(...expireMessages(history, 'agentStep'), stepPrompt && userMessage(...))` construction with a conditional append. Net 4 allocations/step → 2 (1 when `stepPrompt` absent). `buildArray`'s falsey-filter only ever removed the absent-`stepPrompt` case, so the conditional append covers it exactly.

### Child 005 — per-write overhead (F-04, F-05)

- `captureSnapshot` (`packages/agent-runtime/src/tools/handlers/tool/checkpoint-store.ts`) is async (`fs.promises.readFile`) with an in-flight per-path promise map preserving first-wins dedupe; awaited in `runWriteGate` (`packages/agent-runtime/src/tools/tool-executor/write-gate.ts`).
- `closeTurn`/`prune` converted to `fs.promises` (`mkdir`/`writeFile`/`readdir`/`rm`); `finalize()` in `cli/src/hooks/helpers/send-message-lifecycle.ts` awaits `closeTurn`.
- Law-1 gate (`packages/agent-runtime/src/tools/tool-executor/native.ts`) now uses awaited `fs.promises.access` (ENOENT → new, else "not new"), keeping the try/catch degradation contract.

### Child 006 — compactor micro-optimizations (F-06, F-07, F-08)

- `reactiveCompact` (`packages/agent-runtime/src/context-compactor.ts`) rewritten as a single forward walk with a preserved-index Set and Set-based last-20% exclusion (O(n²) → O(n)), preserving output ordering and the `tokensSaved`/`messagesRemoved` arithmetic.
- `microCompact` uses a `keepRecentSet` (Set) for the keep-recent test (O(n·k) → O(n)).
- `getThresholds()` returns the immutable `this.thresholds` reference instead of a fresh spread.
- Also corrected the stale header comment (`context-compactor.ts:11-13`) that mis-described the file as a re-export shim (the cause of Nova's retracted "citation gap" in the planning verdict).

### Child 007 — CLI startup (F-09, F-10)

- `fetchGatewayModels` (`cli/src/utils/openrouter-models/gateway.ts`) gained a disk cache (`gateway-catalog.json` under `getConfigDir()`, same `CATALOG_TTL_MS`) — synchronous fresh-cache load on cold in-memory cache (instant picker, no network RTT) with write-through after fetch.
- `discoverSkillsFromDirectory`/`loadSkillFromFile` (`sdk/src/skills/load-skills.ts`) and `getAllAgentFiles` (`sdk/src/agents/load-agents.ts`) converted to `fs.promises` async walks.
- **API surface change (presented, not silently dropped):** `loadSkillsSync` was **removed** — Law-4 grep confirmed zero callers (only the async `loadSkills` wrapper called it, plus the `sdk/src/index.ts:88` re-export). Re-export and `docs/sdk-overview.md` updated. Restore on request.

### Child 008 — UI re-render store no-op guards (F-11)

- `updateContextTokens` / `updateContextTokensMax` / `updateSessionCost` (`cli/src/state/chat-store/sidebar-actions.ts`) now `Object.is`-no-op on an equal value.
- `setCompactionStatus` no-ops on a **shallow field compare** (`phase`/`percentUsed`/`tokensSaved`), not reference equality — the runtime rebuilds a fresh object per heartbeat (proven by the existing `repeated status refreshes` test). The `compacting→pruned/warning` transition recording is preserved (only runs on a real change).
- New regression tests (`cli/src/state/__tests__/chat-store-noop-guards.test.ts`) assert a no-op write does not notify subscribers. The interactive profiling pass (render counts / `bun --cpu-prof`) remains a tmux follow-up per repo conventions.

### Child 009 — code-map / knowledge-graph indexing (F-12)

- `getFileTokenScores` (`packages/code-map/src/parse.ts`) fans the per-file pipeline out over a bounded pool (concurrency 6), then applies `MAX_PARSE_FILES` / `MAX_TOTAL_PARSE_BYTES` in an ordered walk reproducing the prior sequential skip/break semantics (byte-identical scores).
- `updateKnowledgeGraph` (`packages/knowledge-graph/src/update.ts`) parallelizes source reads + changed-file parses over the same pool; the scan-loop hash is stored in `hashByPath` and reused in the upsert loop (no double hash). `sources`/`hashByPath`/`parsedFiles` are lookup-only Maps.
- `resolveSymbolDefiningFile` (`packages/knowledge-graph/src/extract.ts`) is now an O(1) `[0]` pick over pre-sorted candidate lists (sorted once when `dbSymbolIndex` is built).
- Determinism regression (`update.test.ts`): two full rebuilds → identical `IndexStats` + semantic node/edge rows (joined on `files.path`; `files.id` is AUTOINCREMENT so raw rowids legitimately shift).

## Verification evidence (reproduce independently)

- **Typecheck ×4 + code-map + knowledge-graph — clean** (`tsc --noEmit` in sdk/common/agent-runtime/cli + code-map + knowledge-graph).
- **Full suites:** agent-runtime 964 pass / 0 fail · SDK 475 pass / 1 skip / 0 fail · CLI 3074 pass / 18 skip / 0 fail · code-map 51/0 · knowledge-graph 19/0.
- **Focused:** checkpoint-store 18/0, rewind 10/0, send-message 45/0, compactor 17/0, load-skills 7/0, openrouter-models 22/0, registry-gating 5/0, chat-store (no-op guards) 11/0.
- ESLint `--max-warnings 0` on every changed file.

## Hard questions Nova must verify at source

### Child 004

1. Confirm `history.ts` `expireMessages` returns the input array unchanged only when nothing would expire (scan, no allocation) and that no caller mutates the returned array in place (callers `loop.ts:209,249`, `step.ts:80,120,282` reassign `messageHistory` or spread-copy).
2. Confirm the `step.ts` conditional append preserves the exact `STEP_PROMPT` message shape (`tags`, `timeToLive: 'agentStep'`, `keepDuringTruncation`) and the absent-`stepPrompt` case produces the same array as before.

### Child 005

1. Confirm `captureSnapshot` is async and awaited in `runWriteGate`, and the in-flight per-path promise map coalesces concurrent same-path captures onto one read (first completion wins — CKR-1/CKR-2 from FID-2026-0803-004 preserved). Confirm the new regression test asserts one `readFile` for concurrent same-path captures.
2. Confirm `closeTurn`'s only production caller is `finalize()` and it now awaits; the SDK re-export surface is unchanged except the `Promise<...>` return type.
3. Confirm the Law-1 gate's `fs.promises.access` keeps the try/catch → "not new" degradation contract (ENOENT → new file).

### Child 006

1. Confirm `reactiveCompact` is now a single forward walk (preserved-index Set) preserving output ordering (`firstMessage`, 10% middle, re-added preserved, last 20%) and the `tokensSaved`/`messagesRemoved` arithmetic asserted by `context-compactor.test.ts` + `context-compactor-micro.test.ts`.
2. Confirm `getThresholds()` returns the internal reference and no consumer mutates it (`context-tokens.ts:146`, `loop-context.ts:349`, tests are read-only).
3. Confirm the header comment at `context-compactor.ts:11-13` was corrected (no longer describes the file as a re-export shim).

### Child 007

1. Confirm the disk cache reuses `CATALOG_TTL_MS` (single source of truth) and that a stale cache is indistinguishable from a cold start (same background refresh).
2. Confirm `loadSkillsSync` has zero remaining callers after removal (no production sync caller; re-export at `sdk/src/index.ts` and `docs/sdk-overview.md` updated).
3. Confirm the async discovery walks return the same skill/agent sets (same catalogs) — behavior-neutral beyond non-blocking I/O.

### Child 008

1. Confirm the four guarded actions are the only writers of `contextTokensUsed`/`contextTokensMax`/`sessionCost`/`compactionStatus`, and the `Object.is` guard only drops identical writes (a real change passes the inequality check).
2. Confirm `setCompactionStatus` uses a shallow field compare (not reference equality) and that the `compacting→pruned/warning` transition recording still runs on a real change.
3. Confirm `chat-store-noop-guards.test.ts` asserts a no-op write does not notify subscribers.

### Child 009

1. Confirm the bounded pool (concurrency 6) collects into path-keyed lookup-only Maps and that downstream assembly iterates the pre-existing ordered structures, so output is byte-identical to the sequential run.
2. Confirm `MAX_PARSE_FILES` / `MAX_TOTAL_PARSE_BYTES` are applied to the deterministic pre-selected candidate set (identical cap boundary), and the ordered cap walk in `parse.ts` reproduces the prior sequential skip/break semantics.
3. Confirm the scan-loop hash is reused in the upsert loop (no double hash) and `resolveSymbolDefiningFile` is an O(1) pick over pre-sorted lists (same resolved result).
4. Confirm the determinism regression runs two full rebuilds and asserts identical `IndexStats` + semantic node/edge rows (not raw rowids).

## Authorization boundary

Implementation review of FID-2026-0815-004..009 only. No closure, commit, push, release, publication, or deployment authority. Operator closure remains a separate decision after your PASS. The two already-closed children (001, 003) are not reopened, and the broader uncommitted 0.0.24 worktree changes predating this session are out of scope for this review.

## Expected response

1. Overall verdict.
2. Verdict per child (004–009).
3. Verdict per hard question with `path:line` + quoted code/command output.
4. Any missing citation, behavior divergence, or unverified claim.
5. Explicit confirmation this is implementation review only and does not authorize production changes or release activity.
