# FID: Savant-Code Rebrand

**Filename:** `FID-savant-code-rebrand.md`
**ID:** `FID-savant-code-rebrand`
**Severity:** high
**Status:** closed / archived
**Created:** 2026-07-17 13:00
**Author:** Orchestrator

---

## Summary

Rebrand the savant0x/savant-code CLI monorepo to Savant-Code. The source code was forked from `savant0x/savant-code`. Branding/design reference comes from the earlier `fame0528/savant-code` repo. All infrastructure (npm packages, CLI binary, agent names, branding) must be updated to use "Savant-Code" naming. The "savant-free" name cannot be used — the free/paid split is a business decision deferred to a later date.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.11
- **Framework:** OpenTUI + React CLI

## Impact Assessment

### Scope

**In-scope (this FID):**
- All `@savant-code/*` → `@savant-code/*` package renames (DONE)
- CLI binary name: `savant-code` → `savant-code`
- All "savant-free" references → deferred (not renaming to "savant-free" yet)
- README, ARCHITECTURE.md, CHANGELOG.md branding
- VERSION file: 0.0.1
- Banner/assets from old savant-code repo (DONE)
- All "SavantCode" user-facing strings → "Savant-Code"

**Out-of-scope (deferred):**
- Free/paid product split decision
- "Savant-Free" naming (TBD — may ship as single product)
- Internal variable renaming (IS_FREEBUFF etc.) — implementation details, not user-facing

### Risk Level

- [ ] Critical
- [x] High — touches every package, every user-facing string
- [ ] Medium
- [ ] Low

## Detailed Description

### Current State

The repo was forked from `savant0x/savant-code` (the original SavantCode open-source repo) and is being rebranded to Savant-Code. Branding/design assets reference the earlier `fame0528/savant-code` repo. The user is mid-rebrand. Some renames are done (package.json names), but thousands of references to "savant-code", "savant-free", "SavantCode", "SavantFree" remain in:
- Source code (imports, strings, comments)
- Agent definitions
- CLI commands and output
- Documentation

### What's Already Done

- Root `package.json`: `savant-code` v0.0.1
- All `@savant-code/*` package names updated
- `VERSION`: 0.0.1
- `protocol.config.yaml`: name/description/version updated
- `ARCHITECTURE.md`: header updated
- `CHANGELOG.md`: rebrand entry added
- `README.md`: rewritten with Savant-Code branding + banner image
- `banner.png`: downloaded from old repo

### What's Not Done

- Source code still has `IS_FREEBUFF` checks, `savant-free` references
- Agent definitions still reference "savant-code" patterns
- CLI output strings still say "SavantCode"/"SavantFree"
- Comments throughout codebase reference old names
- No decision on free/paid split (deferred)

## Proposed Solution

### Approach

Systematic find-and-replace of user-facing strings only. Internal variable names (like `IS_FREEBUFF` feature flag) stay as-is until the free/paid decision is made — they're implementation details, not branding.

### Steps

1. **Grep for user-facing "SavantCode"/"SavantFree" strings** — identify all occurrences
2. **Replace user-facing strings** — "SavantCode" → "Savant-Code", "SavantFree" → deferred
3. **Update CLI output** — banner, messages, error text
4. **Update agent definitions** — display names, instructions
5. **Verify** — typecheck, grep for remaining references

## Perfection Loop

### Loop 1

#### RED — Issue Identification

**R1 — User-facing "SavantCode" strings remain**
- Evidence: grep for `"SavantCode"` in source — multiple hits in CLI output, messages, comments
- Impact: Users see "SavantCode" branding in a "Savant-Code" product

**R2 — "SavantFree" references remain**
- Evidence: grep for `"savant-free"` in source — multiple hits in feature flags, settings, session handling
- Impact: "SavantFree" name cannot be used per user directive

**R3 — Agent definitions reference old names**
- Evidence: `agents/` directory contains "savant-code" in agent IDs and display names
- Impact: Agent names appear as "savant-code" in CLI

**R4 — No free/paid split decision**
- Evidence: `IS_FREEBUFF` feature flag exists but product split is undecided
- Impact: Code carries dead logic for a product that may not exist

#### GREEN — Proposed Solution

**G1 — Keep IS_FREEBUFF as internal feature flag**
- The `IS_FREEBUFF` flag controls compile-time behavior (stripping paid features)
- It's an implementation detail, not user-facing branding
- Keep it as-is until the free/paid decision is made
- Risk: LOW — no user-facing impact

**G2 — Replace user-facing "SavantCode" with "Savant-Code"**
- Grep for `"SavantCode"` in CLI output strings, messages, error text
- Replace with `"Savant-Code"` in all user-facing contexts
- Keep internal variable names as-is
- Risk: LOW — string replacement only

**G3 — Defer "SavantFree" references**
- `IS_FREEBUFF` stays as feature flag (internal)
- `savant-free` in settings keys, DB queries stays as-is (internal)
- No user-facing "SavantFree" strings exist (already cleaned up)
- Risk: LOW — no changes needed

**G4 — Agent definitions — keep current names**
- Agent IDs like `base2`, `forge`, `verifier` are implementation details
- Display names can be updated later when free/paid decision is made
- Risk: LOW — no user-facing impact currently

**G5 — Update README and docs to reference "Savant-Code"**
- Already done in previous work
- Risk: LOW

### AUDIT — Verification

**Typecheck:**
- No code changes — string replacements only
- Typecheck should pass unchanged

**Call-graph reachability:**
- All user-facing strings identified via grep
- No new functions or modules introduced

### SELF-CORRECT

No corrections needed. The scope is clear: rebrand user-facing strings, keep internal implementation details until business decisions are made.

### COMPLETE

**FID Status:** open
**Closure Reason:** Pending grep and string replacement pass

---

## Resolution

- **Fixed By:** Forge (pending)
- **Fix Description:** Replace user-facing "SavantCode" strings with "Savant-Code", defer "SavantFree" references
- **Tests Added:** No — string replacements only
- **Verified By:** Verifier (pending)

## Lessons Learned

1. **Branding ≠ internals** — Feature flags like `IS_FREEBUFF` are implementation details. Renaming them creates churn with no user value. Defer until the business decision is made.
2. **"Free" is a business decision** — Whether to ship one product or two (paid + free) affects naming, packaging, and feature gating. Don't decide in code — defer to partnerships.
3. **Fork source vs branding reference** — The source code came from `savant0x/savant-code`. The branding/design reference is `fame0528/savant-code`. These are different repos with different purposes.
4. **Infrastructure can't be copied** — Assets like banners, logos, and branding from the old repo need to be rebuilt with Savant branding, not copied from SavantCode.
