# Session Summary — 2026-09-19 ~13:30 UTC — FID-2026-0919-021 verification-contract widening

> Operator picked **T66-B** from the SCOPE menu ("FID-007 part 3
> implementation"). Ground-truthing that item found it already complete —
> and the audit of the record it concerns found two real holes in the
> verification contract itself. Both were presented as blocking decisions and
> ruled on before any code changed.

## What T66-B actually was

SCOPE.md read `[ ] T66-B. FID-007 part 3 implementation`; the codebase said
otherwise. Re-verified from disk, not metadata:

- `sdk/scripts/ensure-ripgrep-vendor.ts` + its 4-test suite exist; commit
  `0e0ffcd9` carries both; `package.json:60` `prepare` is the sole production
  caller (Law 4 grep).
- All three declared gates re-run GREEN live: `typecheck sdk` 0; the three
  ripgrep suites 23/0 (57 expects); `quality` PASS (1498 files).

No code was written for T66-B. SCOPE.md was corrected to ground truth.

## Findings presented (both ruled on by the operator)

**T69 — archived receipts are systematically stale.**
`dev/scratchpad/active/fid-receipt-staleness-audit.ts` scanned all 405 FID
files: **284 of 315 `closed` records** carry a fingerprint that no longer
matches their content (31 match — the records re-stamped in the 2026-09-16/17
ceremonies). Causally proven on FID-2026-0918-007 with git blobs: stored
`sha256:3817c5e2…` MATCHED at `6e816902` (status `verified`) and stopped
matching at `3a0fe8dd`, the closure batch commit that flipped the status and
appended the archive line without re-stamping. Invisible to both surfaces:
`--check` reads `dev/fids/` only, and `validateFidVerification` skips every
status outside `fixed`/`verified`. **Ruling: by-design — document it, and stop
skipping silently.**

**T70 — the FID-2026-0918-007 gate-coverage gap.** Two new suites were named
in the record but covered by no declared gate; the FID-2026-0918-006 sweep
reported 0 errors / 0 warnings because its pattern required the literal
"new test" wording and read only the `### Verification` section. **Ruling:
"Both" — amend the record and widen the sweep.**

## Implementation (FID-2026-0919-021, status `verified`)

- `packages/agent-runtime/src/echo/fid-verification-enforcement.ts` (new):
  `parseFidStatus` + `describeVerificationEnforcement`, the single authority
  for "which statuses the contract covers". `validateFidVerification` now asks
  it whether to enforce and still returns `[]` for a skipped record — the
  pre-write tripwire and the scan are unchanged in behavior (pinned).
- `fid-verification-contract-sweep.ts`: the promise rule is now
  whole-document + novelty-marker based (`new`/`added` on the same line as a
  repo-relative `*.test.ts(x)` path, either order), with the pathless branch
  scoped to `### Verification` + `### Implementation Evidence`.
- `scripts/fid-check.ts`: `--check` gained a non-fatal information tier
  naming each active record outside the contract, with the reason.
- `scripts/fid-gates.ts`: its duplicate status set/parser deleted — re-exported
  from the enforcement authority (Law 13; three copies existed).
- `dev/echo-v0.1.2-single-agent.md`: FID Auto-Archive now states that a closed
  record carries no live fingerprint guarantee and that re-stamping is
  optional.
- `dev/fids/archive/FID-2026-0918-007-…md`: both suites declared as gates,
  Loop 4 amendment recorded, receipt re-stamped from a live five-gate run.

## Gates (real runs)

typecheck `packages/agent-runtime` 0 · new suites 11/0 + 1/0 + 8/0 · five
pre-existing suites green (50/0 across the five contract files) ·
`agent-runtime` echo tree 189/0 · `fid:verify --check` **PASS** ·
`quality:report` PASS · eslint 0 · lint:md 0 · prettier clean · receipt
**10/10** via `--write`.

LIVE proof on the real record, all three states reproduced under the FINAL
rule: **0 violations** before the widening → **3** after it (both artifacts)
→ **0** after the amendment, fingerprint matching.

## Audit findings against my own work (self-corrected, all pinned)

1. The new rule **rejected this FID's own Summary prose** ("a document whose
   two new test suites were covered by no declared gate") — whole-document
   scope let the preserved pathless branch fire on narration. Fixed by
   scoping that branch to the two promise sections.
2. That first fix was still too broad: `sectionBetween` ran the section past
   its sibling `###` subsections into the surrounding prose, so Loop 2's
   quoted wording tripped it again. Terminator tightened to
   `^(?:##|###) `.
3. The widened suite hit **304 lines** (300 ceiling); the `quality` gate
   caught it (exit 1), and the live `--check` tier pin was split into
   `fid-check-enforcement-tier.test.ts`.

## Discovered out-of-scope, presented, NOT ruled yet

`bun run validate:repository` is RED with 13 issues — **none from this
change** (every issue sits in files this session did not touch):

- **T71** — 2 `audit.gate-env-parity` violations shipped BY
  FID-2026-0918-007's part-3 code (`ensure-ripgrep-vendor.ts:114`,
  `ensure-ripgrep-vendor.test.ts:39` spawn bare `'bun'`; the
  `process.execPath` class fixed in `scripts/bump-version.ts` by
  FID-2026-0909-002). The escape route is the interesting half: the receipt
  vocabulary has no kind for a repo gate like `validate:repository`, so a
  repo-gate break can ride a `verified` receipt.
- **T72** — 11 `hygiene.scratchpad-clutter` violations: scratch scripts from
  the 018/019/020 sessions at the `dev/scratchpad/` root (this session's
  tooling is in `active/` and compliant).

## Phase 2 — operator: "nothing is out of scope, address all issues found"

Both out-of-scope findings above were ruled on and closed, with T72 =
"move them into archive/".

**T72 (done):** all 11 scratchpad-root scripts moved to
`dev/scratchpad/archive/`; the root is back to README + `active/` + `archive/`.

**T71 (done) — FID-2026-0919-022, `verified`, receipt 8/8:**

- Both bare `'bun'` spawns → `process.execPath`
  (`sdk/scripts/ensure-ripgrep-vendor.ts:114`, its suite line 39).
- The vocabulary gap was closed with the EXISTING `probe` kind instead of a new
  gate kind: `scripts/audit-gate-env-parity.ts` gained an `import.meta.main`
  entry point (exit 0 clean / 1 with one line per issue), so the FID proves the
  repo-gate check on its own receipt —
  `- gate: probe scripts/audit-gate-env-parity.ts` → **[PASS] exit 0**.
  A new `audit` kind was rejected on Law 5 grounds (the probe kind already runs
  an allowlisted repo-relative `.ts`; a new kind would add parser + receipt +
  template + bundle surface for zero new capability).
- `validate:repository` can NEVER be a gate: it re-enters FID gate execution
  (C3) and would recurse — the Lesson already recorded under FID-2026-0915-004.
  The boundary is now documented rather than left to be rediscovered.
- T69's template-surface residual closed in the same edit: `templates/FID-TEMPLATE.md`
  now states the probe route, the recursion boundary, and the closed-record
  receipt semantics. **Protocol bundle regenerated** (1 file, harness v0.2.0) and
  `generate:protocol-bundle:check` PASS; protocol-copies + embedded-protocol
  suites 33/0.
- Entry-point pins added (2): exit 0 + `PASS` on a clean checkout; exit 1 +
  `FAIL` when ground truth is unprovable (non-git root). Both spawn
  `process.execPath` — the suite cannot smuggle the shape the audit forbids.
- `validate:repository`: **FAIL (13 issues) → PASS**.

## Closure (operator directive, same session)

Both records closed + archived 2026-09-19:

- `dev/fids/archive/FID-2026-0919-021-fid-contract-widening-and-enforcement-report.md`
  — status `closed`, Closed/Archived stamped, receipt **re-stamped LIVE at the
  archived path (10/10 gates)**, fingerprint `sha256:4a6dadaa…` matching.
- `dev/fids/archive/FID-2026-0919-022-receipt-contract-completeness.md` —
  status `closed`, Closed/Archived stamped, receipt **re-stamped LIVE at the
  archived path (8/8 gates incl. the probe gate)**, fingerprint
  `sha256:55b5c4fc…` matching.

Both re-stamps were run deliberately: the closure edit (status flip + archive
lines) invalidates the fingerprint by construction — that is exactly the T69
finding this session documented — so the records were re-stamped on their FINAL
content to stay byte-consistent, the convention the 2026-09-16/17 ceremonies
used. Commit SHAs remain pending operator git execution (G2 withheld);
evidence is the file:line + grep ranges in each record, which the FID Lifecycle
rule admits for `closed`.

Recorded in `CHANGELOG.md` (new 2026-09-19 section, 2 FIDs),
`dev/fids/archive/README.md` (closure index), `dev/fids/README.md` (active
queue empty again) and `SCOPE.md`.

## Honest notes

- G2 commit withheld — nothing committed; the operator has not authorized it.
- Harness-side docs (`ECHO.md`, `templates/FID-TEMPLATE.md`) were deliberately
  NOT edited: the template is an embedded grounding file, so changing it
  obliges a protocol-bundle regeneration — presented as a separate decision
  rather than absorbed.
- `code_search` failed for the whole session with the outer-client ENOENT
  (`C:\Users\spenc\.config\manicode\rg.exe`) documented as FID-2026-0918-007
  Root Cause 4. Repo-side fallback, executor text, and the install hook are
  all live and green — the missing binary is the OUTER client's; operator
  remediation is `CODEBUFF_RG_PATH` → this repo's vendored `rg.exe`. bash
  `grep` was the workaround.
