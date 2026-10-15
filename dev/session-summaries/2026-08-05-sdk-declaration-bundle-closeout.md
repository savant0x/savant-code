# SDK Declaration Bundle Closeout — 2026-08-05

**FID:** FID-2026-0805-007  
**Author:** Savant  
**Status:** Closed and archived

## Finding

The SDK build's declaration phase failed with `undefined is not an object (evaluating
'symbol.declarations')` after ESM/CJS bundling completed. Instrumentation localized the
first missing symbol to the `childProcessToPromise` re-export in `sdk/src/run-state.d.ts`.

The implementation and several other helpers were publicly re-exported but marked
`@internal`. With `stripInternal: true`, TypeScript stripped their implementation
declarations while retaining barrel re-exports. `dts-bundle-generator` 9.5.1 then
encountered a dangling symbol and dereferenced `symbol.declarations`.

## Fix

Removed only the misleading `@internal Exported for testing` markers from the
intentionally exported helpers in:

- `sdk/src/run-state/child-process.ts`
- `sdk/src/run-state/file-tree.ts`
- `sdk/src/run-state/knowledge-files.ts`

`stripInternal` remains enabled. No runtime implementation, function signature, export
name, or dependency changed. A temporary `stripInternal: false` experiment confirmed the
mechanism but was not adopted because it would broaden the declaration surface.

## Verification

- SDK build: **exit 0**; ESM, CJS, and bundled declaration artifacts created.
- SDK typecheck: **exit 0**.
- SDK unit suite: **438 passed, 1 skipped, 0 failed**.
- SDK dist verification with `bun run verify --skip-build`: **all 20 checks passed**,
  including Node CJS smoke, CJS/ESM compatibility, ripgrep bundling, and tree-sitter
  query loading.
- ESLint on changed TypeScript: **exit 0**.
- Prettier on changed TypeScript and FID: **clean**.
- Markdownlint on FID: **0 issues**.
- Independent review: accepted the fix as minimal and requested confirmation that the
  intentionally exported helpers remained in the generated declarations; the successful
  bundle contains `childProcessToPromise`, `buildFileTree`,
  `selectHighestPriorityKnowledgeFile`, and `loadUserKnowledgeFiles`.

FID-2026-0805-007 is closed and archived.
