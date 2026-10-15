# Tree-Sitter `.scm` Loader Closeout — FID-2026-0805-006

**Author:** Savant
**Date:** 2026-08-05
**FID:** FID-2026-0805-006

## Finding

The isolated CLI command
`cd cli && bun test src/utils/__tests__/send-message-helpers.test.ts`
failed during module evaluation because Bun parsed
`packages/code-map/src/tree-sitter-queries/tree-sitter-c_sharp-tags.scm`
as JavaScript. The failure came through the static CLI → SDK → code-map
import graph; it was not caused by the Phase 10 module extraction.

## Fix

Added the workspace-scoped Bun loader declaration to `cli/bunfig.toml`:

```toml
[loader]
".scm" = "text"
```

The initial plural `[loaders]` experiment was invalid and was reverted.
Root and SDK bunfigs were intentionally unchanged because those contexts did
not reproduce the defect.

## Verification

- Isolated CLI regression: **110 pass / 0 fail**.
- Full CLI utility suite: **1,284 tests / 0 fail / 7 skipped**.
- Code-map suite: **51 pass / 0 fail**.
- CLI typecheck: **exit 0**.
- Code-map typecheck: **exit 0**.
- SDK typecheck: **exit 0**; SDK suite: **438 pass / 1 skipped**.
- Root-cwd regression: **110 pass / 0 fail**.
- Independent code review: loader is the smallest correct scoped fix.

The SDK build still reports its pre-existing declaration-bundling failure
(`symbol.declarations` undefined). That failure is unrelated to this
configuration fix and remains documented in release history.

## Closeout

FID-2026-0805-006 was verified and archived. The Phase 10 FID's stale
“pre-existing isolation failure” wording was corrected to reference this
resolution.
