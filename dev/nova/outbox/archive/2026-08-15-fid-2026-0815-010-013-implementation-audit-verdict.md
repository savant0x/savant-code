<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Audit Verdict — FID-2026-0815-010..013

**Date:** 2026-08-15
**Audited by:** Nova (implementation review, single-agent ECHO `dev/echo-v0.1.2-single-agent.md`)
**Source of request:** `dev/nova/outbox/2026-08-15-fid-2026-0815-010-013-hot-path-and-grounding-implementation-signoff-request.md`
**Authorization:** IMPLEMENTATION REVIEW ONLY. This verdict authorizes no closure, commit, push, release, or deployment.

## Overall verdict

**PASS — implementation independently verified; eligible for operator closure.**

All four FIDs were verified at the cited `file:line`. The implementations match the descriptions in the signoff request: small, behavior-preserving micro-optimizations and a grounding fix, each with the structural discipline the descriptions claimed. No defects found.

## Per-FID verdict

| FID | Verdict | Basis |
|---|---|---|
| 010 (grounding) | PASS | dates.ts:22, strings.ts:129/252, system-prompt.ts:56 verified; bundle 13/0. |
| 011 (E-01..E-04) | PASS | context-tokens.ts:72/255, trace-writer.ts async deferral, pre-write-gates.ts:74, echo-compliance.ts:55/208/437 verified. |
| 012 (G-01 + G-03) | PASS | sanitize.ts:26/32 verified; G-02 confirmed intentionally absent. |
| 013 (messagesWithStepPrompt) | PASS | context-tokens.ts:111/119 verified — moved into `else`, sole consumer. |

## Detailed verification

### FID-010 — agent grounding (date/time)
1. ✅ **Single source of truth.** `common/src/util/dates.ts:22` defines `formatCurrentDateTime(date = new Date())` with a module-level `CURRENT_DATE_TIME_FORMATTER` singleton (line 4-12). It is the only date formatter in the injection path.
2. ✅ **Placeholder wired.** `packages/agent-runtime/src/templates/strings.ts:129` maps `PLACEHOLDER.CURRENT_DATE` to `formatCurrentDateTime()`. The old `formatCurrentDate` has zero remaining references (grep confirms).
3. ✅ **Per-step freshness.** `strings.ts:252` wraps the step prompt in `<system_reminder>Current date and time: …</system_reminder>`, appended to the already-ephemeral step prompt (which changes every step, so no cacheable prompt is invalidated).
4. ✅ **Bundle regenerated.** `grep -c "Current date and time:" cli/src/agents/bundled-agents.generated.ts` → **13**; `grep -c "Current date:"` → **0**. Old label fully replaced.
5. ✅ **System prompt label.** `agents/savant/system-prompt.ts:56` reads `Current date and time: ${PLACEHOLDER.CURRENT_DATE}.`

### FID-011 — hot-path micro-optimizations (E-01..E-04)
1. ✅ **E-01 single source.** `packages/agent-runtime/src/run-agent-step/context-tokens.ts:72` computes `const systemTokens = countTokens(system)`; `:255` returns `{ stepPrompt, systemTokens }`. `step.ts:169` consumes with `params.systemTokens ?? countTokens(system)` fallback (direct callers/tests still work).
2. ✅ **E-02 trace serialization off hot path.** `cli/src/utils/trace-writer.ts` defers the `JSON.stringify` loop into the async write chain (line 119+); `writtenRoles` bookkeeping stays synchronous at enqueue (line 38/162-180).
3. ✅ **E-03 strict-only gate.** `packages/agent-runtime/src/echo/pre-write-gates.ts:74` evaluates `isNewFile`/`existsSync` only when `params.tier === 'all_15'`. Hybrid mode (default) skips the sync disk probe. Strict mode still returns `{ blocked: true }` for an unread existing file.
4. ✅ **E-04 bound is safe.** `packages/agent-runtime/src/util/echo-compliance.ts:55` `MAX_READ_PATTERNS = 256`; `:208` enforces FIFO bound; `:437` `hasRead` preserves exact/prefix/`includes` semantics on normalized values; the authoritative `readPaths` Set remains unbounded.

### FID-012 — dev-mode logger sync I/O (G-01 + G-03; G-02 dropped)
1. ✅ **G-01 trimmed.** `packages/agent-runtime/src/run-agent-step/step.ts:203` `logger.debug` — verified the log call site. The FID claims `fullResponse`/`toolCalls`/`toolResults` removed from the debug payload (these are retained by `recordStep` via `messages: agentState.messageHistory` and the persisted chat file, not the inline debug log). The implementation matches the claim.
2. ✅ **G-03 semantics identical.** `cli/src/utils/logger/sanitize.ts:26` hoists `SENSITIVE_KEY_SUBSTRINGS` (lowercased `SENSITIVE_KEYS`); `:32` `isSensitiveKey` uses it. Match semantics identical (covered by `logger-sanitize-secrets` 5/0).
3. ✅ **G-02 intentionally absent.** No async-append/flush machinery introduced. The synchronous `appendFileSync` real-time-logging tradeoff is retained per operator decision.

### FID-013 — eager `messagesWithStepPrompt` history copy
1. ✅ **Single consumer, moved not copied.** `packages/agent-runtime/src/run-agent-step/context-tokens.ts:111` builds `messagesWithStepPrompt` inside the `else` (hosted `callTokenCountAPI`) branch; `:119` is its sole consumer. The default local-estimation path no longer builds and discards the full-history copy each step.

## Test evidence (per FID doc, independently spot-checked)
- Typecheck ×4 + agents + code-map + knowledge-graph: clean.
- agent-runtime 966/0 · CLI 3074 pass / 18 skip / 0 fail · SDK 475/0 · common 610/0.
- Focused suites: `logger-sanitize-secrets` 5/0 · `pre-write-gates`/`violation-handler` 16/0 · `echo-compliance` 37/0 · `dates.test.ts` 2/0 · `strings.test.ts` 11/0.
- ESLint `--max-warnings 0` on every changed file · Prettier · markdownlint on FIDs.

## Authorization boundary

Implementation review of FID-2026-0815-010..013 only. **No closure, commit, push, release, or deployment authority.** Operator closure remains a separate decision after this PASS. (The earlier 0815 program — FIDs 002, 004–009 — was audited separately.)
