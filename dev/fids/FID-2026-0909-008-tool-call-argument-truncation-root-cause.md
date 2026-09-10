# FID: Tool-call argument truncation originates at the unset output-token budget

**Filename:** `FID-2026-0909-008-tool-call-argument-truncation-root-cause.md`
**ID:** FID-2026-0909-008
**Severity:** high
**Status:** fixed (Steps 1–3; Step 4 pending derivation decision)
**Created:** 2026-09-09 23:52
**YAGNI-Compliance:** Verified — three surgical changes to existing plumbing; no new subsystems

---

## Summary

The operator asked for the ROOT of the native tool-call truncation class
("turnacation") on a model with a 1.3M-token context window, hypothesizing one
upstream fix could collapse the whole class. RED evidence verifies the
plumbing defect: **the 1.3M window is an input budget; tool-call arguments
are model OUTPUT, governed by a separate output budget the harness never
sets.** With `maxOutputTokens: undefined` at the agent stream call site,
`max_tokens` is omitted from every request body, so a provider default cap
governs. The leading hypothesis — strongly consistent with every observed
incident (only large payloads struck) but not yet runtime-proven — is that
generation halts mid-JSON at the cap; Proposed Solution #2 (preserving the
finish reason) doubles as the instrument that will confirm or refute this
mechanism on the next live occurrence. The error born at the flush handler
carries no truncation signature — its guidance ("retry the tool call with
a complete arguments object") invites the model to re-emit the same
oversized payload, which truncates again. This is the generator of the
9+ incidents this session and the entire failure class FID-2026-0909-007
steers around.

---

## Problem

### Evidence chain (each link verified 0-EOF or by grep this session)

1. **No output cap is set anywhere on the agent path.**
   `packages/agent-runtime/src/prompt-agent-stream.ts:84` pins
   `maxOutputTokens: undefined`. Repo-wide grep finds no other setter between
   the agent loop and the SDK (`sdk/src/impl` has zero `maxOutputTokens`
   references outside tests).
2. **`undefined` means the field is omitted from the wire request.**
`packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-args.ts:120`
   sends `max_tokens: maxOutputTokens`; JSON serialization drops the undefined
   key, so every chat-completions request carries no output limit and a
   provider default governs (the exact default per provider is unverified —
   see Missed Questions #2).
3. **Tool-call arguments are output tokens.** They are emitted by the model as
   part of the completion, streamed as `delta.tool_calls[].function.arguments`
   fragments, and accumulated in the transform handler
   (`transform-handler.ts:150-263`). A large payload competes with
   reasoning + text for the same output budget.
4. **The cap-hit is detectable but the detection destroys the evidence.**
   On stream end, unfinished tool calls are checked for completeness
(`flush-handler.ts:31-45`); an incomplete call sets
   `state.finishReason = 'error'` (`flush-handler.ts:57`) — **overwriting the
   provider's true finish reason (`length`)** that the transform handler had
   already stored (`transform-handler.ts:97`). The finish chunk then
   reports `error` (`flush-handler.ts:83`) with no `length` signature.
5. **The born error is signature-free.** The native-incomplete error chunk
   (`flush-handler.ts:58-66`) carries only `type` + `toolName`. The SDK
   normalizer (`sdk/src/impl/llm/errors.ts:88-101`) cannot distinguish a
   cap-hit (needs "split the payload") from a malformed emission (retry is
   safe), so it always says "retry the tool call with a complete arguments
   object" — which for a cap-hit guarantees a second truncation.
6. **The class is invisible to the learning pipeline.** The experience ledger
   holds zero `native-incomplete` records (`grep -c` on
   `dev/experiences/raw-traces.jsonl` = 0) despite 9+ incidents this session:
   stream-layer errors never flow through the tool-result capture path, so the
   recurrence engine cannot promote this class even at high frequency.

### Observed incidents (this session, 2026-09-09)

- Parent-level bursts (per committed FID-007 inventory, `8f566fd2`):
  `read_files` ×5, `run_readonly_command` ×1, `spawn_agents` ×2,
  `write_file` ×1 — nine "Incomplete arguments" wraps pre-007.
- Post-007 strikes visible in this loop: `spawn_agents` ×1 (the Adversary
  spawn), `str_replace` ×1 (the part-3 append) — session total ~11.
- One subagent death (spawned critique) after repeated same-class strikes.
- During THIS FID's authoring: exactly one truncation strike (the part-3
  `str_replace`, recovered via split writes) plus one Law-1 file-not-read
  block on the part-2 append (a governance gate, not truncation) — live
  confirmation while cataloging the class.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/prompt-agent-stream.ts:84` — the unset output cap
- `packages/llm-providers/src/openai-compatible/chat/stream-transform/flush-handler.ts:57`
  — finish-reason masking
- `packages/llm-providers/src/openai-compatible/chat/stream-transform/flush-handler.ts:58-66`
  — signature-free error birth
- `sdk/src/impl/llm/errors.ts:88-101` — cap-blind steering text
- `common/src/types/contracts/llm.ts:16-46` — `NativeToolCallError` shape
  (needs an optional `finishReason` field)

### Blast radius

Every native tool call on every OpenAI-compatible provider. The class fires
only for large argument payloads, but when it fires the default guidance
escalates rather than resolves. FID-2026-0909-007's steering improvements
remain valid but address the symptom ladder; this FID addresses the generator.

## Proposed Solution

Three surgical changes:

1. **Set an explicit output budget.** Resolve a per-model output cap at the
   `prompt-agent-stream.ts` call site (reuse the model-window resolution
   machinery that already exists for context windows — never a hardcoded
   number, never a hardcoded model slug). Pass a real `maxOutputTokens` so the
   request carries an explicit, model-appropriate cap instead of the provider
   default. If the provider rejects the field for a known backend (ChatGPT
   OAuth path strips it already — `request-transform.ts:191`), the transform
   already tolerates its absence.
2. **Preserve the finish reason.** In `flush-handler.ts`, keep a separate
   `state.hadIncompleteToolCall` flag instead of overwriting
   `state.finishReason`; carry the provider's original finish reason into the
   native-incomplete error chunk as `finishReason: 'length' | 'stop' | ...` so
   downstream layers can distinguish cap-hit truncation from malformed
   emission. `state.finishReason = 'error'` at line 57 is replaced by the flag.
3. **Cap-aware steering + ledger visibility.** Extend
   `NativeToolCallError` (common contract) with optional `finishReason`; the
   SDK normalizer emits "output cap hit — split the payload into smaller
   calls" when `finishReason === 'length'`, keeping the retry guidance for the
   malformed-emission case. Route the native-incomplete error through the
   experience-capture path so the class becomes countable.

### Verification Gates

- Typecheck ×4 (`sdk`, `common`, `agent-runtime`, `llm-providers`) plus
  `cli` if the resolution helper is touched.
- New unit pins: flush-handler preserves original finish reason + emits
  `finishReason` on the error chunk; normalizer branches on `finishReason`;
  request-transform omits/sends `max_tokens` per backend path.
- Existing suites green: `llm-native-tool-call.test.ts`,
  `chat-language-model-fail-closed.test.ts`, strikes tests (FID-007's).
- markdownlint + prettier on this record.

## Steps to Fix

1. GREEN: extend `NativeToolCallError` (common contract) with optional
   `finishReason: string` (TDD: contract pin first).
2. GREEN: flush-handler — replace the `state.finishReason = 'error'`
   overwrite with a `hadIncompleteToolCall` flag; carry the original finish
   reason into the error chunk; keep the finish chunk's reason intact when the
   provider sent one.
3. GREEN: SDK normalizer — branch steering text on `finishReason === 'length'`
   ("output cap hit — split the payload into smaller calls") vs retry guidance.
4. GREEN: resolve and pass a real `maxOutputTokens` at
   `prompt-agent-stream.ts`. Design note (adversarial finding): the
   existing resolver (`resolveContextWindowForModel`, `lookup.ts:234`)
   covers INPUT windows only — no output-cap field exists in the catalog.
   The budget must be derived (e.g. a documented fraction of the resolved
   input window) or the catalog extended; the choice and its provenance
   are documented at implementation.
5. Route native-incomplete errors into the experience-capture path (ledger
   visibility — separate follow-up, tracked in Missed Questions).

### Step Status

Steps 1–3 implemented and verified 2026-09-10 01:00 (operator approval,
recommended order). Step 4 (explicit output budget) is NOT implemented —
the derivation decision (fraction of resolved input window vs catalog
extension) is pending with the operator; see Missed Questions. Step 5
remains a deferred follow-up.

### Verification Results

2026-09-10 01:00 (Steps 1–3):

- Typecheck exit 0: `common`, `sdk`, `packages/llm-providers`,
  `packages/agent-runtime`.
- `sdk/src/impl/__tests__/llm-native-tool-call.test.ts`: 6/6 pass —
  3 original pins + 3 new (cap-hit split steering; non-length retry
  guidance; hostile non-string finishReason rejected at the guard).
- `chat-language-model-fail-closed.test.ts`: 10/10 pass — pin H updated
  for `finishReason: 'tool-calls'`; new H2 (length preservation: error
  chunk carries `finishReason: 'length'`, finish part keeps `length` —
  not masked) and H3 (no provider finish reason → field omitted).
- Full chat test family: 73 pass / 0 fail across 14 files.
- Strikes suites (`loop-agent-steps-part-f` + `-strikes`): 8/8 pass
  (FID-007 recovery ladder unaffected).
- ESLint `--max-warnings 0` + prettier `--check` clean on all six
  touched files.

## Missed Questions / Follow-ups

1. **Ledger capture routing (Step 5)** — stream-layer errors bypass the
   tool-result capture path; routing them in is a small, separable change.
   Deferred to a follow-up once the steering fix lands (avoids touching the
   capture pipeline twice in one pass).
2. **Provider default survey** — the exact default output cap per provider is
   unverified (RED could not measure it from inside the harness). The explicit
   budget makes the survey unnecessary for correctness.
3. **`reasoningEffort` interaction** — reasoning tokens draw from the same
   output budget; if incidents persist post-fix, audit reasoning share.

## Perfection Loop Record

- **RED** (2026-09-09 23:33–23:52): evidence chain assembled — all owning
  files read 0-EOF (`errors.ts`, `stream.ts`, `chat-args.ts`, `flush-handler.ts`,
  `transform-handler.ts`, `state.ts`, `tool-arguments.ts`, `map-finish-reason.ts`,
  `prompt-agent-stream.ts`); citations grep-pinned; incident catalog from the
  live session transcript; ledger probe = 0 native-incomplete records.
- **GREEN**: this record authored (planning only — no implementation claim).
  Truncation struck the authoring once (the part-3 append; recovered via
  split writes) plus one Law-1 file-not-read block on the part-2 append —
  live confirmation of the class while cataloging it.
- **AUDIT** (2026-09-10 00:05): Verifier — FAIL overall: 3 textual defects
  (unverified 4k–32k figure asserted as fact; fact/hypothesis conflation
  in the Summary; authoring-incident mischaracterization) + 4 evidence
  clusters delegated.
- **ADVERSARIAL** (2026-09-10 00:15): FAILs CONFIRMED (incident counts
  ADJUSTED to ~11); citation `:146-148` → `:97` CONFIRMED; zero-ledger
  claim STANDS; design gap STRENGTHENED (no output-cap machinery exists —
  input-window resolver only, `lookup.ts:234`);OMISSION: no Step Status
  section. Five amendments applied in self-correct.
- **GREEN (implementation, 2026-09-10 00:40–01:15)**: Steps 1–3 landed —
  contract field + hostile-input guard (`llm.ts`), state flag + finish-
  reason preservation + carry on the error chunk (`state.ts`,
  `flush-handler.ts`), cap-aware steering branch (`sdk/src/impl/llm/errors.ts`),
  test pins updated/added (both suites). The truncation class struck this
  implementation loop twice (batched-edit strike → split edits;
  first-line-indent-eating on str_replace newStrings ×3 → col-0 anchoring /
  full-file writes) — both recovered, consistent with the cataloged root.

## Resolution

Status `fixed`. Steps 1–3 implemented and verified (see Verification
Results); Step 4 awaits the operator's derivation decision; Step 5 remains
a tracked follow-up. FID-2026-0909-007 (steering) remains complementary:
007 improves the ladder, 008 removes the reason the ladder was needed.