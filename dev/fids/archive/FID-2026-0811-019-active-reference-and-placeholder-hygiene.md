<!-- markdownlint-disable MD013 -->

# FID: Active Reference and Placeholder Hygiene

**Filename:** `FID-2026-0811-019-active-reference-and-placeholder-hygiene.md`
**ID:** FID-2026-0811-019
**Severity:** medium
**Status:** closed
**Created:** 2026-08-11 04:20
**YAGNI-Compliance:** Verified
**Master FID:** `FID-2026-0811-021`

---

## Summary

The audit found stale references to removed single-agent paths across historical summaries, audit correspondence, scratchpad transcripts, and current-facing search results, along with placeholder-like text in production-adjacent code and prompts. The cited session-summary occurrence is historical evidence, not by itself a current instruction; whether any current actionable reference remains requires a scoped inventory. Many matches are intentional protocol vocabulary, template literals, UI placeholders, generated instructions, or historical records. This FID defines the active-reference cleanup and placeholder policy while preserving historical evidence and runtime placeholder mechanisms; the completed provenance policy is recorded below.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** Strict TypeScript monorepo; Bun `1.3.14`
- **Tool Versions:** Project repository validation and lint commands
- **Commit/State:** Dirty working tree; active and historical documents coexist
- **Governing contract:** ECHO Laws 5, 9, 10, and 11; current boot contract in `ECHO-single-agent.md`

## Detailed Description

### Problem

A broad scan still finds removed references such as `dev/nova/specs/echo-v0.1.2-single-agent.md`, `FREEREADME.md`, `ECHO-freebuff.md`, and `freebuff.protocol` in changelog history, archived records, scratchpad transcripts, and audit correspondence. The prior audit specifically identified a stale enforcement-test reference in archived audit correspondence; this is not proof of a current executable reference. A production scan also finds terms such as `not implemented`, `placeholder`, and TODO-related strings; some are intentional runtime slots or test fixtures, while others may violate Law 5 if they are shipped unresolved work.

### Expected Behavior

Current boot, source, test, and operator-facing documents point only to existing canonical paths or explicitly label historical quotations. Intentional placeholders are typed runtime substitution markers, UI copy, test-only values, or approved development defaults and are excluded by provenance-aware rules. Unresolved implementation placeholders in shipped production code fail validation and require a linked active FID.

### Root Cause

Lexical scans lack scope and provenance. Earlier renames left historical references that are valid evidence but indistinguishable from current instructions in broad output. Placeholder vocabulary is also used for both legitimate substitution slots and unfinished work.

### Evidence

```text
dev/session-summaries/2026-08-09-1206-single-agent-init.md:40
references dev/nova/specs/echo-v0.1.2-single-agent.md and FREEREADME.md, but neither exists

dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-nova-approval-response.md:52
records an enforcement-test reference to the absent path

Current source scan includes:
common/src/env.ts:47,49,51 — explicitly named development placeholders
packages/agent-runtime/src/echo/fid-validator.ts:39 — placeholder detection rule
```

## Impact Assessment

### Affected Components

- Current-facing docs and session summaries
- Active test fixtures and boot-contract tests
- `packages/agent-runtime/src/echo/fid-validator.ts`
- Development environment defaults and prompt/template substitution code
- Repository validation scans

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Current instructions can be stale or unresolved work can be hidden by lexical noise
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Create a provenance-aware scan policy with explicit scopes: current executable/source, current operator docs, generated output, test/fixture, historical archive, and scratchpad. Correct only current actionable references; preserve historical quotations and immutable records. Require unresolved production placeholders to carry an active FID reference, while allowing typed substitution markers and approved test/development values.

### Steps

1. Enumerate all stale-path and placeholder matches by scope and classify them.
2. Update current executable/test/operator references to canonical paths only.
3. Add validation fixtures for an actionable stale reference, an intentional historical citation, a runtime substitution marker, and an unresolved production placeholder.
4. Keep generated artifacts synchronized through their generators rather than hand-editing generated output.
5. Run focused scans, repository validation, affected tests, lint, formatting, and full gates.

### Verification

The implementation must paste exact scoped scan commands and outputs, prove that current boot/test paths resolve, show historical matches are intentionally excluded, and demonstrate that unresolved production placeholders fail with actionable diagnostics.

## Perfection Loop

### Loop 1 — RED

- **RED:** Current-facing stale references and unresolved-placeholder risk are mixed with valid historical and runtime vocabulary.
- **GREEN:** Use provenance-aware scopes and correct only actionable current artifacts.
- **AUDIT:** Exact current and historical examples are cited above; no broad grep result is treated as a defect without classification.
- **ADVERSARIAL:** Do not rewrite changelog or archive evidence merely to achieve zero lexical matches. Do not flag UI `placeholder` attributes or substitution constants as unfinished code.
- **CHANGE DELTA:** FID document only.

### Loop 2 — Independent audit and self-correction

- **RED:** The first scope could overlook test fixtures that execute at runtime or generated source that ships in a package.
- **GREEN:** Classify by execution and generation behavior, not directory name alone; include generated artifacts when they are shipped runtime inputs and exclude them when regeneration is authoritative.
- **AUDIT:** Current boot marker and source paths were read; final implementation must prove every corrected reference and generated parity.
- **ADVERSARIAL:** A zero-match claim across the entire repository is invalid because historical records and protocol rules intentionally contain the vocabulary.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final audit and adversarial convergence

- **RED:** Independent review corrected an overclaim: the cited `2026-08-09` session summary and archived audit response are historical records, so they prove stale historical references but not a current executable violation.
- **GREEN:** The scope now distinguishes historical evidence from current actionable references and requires a provenance-aware inventory before any current document is changed.
- **AUDIT:** The final package probes produced `validation: PASS`, `All matched files use Prettier code style!`, Markdownlint exit 0, and no forbidden-attribution matches in the new FID package. The remaining reference matches must be classified by the implementation audit; no zero-match claim is made.
- **ADVERSARIAL:** Severity remains `medium` for the classification/policy gap, not for a proven current boot failure. Historical records remain immutable, and intentional placeholders remain out of scope unless execution evidence shows unresolved behavior.
- **CHANGE DELTA:** Final planning-loop evidence and scope correction only; no historical document was rewritten.

### Missed Questions

1. Are all stale references violations? → No; historical evidence is preserved, current instructions are actionable.
2. Are all placeholders violations? → No; typed substitution slots, UI copy, and synthetic tests are legitimate.
3. Can historical records be edited? → No; use index notes or scope exclusions.
4. What about generated bundles? → Validate their generator and drift check; do not hand-edit the generated copy.
5. How is an unresolved production TODO tracked? → It must link to a current active FID or be removed as part of an approved implementation.

### Code Verification Evidence

- [x] Canonical current marker and stale historical examples are identified.
- [x] Placeholder-producing source paths are identified for classification.
- [x] Current references corrected — implementation completed under the granted automation level 3 scope.
- [x] Scoped validator and fixtures — implementation completed.
- [x] Generator parity and full gates — implementation completed.

### Implementation Closure Addendum — 2026-08-11

- Nova's independent implementation audit returned **PASS — implementation approved for closure** in `dev/nova/inbox/2026-08-11-fid-2026-0811-015-021-echo-compliance-remediation-implementation-audit-response.md`.


- Hygiene enforcement is provenance-scoped in `scripts/hygiene.ts:39` and distinguishes current actionable references from historical records and intentional runtime vocabulary.
- Generated protocol artifacts were regenerated through the project generator; `bun run generate:protocol-bundle:check` and `bun run generate:provider-docs:check` both exited 0.
- Hygiene, repository validation, root ESLint, Markdownlint, Prettier, quality, scripts tests, and agent-runtime tests (780/780) all passed.
- Working-tree audit manifest `21110e2f32dccab4b69adc1c5d55ed98d637d44aa3200e679c8b769e4bfe4808` passed; it is not clean-release certification.

## Resolution

- **Status:** `closed` — hygiene implementation, validation, and Nova independent implementation audit completed.
- **Implementation:** Completed under the granted automation level 3 scope.
- **Tests Added:** Yes — provenance-scoped hygiene and placeholder fixtures.
- **Archive:** Moved to `dev/fids/archive/` after Nova returned PASS.

## Lessons Learned

Lexical cleanliness without provenance destroys useful history. Compliance scans must distinguish executable current truth from historical evidence and legitimate substitution vocabulary.
