# FID: Vendor-path invalid tool-inputs lose native-incomplete classification (steering/strikes/ledger bypassed)

**Filename:** `FID-2026-0912-005-vendor-path-invalid-tool-input-native-incomplete-classification.md`
**ID:** FID-2026-0912-005
**Severity:** medium
**Status:** closed
**Created:** 2026-09-12 15:00
**YAGNI-Compliance:** Verified

---

## Summary

Anthropic-compatible and Google-compatible provider families route through the
vendor SDKs (`@ai-sdk/anthropic@2.0.50`, `@ai-sdk/google`) — not our hardened
OpenAI-compatible stream transformer. When a model on those paths emits a tool
call with truncated or otherwise invalid arguments JSON, `ai@5.0.122` core
marks the call `invalid: true` and filters it from execution (correct,
fail-closed), and our SDK stream layer forwards the raw invalid tool-call part
into the runtime, where it degrades into a generic `stringInputError`. The
runtime's entire native-incomplete machinery — tool-specific strike-one
steering, consecutive-strike counting with exhaustion, and the
PostToolUseFailure experience-capture ledger record — never fires, because
`errorClass: 'native-incomplete'` is never produced on those paths. Execution
is still safe; observability, recovery quality, and learnability are lost for
two of three provider families.

## Environment

- **OS:** Windows (win32, bash)
- **Language/Runtime:** TypeScript, Bun ≥ 1.3.11
- **Tool Versions:** `ai@5.0.122`, `@ai-sdk/anthropic@2.0.50`, `@ai-sdk/google@2`, `@ai-sdk/provider@2.0.1`
- **Commit/State:** `4e6b867` (2026-09-12)

## Detailed Description

### Problem

The native-incomplete pipeline has three producers of the classification
signal, but only one covers the OpenAI-compatible family:

1. **Our flush gate** (`packages/llm-providers/src/openai-compatible/chat/stream-transform/flush-handler.ts:57-74`):
   arguments that fail `isCompleteKnownToolCallArguments` emit
   `{ type: 'error', error: { type: 'native-incomplete', toolName, finishReason? } }`.
2. **`normalizeNativeToolCallStreamError`** (`sdk/src/impl/llm/errors.ts:88-113`):
   converts that typed object into a `StreamErrorChunk` with
   `errorClass: 'native-incomplete'` and the FID-2026-0909-008
   output-cap-aware message.
3. **Runtime consumption** (`packages/agent-runtime/src/tools/stream-parser.ts:178-213`
   → `stream-parser/error-chunk.ts:62-108`): sets `hasNativeIncompleteToolCall`,
   appends steering (FID-2026-0909-007), drives strikes
   (`run-agent-step/loop-iteration.ts:198-218`), and fires the
   experience-capture hook (FID-2026-0909-008 Step 5).

Vendor paths never reach producer 1: `@ai-sdk/anthropic` emits the `tool-call`
part **unconditionally** at `content_block_stop`
(`node_modules/@ai-sdk/anthropic/dist/index.mjs:2659-2674`), with no
completeness check on `contentBlock.input`. The `ai` core then attempts
`doParseToolCall` (`node_modules/ai/dist/index.mjs:1925-1941`); on
`InvalidToolInputError` / `NoSuchToolError` the parse result is returned as
`{ invalid: true, error }` (`ai/dist/index.mjs:1894-1907`) and execution is
filtered (`ai/dist/index.mjs:2378-2401` — `invalidToolCalls` become
`tool-error` outputs, `executeTools` receives only `!toolCall.invalid`).

Our SDK stream layer then forwards the invalid part verbatim:
`sdk/src/impl/llm/stream.ts:255-262` (`chunkValue.type === 'tool-call'` →
`yield chunkValue` — no `invalid` inspection). Downstream,
`processToolCallObject` (`packages/agent-runtime/src/tool-stream-parser.ts:56-96`)
fails its `JSON.parse` (pass-through debug log per FID-2026-0803-005 C4) and
the executor surfaces the generic `stringInputError`
(`packages/agent-runtime/src/tools/tool-call-repair.ts:116-128`) — wrapped,
retryable, but unclassified.

**Consequences on vendor paths:**

- `hasNativeIncompleteToolCall` stays `false` → no tool-specific steering
  (strike 1 hint from `getSteeringMessage`), no strike-2+ escalation, no
  exhaustion (`buildStepExhaustedError` unreachable for this class).
- No `PostToolUseFailure` ledger record → the recurrence engine is blind to
  the truncation class on these families (the exact invisibility that
  motivated FID-2026-0909-008 Step 5 for the OpenAI-compatible path).
- Only the generic anti-runaway guard (`consecutiveToolErrorSteps`,
  `finalize-step.ts:155-190`) bounds the retry loop.

### Expected Behavior

An invalid (truncated/malformed-args or unknown-tool) vendor tool-call should
surface as a `StreamErrorChunk` with `errorClass: 'native-incomplete'` and the
tool name — identical to the OpenAI-compatible path — so steering, strike
counting, exhaustion, and experience capture apply uniformly across all
provider families.

### Root Cause

The SDK stream layer's `tool-call` branch predates the invalid-part shape and
inspects nothing but `chunkValue.type`. The vendor families were wired into
`model-factories.ts` (`sdk/src/impl/model-provider/model-factories.ts:1-2,82,105`)
after the OpenAI-compatible hardening landed, and the classification gap was
not re-audited per family.

### Evidence

Audit performed 2026-09-12 (Task 40; evidence re-verified at authoring):

```text
# Vendor transformer emits tool-call unconditionally (no completeness check):
node_modules/@ai-sdk/anthropic/dist/index.mjs:2659-2674
  case "tool-call":
    if (!usesJsonResponseTool) {
      controller.enqueue({ type: "tool-input-end", id: contentBlock.toolCallId });
      ...
      controller.enqueue({ type: "tool-call", toolCallId: ..., toolName, input: contentBlock.input, ... });

# ai core marks unparseable input invalid and filters it from execution:
node_modules/ai/dist/index.mjs:1894-1907  (parseToolCall catch → invalid: true)
node_modules/ai/dist/index.mjs:2378-2401  (invalidToolCalls → tool-error; executeTools filters !invalid)

# ai core's fixJson salvage parser is NOT in the tool-input path:
node_modules/ai/dist/index.mjs:3401-3411  (parsePartialJson — UI previews :3699, structured output :7612/:7999 only)

# Our SDK forwards invalid parts verbatim (no invalid inspection):
sdk/src/impl/llm/stream.ts:255-262
    if (chunkValue.type === 'tool-call') {
      hasYieldedContent = true
      yield chunkValue
    }

# Runtime treats the degraded result generically:
packages/agent-runtime/src/tools/tool-call-repair.ts:116-128 (stringInputError — no errorClass)
packages/agent-runtime/src/tools/stream-parser.ts:186 (tool-call branch empty; execution flows via processors)

# Vendor family wiring that bypasses our flush gate:
sdk/src/impl/model-provider/model-factories.ts:1-2, 82, 105
```

Runtime evidence (Task 40 suites; Savant-scope all green — the single failure
is the vendored `resources/freebuff-main` fixture missing its own
`node_modules`, not Savant code):

```text
bun test packages/agent-runtime/src/tools/__tests__/tool-call-repair.test.ts \
         packages/agent-runtime/src/util/__tests__/stream-xml-parser.test.ts \
         packages/llm-providers/src/openai-compatible/chat/chat-language-model-fail-closed.test.ts
32 pass, 1 fail (freebuff-main fixture), 95 expect() calls
Fail-closed pins D/E/E2/E3/H/H2/H3/I/J/G: all (pass)
```

## Impact Assessment

### Affected Components

- `sdk/src/impl/llm/stream.ts` — the forwarding seam (fix site)
- `sdk/src/impl/llm/errors.ts` — message factory (reuse; possible shared helper)
- `sdk/src/impl/model-provider/model-factories.ts` — evidence: which families are affected
- `packages/agent-runtime/src/tools/stream-parser/*` — NO change (already consumes `StreamErrorChunk` uniformly)
- Anthropic-compatible and Google-compatible registry providers (all entries whose `protocol` selects the vendor SDKs)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Feature degraded, workaround exists — execution still fails
  closed via `ai` core; the model still receives a retryable error; the
  runaway guard still bounds loops. What is lost is classification-grade
  recovery (steering text, strike ladder, exhaustion) and the ledger record.

## Proposed Solution

### Approach

Classify at the SDK boundary, not the vendor transformers. In
`sdk/src/impl/llm/stream.ts`'s `tool-call` branch, detect the invalid part
(`invalid === true` plus its `error`/`toolName`) and yield a
`StreamErrorChunk` built through the **existing** factory
(`normalizeNativeToolCallStreamError`, fed a `NativeToolCallError`-shaped
object) instead of the raw part. This reuses the one message factory (Law 13),
requires no contract change (the yielded shape is already
`StreamErrorChunk`), and lets the unchanged runtime machinery classify, steer,
count strikes, and record experience.

Classification covers `InvalidToolInputError` **and** `NoSuchToolError`
invalid parts. This is consistent with the OpenAI-compatible path, where
undeclared tools already fail closed as `native-incomplete` (fail-closed pin
J), and unknown tool names already receive the FID-2026-0816-012 drift warning
in `handleStreamErrorChunk` (`error-chunk.ts:69-83`).

### Steps

1. **RED pin test first (failing):** new
   `sdk/src/impl/__tests__/llm-invalid-vendor-tool-call.test.ts` driving
   `promptAiSdkStream` with a mock vendor model that emits a tool-call with
   truncated arguments JSON. Assert (a) the yielded chunk is
   `{ type: 'error', errorClass: 'native-incomplete', toolName }` and (b) the
   raw invalid tool-call part is NOT yielded. Confirm the exact fullStream
   part shape for `invalid` parts at the pinned `ai` version while writing
   this test — the assertion doubles as the version-drift canary. Add a
   second case for a `NoSuchToolError` invalid part (unknown tool, repair
   declined) asserting the same classification.
2. **GREEN:** in `stream.ts`, before `yield chunkValue` in the `tool-call`
   branch: if the part is invalid, build the error chunk via
   `normalizeNativeToolCallStreamError({ type: 'native-incomplete', toolName })`
   (no `finishReason` — see Missed Question 4), `yield` it, and `continue`.
   Extend the existing `llm-native-tool-call.test.ts` only if a shared-helper
   refactor touches its surface.
3. **Runtime integration proof (no runtime changes expected):** one
   agent-runtime test asserting that a `native-incomplete` error chunk
   yielded from the SDK layer produces `hasNativeIncompleteToolCall: true`
   through `processStream` (the wiring is already pinned by
   `error-chunk-steering.test.ts` and `loop-agent-steps-part-f*.test.ts`;
   this step only confirms the SDK-shaped chunk enters the same path).
4. **Gates + Law 4:** typecheck ×4 (sdk, common, packages/agent-runtime, cli);
   full affected suites; grep proof that the new classification is consumed
   (`errorClass: 'native-incomplete'` handled at
   `stream-parser/error-chunk.ts:64`) and that no second message factory was
   introduced.

### Verification

- RED test fails before the fix, passes after (pasted output).
- Suites: `sdk/src/impl/__tests__/llm-invalid-vendor-tool-call.test.ts`,
  `llm-native-tool-call.test.ts`, agent-runtime stream-parser +
  loop-strikes suites — all green.
- `handleStreamErrorChunk` receives the vendor-origin chunk unchanged
  (file:line citation in the implementation audit).

Verification Gates are declared per FID-2026-0823-009; the receipt is stamped
with `bun run fid:verify <fid-path> --write`, and the pre-write gate blocks
any status flip without a valid receipt.

## Verification Gates

- gate: typecheck sdk
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: test sdk/src/impl/__tests__/llm-invalid-vendor-tool-call.test.ts
- gate: test sdk/src/impl/__tests__/llm-native-tool-call.test.ts

### Verification Receipt

- fingerprint: sha256:7b0165bc62bdf8fc0baeda5ba09a0bda5a07108b9d638fe3bd0057dc58eb4c7c
- verified: 2026-09-12T23:27:36.142Z
- typecheck sdk: exit 0
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- test sdk/src/impl/__tests__/llm-invalid-vendor-tool-call.test.ts: exit 0
- test sdk/src/impl/__tests__/llm-native-tool-call.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Vendor families bypass the flush gate (`model-factories.ts:1-2,82,105`);
  vendor transformers emit unconditionally (`@ai-sdk/anthropic` dist:2659-2674);
  `ai` core marks invalid and filters from execution (dist:1894-1907,
  2378-2401); our SDK forwards the invalid part verbatim
  (`stream.ts:255-262`); runtime degrades to `stringInputError`
  (`tool-call-repair.ts:116-128`) — classification, steering, strikes,
  exhaustion, and ledger all bypassed.
- **GREEN:** Classify at the SDK `tool-call` branch; reuse
  `normalizeNativeToolCallStreamError`; no runtime or contract change.
- **AUDIT:** Every claim cited file:line above (vendor dist + ai dist + Savant
  sites). No runtime change needed — verified that `handleStreamErrorChunk`
  consumes any `errorClass: 'native-incomplete'` chunk regardless of origin
  (`error-chunk.ts:62-108`) and that `stream-parser.ts:178-213` drives the
  flag/strike/ledger off it.
- **ADVERSARIAL:** (a) "Is execution currently unsafe on vendor paths?" — No:
  `ai` core filters invalid calls (`dist:2395-2401`); `fixJson` salvage is
  provably absent from the tool-input path (`dist:3401-3411` consumers
  enumerated). The FID is about observability, not corruption. (b) "Could the
  vendor version drift make this moot?" — Possible in later majors; the Step 1
  pin test is the canary. (c) "Does classifying `NoSuchToolError` as
  native-incomplete mislead?" — It mirrors the OpenAI-compatible path exactly
  (pin J + drift warning), so a discrepancy would be a pre-existing
  inconsistency, not a new one.
- **CHANGE DELTA:** initial authoring (Loop 1 baseline).

### Missed Questions

1. **Why not fork/patch the vendor transformers like `openai-compatible`?**
   Our OpenAI-compatible fork exists because it is the primary path for 12+
   gateway providers. Vendor SDKs cover two families; the seam is
   observability-only. A ~10-line SDK-boundary classification beats
   maintaining two vendor forks. Revisit only if a vendor family becomes
   primary.
2. **Does `experimental_repairToolCall` interfere?** No —
   `createRepairToolCall` (`repair-tool-call-callback.ts:22-57`) returns the
   original toolCall for non-`NoSuchToolError` errors (pass-through) and only
   rewrites spawnable-agent aliases; if repair succeeds the call parses and
   never becomes invalid. Invalid parts are exactly "repair didn't fix it."
3. **Does the `n`-parameter path need the same fix?** No —
   `handleNParameterStep` (`run-agent-step/n-parameter.ts:60-114`) consumes a
   plain string response and hardcodes
   `hasNativeIncompleteToolCall: false`; tool calls on that path flow through
   the programmatic executor, not the stream parser. Explicit non-goal.
4. **No `finishReason` on the vendor classification — why?** The invalid
   part arrives before the `finish` part in `fullStream`, so the reason is
   not yet known at classification time. Buffering/look-ahead to carry it is
   declined (YAGNI): without it, the message uses the generic
   "retry with a complete arguments object" guidance instead of the
   FID-2026-0909-008 split-payload hint. If vendor output-cap truncation is
   observed in practice, a follow-up can thread the finish reason through.
5. **Does converting the part to an error chunk break turn-ending logic?**
   No — error chunks set `hadToolCallError = true`
   (`stream-parser.ts:181`), which already forces another step
   (`finalize-step.ts:86`), identical to today's degraded path.
6. **cli/desktop impact?** None — both consume the same SDK stream contract;
   the yielded shape remains a `StreamErrorChunk`.

### Implementation Evidence (REQUIRED for `closed`)

Implemented 2026-09-12 (same session as authoring; operator approved the
implementation directive). Commit SHA pending — the operator executes or
authorizes git (G1/G2); closure requires that hash.

- [x] **Commit SHA:** `a6853358` (2026-09-13 — `fix(sdk): FID-2026-0912-005
      classify vendor-path invalid tool-inputs as native-incomplete`,
      2 files: `stream.ts` + the pin test)
- [x] **File:line ranges:** `sdk/src/impl/llm/stream.ts:255-292` (the
      `tool-call` branch now classifies `invalid === true` parts via
      `normalizeNativeToolCallStreamError` and fails closed on a null
      factory result — Law 14); new pin test
      `sdk/src/impl/__tests__/llm-invalid-vendor-tool-call.test.ts`
      (3 tests: truncated-args classification, NoSuchToolError
      classification, valid-part pass-through). ZERO runtime changes.
      **[ERRATUM 2026-09-13, FID-2026-0913-002:** the hard-cap split
      program moved the classification helpers (factory call, log fields)
      to `sdk/src/impl/llm/stream-error-chunk.ts`; the `tool-call` branch
      logic is unchanged and the pin suite still passes (9/9). The pinned
      line ranges above describe the pre-split tree.**]
- [x] **Gate output:** receipt stamped 5/5 PASS — typecheck
      sdk/common/agent-runtime exit 0, both test gates exit 0; cli typecheck
      run separately exit 0 (typecheck ×4). Re-stamped after these evidence
      edits per the fingerprint-binding rule (the receipt in this record is
      the authoritative, current one). Runtime-integration suites re-run:
      part-f + strikes + capture + steering = 16/16 pass.
- [x] **Reproducibility:** `grep -n "invalid === true" sdk/src/impl/llm/stream.ts`
      and `grep -rn "normalizeNativeToolCallStreamError" sdk/src --include="*.ts"`
      show the new call site (`stream.ts:299`) consuming the single factory
      (`errors.ts:88`); the consumer contract is untouched
      (`packages/agent-runtime/src/tools/stream-parser/error-chunk.ts:64,96`).
- [x] **Step statuses:** Step 1 `implemented` (RED observed first: 2 fail /
      1 pass pre-fix — classification legs failed, valid-part leg passed);
      Step 2 `implemented` (GREEN — 9/9 across the two sdk suites);
      Step 3 `implemented` (runtime suites 16/16 — the exact yielded shape is
      consumed by the existing machinery, proven by the strikes + capture +
      steering pins); Step 4 `implemented` (typecheck ×4, receipt stamped,
      Law 4 greps pasted above). No step is `blocked`, `deferred`, or
      `skipped`.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`stream.ts`,
      `errors.ts`, `model-factories.ts`, stream-parser modules)
- [x] Implementation matches the Proposed Solution (SDK-boundary
      classification; factory reused; no runtime or contract change; no
      vendor forks; no finishReason look-ahead — Missed Questions 1-6 hold)
- [x] Typecheck/tests/lint pass with pasted tool output (receipt + suite
      outputs in this record; lint:md + prettier clean)
- [x] Production call-graph evidence is present (Law 4 greps: producer →
      consumer chain cited; no duplicate factory introduced)
- [x] FID status reflects the actual implementation state (`closed`
      2026-09-13 — commit `a6853358` verified in history)

### Loop 2 — Independent audit and self-correction

- **RED:** Implementation-time audit found two defects in the Loop 1 plan:
  (1) the typechecker rejected the first GREEN — the factory's return type
  is `… | null` (hostile-shape guard, `errors.ts:88`) and the raw yield
  violated `StreamChunk` (caught by typecheck sdk before any test run);
  (2) the Verification Gates section as authored violated the
  FID-2026-0823-009 grammar (template's fenced ```markdown block shape;
  parser requires bare `- gate:` lines with prose above the heading).
- **GREEN:** (1) null is handled fail-closed with an explicit throw
  (unreachable after the toolName normalization, but Law 14 refuses to
  trust the type); (2) gates reformatted to the allowlisted shape; receipt
  stamped.
- **AUDIT:** receipt 5/5 PASS (typecheck sdk/common/agent-runtime + both
  sdk test gates); cli typecheck exit 0 (×4 complete); runtime suites
  16/16; RED-first evidence captured (2 fail / 1 pass pre-fix, 9/9
  post-fix). Message factory remains single (`errors.ts` — grep count 2 =
  its two message variants). Valid-part behavior byte-identical
  (pass-through leg pinned in the new test). Receipt re-stamped on the
  final text (fingerprint-binding rule).
- **ADVERSARIAL:** "Does classifying at the SDK layer double-classify when
  our own flush gate also fires?" — No: the families are disjoint by
  construction (model-factories routes a model through EITHER our
  OpenAI-compatible transformer OR the vendor SDK); a single stream cannot
  produce both classifications for the same call. "Can `invalid` parts
  arrive with a valid `input` (double-emission)?" — `ai` core marks invalid
  ONLY in `parseToolCall`'s error path; a successfully parsed call never
  carries `invalid: true` at the pinned version; the pin test is the
  drift canary. Residual (documented, not silently absorbed): without a
  finish reason, an output-cap truncation on a vendor path gets generic
  retry guidance rather than the split-payload hint (Missed Question 4 —
  follow-up candidate if observed in practice).
- **CHANGE DELTA:** ~12% (evidence sections + two GREEN corrections;
  summary/approach unchanged — within the pass cap, oscillation none)

## Resolution

- **Closed Date:** 2026-09-13
- **Fix Description:** `promptAiSdkStream`'s `tool-call` branch classifies
  `invalid === true` vendor parts (truncated/malformed args AND unknown
  tool) through the single `normalizeNativeToolCallStreamError` factory
  with a fail-closed null guard; valid parts forward byte-identically.
  Implementation commit `a6853358`.
- **Tests Added:** `sdk/src/impl/__tests__/llm-invalid-vendor-tool-call.test.ts`
  — RED-first (2 fail / 1 pass pre-fix; 9/9 across the two sdk suites
  post-fix); runtime-integration suites 16/16 (part-f, strikes,
  experience-capture, steering).
- **Verification Evidence:** receipt 5/5 PASS (typecheck
  sdk/common/agent-runtime + both declared test gates; cli typecheck run
  separately = ×4). Re-verified 2026-09-13 on the committed tree:
  typecheck ×4 exit 0; `llm-invalid-vendor-tool-call` + free-mode suites
  15/0. Law 4 greps in the record (producer `stream.ts:299` → consumer
  `error-chunk.ts:64,96`; factory single at `errors.ts:88`).
- **Archived:** 2026-09-13 — moved to `dev/fids/archive/`, indexed in
  `dev/fids/archive/README.md`, CHANGELOG `Unreleased` entry updated from
  "closure pending commit" to CLOSED.

## Lessons Learned

Provider-family hardening must be re-audited per family at the moment a new
family is wired in (`model-factories.ts`), not assumed inherited from the
primary path. A fail-closed result is not the same as a classified one:
without the classification, the runtime's recovery and learning machinery is
invisible to exactly the failures it was built for. Add "which families reach
this gate?" to the audit checklist for every stream-layer gate.
