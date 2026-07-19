# FID-2026-0718-018 — high — Pre-Push Doc House-Cleaning + README Realignment + dev/ Org

**Status:** Step 5 ✅ DONE (FID archival sweep complete per user tightening). AUDIT pending user approval of 4 inline decisions for remaining Steps 1-4, 6-8.
**Severity:** high (pre-push; docs must align with 0.0.2 pre-rebrand snapshot per FID-017 Option C)
**Opened:** 2026-07-19
**Updated:** 2026-07-19 (Step 5 sweep complete per user "no files out of place" directive)

---

## Problem (RED)

Pre-push house-cleaning per user request. User tightened scope on 2026-07-19: "no files can be out of place, all completed FIDs must be updated and moved to archive." Discovery found:

- 17 README drifts, 5 CONTRIBUTING drifts, 3 AGENTS drifts, 2 stray `@savant-code/*` pkg names
- 4 straggler ECHO-format FIDs in `dev/fids/` root (FID-2026-0717-013-tests, FID-2026-0718-010-stuck-state-cleanup, plus 2 pre-ECHO format files: `SavantCode Rebranding And Migration Plan.md`, `FID-savant-code-rebrand.md`)
- Stale `dev/session-summaries/` (latest 2026-07-17, no entry for 2026-07-18 → 19)
- Duplicate `coding-standards/release-workflow.md` vs `.agents/skills/release-workflow/SKILL.md`

---

## GREEN Plan Progress

### Step 5 ✅ DONE — FID Archival Sweep (2026-07-19)

**Files moved from `dev/fids/` to `dev/fids/archive/` + renamed to ECHO format:**

| Source (in `dev/fids/`) | Destination (in `dev/fids/archive/`) | Renamed to ECHO format? |
|------------------------|---------------------------------------|------------------------|
| `FID-2026-0717-013-tests.md` | `FID-2026-0717-013-tests.md` | already ECHO |
| `FID-2026-0718-010-stuck-state-cleanup.md` | `FID-2026-0718-010-stuck-state-cleanup.md` | already ECHO |
| `SavantCode Rebranding And Migration Plan.md` | `FID-2026-0717-014-savant-code-rebrand-migration-plan.md` | ✅ renamed |
| `FID-savant-code-rebrand.md` | `FID-2026-0717-015-savant-code-rebrand.md` | ✅ renamed |

**CHANGELOG.md updated** — 4 new FID entries prepended at top (above FID-2026-0718-017):
- FID-2026-0718-010 (closed 2026-07-18, archived 2026-07-19)
- FID-2026-0717-015 (closed 2026-07-19, archived 2026-07-19 — pre-ECHO doc retrofit)
- FID-2026-0717-014 (closed 2026-07-19, archived 2026-07-19 — superseded by FID-006)
- FID-2026-0717-013 (closed 2026-07-19, archived 2026-07-19 — pre-ECHO tests harness)

**Final state:** `dev/fids/` root contains ONLY:
- `archive/` (directory)
- `.gitkeep`
- `FID-2026-0718-018-pre-push-house-cleaning.md` (THIS FID — awaiting user approval)

`git add -A` staged. Archive count went from 45 to 49 FIDs.

---

## Remaining GREEN Plan Steps

### Step 1 (15 min) — README rewrite: fix 17 drifts + add ECHO Perfection Loop section
### Step 2 (2 min) — Stray pkg names: sed-revert 2 package.json files (`sdk/test/tree-sitter-queries`, `scripts/tmux/tmux-viewer`)
### Step 3 (10 min) — CONTRIBUTING.md rewrite: "open source monorepo governed by ECHO v0.2.0" + FID workflow subsection
### Step 4 (5 min) — AGENTS.md rewrite: drop outdated `docs/*` refs + add ECHO/FID/skill subsections
### Step 6 (3 min) — Write `dev/session-summaries/2026-07-19-pre-push-house-cleaning.md` covering 2026-07-18 → 19 work
### Step 7 (1 min) — Delete `coding-standards/release-workflow.md` (FID-002 already canonical)
### Step 8 — Verify: typecheck × 4 (no source changes expected — verify no spurious effects) + grep verifications + Nova outbox close-out + FID-018 archive

**Remaining total:** ~40 min for Steps 1, 2, 3, 4, 6, 7; Step 8 = ~10 min.

---

## 5-Question Compliance (Law 15)

| Question | Answer |
|----------|--------|
| 1. ALL cases covered? | ✅ All drifts + FID archival sweep addressed |
| 2. 1000-agent scale? | ✅ no impact |
| 3. Hostile-attacker safe? | ✅ no code |
| 4. 2-year maintainable? | ✅ docs aligned with state |
| 5. Industry-standard? | ✅ ECHO Auto-Archive |

---

## Compliance Checklist

- **Law 1** (Read 0-EOF): every drift file reviewed pre-edit ✅
- **Law 2** (Present Before Act): THIS FID is the present ✅
- **Law 3** (Verify Before Proceed): typecheck × 4 + grep verification post-FORGE
- **Law 13** (Utility-first no duplication): orphan FIDs archived; duplicate skill will be deleted ✅

---

## 4 Inline Decisions for User Approval

### Decision 1: README positioning
- **A ✅ (Recommended):** Pre-rebrand snapshot. README uses `@savant-code/X` + `savant-code`/`savant-free` npm names. `savant-code` retained as CLI binary NAME per `cli/package.json` `bin` field with footnote.
- B: Aspirational Savant across the board (false claims).
- C: Badge-only update.

### Decision 2: CONTRIBUTING.md framing
- **B ✅ (Recommended):** Full rewrite as ECHO Protocol contributor guide (~10 min). Includes FID workflow subsection.
- A: Minimal prepend.
- C: Replace file with pointer to ECHO.md.

### Decision 3: dev/ cleanup scope (Step 6)
- **B ✅ (Recommended):** Standard — write missing 2026-07-19 session summary.
- A: Skip session summary.
- C: Also refresh dev/LEARNINGS.md top entry.

### Decision 4: Duplicate `coding-standards/release-workflow.md` (Step 7)
- **A ✅ (Recommended):** Delete (FID-002 already canonical).
- B: Move inline into .agents/skills/coding-typescript/.
- C: Keep both (ECHO Law 13 violation).

---

## Status

**Step 5 DONE.** AWAITING USER APPROVAL of Decisions 1-4 for remaining Steps 1, 2, 3, 4, 6, 7, 8. Once approved: complete FORGE → archive FID-018 + add CHANGELOG entry + Nova outbox close-out → 0.0.2 push (you run that yourself).
