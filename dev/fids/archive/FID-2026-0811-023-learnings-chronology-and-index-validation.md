<!-- markdownlint-disable MD013 -->

# FID: LEARNINGS Chronology and Index Validation

**Filename:** `FID-2026-0811-023-learnings-chronology-and-index-validation.md`
**ID:** FID-2026-0811-023
**Severity:** medium
**Status:** closed
**Created:** 2026-08-11 18:00
**YAGNI-Compliance:** Pending
**Master FID:** `FID-2026-0811-028`
**Depends On:** `FID-2026-0811-024`

---

## Summary

`dev/LEARNINGS.md` claims that new entries belong above the marker and begins in reverse chronological order, but older August 4–5 entries appear after July 25 entries. This makes recent guidance harder to locate and allows append drift. This FID defines an explicit entry index and a deterministic chronology check without rewriting historical prose.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** TypeScript/Bun monorepo; Bun `1.3.14`
- **Commit/State:** Dirty working tree
- **Governing contract:** ECHO Laws 9, 10, 15; `dev/LEARNINGS.md`

## Detailed Description

### Problem

The file mixes reverse chronology with late-appended sessions. A future agent may treat an older, superseded entry as current simply because it appears later or because the top marker is not enforced.

### Expected Behavior

Entries are ordered newest-first by an unambiguous sortable timestamp. A validator fails when a new dated entry is inserted below an older entry or when a heading lacks a parseable date.

### Root Cause

Chronology is a convention only; no parser or index validates it. Session headings use multiple date forms, including `YYYY-MM-DD` and `YYYY-MM-DD-HHMM`.

### Evidence

- `dev/LEARNINGS.md:3-568` is broadly newest-first through July 25.
- `dev/LEARNINGS.md:692-786` then returns to August 4–5 entries.
- `<!-- Add new entries above this line -->` is not enforced mechanically.

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md`
- New learning validation script/test
- `package.json` and repository validation
- Protocol bundle regeneration

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Current guidance can be obscured by ordering drift
- [ ] Low

## Proposed Solution

### Approach

Normalize session headings to a parseable timestamp, reorder entries without changing their prose, keep a single insertion marker at the end of the file, and add a deterministic validator that checks heading dates are non-increasing, entries are separated correctly, and no content exists after the marker except permitted whitespace. Integrate the validator into repository validation and the protocol-bundle check.

### Steps

1. Define accepted heading formats and timezone/precision behavior.
2. Build an entry parser with fail-closed handling for malformed headings.
3. Reorder current entries using parsed timestamps and preserve their bodies.
4. Add fixtures for valid order, equal timestamps, malformed headings, and content below the marker.
5. Wire the check into repository validation and run all document gates.

### Verification

The validator must reject the current out-of-order fixture before correction and pass the corrected file. It must not alter or reinterpret lesson content.

## Perfection Loop

### Loop 1 — RED

- **RED:** Ordering is convention-only and visibly regressed.
- **GREEN:** Parse dates and enforce newest-first ordering at validation time.
- **AUDIT:** The late August entries after July entries prove the defect.
- **ADVERSARIAL:** Do not sort by raw heading text; mixed precision and session suffixes require a defined timestamp parser.
- **CHANGE DELTA:** Planning only.

### Loop 2 — Independent audit and self-correction

- **RED:** A simplistic parser could reject legitimate historical headings or mishandle same-day sessions.
- **GREEN:** Support the observed heading forms, define tie behavior, and fail closed on unknown forms.
- **AUDIT:** Fixtures must cover mixed precision, same-day ordering, malformed dates, and marker placement.
- **ADVERSARIAL:** Do not silently auto-sort future content; validation should identify the exact offending heading and location.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final convergence

- **RED:** Reordering can create large historical diffs and obscure immutable evidence.
- **GREEN:** Perform one explicit normalization with a preservation check, then use a validator for future changes.
- **AUDIT:** Compare entry bodies before/after and verify generated bundle parity.
- **ADVERSARIAL:** Reject closure if the validator passes only because it ignores malformed or unindexed sections.
- **CHANGE DELTA:** Final planning convergence.

### Missed Questions

1. Are session times local or UTC? → Preserve recorded timestamps; use lexical sortable parsing without inventing timezone semantics.
2. What happens with equal timestamps? → Preserve existing order and require a stable secondary sequence.
3. Should historical headings be renamed? → Only when required for parsing, with a preservation report.
4. Is the marker part of the schema? → Yes; content after it is invalid except whitespace.
5. Should the validator auto-fix? → No; fail with actionable location output.

### Code Verification Evidence

- [x] Current structured entries validated without rewriting preserved legacy prose
- [x] Chronology validator, legacy boundary, and insertion-marker fixtures added
- [x] Repository and generated-bundle checks pass
- [x] Formatting passes and governed chronology/learning documents are clean
- [ ] Repository-wide Markdownlint — NEEDS-REVIEW for unrelated untracked design-system documents
- [x] FID status reflects implementation reality

## Resolution

- **Status:** `closed` — implementation completed and local verification passed; chronology is intentionally enforced for new structured entries above the preserved legacy boundary. Independent Nova implementation sign-off requested.
- **Closed Date:** 2026-08-11
- **Fix Description:** Added deterministic date parsing, newest-first checks for structured entries, exactly-one legacy boundary validation, and insertion-marker placement validation without rewriting historical prose.
- **Verification Evidence:** `bun test scripts/learnings.test.ts` (11 passing); `bun run learnings:check`; `bun run validate:repository`; bundle drift, typecheck, ESLint, Prettier, quality, and hygiene gates passed. Global `bun run lint:md` remains `NEEDS-REVIEW` solely because pre-existing untracked design-system documents under `packages/design-systems/library/` fail Markdownlint; chronology/learning documents are clean.
- **Archive:** Physically moved to `dev/fids/archive/` as working-tree evidence; the archive file remains untracked pending commit and Nova sign-off.
