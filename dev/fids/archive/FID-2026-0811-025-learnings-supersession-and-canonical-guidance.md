<!-- markdownlint-disable MD013 -->

# FID: LEARNINGS Supersession and Canonical Guidance

**Filename:** `FID-2026-0811-025-learnings-supersession-and-canonical-guidance.md`
**ID:** FID-2026-0811-025
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 18:00
**YAGNI-Compliance:** Pending
**Master FID:** `FID-2026-0811-028`
**Depends On:** `FID-2026-0811-023`, `FID-2026-0811-024`, `FID-2026-0811-029`

---

## Summary

Later lessons explicitly correct earlier release and environment guidance, but the older entries remain visually active. The file also repeats FID archival rules and related operational principles across multiple sessions. This creates a risk that an agent follows an obsolete recipe or treats historical repetition as a current independent rule. This FID defines supersession metadata, canonical-rule links, and a validator that prevents corrected guidance from remaining ambiguous.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** TypeScript/Bun monorepo; Bun `1.3.14`
- **Commit/State:** Dirty working tree
- **Governing contract:** ECHO Laws 5, 9, 10, 15; release and FID archive invariants

## Detailed Description

### Problem

The August 10 clean-shell lesson says an earlier “set aside + clear overrides” recipe was insufficient, while the August 5 binary-rebuild lesson still presents that recipe without a superseded marker. Similar FID archive rules recur in several entries without a canonical reference.

### Expected Behavior

Every corrected lesson explicitly identifies its replacement. Repeated durable rules have one canonical source, while historical entries link to it and retain their incident context. Validators reject a `Superseded by` target that does not exist and flag contradictory active recipes.

### Root Cause

Lessons are appended as incident reports, but there is no lifecycle for guidance validity.

### Evidence

- `dev/LEARNINGS.md:111-143` corrects prior clean-shell guidance.
- `dev/LEARNINGS.md:743-760` retains the earlier incomplete recipe without a supersession marker.
- FID archival requirements recur at multiple historical headings.

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md`
- Learning schema/validator from FID-024
- FID/release guidance references
- Scribe authoring instructions

### Risk Level

- [ ] Critical
- [x] High: obsolete release guidance can cause failed or unsafe builds
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Add optional metadata to each new or corrected lesson: `Status` (`active`, `superseded`, `historical`), `Superseded by`, and `Canonical rule`. Mark known obsolete recipes and point them to the authoritative current recipe. Consolidate repeated FID closure guidance into one canonical operational rule while keeping historical entries as context.

### Steps

1. Identify contradictions and repeated normative rules.
2. Mark known superseded entries without deleting incident evidence.
3. Add canonical links for FID closure and environment/release recipes.
4. Extend the learning validator to resolve supersession and canonical targets.
5. Add contradiction fixtures and update Scribe guidance.
6. Run release-relevant documentation and validation gates.

### Verification

A superseded entry must link to an existing replacement. Current release documentation and the canonical recipe must agree. Historical incident details may remain but must not appear as unqualified current instructions.

## Perfection Loop

### Loop 1 — RED

- **RED:** Older guidance remains active-looking after a later correction.
- **GREEN:** Add explicit status, replacement, and canonical-rule metadata.
- **AUDIT:** The August 5/10 environment pair demonstrates the contradiction.
- **ADVERSARIAL:** Do not rewrite the incident into a false historical account; mark its status and preserve what actually happened.
- **CHANGE DELTA:** Planning only.

### Loop 2 — Independent audit and self-correction

- **RED:** “Superseded” can itself become stale if its replacement moves or disappears.
- **GREEN:** Validate links and require a current canonical target for active operational rules.
- **AUDIT:** Fixtures cover valid replacement, missing replacement, circular supersession, and contradictory recipes.
- **ADVERSARIAL:** A link alone is not enough; the replacement must be clearly normative and tested against the real command.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final convergence

- **RED:** Consolidation can erase useful historical repetition or create one oversized canonical document.
- **GREEN:** Keep incident narratives, link them to compact canonical rules, and avoid duplicating full procedures.
- **AUDIT:** Search must show no unmarked contradictory current recipe in the governed scope.
- **ADVERSARIAL:** Reject closure if the validator ignores entries below the marker, archive docs, or generated copies where they are shipped.
- **CHANGE DELTA:** Final planning convergence.

### Missed Questions

1. Should every historical lesson be marked historical? → Only where it is not current operational guidance; preserve incident context.
2. What outranks a lesson? → Current executable scripts and protocol/config contracts; lessons explain them but do not override them.
3. Can a superseded lesson still be embedded? → Only if the status is explicit and the runtime bundle intentionally includes historical context.
4. How are canonical rules chosen? → Prefer existing executable validator/script or protocol source over prose.
5. What if two lessons disagree and neither is verified? → Mark both `NEEDS-REVIEW` and create a FID; never choose by recency alone.

### Code Verification Evidence

- [x] Current corrected guidance is explicitly linked to the canonical release-preflight rule
- [x] Canonical rules identified in `dev/LEARNING-RULES.md`
- [x] Supersession/canonical validator tests pass, including missing-target and cycle rejection
- [x] Release recipe and docs use the reversible preflight contract
- [x] FID status reflects implementation reality
- [ ] Repository-wide Markdownlint — NEEDS-REVIEW for unrelated untracked design-system documents

## Resolution

- **Status:** `closed` — implementation completed and local verification passed; independent Nova implementation sign-off requested.
- **Closed Date:** 2026-08-11
- **Fix Description:** Added canonical rule links and validator checks for missing, circular, superseded, duplicate, and unresolved canonical targets; current release guidance now points to the reversible preflight rule while historical incident prose remains preserved.
- **Verification Evidence:** `bun test scripts/learnings.test.ts` (11 passing); `bun run learnings:check`; `bun run validate:repository`; and the 55-test public-release suite passed. Global `bun run lint:md` remains `NEEDS-REVIEW` solely because pre-existing untracked design-system documents under `packages/design-systems/library/` fail Markdownlint; governed learning documents are clean.
- **Archive:** Moved to `dev/fids/archive/` as working-tree evidence; the archive file remains untracked pending commit and independent sign-off.
