# FID: Batch Operations (Edit Multiple Files Before Verifying)

**Filename:** `FID-2026-0723-058-batch-operations.md`
**ID:** FID-2026-0723-058
**Severity:** medium
**Status:** closed
**Created:** 2026-07-23 02:15
**Author:** Buffy (Orchestrator)

---

## Summary

The current orchestrator workflow performs per-file edit→verify cycles: write file A → verify → write file B → verify → write file C → verify. For multi-file changes (3-5 files), this creates 3-5 separate verification rounds when a single batch verification would suffice. Batch operations combine all edits into one verification pass, reducing LLM calls by ~25% for multi-file tasks.

## Environment

- **OS:** Windows (production: Linux)
- **Language/Runtime:** TypeScript / Bun 1.3.11
- **Tool Versions:** ECHO Protocol v0.2.0
- **Commit/State:** Working tree (uncommitted)

## Detailed Description

### Problem

For a 4-file change, the current flow is:
```
Write file A → typecheck → Write file B → typecheck → Write file C → typecheck → Write file D → typecheck
= 4 LLM calls + 4 verification rounds = ~8 steps
```

### Expected Behavior

```
Write files A, B, C, D → single typecheck pass
= 1 LLM call + 1 verification round = ~2 steps
```

### Root Cause

The current system prompt doesn't instruct the orchestrator to batch edits. Each write_file/str_replace is followed by verification, even when the changes are independent.

### Evidence

```text
# Current step prompt (savant.ts line ~384):
`Verify with typecheck/lint in parallel using bashers after writing.`
# This implies verification after EVERY write, not after a batch of writes

# The orchestrator has write_file and str_replace in its toolNames
# But the prompt doesn't say "batch multiple edits before verifying"
```

## Impact Assessment

### Affected Components

- `agents/savant/savant.ts` — Instructions prompt for batch operations

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Low: Minor issue, cosmetic, or edge case
- [x] Medium: Feature degraded, workaround exists

## Proposed Solution

### Approach

Add explicit instruction to batch multiple file edits before running verification.

### Steps

1. **Update `agents/savant/savant.ts`** — Add batch operations instruction:
   ```
   When making multiple file changes, batch all edits before verification.
   Write all related files first, then run typecheck/lint once at the end.
   Only verify after each individual write if the changes are unrelated
   or if you suspect a type error in a specific file.
   ```

2. **Update `ECHO.md`** — Document batch operations as an optimization:
   ```
   Batch Operations: For multi-file changes, write all files first,
   then verify once. This reduces verification rounds from N to 1.
   ```

### Verification

- `cd packages/agent-runtime && bun run typecheck` — zero errors
- Grep verification: batch instruction present in savant.ts and ECHO.md

## Perfection Loop

### Loop 1

- **RED:** [Pending]
- **GREEN:** [Pending]
- **AUDIT:** [Pending]
- **CHANGE DELTA:** [Pending]

## Resolution

- **Fixed By:** [Pending]
- **Fixed Date:** [Pending]
- **Fix Description:** [Pending]
- **Tests Added:** No (prompt-only changes)
- **Verified By:** [Pending]
- **Commit/PR:** [Pending]
- **Archived:** [Pending — set when moved to `dev/fids/archive/` after implementation + verification]

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

[To be filled after Perfection Loop completion]
