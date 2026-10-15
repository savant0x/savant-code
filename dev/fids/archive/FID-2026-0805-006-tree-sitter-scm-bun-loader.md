<!-- markdownlint-disable MD013 -->

# FID: Tree-Sitter Query Imports Need a Bun Text Loader

**Filename:** `FID-2026-0805-006-tree-sitter-scm-bun-loader.md`
**ID:** FID-2026-0805-006
**Severity:** medium
**Status:** closed
**Created:** 2026-08-05
**Author:** Savant

---

## Summary

The isolated CLI test command failed before executing tests because Bun 1.3.11 transpiled
`packages/code-map/src/tree-sitter-queries/tree-sitter-c_sharp-tags.scm` as JavaScript. The failure was
specific to the CLI test bundle and was triggered through the production import chain
`block-operations → message-block-helpers → savant-code-client → @savant-code/sdk → @savant-code/code-map`.
The CLI Bun configuration now explicitly loads `.scm` files as raw text with the singular `[loader]` block.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript, Bun 1.3.11 (repository pin is Bun 1.3.14)
- **Tool Versions:** `web-tree-sitter` 0.25.10; Prettier 3.9.5
- **Commit/State:** `main`, uncommitted working tree; unrelated hardening/deconstruction changes pre-existed this FID

## Detailed Description

### Problem

From the `cli/` workspace, this isolated command failed at module evaluation:

```text
$ cd cli && bun test src/utils/__tests__/send-message-helpers.test.ts
# Unhandled error between tests
error: Expected ")" but found "name"
    at C:\Users\spenc\dev\savant-code\packages\code-map\src\tree-sitter-queries\tree-sitter-c_sharp-tags.scm:2:2
0 pass
1 fail
1 error
Ran 1 test across 1 file.
```

The same test from the repository root passed, and code-map's own language tests passed. This difference made the
failure appear intermittent, but the actual error was deterministic for the CLI workspace's Bun test bundle.

### Expected Behavior

Tree-sitter `.scm` query files must be imported as text and must not be parsed as JavaScript. The isolated CLI
unit test should execute all tests successfully.

### Root Cause

`packages/code-map/src/languages.ts` statically imports nine `.scm` query files. `packages/code-map/src/index.ts`
re-exports `languages.ts`; `sdk/src/index.ts` re-exports code-map; and the CLI's `savant-code-client.ts` statically
imports the SDK. Bun's unknown-extension handling can emit an asset/path in supported bundle contexts, but without an
explicit loader the CLI test bundler attempted to parse the C# query source as JavaScript. The syntax error points
at the valid query predicate `name: (identifier) @identifier`, which is not JavaScript.

The existing `languages.ts` fallback already handles Bun's path-string behavior by reading an absolute imported path
with `fs.readFileSync`; mapping `.scm` to `text` is compatible with that code because it also accepts query content.

## Impact Assessment

### Affected Components

- `cli/bunfig.toml` — Bun test/build loader configuration
- `packages/code-map/src/languages.ts` — static query imports and query construction
- `sdk/src/index.ts` — code-map re-export surface
- CLI utility test isolation — especially `send-message-helpers.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Affected isolated CLI test command could not load its module graph
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor, cosmetic, or edge case

## Proposed Solution

### Approach

Add the smallest workspace-scoped Bun configuration needed to classify tree-sitter query files as raw text:

```toml
[loader]
".scm" = "text"
```

The loader belongs in `cli/bunfig.toml` because the failure reproduces in the CLI workspace. Root and SDK
configurations were not changed: the root-cwd regression test and SDK suite already pass, and widening the scope
would add configuration churn without a reproduced defect.

### Steps

1. Add the singular Bun `[loader]` block to `cli/bunfig.toml`.
2. Run the formerly failing isolated CLI test from the `cli/` directory.
3. Run the full CLI utility suite, code-map suite, affected typechecks, and SDK/root smoke tests.
4. Record the unrelated SDK declaration-bundling failure separately rather than attributing it to this change.

### Verification

- Isolated `send-message-helpers.test.ts`: 110 pass / 0 fail.
- Full CLI utility suite: 1,284 tests / 0 fail / 7 skipped.
- Code-map full suite: 51 pass / 0 fail.
- CLI typecheck: exit 0.
- Code-map typecheck: exit 0.
- SDK typecheck: exit 0; SDK suite: 438 pass / 1 skipped.
- Root-cwd regression: 110 pass / 0 fail.
- Full repo ESLint and Prettier do not parse TOML; their attempted checks reported “no matching configuration” and
  “No parser could be inferred,” respectively. These are tooling limitations, not source failures.
- SDK build remains blocked by the pre-existing declaration-bundling error (`symbol.declarations` undefined), and
  the CLI package has no `build` script. This is unrelated to the `.scm` loader and is documented in existing release
  history.

## Perfection Loop

### Loop 1

- **RED:** Reproduced the CLI isolation failure and traced the static import chain to `languages.ts` and its `.scm`
  imports. Initial hypotheses (CRLF, preload, `NODE_ENV`, root config, and Bun cache) were tested and rejected.
- **GREEN:** Corrected the initial config attempt from invalid `[loaders]` to Bun's supported singular `[loader]` block
  with `".scm" = "text"`; no production TypeScript API changed.
- **AUDIT:** Static audit: CLI and code-map typechecks exit 0; the changed file contains only the intended loader
  mapping; root and SDK import surfaces remain unchanged. Runtime audit: isolated test, full CLI utility suite,
  code-map suite, SDK suite, and root-cwd regression all pass at the counts listed above.
- **CHANGE DELTA:** One six-line workspace configuration addition; no runtime source changes.

### Missed Questions

1. **Was the first `[loaders]` experiment valid?** → No. Bun uses singular `[loader]`; the invalid plural section was
   reverted before final verification.
2. **Could the failure be caused by the probe rather than the application?** → The first custom probe omitted
   `expect`; it was discarded. The original 110-test failure independently reproduced the `.scm` parser error.
3. **Should root and SDK Bun configs also change?** → No. Neither context reproduced the defect, and the smallest
   robust fix is scoped to the failing CLI workspace.
4. **Does loading `.scm` as text break code-map's path fallback?** → No. `createLanguageConfig` accepts either imported
   content or an absolute path and only reads the latter from disk.
5. **Did the SDK build failure come from this change?** → No. The SDK build failed in its existing declaration
   bundling step after SDK typecheck and tests passed; this FID changed only `cli/bunfig.toml`.

### Code Verification Evidence

- [x] `cli/bunfig.toml` exists and contains the singular `[loader]` mapping.
- [x] `packages/code-map/src/languages.ts` still accepts text content and absolute query paths.
- [x] CLI typecheck exit 0.
- [x] Code-map typecheck exit 0.
- [x] Isolated CLI test and full affected suites pass.
- [x] FID status reflects the verified implementation.

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-05
- **Fix Description:** Added `[loader] ".scm" = "text"` to `cli/bunfig.toml`, preventing Bun's CLI test bundle
  from parsing tree-sitter query files as JavaScript.
- **Tests Added:** No production test needed; the existing isolated regression command is now green. Temporary probes
  used during diagnosis were removed.
- **Verified By:** Static typechecks plus independent runtime suites and code review.
- **Commit/PR:** Working tree on `main`; no commit requested.
- **Archived:** 2026-08-05 after verification and changelog/session evidence.

## Lessons Learned

1. Unknown asset extensions must be configured at the workspace that bundles them; passing tests from a repository root
   does not prove an isolated workspace command uses the same Bun loader context.
2. Bun configuration keys are exact: `[loader]` is singular.
3. A pre-existing failure should be diagnosed and linked to its corrective FID rather than left as an unexplained test
   exception in a completed refactor record.
