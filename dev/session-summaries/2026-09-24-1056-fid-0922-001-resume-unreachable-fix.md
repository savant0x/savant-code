# Session Summary — 2026-09-24 10:56

**FID-2026-0922-001 implemented, closed and archived: the `--resume` deadlock is
fixed and the npm read-after-write now retries. Receipt 3/3 live at the archived
path.**

Continues `2026-09-22-1900-v0033-release-verified-and-resume-deadlock.md` (that
summary is left intact per this directory's no-rewrite rule).

## Trigger

Operator instruction: read the single-agent protocol 0-EOF and ground in the
project, then — presented with the two remaining level-1 items — authorize
implementation of FID-2026-0922-001 (the guard fix the 2026-09-22 ruling had held
to "document only"). SCOPE Task 84 was opened by discovery during the same pass.

## Grounding (before any edit)

Single-agent governance confirmed and used: `ECHO-single-agent.md` is the marker
(`ECHO.md` v0.2.0 does **not** govern a solo session), `dev/echo-v0.1.2-single-agent.md`
read 0-EOF as the operating protocol, `protocol.config.yaml` (`strict_mode: true`,
`autonomy_level: 3`), `coding-standards/typescript.md`, `dev/LEARNINGS.md` 0-EOF,
the active FID queue (exactly one record), and `SCOPE.md`.
The FID's central claim was re-verified live before touching anything: the
on-origin branch returned `block` unconditionally and the suite pinned only the
mutation-mode and local-only cases — the record was not drifting.

## RED (both legs failed against the unmodified tree)

```text
$ bun test scripts/__tests__/pre-audit.test.ts scripts/__tests__/public-release-npm-guards.test.ts
(fail) checkStaleTag > tag on origin is kept in resume mode (finishing the shipped release)
Expected: "warn"
Received: "block"
# Unhandled error between tests
SyntaxError: Export named 'npmVerifyPollIntervalMs' not found in module
'C:\Users\spenc\dev\savant-code\scripts\public-release\npm-guards.ts'.
 13 pass / 2 fail / 1 error
```

Two different failure shapes on purpose: an assertion failure (the guard ignores
its own `resume` parameter) and an absent capability (no bounded npm window).

## GREEN (five files)

| File | Change |
|---|---|
| `scripts/public-release/pre-audit-local.ts` | on-origin + `resume` ⇒ `warn` (kept); mutation mode still blocks a re-cut |
| `scripts/public-release/npm-guards.ts` | `npmVerifyTimeoutMs` / `npmVerifyPollIntervalMs` + `awaitPublishedPackage`; `verifyPublishedPackage` awaits it |
| `scripts/public-release/env-ms.ts` (new) | `positiveEnvMs` extracted — one parse, two retry windows (Law 13) |
| `scripts/public-release/assets.ts` | imports the shared parse; private copy removed (no behavior change) |
| `scripts/public-release/stages-verify.ts` | awaits `verifyPublishedPackage` |

## AUDIT

| Gate | Result |
|---|---|
| Pre-audit + npm-guards suites | **17 pass / 0 fail** (44 expects) |
| Release suites + validation-manifest | **138 pass / 0 fail** (22 files, 413 expects) |
| Scripts tree (67 files, minus the two process-spawning e2e suites) | 523 pass / 0 fail after the self-inflicted red was cleared |
| `bun run typecheck` | exit 0 (12 workspaces) |
| `eslint . --max-warnings 0` | exit 0 (two import-order warnings found in the new suite and fixed) |
| `prettier --check .` · `lint:md` | clean · exit 0 |
| `quality:report` · `validate:repository` · `version:check` | PASS (1498 baselined files) · PASS · PASS |
| Receipt (`fid:verify --write`) | **3/3 gates exit 0**, stamped into the FID |

Call-graph reachability (Law 4): `main()` → `runPreAudit` (`transaction.ts:245`) →
`checkStaleTag(root, version, mode === 'resume')` (`pre-audit.ts:29`) for the guard,
and `main()` → `runPostReleaseVerifyStage` (`transaction.ts:214`) →
`verifyPublishedPackage` (`stages-verify.ts:113`) → `awaitPublishedPackage`
(`npm-guards.ts:154`, `:127`) for the retry. Both new helpers have production
readers; `positiveEnvMs` has two.

## Adversarial pass

Four challenges, each answered with evidence rather than reasoning:

1. **Does the `warn` weaken the re-cut guard?** No — mutation mode still blocks
   (pinned), and a re-cut reaching `--resume` fails at `preflight.ts:126-141`
   (the tag must dereference to release HEAD) plus the receipt HEAD binding
   (`transaction.ts:139`).
2. **Is the retry fail-open?** No — only the not-found class is retried;
   `packageIsPublished` calls `fail()` on every other npm outcome. Expiry fails
   closed with the `--resume` remediation (pinned).
3. **Are the pins tautological?** Proven not: collapsing the window to single-shot
   makes the absorb pin fail in 0.73 ms (source restored afterwards).
4. **Is the pin hermetic?** Corrected mid-loop — the first absorb leg drove the
   whole stage boundary and died in the real `npm pack` step, so the retry is now
   pinned at its own exported seam and the stage wiring is proven by the census.
   The correction is recorded in the FID and promoted to LEARNINGS.

## Records

- `dev/fids/FID-2026-0922-001-resume-unreachable-after-git-push.md` — `analyzed` →
  **`verified`**; Steps all `[x]`; new gate declared; Loop 2 (RED/GREEN/AUDIT/
  ADVERSARIAL with the transcriptions above); 3 new Missed Questions including the
  two deliberate boundaries (why the retry is not inside `packageIsPublished`, and
  that the `npm pack` step is the known unproven edge); Resolution + receipt.
- `SCOPE.md` — T83-C completed with evidence; **Task 84** opened for the newly
  discovered gap (`scripts/` has no standing type-check surface; measured 117
  errors under a root-inherited `scripts/**` probe), blocked pending an operator
  ruling because closing it edits the fail-closed release gate battery.
- `dev/fids/README.md` — new 2026-09-24 ledger block; the 2026-09-22 entry is kept
  as history with its "document only" ruling marked superseded.
- `dev/LEARNINGS.md` — two new governed lessons: a networked downstream step
  defeats a boundary pin (`networked-downstream-defeats-boundary-pin`), and a mode
  parameter must be pinned on every branch that returns a verdict
  (`pin-mode-parameter-on-every-verdict-branch`).

## Closure (same session, operator directive)

Operator: "Close and archive FID-2026-0922-001 now that the fix is verified." The
ceremony ran in the established order: status `verified` → `closed`; the
Resolution restructured to the closure format (Closed Date / Fix Description /
Tests Added / Verification Evidence / Archived); the file moved to
`dev/fids/archive/`; the receipt re-stamped LIVE at the archived path from a fresh
three-gate run (**3/3 exit 0**, `sha256:a3fe41e4…`, `2026-09-24T15:21:06Z`) so the
closed record is byte-consistent with its final content; then the CHANGELOG
subsection, the `archive/README.md` index entry, the `dev/fids/README.md` ledger
block and the SCOPE.md T83-C closure note. **The active FID queue is empty.**

## Open items

- **G2 (operator):** the commit. Nothing was committed this session. The record is
  `closed` on the operator's directive with file:line + receipt evidence (the
  evidence form the FID Lifecycle rule admits when the commit is withheld); the
  commit SHA stays pending operator git execution.
- **T83-E (operator):** drop `backup-pre-rewrite-20260922` (local-only hygiene).
- **Task 84 (operator ruling):** whether `scripts/` gains a standing type-check
  surface, and if so whether it is narrowed to the release modules.
- **Known unproven edge (recorded in the FID, not actioned):** a transient
  tarball-unavailable state after a successful version read would still fail the
  `npm pack` inspection.
