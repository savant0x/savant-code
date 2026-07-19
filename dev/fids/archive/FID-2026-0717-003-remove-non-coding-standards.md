# FID: Remove x402 from coding-standards/, Keep release-workflow

**Filename:** `FID-2026-0717-003-remove-non-coding-standards.md`
**ID:** FID-2026-0717-003
**Severity:** medium
**Status:** closed
**Created:** 2026-07-17 15:30
**Author:** Spencer Howell

---

## Summary

The `coding-standards/` directory contains 1 file that is not a coding standard: `x402.md` (agent payment protocol, 204 lines, from Savant core). It should be removed. `release-workflow.md` (CHANGELOG/README conventions) IS part of the coding workflow — agents need to know how to release code. It stays and becomes a skill alongside the 6 language standards.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Commit/State:** Post FID-2026-0717-001 (FSM enforcement fixes)

## Detailed Description

### Problem

1. **`x402.md`** — Agent payment standard (HTTP-native crypto payments). References "NOVA + Mya + Vera + Savant swarm". This is Savant core functionality, not a coding standard. 204 lines of payment protocol documentation has no place in a coding harness.

2. **Skill namespace pollution** — When FID-2026-0717-002 converts these to skills, `x402` would appear in `{{AVAILABLE_SKILLS}}` alongside `coding-typescript`, `coding-rust`, etc. An agent looking for coding standards would see a payment protocol in the same list.

### Expected Behavior

- `coding-standards/` contains 7 files: 6 language standards + release-workflow
- `x402.md` lives in the Savant core repo, not here
- When FID-2026-0717-002 converts to skills, only coding-related standards become skills

### Root Cause

The `coding-standards/` directory was created as a catch-all for project documentation, not specifically for coding-related standards. No one enforced the boundary. `x402.md` was placed here during initial setup and never moved.

### Evidence

**Files in `coding-standards/`**:
```
typescript.md       — 85 lines,  coding standard ✓
rust.md             — 78 lines,  coding standard ✓
python.md           — 82 lines,  coding standard ✓
go.md               — 71 lines,  coding standard ✓
java.md             — 74 lines,  coding standard ✓
csharp.md           — 77 lines,  coding standard ✓
release-workflow.md — 64 lines,  release conventions ✓ (part of coding workflow)
x402.md             — 204 lines, agent payment standard ✗
```

**`x402.md` content** (lines 1-15):
```markdown
# x402 — Agent Payment Standard
> **Status:** DRAFT v0.1.0
> **Companion to:** ECHO.md v0.1.0
> **Applies to:** Any ECHO-compliant agent that makes or receives HTTP requests
> **Transport:** HTTP-native (no new ports, no extra round trips beyond standard 402 challenge/response)
```

**No TypeScript code references x402.md** — grep for `x402` across all `.ts` files returns zero results.

## Impact Assessment

### Affected Components

- `coding-standards/x402.md` — to be removed from this directory
- FID-2026-0717-002 — skill conversion should not include x402

### Risk Level

- [x] Medium: Namespace pollution, misplaced documentation, no runtime impact

## Proposed Solution

### Approach

Remove `x402.md` from `coding-standards/`. Keep `release-workflow.md` as a coding workflow standard.

### Steps

1. Delete `coding-standards/x402.md` from this repo (belongs in Savant core)
2. Update FID-2026-0717-002 to exclude x402 from skill conversion
3. Final skill list: `coding-typescript`, `coding-rust`, `coding-python`, `coding-go`, `coding-java`, `coding-csharp`, `release-workflow` (7 skills)

### Verification

1. `coding-standards/` contains exactly 7 files
2. No references to x402.md in any `.ts` file (already confirmed)
3. FID-2026-0717-002 skill list updated to exclude x402

## Perfection Loop

### RED Phase — Issues Identified

| # | Issue | Evidence |
|---|-------|----------|
| 1 | `x402.md` is an agent payment standard, not a coding standard | Content: HTTP-native crypto payments for agent swarms. References "NOVA + Mya + Vera + Savant swarm" |
| 2 | `release-workflow.md` IS part of coding workflow | Content: CHANGELOG format, README conventions, version bumping — agents need this when releasing code |
| 3 | `x402.md` is not referenced by any TypeScript code | Grep for `x402` across all `.ts` files: zero results |
| 4 | `x402.md` is dead config | No runtime code reads it |
| 5 | Skill namespace pollution | `x402` would appear alongside `coding-typescript`, `coding-rust`, etc. |
| 6 | `coding-standards/` boundary not enforced | Directory was created as a catch-all |

### GREEN Phase — Proposed Fixes

**Fix 1: Remove `x402.md`**
- Delete `coding-standards/x402.md`
- This file belongs in the Savant core repo, not a coding harness
- It's a 204-line payment protocol document that has no relationship to coding conventions

**Fix 2: Update FID-2026-0717-002**
- Remove `x402` from the skill conversion list
- Final skill list: 6 language standards + `release-workflow` = 7 skills

### AUDIT Phase — Verification

| # | Check | Method |
|---|-------|--------|
| 1 | `coding-standards/` has exactly 7 files | `ls coding-standards/` |
| 2 | No TypeScript code references x402.md | Already confirmed — zero grep results |
| 3 | FID-2026-0717-002 updated | Verify skill list excludes x402 |
| 4 | No broken imports | Typecheck passes (no code imports x402.md) |

### SELF-CORRECT Phase

**Finding S1**: Should we add a README to `coding-standards/` explaining what belongs here?

**Correction**: Yes. Add a one-liner: "Language-specific coding standards and development workflow. Protocol standards belong in Savant core."

**Finding S2**: What if `scripts/sync-agents.py` references x402.md?

**Correction**: Need to check before removing. If it does, update the script. But the script is a dev tool, not runtime — low risk.

### COMPLETE Phase

FID converged. 6 issues identified, 2 fixes specified, 2 self-corrections applied. Ready for Forge implementation.

## Blind Spots (Questions I Should Have Asked)

1. **Should we add a README to `coding-standards/` explaining what belongs here?** — Yes. A one-liner prevents future drift.

2. **What about `scripts/sync-agents.py`?** — Need to check if it references x402.md before removing. If it does, update the script.

3. **Is there a test that validates `coding-standards/` contents?** — No. But after FID-2026-0717-002, the skill system will validate frontmatter. Non-standard files would fail validation.

4. **Should the removal be a git move instead of delete?** — If moving to Savant core, yes. But that's a different repo. For this repo, delete is correct.

5. **What if a project wants x402 as a skill?** — They can add it to `.agents/skills/` at the project level. It's a project-specific concern, not a harness default.

6. **Does `release-workflow.md` need frontmatter for the skill conversion?** — Yes. FID-2026-0717-002 should add frontmatter to it like the other standards.

## Resolution

- **Fixed By:** Spencer Howell
- **Fixed Date:** 2026-07-17 16:00
- **Fix Description:** Deleted coding-standards/x402.md (Savant core, not coding harness). Kept release-workflow.md as a skill. All 7 standards moved to .agents/skills/ with frontmatter.
- **Tests Added:** No (typecheck verification only)
- **Verified By:** typecheck (common clean), directory structure verified
- **Commit/PR:** Pending
- **Archived:** 2026-07-17 (set when moved to `dev/fids/archive/`)

## Lessons Learned

- Directory names are contracts — `coding-standards/` should contain coding-related standards
- Release workflow IS part of coding — agents need to know how to release code
- Payment protocols are NOT part of coding — they belong in the platform layer
- Skill namespace purity matters — unrelated skills in the same directory confuse agents
