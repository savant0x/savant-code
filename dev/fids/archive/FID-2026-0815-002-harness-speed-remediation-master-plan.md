<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Harness speed remediation — master plan

**Filename:** `FID-2026-0815-002-harness-speed-remediation-master-plan.md`
**ID:** FID-2026-0815-002
**Severity:** high
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Pending — the master adds no code; each child FID records its own compliance.

---

## Summary

Operator-directed, exhaustive remediation of everything that controls harness speed. The audit traced the full request path — CLI startup, per-step agent loop, per-tool-call overhead, context compaction, streaming, UI snapshot, and one-time indexing. Every finding is in scope. This master FID catalogs all findings and organizes them into child FIDs; each child runs its own Perfection Loop and converges independently, then this master is re-audited against the converged children before the Nova signoff request is drafted.

## Operator directive

> NOTHING is ever "out of scope" unless the operator explicitly says so. Default = include everything.

This supersedes the `reactiveCompact` / `getThresholds` "out of scope" note recorded in
FID-2026-0815-001 — those items are now in scope below (child FID 4).

## RED — Issue catalog (complete, nothing out of scope)

| ID | Sev | Surface | Finding | Evidence | Child FID |
|---|---|---|---|---|---|
| F-01 | low | per-step loop | `formatPrompt` eager placeholder computation (3 file-tree truncations + git/system-info/knowledge every step) | `strings.ts:204` (pre-fix) | CLOSED — FID-2026-0815-001 |
| F-02 | high | per-step loop | Trace writer `recordStep` runs 2×/step with an O(n) role-sequence scan + synchronous `appendFileSync`; `isTraceEnabled()` is `true` whenever `IS_DEV`, so dev runs always pay it | `cli/src/utils/trace-writer.ts:158-217`; `step.ts:185` + `:350` | FID-2026-0815-003 |
| F-03 | med | per-step loop | Redundant full-history array copies per step (`expireMessages` ×2, `buildArray`, spread appends for steering/ECHO-compliance) | `step.ts:128-146`; `loop-iteration.ts` (multiple `[...messageHistory, ...]`) | FID-2026-0815-004 |
| F-04 | med | per-tool-call | Checkpoint capture does a synchronous `readFileSync` of the whole file before each distinct write | `checkpoint-store.ts:154` | FID-2026-0815-005 |
| F-05 | low | per-tool-call | `fs.existsSync` per write for the Law-1 gate | `tool-executor/native.ts:401` | FID-2026-0815-005 |
| F-06 | med | compaction | `reactiveCompact` O(n²) `indexOf`/`includes` scans over the history | `context-compactor.ts` (reactiveCompact) | FID-2026-0815-006 |
| F-07 | low | compaction | `getThresholds()` returns a fresh `{...spread}` on every call (once/step) | `context-compactor.ts` (getThresholds) | FID-2026-0815-006 |
| F-08 | low | compaction | `microCompact` `keepRecent.includes` inside a `filter` (O(n·k)) | `context-compactor.ts` (microCompact) | FID-2026-0815-006 |
| F-09 | med | CLI startup | `fetchGatewayModels` fetches the full OpenRouter catalog over the network at boot (RTT + parse on startup) | `cli/src/index.tsx`; `cli/src/utils/openrouter-models.ts` | FID-2026-0815-007 |
| F-10 | low | CLI startup | Sync `readdirSync`/`readFileSync`/`statSync` during skill + agent registry init | `sdk/src/skills/load-skills.ts:105,129,139`; `sdk/src/agents/load-agents.ts:131` | FID-2026-0815-007 |
| F-11 | med | UI | React re-render frequency (sidebar/panels) — needs profiling before changes | `cli/src/components/`, `cli/src/state/` | FID-2026-0815-008 |
| F-12 | med | indexing | code-map / knowledge-graph indexing & query cost — needs profiling before changes | `packages/code-map/`, `packages/knowledge-graph/` | FID-2026-0815-009 |

**Verified-OK (no action):** provenance ledger already async (`provenance/ledger.ts:82-90`); token-counter already LRU + WeakMap memoized (`token-counter.ts`); `createCacheDebugSetup` gated behind `CACHE_DEBUG_FULL_LOGGING` (`run-agent-step/cache-debug.ts`); snapshot emitter reference-based + scalar reads with coalesced persist (`send-message-lifecycle.ts:158-188`).

## GREEN — Child FID breakdown & ordering

1. `FID-2026-0815-003` — Trace writer: async append + O(1) role tracking (F-02).
2. `FID-2026-0815-004` — Per-step history copy reduction (F-03).
3. `FID-2026-0815-005` — Per-write overhead: checkpoint capture + write-path gate (F-04, F-05).
4. `FID-2026-0815-006` — Context compactor micro-optimizations (F-06, F-07, F-08).
5. `FID-2026-0815-007` — CLI startup: model catalog caching + registry I/O (F-09, F-10).
6. `FID-2026-0815-008` — UI re-render profiling + optimization (F-11).
7. `FID-2026-0815-009` — code-map / knowledge-graph indexing (F-12).

Each child runs RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE → IMPLEMENT independently, with typecheck/tests/lint and Law-4 call-graph evidence. After all children converge, this master re-runs its loop (AUDIT against the converged children) and the Nova signoff request is drafted.

**Child status at master re-audit (2026-08-15):**

| Child FID | Findings | Planning-loop status |
|---|---|---|
| FID-2026-0815-001 | F-01 | CLOSED (archived) — implemented + verified |
| FID-2026-0815-003 | F-02 | CLOSED (archived) — implemented + verified |
| FID-2026-0815-004 | F-03 | Converged — pending operator approval to implement |
| FID-2026-0815-005 | F-04, F-05 | Converged — pending operator approval to implement |
| FID-2026-0815-006 | F-06, F-07, F-08 | Converged — pending operator approval to implement |
| FID-2026-0815-007 | F-09, F-10 | Converged — pending operator approval to implement |
| FID-2026-0815-008 | F-11 | Converged — pending operator approval to implement |
| FID-2026-0815-009 | F-12 | Converged — pending operator approval to implement |

## Perfection Loop

### Loop 1 — RED

Full catalog above. **Exit: all issues cataloged (nothing out of scope).**

### Loop 1 — GREEN

Child-FID plan above. **Exit: fixes documented as child FIDs.**

### Loop 1 — AUDIT (re-run after children converged)

- **Coverage:** all 12 findings (F-01…F-12) map to a child FID; none dropped,
  none reclassified out of scope (operator directive honored).
- **Child convergence:** every child FID (004–009) completed RED → GREEN → AUDIT
  with grep-verified Law-4 evidence and a converged fix; FID-005's AUDIT
  corrected two `file:line` citations via SELF-CORRECT (no plan change).
- **Implemented children:** FID-2026-0815-001 (prompt format) and
  FID-2026-0815-003 (trace writer) are closed/archived with typecheck + test
  + lint evidence in their own records.
- **AUDIT passes → COMPLETE (master converged; pending operator approval to
  implement children 004–009, then re-audit + Nova signoff).**

### Missed Questions

1. **Is any finding still unassigned?** No — F-01…F-12 are each mapped; verified
   by the table above.
2. **Does master convergence imply implementation?** No — Law 2: implementation
   of children 004–009 awaits operator approval.

## Resolution

Re-audited and closed 2026-08-15 after the operator approved implementation.
All six converged children (004–009) were implemented and verified in priority
order (004 → 005 → 006 → 007 → 008 → 009), each with typecheck + tests + ESLint
`--max-warnings 0` + Law-4 call-graph evidence in its own record. Together with
the already-closed 001 and 003, every finding F-01…F-12 is now implemented.

Final gate: typecheck ×4 (sdk/common/agent-runtime/cli) + code-map +
knowledge-graph clean; full suites — agent-runtime 964/0 · SDK 475 pass / 1 skip
/ 0 fail · CLI 3074 pass / 18 skip / 0 fail · code-map 51/0 · knowledge-graph
19/0. Planning sign-off (Nova) returned PASS; a Nova implementation sign-off
request is the remaining separate step (drafted post-implementation, per the
handoff). No commit, push, release, publication, or deployment is implied.
