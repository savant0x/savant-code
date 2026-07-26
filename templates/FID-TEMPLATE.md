# FID: [Short Description]

**Filename:** `FID-YYYY-MMDD-NNN-[short-description].md`
**ID:** FID-YYYY-MMDD-NNN
**Severity:** critical | high | medium | low
**Status:** created | analyzed | fixed | verified | closed
**Created:** YYYY-MM-DD HH:MM
**Author:** [Agent/Human Name]

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

## Perfection Loop

### Loop 1

- **RED:** [Issues identified]
- **GREEN:** [Fixes applied]
- **AUDIT:** [Verification results]
- **CHANGE DELTA:** [Percentage of code changed]

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: *"What questions should I have asked when this FID was created, but failed to?"* Surface every missed question, answer it with the most robust default derivable from code inspection, and fold those answers directly back into the existing FID sections.

1. [Missed question → answer]
2. [Missed question → answer]

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that the code referenced in this FID actually exists. FID metadata is a claim — the code is ground truth. (FID-2026-0725-086)

- [ ] Files referenced in "Affected Components" exist in the codebase
- [ ] Implementation matches the proposed solution
- [ ] Typecheck passes: [command output]
- [ ] FID status updated to reflect actual implementation state

### Loop 2 (if needed)

- **RED:** [Remaining issues]
- **GREEN:** [Additional fixes]
- **AUDIT:** [Verification results]
- **CHANGE DELTA:** [Percentage]

## Resolution

- **Fixed By:** [Agent/Human Name]
- **Fixed Date:** YYYY-MM-DD HH:MM
- **Fix Description:** [What was changed]
- **Tests Added:** [Yes/No — describe]
- **Verified By:** [Verification method]
- **Commit/PR:** [Reference]
- **Archived:** YYYY-MM-DD HH:MM (set when moved to `dev/fids/archive/`)

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

What can we learn from this finding? How can we prevent similar issues?
