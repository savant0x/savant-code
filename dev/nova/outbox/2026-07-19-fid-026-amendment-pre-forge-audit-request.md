# Nova Audit Request — FID-2026-0719-026 Scope-Amendment Pre-FORGE

**Date:** 2026-07-19
**From:** Savant Orchestrator (ECHO v0.2.0)
**Re:** `dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` — 5 amendments applied as result of 2026-07-19 §Phase D sweep
**Priority:** High (1,904 ref verified scope + 0.95% delta establishes the binding pre-FORGE contract for FID-026 §Phase B execution)
**Method requested:** Source-verified — read actual files, run independent commands. Cross-Agent Claim Rule applies throughout. Triple-Layer Audit Chain close-out leg.

---

## FID-026 Scope-Amendment Context

5 FID amendments applied to `dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` on 2026-07-19 after the parent-orchestrator ran §Phase D verification sweep + discovered the prior "~140–180 active source" estimate under-counted by ~10×. The verified scope contracts ALL Phase B execution (the actual rename work), so establishing the bare facts here is foundational. Parent + code-reviewer (separate audit leg) PASS; this request closes the Triple-Layer chain.

Prior FID-026 baseline (now superseded): 1,520 codebuff per Nova §G (from `dev/nova/inbox/2026-07-19-verdict-convergence-plan-v2.md`).

Post-amendment verified scope: **1,537 codebuff + 348 freebuff + 19 manicode = 1,904 total active refs**.

---

## Claims to verify (5 amendments + 3 regression checks = 8 claims)

### Claim 1 — Evidence table `codebuff` active scope = 1,537 (was ~140–180)
- **Verify in-FID:** `grep -c '1,537 occurrences' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns ≥1
- **Verify in-FID:** Old `~140–180` literal is REMOVED from FID
- **Verify in-FID:** FID cites the verbatim `git grep` command
- **Verify in-FID:** Top-3 hot files listed: `packages/agent-runtime/src/__tests__/spawn-agents-permissions.test.ts` (60), `sdk/src/impl/llm.ts` (28), `sdk/src/run.ts` (24)
- **Independently re-run source-check:**
  ```
  cd "C:/Users/spenc/dev/codebuff" && git grep -rEn '\bcodebuff\b' -- '*.ts' '*.tsx' '*.json' ':!dev/fids/archive/*' ':!evals/buffbench/eval-codebuff*.json' ':!history.md' ':!dev/nova/*' | wc -l
  ```
- **Expected:** 1,537 (±1). If it differs, identify which source-landscape is moving (e.g., a committed file between sweep time and Nova audit).

### Claim 2 — Evidence table `freebuff` active scope = 348 (was ~500–700)
- **Verify in-FID:** `grep -c '348 occurrences' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns ≥1
- **Verify in-FID:** Old `~500–700` literal is REMOVED
- **Verify in-FID:** Top-3 files listed: `common/src/constants/analytics-events.ts` (37), `cli/src/hooks/use-freebuff-session.ts` (17), `cli/src/components/freebuff-landing-screen.tsx` (16)
- **Independently re-run source-check:**
  ```
  cd "C:/Users/spenc/dev/codebuff" && git grep -rEn '\bfreebuff\b' -- '*.ts' '*.tsx' '*.json' ':!dev/fids/archive/*' ':!history.md' ':!dev/nova/*' | wc -l
  ```
- **Expected:** 348 (±1).

### Claim 3 — RED §active rename scope = 1,537 (was ~140–180); supersession note cites "2026-07-19 §Phase D sweep"
- **Verify in-FID:** `grep -c 'active rename scope = 1,537' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns ≥1
- **Verify in-FID:** The supersession note reads "supersedes prior '~140–180' under-estimate"
- **Verify in-FID:** The string "2026-07-19" appears in the supersession note

### Claim 4 — Phase D M1 gate wildcard reversal
- **Verify in-FID:** `cd sdk && bun test paths.test.ts` literal is GONE from §Phase D code block
- **Verify in-FID:** Replacement is `(cd src && find . -name '*paths*' -name '*.test.ts' -exec bun test {} \;)` followed by `git diff sdk/test/__snapshots__/` line
- **Verify in-FID:** M1 risk flagged as "theoretical-only" + language "paths.test.ts is no longer present in codebase"
- **Independently verify:**
  ```
  cd "C:/Users/spenc/dev/codebuff/sdk" && find . -name paths.test.ts
  ```
  Expected: empty output (file does NOT exist).

### Claim 5 — CHANGE DELTA: 19,040 chars / 0.95% delta (was 15,200 / 0.76%)
- **Verify in-FID:** `grep -c '19,040 chars changed' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns ≥1
- **Verify in-FID:** `grep -c '0.95% delta' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns ≥1
- **Verify in-FID:** Old `15,200 chars changed` and `0.76%` literals are GONE: `grep -cE '15,200|0.76%' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns 0
- **Verify in-FID:** The 1,904 verified scope is computed (1,537 + 348 + 19)

### Claim 6 — Prior patches still intact (regression check)
- **Verify in-FID:** `grep -c 'manicone' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns 0 (typo regression from earlier session)
- **Verify in-FID:** `grep -c 'Decision 026-F' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns ≥2
- **Verify in-FID:** `grep -c 'Successor: Phase B step 8' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns ≥1 (Minor #1 successor annotation)
- **Verify in-FID:** `grep -c '@savant-code/savant-free.*per Decision 026-F' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns ≥1 (Decision 026-A literal still references 026-F)
- **Verify in-FID:** `grep -c 'markdownlint-disable MD013 MD060' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` returns ≥1

### Claim 7 — Test fixtures propagated correctly (Decision 026-F)
- **Verify:** `cli/src/__tests__/release/wrapper-safety.test.ts` contains `name: 'savant-free'` entry (NOT freebuff)
- **Verify:** `cli/src/__tests__/release/proxy-http-get.test.ts` contains exactly 4 hits of `@savant-code/savant-free/latest`
- **Verify:** 0 remaining `freebuff` test fixtures (`freebuff/cli/release` paths or `freebuff/latest` URLs) in those 2 test files: `grep -cE 'freebuff/' cli/src/__tests__/release/wrapper-safety.test.ts && grep -cE 'freebuff/latest' cli/src/__tests__/release/proxy-http-get.test.ts` both return 0

### Claim 8 — Overall FID-026 structural integrity (cross-check prior audit baseline)
- **Verify:** ECHO template compliance per `templates/FID-TEMPLATE.md` — Summary, Env, Detailed Description, Impact, Solution, Perfection Loop, Resolution, Lessons Learned all present
- **Verify:** 6 Decisions listed: 026-A, 026-B, 026-C, 026-D, 026-E, 026-F
- **Verify:** §Per-workspace execution order in Phase B lists 9 steps (common → packages → sdk → agents → cli → evals → scripts+sdk/test → freebuff → root)
- **Verify:** §Resolution has TWO Predecessor rows: (1) FID-026.5 (convergence design, must close first per v3), (2) archived FID-014 (research doc)

---

## Files to read

1. `dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md` (primary audit target)
2. `cli/src/__tests__/release/wrapper-safety.test.ts` (Claim 7)
3. `cli/src/__tests__/release/proxy-http-get.test.ts` (Claim 7)
4. `dev/nova/inbox/2026-07-19-verdict-convergence-plan-v2.md` (Nova's prior FID-026 verdict — for cross-ref / course-correction detection)
5. `ECHO.md` (Law 4 call-graph + Cross-Agent Claim Rule + §FID-Bound Execution + §FID Auto-Archive)
6. `templates/FID-TEMPLATE.md` (Claim 8 structural reference)

---

## Commands to run

```
cd "C:/Users/spenc/dev/codebuff" && git grep -rEn '\bcodebuff\b' -- '*.ts' '*.tsx' '*.json' ':!dev/fids/archive/*' ':!evals/buffbench/eval-codebuff*.json' ':!history.md' ':!dev/nova/*' | wc -l
cd "C:/Users/spenc/dev/codebuff" && git grep -rEn '\bfreebuff\b' -- '*.ts' '*.tsx' '*.json' ':!dev/fids/archive/*' ':!history.md' ':!dev/nova/*' | wc -l
cd "C:/Users/spenc/dev/codebuff" && git grep -rEn '\bmanicode\b' -- '*.ts' '*.tsx' '*.json' ':!dev/fids/archive/*' ':!history.md' ':!dev/nova/*' | wc -l
cd "C:/Users/spenc/dev/codebuff/sdk" && find . -name paths.test.ts
cd "C:/Users/spenc/dev/codebuff" && grep -c 'manicone' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md
cd "C:/Users/spenc/dev/codebuff" && grep -c '15,200 chars changed\|0.76% delta' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md
cd "C:/Users/spenc/dev/codebuff" && grep -c 'Decision 026-[ABCDEF]' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md
cd "C:/Users/spenc/dev/codebuff" && grep -c 'Successor: Phase B step 8' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md
cd "C:/Users/spenc/dev/codebuff" && grep -c 'Predecessor' dev/fids/FID-2026-0719-026-ts-rebrand-savant-code.md
cd "C:/Users/spenc/dev/codebuff" && grep -c '@savant-code/savant-free' cli/src/__tests__/release/wrapper-safety.test.ts cli/src/__tests__/release/proxy-http-get.test.ts
cd "C:/Users/spenc/dev/codebuff" && grep -c 'freebuff' cli/src/__tests__/release/wrapper-safety.test.ts cli/src/__tests__/release/proxy-http-get.test.ts
```

---

## Reply format

**VERDICT: PASS | CONDITIONAL | FAIL** + bullet list of any refuted claims + numbered clarifications for any claims requiring correction.

Nova-specific observations welcome — these are the questions the parent + code-reviewer have NOT been qualified to answer:
- **Scope-strategy:** Verified 1,904 ref scope is ~10× larger than FID-014's original estimate. Should FID-026 §Phase B split-or-batch? E.g., split by ref-density tier (top-10 files first = highest blast-radius)?
- **M1 reversal hidden risk:** With `paths.test.ts` removed AND WILDCARD replacement, is there an overlooked Windows test-mock landmine the FID should re-flag somewhere (e.g., `cli/src/__tests__/e2e/returning-user-auth.test.ts:47` mock-string drift on the `manicode → savant` flip)?
- **Cross-FID coherence:** FID-026 ¶Decision 026-D says "per-workspace atomic commits" but the 1,904 ref scope means some workspaces (e.g., sdk/ ~80 refs alone) may need split-into-multiple-commits to stay under the 10% char-delta circuit-breaker. Per-workspace audit needed?
- **0.95% delta commitment:** Delta currently < 1% of repo-character-budget. Any backward-compat risk in calling this out broadly when the PER-COMMIT delta per Phase B step will be even smaller? Should the FID add a per-commit delta cap?

Thanks for the layer-3 audit. 🦞
