# FID-2026-0805-007 — SDK Declaration Bundle Symbol Integrity

**Filename:** `FID-2026-0805-007-sdk-declaration-bundle-symbol.md`  
**ID:** `FID-2026-0805-007`  
**Author:** Savant  
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)

## Problem

`cd sdk && bun run build` failed during declaration bundling with:

```text
TypeScript declaration bundling failed: undefined is not an object (evaluating 'symbol.declarations')
```

The failure occurred after the ESM/CJS bundles were produced, inside
`dts-bundle-generator` 9.5.1's type-usage evaluator. Instrumentation identified the
first dangling symbol as:

```text
childProcessToPromise
sdk/src/run-state.d.ts: export { childProcessToPromise } from './run-state/child-process'
```

The source export chain intentionally exposes the helper through `run-state.ts` and
therefore through the SDK entrypoint. Its implementation, however, carried the
`@internal` JSDoc tag while `sdk/tsconfig.build.json` enabled `stripInternal: true`.
TypeScript stripped the implementation declaration from the generated declaration graph
but retained the barrel re-export. The bundler then dereferenced the missing symbol's
`declarations` property.

The same declaration-shape problem existed for the other intentionally re-exported
helpers marked `@internal`:

- `buildFileTree`
- `selectHighestPriorityKnowledgeFile`
- `selectKnowledgeFilePaths`
- `loadUserKnowledgeFiles`

## Decision

Remove only the misleading `@internal Exported for testing` markers from those
intentionally exported helper declarations. Keep `stripInternal: true` enabled so
unrelated internal declarations remain excluded from the published bundle.

Do not upgrade or patch `dts-bundle-generator`; do not disable `stripInternal`; and do
not alter runtime behavior or public export names.

## Implementation

- `sdk/src/run-state/child-process.ts` — remove the internal-only marker.
- `sdk/src/run-state/file-tree.ts` — remove the internal-only marker.
- `sdk/src/run-state/knowledge-files.ts` — remove internal-only markers from its
  exported helpers.

No function signatures, implementations, barrel exports, or runtime code change.

## Verification contract

- SDK declaration bundle succeeds and writes `dist/index.d.ts`.
- SDK build succeeds, including ESM/CJS output and copied assets.
- SDK typecheck and unit tests pass.
- SDK dist verification/smoke checks pass where available.
- Changed TypeScript files pass ESLint and Prettier.
- Full-repo markdown validation passes for this FID and closeout record.
- Independent review confirms the fix is minimal and does not broaden declarations
  unnecessarily.

## Evidence

Initial reproduction: SDK ESM/CJS build completed, then declaration bundling exited 1
with the `symbol.declarations` error. A temporary config with only `stripInternal: false`
made the exact bundle succeed, confirming the declaration-stripping mechanism, but was
rejected as the implementation because it would expose all internal declarations.

## Final verification

- `cd sdk && bun run build` — exit 0; ESM, CJS, and bundled declarations created.
- `cd sdk && bun run typecheck` — exit 0.
- `cd sdk && bun test src` — 438 passed, 1 skipped, 0 failed.
- `cd sdk && bun run verify --skip-build` — all 20 verification checks passed, including
  CJS/ESM compatibility, Node dist smoke tests, ripgrep bundling, and tree-sitter query
  loading.
- Changed TypeScript files — ESLint exit 0 and Prettier clean.
- This FID — markdownlint exit 0.
- Independent review — minimal fix accepted; the review-requested declaration-surface
  verification confirmed the intentionally exported helpers are present in the successful
  bundle.

The FID is closed and archived after this evidence was recorded.
