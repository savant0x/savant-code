# FID-017 Loop 8 — the provider-side rejection, steered by cause — 2026-10-15 0608 UTC

## Authority and starting state

Single-agent ECHO v0.1.2 (strict mode), automation level 3. Work confined to
`FID-2026-1012-017`'s register target in `SCOPE.md`. The record, its master
(`FID-2026-1012-022`), `-021`, `-023`, `-024`, the two design documents it cites and every file
edited here were read before the first write. No push, no release, no register edit.

## 1. RED — the class is silent, and the rejection half had no cause of its own

Re-measured with the program's own instrument against the capture at HEAD:

- **zero** `Incomplete arguments for tool` rows after Loop 6's commit (`232f0022`,
  2026-10-13T19:19:51Z), and for 15 of the lane's 19 owned keys nothing since the Loop 3/4 fixes
  either. Silence, and the record's own Boundaries say silence is not evidence — so no class claim is
  made and the loop works the half Loop 5 actually measured.
- the 20 post-fix rows: every one `errorClass: native-incomplete`, `finishReason: 'tool-calls'`,
  **no** `argumentsTruncated` marker, carrying the SDK's rejection body verbatim —
  *"the provider rejected the call's arguments and nothing observed indicates truncation. Correct the
  argument values…"*, ending *"…divide the work across calls instead of sending the same payload
  again. One tool call's arguments may occupy at most 16384 characters…"*.

The defect is what the runtime appended to that body. `handleStreamErrorChunk` steered **every**
`native-incomplete` call with the tool's *size* ladder, unconditionally: at strike 1 the conditional
hints, at strikes 2+ the flat claim *"Your read_files arguments were rejected because the file list is
too large"*. That is advice about a cut nobody observed, appended to a message that says the opposite —
and in the measured burst it is the lever the model pulled again: told to shrink a payload that had
already arrived, it re-emitted the same call.

RED pinned first, against the pre-change code:

```text
(fail) (k) steers the rejection by cause instead of asserting a size problem
Expected to not contain: "read fewer files at a time"
Received: "…Error during tool call: Incomplete arguments for tool read_files: the provider rejected
the call's arguments and nothing observed indicates truncation. Correct the argument values … Please
check the tool name and arguments and try again. If reading many files, read fewer files at a time."
(fail) (m) steers an unmapped tool by cause, not with the generic size fallback
Expected to not contain: "split the work into multiple smaller"
Received: "…and try again. If the tool call arguments are large, split the work into multiple smaller
tool calls."
```

## 2. GREEN — one discriminator at both ends of the seam

- `packages/agent-runtime/src/tools/stream-parser/error-chunk.ts` selects the appended steering from
  the cause the chunk carries, using the **same** discriminator the SDK's message uses (Law 13):
  truncation evidence (`argumentsTruncated`, or `finishReason: 'length'`) ⇒ the existing per-tool size
  ladder; an **observed rejection** — the classifier read the schema failure, or the provider reported
  a completed response (`stop` / `tool-calls`, which excludes a mid-argument cut) ⇒
  `NATIVE_TOOL_CALL_REJECTION_STEERING`. An unknown cause (no marker, no finish reason) keeps today's
  ladder, fail-closed: the change narrows advice, it never widens a claim.
- `packages/agent-runtime/src/run-agent-step/constants.ts` carries the new wording, documented against
  the measured rows, and the size ladder's own doc now states which cause selects it.
- `common/src/types/contracts/llm.ts` + `sdk/src/impl/llm/errors.ts`: `StreamErrorChunk`'s
  `native-incomplete` variant gained the optional `schemaIssue`, populated under the same exclusivity
  that governs the message clause — so the vendor path, which has no finish reason to offer, is
  selected correctly too.

## 3. Evidence

```text
packages/agent-runtime  bun test src/tools/stream-parser/__tests__/   19 pass / 0 fail
  error-chunk-rejection-steering.test.ts   4 pass  (k, l, m, n — the measured shape, the output-cap
                                                   control, the schema-failure shape, the unmapped tool)
  error-chunk-steering.test.ts            10 pass  (unchanged)
  native-failure-deduper.test.ts           5 pass  (unchanged)
sdk                     bun test src/impl/__tests__/llm-native-tool-call{,-schema-issue}.test.ts
                                         20 pass / 0 fail
bun run --cwd=common typecheck           exit 0
bun run --cwd=sdk typecheck              exit 0
bun run --cwd=packages/agent-runtime     exit 0
bun run quality:report                   PASS (1,502 baselined files)
bun x eslint <changed> --max-warnings 0  exit 0
bun x prettier --check <changed>         exit 0
```

Two ceilings this change first breached were repaired by **extraction, not suppression** — the same
discipline Loop 3 applied to `stream.ts`/`tool-call.ts`: the new pins moved into their own suite
(`error-chunk-steering.test.ts` 423 → 274 lines) and `common/src/types/contracts/llm.ts`'s duplicated
per-field docs were collapsed to point at `NativeToolCallError` (303 → 297).

## 4. Boundaries — stated, not implied

- **The refusal cannot be prevented locally.** It is the provider refusing the arguments; the lane
  established that in Loop 5. What Loop 8 removes is the false diagnosis that made the retry re-send the
  same call. **No class stopped, so `dev/experiences/fix-boundaries.json` stays empty** and every owned
  key still reports `unresolved`.
- **The strike 2+ escalation stays size-worded.** `native-strikes.ts` receives only the tool name; the
  cause would have to reach it through `packages/agent-runtime/src/tools/stream-parser.ts`, and this
  record's register target — `packages/agent-runtime/src/tools/stream-parser/**` — is a **directory**
  glob that does not cover that sibling file (the register's matcher anchors `**` after the separator:
  `^packages/agent-runtime/src/tools/stream-parser/.*$`). The register was not edited to widen a surface
  mid-record. Strike 1 is fixed; the escalation path needs either a register target covering that file
  or the cause carried in the step result.
- **Coverage boundary.** The producer (SDK carries `schemaIssue` / `argumentsTruncated`) and the consumer
  (runtime selects the steering) are pinned from both sides against the shared `common` contract; the
  producer's own site, `packages/llm-providers/.../flush-handler.ts`, is outside this record's write
  surface and was not touched, so it still emits a bare rejection with no evidence of its own — which is
  why the runtime must read the provider's completion signal instead.

## 5. Commits

One commit for the loop; no push.
