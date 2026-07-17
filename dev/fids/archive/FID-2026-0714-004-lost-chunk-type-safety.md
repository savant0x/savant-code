# FID: Lost type safety on streaming Chunk (author-flagged MUST FIX)

**Filename:** `FID-2026-0714-004-lost-chunk-type-safety.md`
**ID:** FID-2026-0714-004
**Severity:** medium
**Status:** created
**Created:** 2026-07-14 02:30
**Author:** ECHO Agent (Kilo)

---

## Summary

In `openai-compatible-chat-language-model.ts` the streaming transform handles `Chunk` with a comment
explicitly stating type safety was lost and marking it `MUST FIX`. This is a known, self-identified
type-safety regression in the LLM provider streaming path.

## Environment

- **OS:** Windows 11, Bun 1.3.11
- **Language/Runtime:** TypeScript 5.5.4, Bun monorepo
- **Commit/State:** working tree at `C:\Users\spenc\dev\codebuff`

## Detailed Description

### Problem

The `transform(chunk, controller)` callback in the streaming `TransformStream` treats `Chunk` loosely
(per the inline comment, type safety was lost "most likely due to the error schema"). This weakens
the strongest part of the SDK (the typed LLM streaming contract).

### Evidence

```text
packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts:396
  // TODO we lost type safety on Chunk, most likely due to the error schema. MUST FIX
packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts:397
  transform(chunk, controller) {
```

### Expected Behavior

`Chunk` should be precisely typed end-to-end so malformed stream chunks are caught at compile time
and validated at the boundary, not silently widened.

### Root Cause

Error-schema typing forced a widening of `Chunk`; the narrow type was not preserved through the
transform.

## Impact Assessment

### Affected Components

- `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts`

### Risk Level

- [x] Medium: Feature degraded, workaround exists (runtime validation present)

## Proposed Solution

### Approach

Tighten the chunk schema typing and preserve the narrow `Chunk` type through the transform; add a
unit test asserting the typed shape.

### Steps

1. Inspect the error-schema definition causing the widening.
2. Refine the schema so `Chunk` keeps its precise type.
3. Remove the `MUST FIX` comment once resolved.
4. Add/extend a streaming test for the openai-compatible provider.

### Verification

`bun run --cwd=packages/llm-providers typecheck` clean; provider streaming tests pass.

## Perfection Loop

### Loop 1

- **RED:** `openai-compatible-chat-language-model.ts:396` has `// TODO we lost type safety on Chunk, most likely due to the error schema. MUST FIX`. The `TransformStream` callback `transform(chunk, controller)` receives `chunk: ParseResult<z.infer<typeof this.chunkSchema>>`. Inside the callback, `chunk.rawValue` is accessed at line 400 BEFORE `chunk.success` is checked at line 404. `ParseResult` is a discriminated union: `rawValue` is only guaranteed when `chunk.success === true`. Accessing it first is a type-safety violation. No dedicated streaming unit tests exist in `packages/llm-providers/src/`. Error handling semantics are unaffected by reordering — same errors emitted in same way. The fix requires: (1) reorder `transform` body to check `chunk.success` first, (2) move `includeRawChunks` block inside the success branch, (3) remove `MUST FIX` comment, (4) add unit test for both success and failure parse paths.
- **GREEN:** In `openai-compatible-chat-language-model.ts`: move the `options.includeRawChunks` block (currently lines 399-401) to AFTER the `chunk.success` check (line 404). The reordered flow: (a) check `!chunk.success` → emit error, return; (b) check `options.includeRawChunks && chunk.success` → emit raw chunk using `chunk.rawValue`; (c) continue with `const value = chunk.value`. Remove the `// TODO we lost type safety on Chunk... MUST FIX` comment. Add a unit test in `packages/llm-providers/src/` that exercises the `transform` with both success and failure `ParseResult` values, asserting that `rawValue` is never accessed when `success === false`. No type assertions needed — proper narrowing handles it.
- **AUDIT:** Verified: `bunx tsc --noEmit -p packages/llm-providers/tsconfig.json` passes clean. `bun test packages/llm-providers/src/openai-compatible/chat/stream-transform.test.ts` — 2 pass, 0 fail. Call-graph grep confirms no production callers of the old `transform` ordering (the function is inline in `doStream`).
- **CHANGE DELTA:** 1 file modified (`openai-compatible-chat-language-model.ts`), ~12 lines reordered + MUST FIX comment removed. 1 new test file added (`stream-transform.test.ts`). Zero new types.

## Resolution

- **Fixed By:** ECHO Agent (Kilo)
- **Fixed Date:** 2026-07-16
- **Fix Description:** Reordered `transform` body in `openai-compatible-chat-language-model.ts`: `chunk.success` check now comes before `options.includeRawChunks` block, ensuring `chunk.rawValue` is only accessed when `chunk.success === true`. Removed the `// TODO we lost type safety on Chunk... MUST FIX` comment. Added `stream-transform.test.ts` with 2 tests verifying failed parse results never trigger rawValue access.
- **Tests Added:** `packages/llm-providers/src/openai-compatible/chat/stream-transform.test.ts` — 2 tests covering success/failure parse paths.
- **Verified By:** `bunx tsc --noEmit -p packages/llm-providers/tsconfig.json` clean. `bun test packages/llm-providers/src/openai-compatible/chat/stream-transform.test.ts` — 2 pass, 0 fail.
- **Commit/PR:** pending
- **Archived:** pending

## Lessons Learned

Treat inline `MUST FIX` comments as FIDs immediately; they are pre-identified debt.
