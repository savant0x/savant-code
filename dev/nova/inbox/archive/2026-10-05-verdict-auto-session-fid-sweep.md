# Nova Verdict — Auto Session FID Sweep (1004-005 → 1005-004) + Working-Tree State

**Date:** 2026-10-05
**Auditor:** Nova (source-verified; `bun`/`grep`/file reads against `C:\Users\spenc\dev\savant-code`)
**Scope:** Nine FIDs closed by the overnight auto run (FID-2026-1004-005, -007, -008; FID-2026-1005-001 through -004), with focus on FID-2026-1005-003 (self-improving harness skill quality, severity high). Plus working-tree/commit state.

---

## Headline

**The code is real. The proposer is wired. The receipts are missing. And none of it is committed.**

Verdict: **CONDITIONAL** — no source defect found; two process gaps block this from being "done."

---

## Per-Claim Verification

| # | Claim | Source says | Verdict |
|---|---|---|---|
| 1 | FID-1005-003 headline gap: "`buildDraftingPrompt`/`recordProposal` have no production invocation" — now fixed | `common/src/util/skill-proposals.ts:183` `prepareCandidateHandoff()` calls `recordProposal` (L208) and `buildDraftingPrompt` (L216); imported by `scripts/lessons-to-skills.ts:28` — a production script, non-test | **PASS** |
| 2 | `computeRecurrences` counts records, not distinct sessions — fixed | `scripts/experiences-dedup.ts:158-190`: `distinctSessions = new Set(inWindowFiltered.map(r => r.sessionId)).size`, with comment `FID-2026-1005-003 Step 1`. Consumed at `lessons-to-skills.ts:120` | **PASS** |
| 3 | All 9 FIDs legitimately closed | All 9 in `dev/fids/archive/`, status `closed`, 1005-003 grown to 29.6KB with 6/6 code-verification steps checked | **PASS** |
| 4 | Honest disclosure of open gates | Resolution names 2 NEEDS-REVIEW items (capture-to-trust needs operator TUI; desktop event-log consumer) rather than claiming them closed | **PASS** (correctly withheld, not faked) |
| 5 | Closure rule: "receipt is machine-stamped at closure by `bun run fid:verify <path> --write`" | **7 of 12 closed FIDs have NO `### Verification Receipt` section at all**: 1004-005, 1004-007, 1004-008, 1005-001, 1005-002, 1005-003, 1005-004. The 5 that DO have it (1004-001 through -004, -006) are populated. Stamping script exists (`scripts/fid-receipt-stamp.ts`, `scripts/fid-verify.ts`, `fid:verify` in package.json) and was not run | **FAIL** (process, not code) |
| 6 | G2 withheld — "commit pending operator git execution" | Correct per standing rule: agents never commit. HEAD remains `45d9a811` (10/04 20:07) | **PASS** (rule followed) |

## Working-Tree Risk Assessment

**147 uncommitted files. 8 untracked archived FIDs. Zero commits since 10/04 20:07.**

| area | files |
|---|---|
| dev/fids | 41 |
| cli/src | 40 |
| root | 27 |
| dev/wiki | 14 |
| common/src | 12 |
| sdk/src + agent-runtime | 5 |
| other | 8 |

Every FID closure since 20:07 — including the entire 1005 series — **exists only on the working tree.** The inter-agent-message-integrity fix, the sidebar audit, the skill-quality implementation, the provider runbook: one `git checkout .` or a bad `%TEMP%` event (we have precedent: 192GB of crash fixtures on 10/03) erases all of it.

**This is the single highest-risk item in the repo right now.** Recommended commit split, in order:
1. `fix(skills):` distinct-session recurrences + proposer wiring (1005-003 core)
2. `feat(harness):` inter-agent message integrity + sidebar audit (1005-001/002)
3. `docs(fids):` archive the 9 closed FIDs + session summaries
4. `feat(providers):` intern InkStone + registry reference + runbook (1004-005/-007/-008, 1005-004)

## The Pattern (same class, again)

The missing receipts are **the silent-zero class in the closure pipeline itself**: the FID says `closed`, the status is true, the receipt — the machine-verified proof — is absent, and nothing fails. The FID template's own rule ("a hand-written placeholder is not a receipt") exists precisely to catch this, and the archive shows the rule was not enforced by the closure script.

If `fid-verify.ts` can detect an open FID, it can detect a closed FID missing a receipt. Suggested gate: **archiving a FID without a populated receipt section fails `validate:repository`.** That turns this from a spot-audit finding into a structural impossibility.

## Blockers Before This Is "Done"

1. **Run `bun run fid:verify dev/fids/archive/FID-2026-1004-005... --write` (etc.) for the 7 receipt-less FIDs** — or re-run the closure battery and stamp. Six gates ran green per the resolution; the receipts should be recoverable from pasted output.
2. **Commit the working tree** in the 4 logical chunks above (operator executes — G2).
3. Non-blocking: the two disclosed NEEDS-REVIEW gates (operator TUI session; desktop event-log consumer) stay open items, correctly tracked.

## Files Read

- `dev/fids/archive/FID-2026-1005-003-self-improving-harness-skill-quality.md` (0–EOF, 29.6KB)
- `common/src/util/skill-proposals.ts` (exports + L183-260 call path)
- `scripts/experiences-dedup.ts` (computeRecurrences, L158-190)
- `scripts/lessons-to-skills.ts` (import + L120 consumption)
- `scripts/session-end-review.ts`, `cli/src/commands/skills-discovery.ts` (import graph)
- All 12 closed 1004/1005 FIDs (receipt-section presence scan)
- `package.json` (fid:verify wiring), `scripts/` inventory