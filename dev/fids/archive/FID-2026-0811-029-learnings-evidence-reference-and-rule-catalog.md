<!-- markdownlint-disable MD013 -->

# FID: LEARNINGS Evidence References and Canonical Rule Catalog

**Filename:** `FID-2026-0811-029-learnings-evidence-reference-and-rule-catalog.md`
**ID:** FID-2026-0811-029
**Severity:** medium
**Status:** closed
**Created:** 2026-08-11 18:00
**YAGNI-Compliance:** Pending
**Master FID:** `FID-2026-0811-028`
**Depends On:** `FID-2026-0811-024`

---

## Summary

The lessons contain many point-in-time line references and repeated normative rules. Line numbers drift, while duplicated rules can contradict one another. This FID establishes stable evidence references and a compact canonical rule catalog so lessons point to executable symbols, commands, tests, or documents rather than relying on fragile line numbers alone.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** TypeScript/Bun monorepo; Bun `1.3.14`
- **Commit/State:** Dirty working tree
- **Governing contract:** ECHO Laws 4, 7, 9, 10; `dev/LEARNINGS.md`, `scripts/validation-manifest.ts`

## Detailed Description

### Problem

Lessons cite exact lines such as `scripts/public-release.ts:159` and `cli/scripts/build-binary.ts:52-61`. These are useful snapshots but become stale after edits. FID archival and release rules are repeated across lessons instead of pointing to one canonical executable/documented rule.

### Expected Behavior

Evidence references identify a path plus a stable symbol, command, test, heading, or generated manifest field. Line numbers may remain as snapshots but are never the only locator. Repeated normative rules link to one canonical rule catalog or executable validator.

### Root Cause

The project’s evidence discipline grew around line citations, while no stable reference syntax or canonical lesson rule index was defined.

### Evidence

- Multiple `dev/LEARNINGS.md` entries use path-and-line citations.
- FID closure rules recur in the July 25, August 7, and later entries.
- `scripts/validation-manifest.ts` already provides a stable command inventory pattern.

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md`
- Learning schema/validator
- FID/release canonical rule references
- Audit evidence output

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: evidence and rules can drift without detection
- [ ] Low

## Proposed Solution

### Approach

Define a stable reference form such as `path → symbol`, `path → heading`, `command → test`, or `manifest → field`, and permit line ranges only as supplemental snapshots. Create a canonical rule catalog for recurring FID lifecycle and release evidence rules, linking to the actual validator or protocol source. Add validation that references resolve and canonical targets are unique.

### Steps

1. Inventory repeated rules and fragile line-only references.
2. Define reference grammar and resolution behavior.
3. Create the minimal canonical rule catalog or reuse an existing authoritative source.
4. Update new/changed lessons and validate reference resolution.
5. Add tests for missing symbols, ambiguous targets, stale line-only references, and duplicate canonical rules.

### Verification

Every new structured lesson reference must resolve to a current path/symbol/command/test. Historical line-only citations may remain explicitly legacy. Canonical rules must have one authoritative target.

## Perfection Loop

### Loop 1 — RED

- **RED:** Point-in-time line citations and repeated rules are fragile.
- **GREEN:** Add stable reference grammar and one canonical rule catalog.
- **AUDIT:** Existing lesson examples and validation-manifest conventions support the approach.
- **ADVERSARIAL:** Do not build a heavyweight documentation database or require historical prose to be rewritten wholesale.
- **CHANGE DELTA:** Planning only.

### Loop 2 — Independent audit and self-correction

- **RED:** Symbol names can also change, and generated code can make references ambiguous.
- **GREEN:** Support path + symbol/heading/command/test with explicit generated-artifact provenance and ambiguity errors.
- **AUDIT:** Fixtures cover valid, missing, ambiguous, generated, and legacy references.
- **ADVERSARIAL:** A resolver that returns the first fuzzy match is not evidence; ambiguity must fail closed.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final convergence

- **RED:** Canonicalization could accidentally turn historical explanations into mutable current policy.
- **GREEN:** Canonical catalog owns normative rule text; history links to it without rewriting the incident narrative.
- **AUDIT:** Verify one target per canonical rule and current command/symbol reachability.
- **ADVERSARIAL:** Reject closure if a lesson claims a stable reference while only a stale line number exists.
- **CHANGE DELTA:** Final planning convergence.

### Missed Questions

1. Do all old line references need conversion? → No; mark old citations legacy and convert current/new guidance first.
2. What is authoritative for FID closure? → ECHO/FID lifecycle rules and the repository’s actual validator/archive state.
3. Are generated files valid evidence targets? → Yes, when paired with their generator and drift check.
4. What if a symbol is renamed? → Validator reports NEEDS-REVIEW; do not silently remap.
5. Can canonical rules live in LEARNINGS? → Only if the runtime/protocol source does not already own the rule; avoid duplicate authority.

### Code Verification Evidence

- [x] Stable evidence reference grammar defined
- [x] Canonical rule targets identified with exactly-one catalog headings
- [x] Resolver/validator tests pass, including missing, ambiguous, path, and line-snapshot rejection
- [x] New guidance uses stable references
- [x] FID status reflects implementation reality

## Resolution

- **Status:** `closed` — implementation completed and local verification passed; independent Nova implementation sign-off requested.
- **Closed Date:** 2026-08-11
- **Fix Description:** Added stable path/kind/target evidence references with fail-closed path, symbol, heading, command, test, field, ambiguity, and line-snapshot validation, plus the executable canonical rule catalog.
- **Verification Evidence:** `bun test scripts/learnings.test.ts` (11 passing); `bun run learnings:check`; `bun run validate:repository`; quality, typecheck, ESLint, and Prettier gates passed. Global `bun run lint:md` remains `NEEDS-REVIEW` because pre-existing untracked design-system documents under `packages/design-systems/library/` fail Markdownlint; governed learning documents are clean.
- **Reference Grammar Evidence:** Symbol, heading, command, test, and field references resolve uniquely; comments, strings, regex literals, and unsupported tagged-template test syntax fail closed. Balanced parenthesized `test.each` expressions are supported; template interpolation is intentionally outside the grammar.
- **Archive:** Moved to `dev/fids/archive/` as working-tree evidence; the archive file remains untracked pending commit.
