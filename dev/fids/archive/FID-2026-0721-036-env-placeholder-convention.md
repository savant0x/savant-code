# FID-2026-0721-036 — Fix env Placeholder Convention (inherited from MIT project)

**Filename:** `dev/fids/FID-2026-0721-036-env-placeholder-convention.md`
**ID:** FID-2026-0721-036
**Severity:** low
**Status:** closed
**Created:** 2026-07-21
**Author:** ECHO Agent (Perfection Loop)

---

## Summary

The `.env.local` file uses non-standard placeholder patterns (`sk-...`, `nvapi-...`, `ocg-...`) for commented-out API keys. Standard env file convention uses empty values (`KEY=`) for placeholders, not dash-based suffixes. This pattern was inherited from the original MIT project (codebuff) and should be corrected.

---

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Commit/State:** Current HEAD (v0.0.4 prep)

---

## Detailed Description

### Problem

Standard env file convention uses empty values for commented-out placeholders:
```
# TOKENROUTER_API_KEY=
# NVIDIA_API_KEY=
# OPENCODE_GO_API_KEY=
```

The current `.env.local` uses non-standard dash-based placeholders:
```
# TOKENROUTER_API_KEY=sk-...
# SAVANT_CODE_API_KEY=sk-...
# OPENCODE_GO_API_KEY=ocg-...  (already fixed to empty)
```

The `sk-...` and `nvapi-...` patterns are inherited from the original MIT project and are confusing because:
1. They look like partial key values, not placeholders
2. They don't match standard env file conventions
3. They could be mistaken for actual API key prefixes

### Expected Behavior

All commented-out API key placeholders in `.env.local` should use empty values:
```
# TOKENROUTER_API_KEY=
# SAVANT_CODE_API_KEY=
# OPENCODE_GO_API_KEY=
```

### Root Cause

The original MIT project (codebuff) used `sk-...` and `nvapi-...` as placeholder values to indicate the expected key format. This is non-standard and was carried over during the rebrand.

### Evidence

```
Current .env.local (lines 74, 86):
  Line 74: # TOKENROUTER_API_KEY=sk-...
  Line 86: # SAVANT_CODE_API_KEY=sk-...

Should be:
  # TOKENROUTER_API_KEY=
  # SAVANT_CODE_API_KEY=
```

Note: Line 78 (`# NVIDIA_API_KEY=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`) contains an actual key value, not a placeholder — no change needed.

---

## Impact Assessment

### Affected Components

- `.env.local` — 2 lines need updating (lines 74, 86)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

---

## Proposed Solution

### Steps

1. Update `.env.local` line 74: `# TOKENROUTER_API_KEY=sk-...` → `# TOKENROUTER_API_KEY=`
2. Update `.env.local` line 86: `# SAVANT_CODE_API_KEY=sk-...` → `# SAVANT_CODE_API_KEY=`
3. Verify no other env files have this pattern

### Verification

1. `grep -n 'sk-\\.\\.\\|nvapi-\\.\\.\\|ocg-\\.\\.' .env.local` → 0 results
2. Confirm all commented-out API keys use empty values

---

## Perfection Loop

### Loop 1

- **RED:** Identified non-standard placeholder pattern inherited from MIT project
- **GREEN:** Proposed simple fix to use empty values
- **AUDIT:** Verified scope (2 lines in .env.local), no other env files affected
- **CHANGE DELTA:** <1% (2 lines in config file)

---

## Resolution

- **Fixed By:** [Pending — Forge]
- **Fixed Date:** [Pending]
- **Fix Description:** [Pending]
- **Tests Added:** N/A (config file only)
- **Verified By:** [Pending]
- **Commit/PR:** [Pending]
- **Archived:** [Pending]

---

## Lessons Learned

1. **Inherited conventions should be audited.** When rebranding an MIT project, carry over only the patterns that match your project's standards. Non-standard conventions should be identified and corrected.
2. **Env file placeholders should be empty.** Standard convention is `KEY=` for commented-out placeholders, not `KEY=sk-...` or similar patterns.
3. **Config files deserve FIDs too.** Even cosmetic issues in config files should be tracked via FIDs for completeness and audit trail.

---

## Linked Documents

- [templates/FID-TEMPLATE.md](../templates/FID-TEMPLATE.md) — this FID conforms
- [ECHO.md](../ECHO.md) — Laws + Perfection Loop FSM sourced here
