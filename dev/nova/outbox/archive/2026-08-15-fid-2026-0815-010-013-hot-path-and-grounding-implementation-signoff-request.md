<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Sign-off Request — FID-2026-0815-010..013 (grounding + hot-path micro-optimizations)

**Date:** 2026-08-15
**Scope:** Four closed-and-archived follow-on FIDs from the harness-speed remediation line. 010 fixes a live grounding gap ("Happy Friday" on a Saturday); 011–013 remove per-step/per-write waste discovered in three successive follow-on scans. All four are small, behavior-preserving, and independently verified.
**Status:** REQUESTED
**Priority:** Low (perf/grounding; no functional regression observed).

## Request

Please independently audit the implementations of FID-2026-0815-010, -011, -012, and -013 at source and return one verdict **per FID**:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation audit only**. It does **not** authorize closure, commit, push, release, publication, or deployment. Operator closure remains a separate decision after your PASS.

## What changed (per FID)

### FID-2026-0815-010 — agent grounding: correct current date and time

- `common/src/util/dates.ts:22` adds `formatCurrentDateTime(date = new Date())` — a shared utility producing `"Saturday, August 15, 2026 at 2:34 PM EDT"` via a module-level `Intl.DateTimeFormat` singleton (`weekday`, date, `hour`, `minute`, `timeZoneName`).
- `packages/agent-runtime/src/templates/strings.ts:129` wires the `CURRENT_DATE` placeholder to `formatCurrentDateTime()` (the old local date-only `formatCurrentDate` was removed — Law-4 verified zero callers).
- `agents/savant/system-prompt.ts:56` label changed to `Current date and time:`; bundle regenerated (`bun run --cwd=cli prebuild:agents`, 13 variants).
- Per-step freshness: `strings.ts:252` wraps the step prompt in `<system_reminder>Current date and time: …</system_reminder>` so a long session never relies on the stale session-start value.

### FID-2026-0815-011 — harness hot-path micro-optimizations (E-01..E-04)

- **E-01** (system prompt tokenized once/step): `context-tokens.ts:72` computes `systemTokens = countTokens(system)`; `:255` returns it; threaded via `loop-iteration.ts:139` (destructure) and `:298` (forward); consumed at `step.ts:169` (`params.systemTokens ?? countTokens(system)`); `types.ts:62` adds the optional field.
- **E-02** (trace serialization off the hot path): `cli/src/utils/trace-writer.ts` defers the `JSON.stringify` loop into the async write chain; `writtenRoles` bookkeeping stays synchronous at enqueue.
- **E-03** (redundant sync `existsSync` gated): `packages/agent-runtime/src/echo/pre-write-gates.ts:74` gates the Law-1 `isNewFile`/`existsSync` probe behind `tier === 'all_15'`; hybrid (default) skips the sync disk probe.
- **E-04** (bounded read-pattern scan): `packages/agent-runtime/src/util/echo-compliance.ts:55` `MAX_READ_PATTERNS = 256`; `:208` enforces the FIFO bound; `recordPatternRead` normalizes once and dedupes; `hasRead` no longer re-lowercases per write.

### FID-2026-0815-012 — dev-mode logger sync I/O (G-01 + G-03; G-02 dropped)

- **G-01** (per-step debug payload trimmed): the end-step `logger.debug` in `packages/agent-runtime/src/run-agent-step/step.ts` (formerly `:365`) now logs only scalar summary fields; `fullResponse`, `toolCalls`, and `toolResults` are removed (captured by the trace writer via `messageHistory`, and by the persisted chat file).
- **G-02** (async dev append): **dropped by operator decision** — the synchronous `appendFileSync` real-time-logging tradeoff is retained.
- **G-03** (hoisted sensitive-keys): `cli/src/utils/logger/sanitize.ts:26` hoists `SENSITIVE_KEY_SUBSTRINGS` (lowercased array); `:32` uses it so `isSensitiveKey` no longer re-allocates/re-lowercases per key. Match semantics identical.

### FID-2026-0815-013 — eager `messagesWithStepPrompt` history copy

- `packages/agent-runtime/src/run-agent-step/context-tokens.ts:111` now builds `messagesWithStepPrompt` (the `buildArray(...messageHistory, userMessage(...))` recursive copy) **inside** the `else` (hosted `callTokenCountAPI`) branch; `:119` is its sole consumer. The default local-estimation path no longer builds and discards the full-history copy each step.

## Verification evidence (reproduce independently)

- Typecheck ×4 (sdk / common / agent-runtime / cli) + `agents` + code-map + knowledge-graph — clean (`tsc --noEmit`).
- Full suites: agent-runtime **966/0** · CLI **3074 pass / 18 skip / 0 fail** · SDK 475/0 · common 610/0 · code-map 51/0 · knowledge-graph 19/0.
- Focused suites: `logger-sanitize-secrets` 5/0 · `pre-write-gates`/`violation-handler` 16/0 · `echo-compliance` 37/0 · `dates.test.ts` 2/0 · `strings.test.ts` 11/0.
- ESLint `--max-warnings 0` on every changed file · Prettier · markdownlint on the FIDs.

## Hard questions Nova must verify at source

### FID-010 (grounding)

1. **Utility is the single source of truth (Law 13).** Confirm `formatCurrentDateTime` (`dates.ts:22`) is the only date formatter in the injection path, and `formatCurrentDate` has zero remaining references (Law-4 grep).
2. **Per-step freshness does not break caching.** Confirm the step prompt's `<system_reminder>` timestamp (`strings.ts:252`) is appended to the already-ephemeral step prompt (which changes every step anyway), so no cacheable prompt is invalidated.
3. **Bundle regenerated.** Confirm `grep -c "Current date and time:" cli/src/agents/bundled-agents.generated.ts` → 13, and 0 occurrences of the old `Current date:` label.

### FID-011 (E-01..E-04)

4. **E-01 single source.** Confirm `systemTokens` is computed once (`context-tokens.ts:72`), returned (`:255`), and consumed with a `?? countTokens(system)` fallback (`step.ts:169`) so direct callers/tests still work.
5. **E-03 strict-only gate.** Confirm `pre-write-gates.ts:74` evaluates the `isNewFile`/`existsSync` probe only when `tier === 'all_15'`, and strict mode still returns `{ blocked: true }` for an unread existing file (regression-covered).
6. **E-04 bound is safe.** Confirm `readPatterns` is a bounded FIFO (`MAX_READ_PATTERNS = 256`) and `hasRead` still preserves exact/prefix/`includes` semantics on normalized values; the authoritative `readPaths` Set remains unbounded.

### FID-012 (G-01 + G-03)

7. **G-01 does not lose observability.** Confirm the end-step debug log still carries `iteration`/`agentId`/`model`/`prompt`/`shouldEndTurn`/`duration`/`messageCount`/`stepCreditsUsed`, and the removed `fullResponse`/`toolResults` are genuinely retained by `step.ts` `recordStep` (`messages: agentState.messageHistory`).
8. **G-03 semantics identical.** Confirm `SENSITIVE_KEY_SUBSTRINGS` is the lowercased form of `SENSITIVE_KEYS` in insertion order, so `isSensitiveKey` matches the same keys case-insensitively (covered by `logger-sanitize-secrets` 5/0).
9. **G-02 intentionally absent.** Confirm the dev `appendFileSync` (`sink.ts:280`) is unchanged and no async-append/flush machinery was introduced.

### FID-013 (messagesWithStepPrompt)

10. **Single consumer, moved not copied.** Confirm `messagesWithStepPrompt` is declared at `context-tokens.ts:111` (inside the `else`) and consumed at `:119`, and the local-estimation branch (`shouldUseLocalTokenCount` → `estimateContextTokensLocally`) has no reference to it.

## Authorization boundary

Implementation review of FID-2026-0815-010..013 only. No closure, commit, push, release, publication, or deployment authority. Operator closure remains a separate decision after your PASS. (Nova sign-off for the earlier 0815 program — FIDs 002, 004–009 — was requested separately in `2026-08-15-fid-2026-0815-002-004-009-harness-speed-remediation-implementation-signoff-request.md`.)
