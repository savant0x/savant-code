# FID: [Short Description]

**Filename:** `FID-YYYY-MMDD-NNN-[short-description].md`
**ID:** FID-YYYY-MMDD-NNN
**Severity:** critical | high | medium | low
**Status:** created | analyzed | fixed | verified | converged | closed
**Created:** YYYY-MM-DD HH:MM
**YAGNI-Compliance:** Pending | Verified | Debt-Incurred

---

## Summary

One-paragraph description of the finding.

## Environment

- **OS:** [OS and version]
- **Language/Runtime:** [Language and version]
- **Tool Versions:** [Relevant tool versions]
- **Commit/State:** [Git SHA or state description]

## Detailed Description

### Problem

What is the issue? What behavior was observed?

### Expected Behavior

What should happen instead?

### Root Cause

What is the underlying cause?

### Evidence

Include logs, screenshots, code snippets, or test output.

```text
[Paste evidence here]
```

## Impact Assessment

### Affected Components

- [Component 1]
- [Component 2]

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

How should this be fixed?

### Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]

### Verification

How will we confirm the fix works?

## Verification Gates

> FID-2026-0823-009 (mandatory once status flips to `fixed`/`verified`). Declare
> the gates that PROVE this FID's claimed verification against the current tree.
> Allowlisted shapes only (never free-form shell):
>
> - `- gate: typecheck <workspace>` — workspace must be in `VALIDATION_WORKSPACE_POLICY`
> - `- gate: test <repo-relative-path>` — must exist, `*.test.ts`/`*.test.tsx`
> - `- gate: probe <repo-relative-path>` — must exist, `*.ts`
>
> Stamp the receipt with `bun run fid:verify <fid-path> --write`. The receipt's
> fingerprint binds it to the document: any edit after verification invalidates
> it until re-verified. `validate:repository` LIVE RE-RUNS the declared gates
> (C3) and the pre-write gate blocks flipping status without a valid receipt.

```markdown
## Verification Gates

- gate: typecheck sdk
- gate: test sdk/src/__tests__/process-definitions.test.ts
- gate: probe dev/scratchpad/process-defs-probe.ts

### Verification Receipt

- fingerprint: sha256:<machine-generated>
- verified: YYYY-MM-DDTHH:MM:SSZ
- typecheck sdk: exit 0
- test sdk/src/__tests__/process-definitions.test.ts: exit 0
- probe dev/scratchpad/process-defs-probe.ts: exit 0
```

## Perfection Loop

### Loop 1 — RED

- **RED:** [Issues identified]
- **GREEN:** [Fixes applied]
- **AUDIT:** [Verification results]
- **ADVERSARIAL:** [Independent challenge]
- **CHANGE DELTA:** [Percentage of FID text changed]

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default
> derivable from inspection, and fold the answer back into the relevant sections.

1. [Missed question → answer]
2. [Missed question → answer]

### Implementation Evidence (REQUIRED for `closed`)

> A FID **cannot** be set to `closed` without this section filled. No silent
> deferrals — every step must be `implemented`, `blocked`, or `deferred`
> (operator-approved only).

- [ ] **Commit SHA:** The exact commit(s) where implementation landed
- [ ] **File:line ranges:** Specific files and line numbers of the key changes
- [ ] **Gate output:** Pasted output from typecheck/tests/lint proving the implementation is clean
- [ ] **Reproducibility:** Another agent can grep for the changes and find matches in the working tree
- [ ] **Step statuses:** Every Proposed Solution step is marked `implemented`, `blocked`, or `deferred` (operator-approved)

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is
> ground truth.

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present for new or repaired wiring
- [ ] FID status reflects the actual implementation state

> Every PASS and FAIL in AUDIT cites `path/to/file.ts:LINE` plus quoted code or exact command output. Absence-shaped
> checks paste the exact search and mark out-of-reach evidence `NEEDS-REVIEW`.

### Loop 2 — Independent audit and self-correction

- **RED:** [Remaining issues]
- **GREEN:** [Corrections applied]
- **AUDIT:** [Independent evidence]
- **ADVERSARIAL:** [Residual challenge]
- **CHANGE DELTA:** [Percentage]

### Loop 3 — Final convergence

- **RED:** [Final risks]
- **GREEN:** [Final corrections]
- **AUDIT:** [Final independent evidence]
- **ADVERSARIAL:** [Final challenge]
- **CHANGE DELTA:** [Percentage]

## Resolution

- **Closed Date:** YYYY-MM-DD HH:MM (set when closure is independently verified)
- **Fix Description:** [What was changed]
- **Tests Added:** [Yes/No — describe]
- **Verification Evidence:** [Commands and results]
- **Archived:** YYYY-MM-DD HH:MM (set when moved to `dev/fids/archive/`)

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

What can we learn from this finding and how can we prevent similar issues?
