<!-- markdownlint-disable MD013 -->

# FID: LEARNINGS Structured Schema and Quality Gate

**Filename:** `FID-2026-0811-024-learnings-structured-schema-and-quality-gate.md`
**ID:** FID-2026-0811-024
**Severity:** medium
**Status:** closed
**Created:** 2026-08-11 18:00
**YAGNI-Compliance:** Pending
**Master FID:** `FID-2026-0811-028`

---

## Summary

The learning file is useful narrative but has no machine-readable contract for failure, evidence, invariant, guard, verification, scope, supersession, or owning FID. This makes lessons passive prose and allows unsupported claims to persist. This FID defines a lightweight structured record convention and a validator that turns lessons into enforceable feedback inputs without requiring every historical entry to be rewritten at once.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** TypeScript/Bun monorepo; Bun `1.3.14`
- **Commit/State:** Dirty working tree
- **Governing contract:** ECHO Laws 5, 8, 9, 10, 15; `agents/scribe/scribe.ts`

## Detailed Description

### Problem

Entries vary between bullets, narrative sections, and file lists. There is no required indication of whether a lesson is internal-only, shipped, superseded, or mechanically enforced.

### Expected Behavior

New entries use a consistent schema: failure, evidence, invariant, guard, verification, scope, and owning FID. Historical entries remain readable and are migrated incrementally or explicitly marked legacy. The validator rejects missing required fields in new entries and detects unsupported PASS claims without evidence links.

### Root Cause

The project evolved the file organically and never defined a record schema or quality gate.

### Evidence

- `dev/LEARNINGS.md` has narrative entries with inconsistent section shapes.
- `agents/scribe/scribe.ts` instructs updates but does not enforce a schema.
- `docs/reports/adoptable-features-2026-07-25.md` already identifies the file as flat, unstructured prose.

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md`
- Scribe guidance
- New learning-schema validator/tests
- Repository validation and bundle generation

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: lessons do not reliably become reusable guardrails
- [ ] Low

## Proposed Solution

### Approach

Define a compact schema for new entries and a legacy boundary for historical entries. Prefer explicit fields over a heavyweight database. Add validation for required fields, FID format, evidence references, scope values (`internal`, `embedded`, `release`), and guard references when a lesson claims mechanical enforcement.

### Steps

1. Define the schema and legacy migration boundary.
2. Add a parser/validator with actionable diagnostics.
3. Convert the newest lessons first and preserve older narrative entries as legacy until separately migrated.
4. Update Scribe guidance and the template for future entries.
5. Add tests for valid records, missing fields, unsupported scope, stale FID references, and unverifiable PASS claims.
6. Wire the gate into repository validation and bundle generation.

### Verification

A new structured entry must pass schema validation; a malformed fixture must fail. Historical content must remain available and be explicitly classified rather than silently discarded.

## Perfection Loop

### Loop 1 — RED

- **RED:** Narrative lessons lack fields needed for automated reuse and evidence discipline.
- **GREEN:** Introduce a minimal schema with a legacy compatibility boundary.
- **AUDIT:** Current variation and the existing Scribe-only instruction are observable.
- **ADVERSARIAL:** Do not force a brittle full-file rewrite or require every historical sentence to become a structured record immediately.
- **CHANGE DELTA:** Planning only.

### Loop 2 — Independent audit and self-correction

- **RED:** An overdesigned schema could make writing lessons too expensive and cause bypasses.
- **GREEN:** Require only fields that support evidence and routing; permit multiline prose inside fields.
- **AUDIT:** Test parser behavior on current entries, new entries, malformed entries, and legacy sections.
- **ADVERSARIAL:** A field named `guard` is not proof of enforcement; validate the referenced command/file or classify it as advisory.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final convergence

- **RED:** A validator can reject useful historical context or create false confidence from metadata alone.
- **GREEN:** Keep legacy content explicitly marked and require independent evidence for status claims.
- **AUDIT:** Run repository validation and inspect generated output for schema consistency.
- **ADVERSARIAL:** Reject closure if the schema is not consumed by Scribe, validation, or generation as specified.
- **CHANGE DELTA:** Final planning convergence.

### Missed Questions

1. Must all 814 lines be converted immediately? → No; new entries first, then bounded migration.
2. What is evidence? → A stable path/symbol, command, test, or exact output reference; agent attribution alone is not evidence.
3. Are lessons allowed to be advisory? → Yes, but scope and guard status must say so.
4. Can one lesson own multiple FIDs? → Yes, through a list of valid IDs.
5. Where is the schema canonical? → A shared script module plus documented Markdown convention, not duplicated prompt prose.

### Code Verification Evidence

- [x] Schema and legacy boundary defined
- [x] Parser/tests implemented, including multiline, malformed, unknown, and duplicate-field rejection
- [x] New structured guidance and canonical rule catalog aligned
- [x] Repository/bundle gates pass; governed learning documents are clean
- [ ] Repository-wide Markdownlint — NEEDS-REVIEW for unrelated untracked design-system documents
- [x] FID status reflects implementation reality

## Resolution

- **Status:** `closed` — implementation completed and local verification passed; independent Nova implementation sign-off requested.
- **Closed Date:** 2026-08-11
- **Fix Description:** Added the structured learning schema, legacy boundary, strict parser, FID/scope/status validation, stable evidence grammar, canonical rule validation, and focused regression tests.
- **Verification Evidence:** `bun test scripts/learnings.test.ts` (11 passing); `bun run learnings:check`; `bun run quality:report`; `bun run validate:repository`; four core typechecks; ESLint; and Prettier passed. Global `bun run lint:md` remains `NEEDS-REVIEW` because pre-existing untracked design-system documents under `packages/design-systems/library/` fail Markdownlint; governed learning documents are clean.
- **Quality Evidence:** `scripts/learnings-references.ts` is measured at 384 lines by the repository ratchet; the baseline records this implementation-driven ceiling and does not claim the file is below the 300-line new-file target.
- **Archive:** Moved to `dev/fids/archive/` as working-tree evidence; the archive file remains untracked pending commit.
