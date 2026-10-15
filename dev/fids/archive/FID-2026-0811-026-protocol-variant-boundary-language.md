<!-- markdownlint-disable MD013 -->

# FID: Protocol-Variant Boundary Language

**Filename:** `FID-2026-0811-026-protocol-variant-boundary-language.md`
**ID:** FID-2026-0811-026
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 18:00
**YAGNI-Compliance:** Pending
**Master FID:** `FID-2026-0811-028`
**Depends On:** `FID-2026-0811-022`, `FID-2026-0811-024`

---

## Summary

The lesson “The harness has zero single-agent concept” is too absolute for a repository that explicitly contains a separate `single_agent` protocol marker and configuration. The intended invariant is narrower: the Savant multi-agent harness must not accidentally select, inject, or bundle the separate single-agent protocol. This FID corrects the language and adds a boundary check so both protocol variants remain explicit and non-falling-through.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** TypeScript/Bun monorepo; Bun `1.3.14`
- **Commit/State:** Dirty working tree
- **Governing contract:** `ECHO.md`, `ECHO-single-agent.md`, `dev/echo-v0.1.2-single-agent.md`, `protocol.config.yaml`

## Detailed Description

### Problem

The current lesson can teach an agent that the repository has no single-agent protocol, contradicting `ECHO-single-agent.md` and `protocol.config.yaml:95`, while the generated harness bundle intentionally excludes that document.

### Expected Behavior

The multi-agent Savant harness and the separate single-agent variant are explicit protocol branches. Harness grounding never selects or embeds the single-agent document; single-agent sessions resolve their own marker and contract without falling through to the harness protocol.

### Root Cause

A shorthand lesson was written to prevent accidental harness references but overgeneralized into a repository-wide statement.

### Evidence

- `ECHO-single-agent.md` is an explicit protocol marker.
- `protocol.config.yaml` contains `single_agent.protocol`.
- `scripts/generate-protocol-bundle.ts` explicitly excludes the single-agent document.
- `dev/LEARNINGS.md` uses the broader “zero single-agent concept” wording.

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md`
- Protocol bundle generator and generated content
- Boot-contract tests and hygiene scans
- `ECHO-single-agent.md` and protocol config documentation

### Risk Level

- [ ] Critical
- [x] High: ambiguous protocol language can select the wrong governance contract
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Rewrite the lesson to state the exact harness-boundary invariant. Add tests that verify harness bundle inputs exclude the single-agent document and that single-agent resolution remains explicit. Keep historical references labeled as variant-boundary documentation rather than treating all occurrences of “single-agent” as violations.

### Steps

1. Correct the lesson language and add variant/scope metadata.
2. Audit generator, boot resolver, hygiene scan, and protocol config for boundary consistency.
3. Add negative tests for harness fallback and positive tests for explicit single-agent selection.
4. Regenerate the bundle and run protocol, repository, and documentation gates.

### Verification

The harness bundle must contain zero single-agent protocol content while the single-agent marker/config tests pass. A scoped sweep must distinguish allowed boundary references from forbidden injected-context references.

## Perfection Loop

### Loop 1 — RED

- **RED:** The lesson overstates “zero single-agent concept” and conflicts with explicit repository protocol variants.
- **GREEN:** Narrow the invariant to selection/injection/bundling separation.
- **AUDIT:** Marker, config, generator exclusion, and lesson wording are independently visible.
- **ADVERSARIAL:** Do not replace the narrow boundary with a blanket zero-match grep that would flag the required variant marker.
- **CHANGE DELTA:** Planning only.

### Loop 2 — Independent audit and self-correction

- **RED:** A harness scan can accidentally include generated comments or legitimate configuration references.
- **GREEN:** Define the exact governed scope: injected harness content must be clean; variant markers and config are allowed.
- **AUDIT:** Test both content and path-selection behavior.
- **ADVERSARIAL:** Reject closure if the scan passes only by deleting the explicit single-agent contract or masking it broadly.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final convergence

- **RED:** Protocol variants can drift even when prose is corrected.
- **GREEN:** Pair language correction with generator/boot boundary tests and drift checks.
- **AUDIT:** Re-run generated bundle and explicit variant resolution checks.
- **ADVERSARIAL:** Reject closure if a missing local single-agent file silently falls through to the harness protocol.
- **CHANGE DELTA:** Final planning convergence.

### Missed Questions

1. Is the single-agent protocol shipped? → Not in the harness bundle; it remains a separate local protocol path.
2. Are all “single-agent” references violations? → No; scope and provenance determine validity.
3. What is the fail-closed behavior? → An explicit variant mismatch or missing required contract must error, not fall through.
4. Does this FID change runtime policy? → Only boundary validation; no protocol semantics are changed.
5. How is generated content proven? → Regenerate and compare exact output, plus scoped content tests.

### Code Verification Evidence

- [x] Lesson wording corrected to scope the harness boundary precisely
- [x] Harness variant boundary tests and scoped assertions pass
- [x] Bundle excludes the separate protocol document
- [x] Governed documentation and protocol drift checks pass
- [ ] Repository-wide Markdownlint — NEEDS-REVIEW for unrelated untracked design-system documents
- [x] FID status reflects implementation reality

## Resolution

- **Status:** `closed` — implementation completed and local verification passed; independent Nova implementation sign-off requested.
- **Closed Date:** 2026-08-11
- **Fix Description:** Narrowed the learning to the harness-injected-context boundary, updated the curated embedded lesson, and retained explicit alternate governance markers without bundling them.
- **Verification Evidence:** `bun test common/src/util/__tests__/boot-contract.test.ts`; `bun test common/src/util/__tests__/embedded-protocol.test.ts`; `bun run generate:protocol-bundle:check`; `bun run validate:repository`; and governed documentation gates passed. Global `bun run lint:md` remains `NEEDS-REVIEW` solely because pre-existing untracked design-system documents under `packages/design-systems/library/` fail Markdownlint; protocol-boundary documents are clean.
- **Archive:** Moved to `dev/fids/archive/` as working-tree evidence; the archive file remains untracked pending independent sign-off.
