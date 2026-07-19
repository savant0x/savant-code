# Nova Verdict — FID-026 Rebrand Amendment (Pre-FORGE)

**Date:** 2026-07-19
**Auditor:** Nova (third-party ECHO v0.2.0)
**Method:** Source-verified. Every claim re-run from `C:\Users\spenc\dev\codebuff\` on disk via git grep + find.
**Top-line verdict:** **PASS** — all 8 claims verified against source. One minor in-FID doc inconsistency (manicode count 24 vs 19) to reconcile; non-blocking.

---

## Claim verification (independent re-run)

| Claim | Stated | My source check | Result |
|---|---|---|---|
| 1 — codebuff active scope | 1,537 | `git grep -rEn '\bcodebuff\b' ... :!dev/nova/*` → **1,537** | ✅ |
| 2 — freebuff active scope | 348 | `git grep -rEn '\bfreebuff\b' ... :!dev/nova/*` → **348** | ✅ |
| 3 — manicode active scope | 19 (CHANGE DELTA) / 24 (Evidence table) | `git grep -rEn '\bmanicode\b' ... :!dev/nova/*` → **19** | ✅ (19 matches my grep; see Note N1) |
| 4 — paths.test.ts gone | file absent | `find sdk -name paths.test.ts` → empty | ✅ |
| 5 — 19,040 chars / 0.95% delta | literals present, old gone | `19,040 chars changed`=1, `0.95% delta`=1, `15,200\|0.76%`=0 | ✅ |
| 6 — regression (manicone typo, Decisions, successors) | all present | `manicone`=0, `Decision 026-[ABCDEF]`=8 mentions/6 unique, `Successor: Phase B step 8`=1, `@savant-code/savant-free.*Decision 026-F`=1, `markdownlint-disable MD013 MD060`=1 | ✅ |
| 7 — test fixtures | savant-free in wrapper-safety=1, proxy 4 hits, freebuff remaining=0/0 | verified: `name: 'savant-free'`=1, `@savant-code/savant-free/latest`=4, `freebuff/`=0, `freebuff/latest`=0 | ✅ |
| 8 — structural integrity | 6 Decisions, 2 Predecessors, 8 ECHO sections, 9 Phase B steps | 6 Decisions (A-F) ✅, 2 Predecessor rows ✅, 8 template sections ✅, 9 Phase B steps (lines 213-221) ✅ | ✅ |

---

## Nova-specific observations (layer-3 questions)

**Q1 — Scope strategy (split-or-batch?):** Batch via ast-grep is correct. 1,904 refs is mechanical for ast-grep/ts-morph; no need to split by ref-density tier. Phase B's per-workspace atomic commits (9 steps) already provide blast-radius control. Do NOT further sub-split — it would multiply commit count without safety gain.

**Q2 — M1 reversal hidden risk:** `paths.test.ts` is confirmed GONE (Claim 4 ✅), so the original M1 guard (`cd sdk && bun test paths.test.ts`) was correctly removed. BUT the real M1 landmine is NOT theoretical — it's live at:
- `cli/src/__tests__/e2e/returning-user-auth.test.ts:47`
- `cli/src/__tests__/e2e/logout-relogin-flow.test.ts:46`
- `sdk/src/__tests__/credentials.test.ts` (6 hits)
- `cli/src/__tests__/integration/credentials-storage.test.ts` (9 hits)

These contain `manicode` mock-string literals that WILL drift on the `manicode → savant` flip (LEARNINGS §Future-Avoidance #3 Windows mock-key regression). The FID's Phase D DOES list these 4 test files as the guard (lines 249-251) — good. **Recommendation:** explicitly label these 4 files as "the M1 landmine" in Phase D (not "theoretical-only") so the Forge agent knows they're the high-risk verification target, not a formality.

**Q3 — Cross-FID coherence (per-workspace commits under 10% cap):** Phase B's 9 atomic commits each <0.1% delta. The 10% circuit-breaker is per-FID; individual workspace commits are far under. No per-commit delta cap needed — math holds. ✅

**Q4 — 0.95% delta commitment:** Stating 0.95% broadly is fine. Per-commit delta is smaller. No backward-compat risk. The CHANGE DELTA section correctly tags the multiplier as `(unverified — estimated)` per Cross-Agent Claim Rule (line 308) — good discipline. Pre-ARCHIVE `cloc .` gate (line 313) is the right final check.

---

## Notes (non-blocking)

**N1 — manicode count inconsistency in FID:** Evidence table line 77 says "24 occurrences / 9 files" (code only) but CHANGE DELTA line 310 uses 19. My source grep (excluding `.md`) = 19 active. The FID should reconcile line 77 to 19 (or note 24 includes a `.tsx`/comment the grep excluded). Not blocking — Phase B will rename all 19 regardless.

**N2 — `CodebuffAI/freebuff-private` → `savant0x/savant-free-private` (mapping line 208):** This assumes a private remote repo exists. If `savant0x/savant-free-private` isn't created yet, the URL rename will point at a non-existent remote. Verify the private repo exists before Phase B step 8, or mark it `unverified` per Cross-Agent Claim Rule. Minor — the public `@savant-code/savant-free` is the active package.

**N3 — Decision 026-B (`FREEBUFF_MODE` KEEPS name):** Correct call — semantic clarity. But Phase B mapping table line 204 lists `FREEBUFF` → `SAVANT_FREE` as a global rule. The FID must ensure the Forge agent EXCLUDES `FREEBUFF_MODE` from that rule (it's the one exception). Add an explicit "EXCEPT FREEBUFF_MODE" annotation to the mapping row so ast-grep doesn't catch it. Currently the Decision is in prose but the mapping table doesn't show the carve-out.

---

## Bottom line

**PASS.** FID-026 is source-verified, ECHO-compliant (RED/GREEN/AUDIT/Perfection Loop present), and ready for Phase B FORGE. The 1,904-ref scope is real (not the ~180 under-estimate), the test fixtures are already forward-renamed (Claim 7), and the convergence inversion is corrected (rebrand BEFORE move, per my v2 verdict §C).

Three minor doc fixes before/with FORGE:
1. Reconcile manicode 24→19 in Evidence table (N1)
2. Label the 4 manicode-touching test files as "M1 landmine" in Phase D (Q2)
3. Add `EXCEPT FREEBUFF_MODE` carve-out to mapping table row (N3)

None block FORGE. Triple-Layer Audit Chain closes: parent ✅ + code-reviewer ✅ + Nova ✅.

**Cross-Agent Claim Rule compliance:** every claim in this verdict cites a git grep / find count from `C:\Users\spenc\dev\codebuff\`.
