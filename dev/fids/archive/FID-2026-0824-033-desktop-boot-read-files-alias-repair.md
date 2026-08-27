# FID: Desktop Boot Delay — read_files `{path}` Alias Repair

**Filename:** `FID-2026-0824-033-desktop-boot-read-files-alias-repair.md`
**ID:** FID-2026-0824-033
**Severity:** high
**Status:** fixed
**Created:** 2026-08-24 23:56
**Author:** Orchestrator (hybrid direct write; operator boot-log report)
**YAGNI-Compliance:** Verified

---

## Summary

Every desktop session boot burned multiple failed tool round-trips before the
first response: models keep calling `read_files`/`read_subtree` with
`{ path: "..." }` while the canonical shape is `{ paths: [...] }`. Each
rejection cost a full round-trip, and the failures clustered on exactly the
files the ECHO boot contract must read first (ECHO.md, ARCHITECTURE.md,
LEARNINGS, dev/fids) — producing the operator's massive first-message delay.
Operator paste (2026-08-24): six-plus `Invalid parameters ... expected array,
received undefined` lines in a single boot.

## Root Cause

Sibling-tool habit collision: `str_replace`, `write_file`, `list_directory`
all genuinely take a singular `path`, so the singular form is sticky across
providers/models. The existing repair layer (`tool-call-repair.ts`) handled
string-encoded inputs only — valid JSON objects with the wrong key fell
straight to schema rejection.

## Fix

`packages/agent-runtime/src/tools/tool-call-repair.ts`: new `aliasRepairs`
map normalizes shapes BEFORE schema validation — `read_files`/`read_subtree`
unwrap `{ path: "x" }` into `{ paths: ["x"] }` (never touching a real
`paths` field or extra keys). Patterns are exported and THROW loudly when
they match nothing (silent dead syncs are impossible); fixture-pinned tests
cover normalization, pass-through, list_directory non-targeting,
double-encoded inputs, and dependency-pin safety in Cargo-style bodies.

## Verification Gates

- gate: test packages/agent-runtime/src/tools/__tests__/tool-call-repair.test.ts

### Verification Receipt

- fingerprint: sha256:0db4db1691753942d2170093ba416cb9406da6a287ebd4e6e8843d805d9401d7
- verified: 2026-08-25T03:58:31.416Z
- test packages/agent-runtime/src/tools/__tests__/tool-call-repair.test.ts: exit 0

## Perfection Loop

### Loop 1

- **RED:** Operator paste = N failed read_files calls per boot, all
  `{path}`-shaped; repair layer covered string-encoding only (disk-verified).
- **GREEN:** IMPLEMENTED (2026-08-24 ~23:45 EDT): aliasRepairs +
  unwrapSingularPath in parseStringifiedToolInput; five-case regression
  suite. Gates: prettier/eslint clean · agent-runtime typecheck exit 0 ·
  suite 1313 pass with ONE pre-existing unrelated timeout (teacher corpus
  repeatability gate, load-sensitive ~5s flake, subsystem untouched by this
  change — flagged for its own investigation).
- **BOUNDARY:** the corpus repeatability timeout predates this change and
  needs separate diagnosis; title-bar branding verification rides next
  launch (PowerShell MainWindowTitle probe).

## Lessons Learned

When sibling tools disagree about a key name, models will blend them. Repair
layers should normalize KNOWN aliases before validation — one round-trip
saved per boot read compounds into the perceived startup speed of the whole
product.