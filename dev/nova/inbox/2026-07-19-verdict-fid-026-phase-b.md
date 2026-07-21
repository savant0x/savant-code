# Nova Verdict — FID-026 Phase B Closeout (Pre-Push Audit)

**Date:** 2026-07-19
**Auditor:** Nova (third-party ECHO v0.2.0)
**Method:** Source-verified. Every claim re-run from `C:\Users\spenc\dev\codebuff`.
**Model:** GLM-5.2 (TokenRouter)

---

## VERDICT: CONDITIONAL — 1 hard fix before push

The rebrand is **functionally complete and green**. But the close-out report contains one **false claim** that must be reconciled, plus several undercounted tables that fail ECHO Law 13's documentation standard.

---

## ✅ VERIFIED PASS (source-confirmed)

| Gate | Report claim | Source result | Status |
|---|---|---|---|
| x4 typecheck (sdk/common/agent-runtime/cli) | 0 errors | `tsc --noEmit` all clean | ✅ PASS |
| `@codebuff/` in active code | 0 hits | 0 (16 hits are CHANGELOG.md + inbox verdict, not code) | ✅ PASS |
| `CodebuffClient` in active code | 0 hits | 0 (6 hits are CHANGELOG/session-summary/evals json) | ✅ PASS |
| `IS_FREEBUFF` | 0 hits | 0 | ✅ PASS |
| `codebuff_tool_call` preserved | ~75 | 97 (preserved, correct) | ✅ PASS (count off) |
| `codebuff_terminal_command` preserved | 1 | 1 | ✅ PASS |
| `manicode` config dir preserved | 13 | 13 | ✅ PASS |
| `codebuff_cli` Gravity surface ID | 1 ref | 2 refs (gravity-index.ts:34 + test) | ✅ PASS (count off) |

**Active code is clean. The rebrand mapping is consistent. ECHO Laws 1-4 + 13 satisfied for the rename scope.**

---

## ❌ HARD BLOCKER (must fix before push)

### 1. `codebuff-client.ts` still EXISTS — report claimed "removed"

- **Report (line 31):** "Stale `codebuff-client.ts` removed (0 importers, dead code)."
- **Source:** `./cli/src/utils/codebuff-client.ts` **STILL ON DISK**.
- **Verified:** 0 importers (truly dead), and the file itself contains **NO `CODEBUFF`/`codebuff` refs** — it's a misnamed leftover from an incomplete `git mv` to `savant-code-client.ts`.
- **Action:** Delete it. `rm cli/src/utils/codebuff-client.ts`. It's not referenced anywhere. The "removed" claim is false and must not ship as truth.

---

## ⚠️ DOCUMENTATION FAILURES (ECHO Law 13 — fix in report, not code)

The "Intentionally Preserved" and "Known Remaining" tables are **severely undercounted**. The strings are legitimately kept (wire protocol / legacy / user-data), but the counts are wrong, which violates "every preserved instance has a documented reason" if the doc doesn't reflect reality.

| Item | Report count | Source count | Note |
|---|---|---|---|
| `codebuff_tool_call` | ~75 | **97** | Undercount |
| `codebuff_cli` | 1 | **2** | 2nd = gravity-index.ts:34 (Gravity surface ID) + test |
| `FREEBUFF_MODE` | ~10 | **108** | Wild undercount |
| `CODEBUFF_CLI_*` env vars | "5 instances" | **51** | Severe undercount |
| `freebuff` settings keys | 7 | **23** | Undercount |
| `IS_SAVANT_FREE` | (n/a) | **134** | Not in report; rename succeeded |

**These are NOT code defects** — the strings are correctly preserved. But the close-out report must be corrected to reflect true counts before it's archived as the audit trail.

---

## ECHO LAW ASSESSMENT

| Law | Status | Evidence |
|---|---|---|
| 1 (read 0-EOF) | ✅ | Agent read + modified target files |
| 2 (plan before act) | ✅ | FID-026 existed, 6-phase plan |
| 3 (build+test green) | ✅ | x4 typecheck = 0 errors (verified) |
| 4 (call-graph reachability) | ⚠️ | `codebuff-client.ts` has 0 importers but wasn't deleted |
| 13 (universal logic) | ⚠️ | Mapping consistent; preserved-item counts wrong in doc |

---

## ACTION REQUIRED BEFORE PUSH

1. **DELETE** `cli/src/utils/codebuff-client.ts` (dead, misnamed, report falsely claims removed).
2. **CORRECT** the close-out report's preserved/remaining tables to match source counts (97 / 2 / 108 / 51 / 23).
3. Optional: add a one-line note that `codebuff_cli` 2nd ref is in `gravity-index.ts` (Gravity surface ID for the ad network).

After #1 + #2, this is a **PASS** and ready to push as v0.0.3.

---

## Nova's note

The rebrand is real. 232 files, 2,132 insertions, 927 deletions, zero errors, zero `codebuff` in active code. The 4,000+ hidden errors you excavated this session are GONE. The only thing between you and the push is a dead file the report wrongly says is deleted, and some doc counts that need updating.

Fix the file, correct the doc, push v0.0.3. 🦞

*Written to inbox/ by Nova (GLM-5.2), source-verified 2026-07-19.*
