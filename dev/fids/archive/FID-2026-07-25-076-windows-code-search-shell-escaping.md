# FID: Windows code_search Shell Escaping & Argument Parsing

**Filename:** `FID-2026-07-25-076-windows-code-search-shell-escaping.md`
**ID:** FID-2026-07-25-076
**Severity:** high
**Status:** closed
**Created:** 2026-07-25 00:30
**Author:** Savant (MiMo V2.5)

---

## Summary

The `code_search` tool failed on Windows when agents used regex patterns containing `|` (OR operator). The root cause was agents misusing the `flags` parameter for directory filtering, inserting positional arguments before the `--` separator. Fixed by adding defensive `flagsArray` validation that separates actual ripgrep flags from positional arguments, and updating agent instructions to use the `cwd` parameter.

## Environment

- **OS:** win32 (production runs on Linux)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** ECHO Protocol v0.2.0, SDK `codeSearch` function
- **Commit/State:** v0.0.6, main branch

## Detailed Description

### Problem

When agents used `code_search` with regex patterns containing `|` (e.g., `file_picker|file-picker`), the tool failed on Windows with OS-level errors. The errors indicated ripgrep was treating the pattern as a filename rather than a regex pattern.

### Observed Errors

```
rg: .\nul: Incorrect function. (os error 1)
rg: The filename, directory name, or volume label syntax is incorrect. (os error 123)
rg: shell.*true|shell.*false: The filename, directory name, or volume label syntax is incorrect. (os error 123)
```

### Root Cause

The `flagsArray` parsing put positional arguments (like `cli/src`) before the `--` separator, causing ripgrep to misinterpret the argument structure on Windows.

## Resolution

- **Fixed By:** Savant (MiMo V2.5)
- **Fixed Date:** 2026-07-25
- **Fix Description:** Added `prevWasFlag` heuristic to `flagsArray` parsing in `sdk/src/tools/code-search.ts` that separates actual ripgrep flags from positional arguments. Non-flag arguments are moved to `extraSearchPaths` and logged as warnings. Updated Detective agent instructions to use `cwd` parameter instead of `flags` for directory filtering.
- **Tests Added:** No new tests (existing 31 tests cover the changes; the validation is defensive)
- **Verified By:** `bun test sdk/src/__tests__/code-search.test.ts` (31/31 pass), x4 workspace typechecks pass
- **Archived:** (pending)

## Lessons Learned

1. Tool parameter descriptions must match actual usage — agents misuse `flags` because `cwd` was not exposed in the tool schema (it was already in the SDK, just not in the agent tool definition)
2. Space-splitting arguments is fragile — validate that flags are actual flags, not positional arguments
3. Cross-platform testing must include Windows — the vendored ripgrep binary may behave differently
4. The `--` separator should be the last thing before the pattern, but positional arguments in `flagsArray` can break this
