# Session 2026-09-09 — Release gate-chain hardening program (001 → 003 → 002)

**Protocol:** single-agent ECHO v0.1.2 (strict) · **Operator approval:** Law 2
presentation → "Approve the full 001→003→002 program and implement all three
sequentially" · **Coordination master:**
`dev/build-orders/BO-2026-09-09-gate-chain-hardening.md`

## Outcome

All three v0.0.30-cut FIDs implemented in the mandatory order, closed,
archived, receipt-stamped, and CHANGELOG'd. The active FID queue is empty.

| FID | Fix | Evidence |
|---|---|---|
| `-0909-001` (low) | Self-healing clean-checkout lifecycle: pre-create remove-if-exists guard, removal-result capture with loud warning, filesystem `rmSync` fallback — new `scripts/public-release/clean-checkout.ts` (all command + fs surfaces injected) | 12/0 + 11/0 + 9/0 suites; live git-ordering probe (unregistered orphan → `worktree remove` exit 128, dir intact → fs fallback required); commit `086565b` |
| `-0909-003` (medium) | `assertCleanCheckoutCompiles` accepts `extraGates` (release chain byte-identical); `verify:clean` opts into `build:sdk` | Live drill BOTH legs: planted TS2339 (commit `1fbb1e06`) → verify:clean FAIL fail-closed, no checkout debris (proves 001 in the incident scenario); clean `086565b6` → PASS 146.0s; commit `086565b` |
| `-0909-002` (medium) | `scripts/audit-gate-env-parity.ts` (pure detector + git-tracked-surface collector) wired into `validate:repository` as `audit.gate-env-parity`; classes 1–2 mechanical, one path-exact exemption (pinned-bun contract probe), class 3 behaviorally pinned by the env-bootstrap suite | First live run caught TWO real class-1 defects (`scripts/bump-version.ts:138/156` bracket-shape `'bun'` spawns → fixed to `process.execPath`); prove-the-guard drill both legs (planted `import.meta.dir` in scratch worktree → FAIL with file:line precision; restored → PASS) |

## Loop-vs-code deltas worth remembering

- FID-002's Step-1 inventory grep matched only the paren spawn shape
  (`spawn('bun'`); the guard's bracket-shape pattern
  (`Bun.spawnSync(['bun', ...])`) immediately found two real defects the
  inventory had missed — the guard earned its keep on its first run.
- `quality-report.ts` enforces line counts only (`max_params` advisory);
  no ESLint max-params rule — the 4-positional + options signature was a
  convention choice, not a gate constraint.
- The FID gates parser (`fid-verification-gates.ts`) accepts only
  `- gate:` lines, the receipt, and `- ` bullets between
  `## Verification Gates` and the next `##` — bare prose inside the span
  is a parse error.
- Windows drill mechanics: `MSYS2_ARG_CONV_EXCL="*"` + relative paths for
  `cmd /c mklink /J`; node_modules junction lets a scratch worktree run
  the toolchain; remove the junction with `cmd /c rmdir` BEFORE `rm -rf`
  (`rmdir` removes only the link, never the target).
- `bunx --no-install` can still trip plugin resolution when transitive
  deps (`@babel/core`) are missing from node_modules — `bun install`
  restored integrity; use `node_modules/.bin/eslint` for direct runs.

## Gates (program battery)

scripts surface **326/0 across 45 files** · typecheck ×4
(sdk/common/agent-runtime/cli) exit 0 · eslint `--max-warnings 0` on all
touched files · lint:md PASS · prettier clean · `validate:repository` PASS
with the new audit gate live · receipts re-stamped at all three archived
paths (`fid:verify` exit 0 each).

## Commits

1. `086565b` — fix(release): self-healing clean-checkout lifecycle +
   verify:clean SDK declaration gate (FID-2026-0909-001, FID-2026-0909-003)
2. FID-002 guard + wiring + real-defect fixes
3. Governance close-out (FID archives, ledger, SCOPE, build order,
   session summary)

## Boundaries carried (operator-owned, never claimed)

- FID-001's live recovery drill at the next real release cut.
- The next cut is the operator's; this program only hardened the gates.
