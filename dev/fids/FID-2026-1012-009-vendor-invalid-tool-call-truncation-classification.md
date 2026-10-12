# FID: Vendor-path invalid tool calls never carry the output-cap discriminator

**Filename:** `FID-2026-1012-009-vendor-invalid-tool-call-truncation-classification.md`
**ID:** FID-2026-1012-009
**Severity:** medium
**Status:** verified
**Created:** 2026-10-12 18:05
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

`read_files` is the top line of the learning ledger: 48 recorded
native-incomplete failures between 2026-10-02 and 2026-10-12, still occurring
today. Every one of them is steered with the generic advice — "retry the tool
call with a complete arguments object" — and none with the output-cap advice
"split the work into smaller calls" that FID-2026-0909-008 built for exactly
this class. The reason is structural: the vendor-SDK classification path
(`classifyInvalidToolCall`) constructs the native-incomplete error from scratch
as `{ type, toolName }`, so the `finishReason === 'length'` branch that selects
the cap advice is unreachable from the path that actually produces these
errors. The runtime therefore cannot tell "the output budget cut the arguments
mid-JSON" from "the model wrote ill-typed arguments", and answers both with
advice that is unactionable for the first.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `ai` 5.0.122
- **Commit/State:** `main` @ `ac4bad20`, v0.0.36 local line

## Detailed Description

### Problem

The agent-facing recovery text for a truncated tool call is chosen from the
native error's `finishReason`. Two classification paths feed it, and only one
of them can supply that field:

- `classifyNativeToolCallError` (OpenAI-compatible providers) forwards the
  provider's own typed error object into
  `normalizeNativeToolCallStreamError`, which reads `finishReason` off it — so
  this path can produce the cap advice.
- `classifyInvalidToolCall` (vendor SDK transformers: `anthropic`, `google`, …)
  receives the `ai` core tool-call part that was marked `invalid: true`, and
  builds `{ type: 'native-incomplete', toolName }` by hand. No finish reason is
  available at that point in the stream (the `finish` part arrives later), so
  the branch is dead for this path.

Consequence, measured: all 48 `read_files` failures carry the generic text. The
`read_files` steering ladder (`NATIVE_TOOL_CALL_STEERING_MESSAGES`) does
escalate at strikes 2 and 3 toward "read 1-3 files per call", but strike 1 —
the retry that matters, per the ledger's own pre-implementation measurements —
tells the model to re-send a complete arguments object. For a payload cut by
the output cap, re-sending it truncates identically. The repository already
records this as a lesson: *a retry that re-emits the same oversized tool call
is not recovery*.

### Expected Behavior

A tool call whose arguments were cut by the output budget, and one whose
arguments were complete but ill-typed, are different failures and must not share
one recovery message. Truncated arguments get the split-the-work advice the
`length` branch already emits; ill-typed arguments keep today's text.

### Root Cause

`classifyInvalidToolCall` discards the only discriminator it has. The `ai` core
attaches the failing input and its cause to the error it hands over —
`InvalidToolInputError` exposes `toolInput: string` and `cause: unknown`
(confirmed in `node_modules/ai/dist/index.d.ts:922-933` for the installed
5.0.122) — and the classifier drops both, keeping only the tool name.

### Evidence

Ledger, all recorded `read_files` native-incomplete failures:

```text
$ grep -c 'Incomplete arguments for tool read_files' dev/experiences/raw-traces.jsonl
48
$ grep 'Incomplete arguments for tool read_files' dev/experiences/raw-traces.jsonl \
    | grep -c 'retry the tool call with a complete arguments object'
48
$ grep 'Incomplete arguments for tool read_files' dev/experiences/raw-traces.jsonl \
    | grep -c 'output token limit'
0
```

Distribution by day (payload captures no `finishReason` field, so the ledger
cannot attribute the cause retrospectively — see the AUDIT note):

```text
2026-10-02: 21   2026-10-03:  1   2026-10-04: 13
2026-10-07:  3   2026-10-09:  3   2026-10-12:  7
```

Emit sites:

- `sdk/src/impl/llm/errors.ts:115-135` — the two message variants and the
  `finishReason === 'length'` branch.
- `sdk/src/impl/llm/stream-error-chunk.ts:96-102` — `classifyInvalidToolCall`
  building `{ type: 'native-incomplete', toolName }` with no finish reason.
- `sdk/src/impl/llm/stream.ts:250-272` — the `invalid: true` part routing.
- `common/src/types/contracts/llm.ts:46-71` — `NativeToolCallError`, whose
  `finishReason` is optional and string-guarded.
- `packages/agent-runtime/src/tools/stream-parser/error-chunk.ts:120-140` —
  ungated strike-1 steering; `run-agent-step/constants.ts:44-50` — the
  `read_files` ladder.

## Impact Assessment

### Affected Components

- `common/src/types/contracts/llm.ts` (the native-incomplete contract)
- `sdk/src/impl/llm/errors.ts` (message selection)
- `sdk/src/impl/llm/stream-error-chunk.ts` (vendor-path classification)
- Every vendor-family provider's malformed tool call; `read_files`,
  `read_url`, `str_replace` and the bulk-write tools are the observable victims

### Risk Level

Low. Classification only selects the recovery text and the strike ladder; no
tool executes differently, no argument is rewritten, and the fail-closed
default (no discriminator → today's message) is preserved. The blast radius is
every agent on every vendor provider, which is why it lands with its own FID and
its own gates rather than as a message tweak.

## Proposed Solution

### Approach

Carry the discriminator the vendor path already holds, without inventing a
finish reason it does not have.

### Steps

1. Extend the contract: `NativeToolCallError` and the `StreamErrorChunk`
   native-incomplete variant gain an optional `argumentsTruncated?: boolean`;
   `isNativeToolCallError` accepts it and still rejects a non-boolean value
   (same hostile-shape discipline as `finishReason`).
2. Select the message in `normalizeNativeToolCallStreamError` when
   `argumentsTruncated === true` **or** `finishReason === 'length'`, reusing the
   existing split-the-work wording verbatim (Law 13 — one wording per class).
3. In `classifyInvalidToolCall`, set `argumentsTruncated: true` when the error
   is an `InvalidToolInputError` whose cause is a JSON syntax failure
   (`SyntaxError`, or a message matching a JSON parse failure such as
   "Unexpected end of JSON input" / "Unterminated string" / "in JSON"). Every
   other shape — schema/type validation failures, repair errors, an absent
   cause — leaves the flag unset and keeps today's text.
4. Extend `sdk/src/impl/__tests__/llm-native-tool-call.test.ts`: a JSON-syntax
   `InvalidToolInputError` yields the split-the-work text; a type/schema failure
   yields the generic text; an error with no cause yields the generic text; a
   hostile non-boolean `argumentsTruncated` is rejected by the guard.
5. Add the classification pin to
   `packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts`
   so the runtime-side strike-1 steering for the truncated class is asserted
   through the parser, not only in the SDK unit.

### Verification

```bash
cd sdk && bun test src/impl/__tests__/llm-native-tool-call.test.ts
cd packages/agent-runtime && bun test src/tools/stream-parser/__tests__/error-chunk-steering.test.ts
bun run --cwd=sdk typecheck && bun run --cwd=packages/agent-runtime typecheck
bun run quality:report
```

## Verification Gates

- gate: test sdk/src/impl/__tests__/llm-native-tool-call.test.ts
- gate: test packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:73791f1f6d99ad9e8f5a2e03a003542172ddc1c504a49976429fc34e4bd705e4
- verified: 2026-10-12T22:05:40.597Z
- test sdk/src/impl/__tests__/llm-native-tool-call.test.ts: exit 0
- test packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** 48 `read_files` native-incomplete failures, 2026-10-02 → 2026-10-12;
  48/48 carry the generic retry text and 0/48 the cap text, so the class is
  steered toward re-sending the payload that already failed.
- **GREEN:** carry `argumentsTruncated` from the vendor classifier's own
  `InvalidToolInputError` input/cause and select the existing split-the-work
  message.
- **AUDIT:** citations re-measured above (`errors.ts:115-135`,
  `stream-error-chunk.ts:96-102`, `stream.ts:250-272`, `llm.ts:46-71`, the
  `ai` type at `index.d.ts:922-933`); ledger counts re-run at HEAD.
- **ADVERSARIAL:** (a) does this collide with the unavailable-tool class?
  No — `NoSuchToolError` is routed to its own message before this branch.
  (b) Can it mislabel a genuinely malformed-but-complete JSON? A JSON syntax
  failure means the document never closed, so "split the work" is valid advice
  in every case it selects; the risk is a wrong *reason*, not wrong advice.
  (c) Does it change execution? No — message and ladder selection only.
  (d) Does it double-fire with the OpenAI-compatible path? No — that path is
  untouched and keeps routing on its provider-supplied `finishReason`.
- **CHANGE DELTA:** ~2% — four source surfaces plus two suites: the contract
  (`common/src/types/contracts/llm.ts`), the message selector
  (`sdk/src/impl/llm/errors.ts`), the vendor classifier
  (`sdk/src/impl/llm/stream-error-chunk.ts`), and the two test files. No
  execution path, argument rewrite, or strike budget changed.

### Missed Questions

1. Should the experience-capture record also store `errorClass` and the
   truncation flag so the next occurrence is attributable? → Yes, and it is a
   separate, smaller change (the capture is a hook record, not this
   classification path). Warranted on the next capture edit; the 48 existing
   records cannot be retro-attributed either way.
2. Is `read_files`' strike ladder itself wrong? → No. It escalates correctly at
   strikes 2 and 3; the defect is that strike 1 contradicts the ladder by
   prescribing a re-send.
3. Should the flag be a boolean or a reason enum (`cap` | `parse-failure`)? →
   Boolean for now: both select the same advice, and a reason enum with one
   consumer would be vocabulary without a use. Revisit if the two classes ever
   need different recovery.

## Resolution

Implemented and verified (2026-10-12).

- The contract carries `argumentsTruncated?: boolean` on `NativeToolCallError`
  and the native-incomplete `StreamErrorChunk`, with the guard rejecting a
  non-boolean value (same hostile-shape discipline as `finishReason`).
- `normalizeNativeToolCallStreamError` selects the split-the-work advice for
  `finishReason === 'length'` **or** `argumentsTruncated === true`, from one
  shared advice sentence with a truthful cause clause per case; the generic
  re-send text is unchanged for everything else.
- `classifyInvalidToolCall` sets the flag when `ai`'s own classification says
  the input never parsed (`InvalidToolInputError` whose cause is a
  `JSONParseError`), and leaves it unset for a schema/type failure, a missing
  cause, or any unrecognised shape.

Evidence: `sdk/src/impl/__tests__/llm-native-tool-call.test.ts` 12/12 (five new
cases: truncation selects the split advice; a false flag keeps the generic text;
`argumentsTruncated: 'yes'` is rejected by the guard; a `JSONParseError` cause is
classified truncated while a `TypeValidationError` cause and a missing cause are
not); `packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts`
10/10 (a new pin proves the truncated body survives the runtime and still gains
the `read_files` strike-1 steering); `common`, `sdk` and `packages/agent-runtime`
typechecks exit 0; `quality:report` PASS.

Boundary recorded rather than claimed: this proves the classification and both
message selections at unit level. It does **not** prove the production incidence
of the class, because the eight-day ledger cannot attribute its 48 records to
cause (the capture stores only the error's first line). The next occurrences must
be read from the ledger to confirm the class text changes; the capture-side
`errorClass`/truncation field remains open as a follow-up.

## Lessons Learned

*A discriminator that only one of two producers can supply is not a
discriminator — check that every path into a branch can reach it.* The
output-cap branch existed, was tested, and was correct for eight days while
being unreachable from the path that actually produced the failures; the suite
that pinned it could not notice, because it constructed the error the reachable
way (a finish reason) rather than the way production builds it.
