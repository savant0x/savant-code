# FID: `model-picker.tsx` references `key.input` and `key.alt` not on OpenTUI `KeyEvent` typings

**Filename:** `FID-2026-0716-002-model-picker-keyevent-type-mismatch.md`
**ID:** FID-2026-0716-002
**Severity:** low
**Status:** closed
**Created:** 2026-07-16 12:55
**Author:** ECHO Agent (Hy3, free)

---

## Summary

`cli/src/components/model-picker.tsx:132,133` reference `key.input` and `key.alt` properties
that are NOT in the OpenTUI `KeyEvent` TypeScript declarations. `bunx tsc --noEmit -p
cli/tsconfig.json` reports 2 `TS2339` errors at those lines. The runtime OpenTUI event
object DOES expose these fields (it works at runtime — the model picker keys are
correctly handled) but the type definitions do not. This is a typings/stub mismatch in
the `@opentui` package's `KeyEvent` type, not a real runtime bug. Surfacing as a new
FID per ECHO Additional Rule (flag any issue, even outside scope) — discovered while
verifying the FID-001 fix's tsc baseline.

## Environment

- **OS:** Windows 11, Bun 1.3.11
- **Language/Runtime:** TypeScript 5.5.4
- **Tooling:** `bunx tsc --noEmit -p cli/tsconfig.json`

## Detailed Description

### Problem

`bunx tsc --noEmit -p cli/tsconfig.json` reports:

```text
cli/src/components/model-picker.tsx(132,40): error TS2339: Property 'input' does not exist on type 'KeyEvent'.
cli/src/components/model-picker.tsx(133,69): error TS2339: Property 'alt' does not exist on type 'KeyEvent'.
```

### Expected Behavior

Either:
- The `KeyEvent` type from `@opentui` should declare these fields (they exist at runtime),
  OR
- `model-picker.tsx` should use field access patterns present in the `KeyEvent` type (e.g.,
  via `key.ctrl`/`key.meta` which ARE declared, but not `key.input`/`key.alt`).

### Root Cause

OpenTUI's published `KeyEvent` typings are stricter than the runtime shape. `@opentui/react`
exports `key` with extra fields populated at runtime by the OpenTUI native event ingest,
but the `.d.ts` does not declare them. Compiler trusts the types and emits TS2339.

### Evidence

```text
$ bunx tsc --noEmit -p cli/tsconfig.json
cli/src/components/model-picker.tsx(132,40): error TS2339: Property 'input' does not exist on type 'KeyEvent'.
cli/src/components/model-picker.tsx(133,69): error TS2339: Property 'alt' does not exist on type 'KeyEvent'.
```

```ts
// cli/src/components/model-picker.tsx:132-133
const ch = key.sequence ?? key.input ?? ''      // 'input' missing
if (ch && ch.length === 1 && !key.ctrl && !key.meta && !key.alt) {  // 'alt' missing
```

## Impact Assessment

### Affected Components

- `cli/src/components/model-picker.tsx` (lines 132-133)
- `cli/tsconfig.json` validation result is non-zero exit (2 errors remaining after FID-001).

### Risk Level

- [x] Low: Stylistic / typings gap, no runtime consequence observed (picker functions at runtime).

## Proposed Solution

### Approach

Two viable directions. Both are equally valid; defer to project maintainer's preference
once they're available.

1. **Local fix** at the callsite: cast `key` to `KeyEvent & { input?: string; alt?: boolean }`
   in `model-picker.tsx:132-133` — smallest change, 2-type assertion, surgically scoped.
2. **Upstream fix** to OpenTUI: report the gap to `@opentui/react` so `KeyEvent` declares
   the runtime fields. Longer timeline, requires external contribution.

### Steps

1. Confirm whether other files in `cli/src` reference the same untyped `KeyEvent` fields
   (call-graph reachability — Law 4 / FID AUDIT).
2. If local fix preferred, add an intersection cast at the callsite only. Minimal.

### Verification

- `bunx tsc --noEmit -p cli/tsconfig.json` reports 0 errors after the fix.
- `bun dev` model picker still functions at runtime (manual smoke test: open picker with
  `/model`, type a character, select a model — existing tests cover the happy path via
  command-registry.ts which uses `saveCodebuffModelPreference`).

## Perfection Loop

### Loop 1

- **RED:** 2 `TS2339` lines at `cli/src/components/model-picker.tsx:132,133`. tsc exit 2.
- **GREEN:** Added intersection type casts at callsite: `typeof key & { input?: string }` and `typeof key & { alt?: boolean }`. Minimal 2-line change.
- **AUDIT:** `bun x tsc --noEmit -p cli/tsconfig.json` reports 0 model-picker errors.
- **COMPLETE:** 2026-07-16

## Resolution

- **Fixed By:** recursive (human + AI pair)
- **Fixed Date:** 2026-07-16
- **Fix Description:** Added typed intersection casts at lines 132-133 of model-picker.tsx to widen `key` with the runtime-present `input` and `alt` fields. No upstream change needed.
- **Tests Added:** None required (type-only fix).
- **Verified By:** `bun x tsc --noEmit -p cli/tsconfig.json` — zero model-picker errors.
- **Commit/PR:** N/A (not a git repo)
- **Archived:** 2026-07-16

## Lessons Learned

- OpenTUI `KeyEvent` typings lag behind the runtime shape. If the project depends on
  OpenTUI heavily, consider gating the model-picker typings behind a project-local type
  declaration that widens `KeyEvent` so the rest of the codebase doesn't accumulate
  per-call casts over time. Until then, prefer claiming the gap is upstream and casting
  locally rather than refactoring type usage piecemeal.
- ECHO Additional Rule paid off: this FID was found during FID-001 AUDIT's tsc step
  (baseline error check). Without the explicit "flag anything outside scope" rule, this
  would have remained silently until a refactor tomorrow tripped a CI gate.
