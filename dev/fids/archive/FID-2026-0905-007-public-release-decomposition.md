# FID: Public-Release Pipeline Decomposition — `scripts/public-release.ts` (3,064 lines)

**Filename:** `FID-2026-0905-007-public-release-decomposition.md`
**ID:** FID-2026-0905-007
**Severity:** high
**Status:** closed
**Created:** 2026-09-05 (session in progress)
**YAGNI-Compliance:** Pending

---

## Summary

`scripts/public-release.ts` — the entire public release pipeline (gates,
tag/push, GitHub release, npm publish, receipts, resume, lock, credential
scan, diagnostic mode) — is **3,064 lines**, the last quality-gate violation
after FID-2026-0905-006 drove the report to 2 and the operator's
2026-09-05 "nothing is out of scope" directive brought the standing R3
residue in scope. Absolute-max has no exemption path for it (confirmed in
`scripts/quality-report.ts`: exemptions still enforce growth-freeze only,
and this file has no baseline entry), so the fix is a real decomposition.

## Ground Truth (all tool-verified 2026-09-05)

- 3,064 lines (report metric), ~25 responsibilities in one module
- **Module importers all use `./public-release`** and live in `scripts/`:
  11 characterization test files (`public-release*.test.ts`), plus
  `pre-push-scan.ts` (`scanStagedCredentials`) and `audit-evidence.ts`
  (`acquireReleaseLock`, `releaseLockPath`). The CLI invokes it via
  `bun run release:public*` (package.json:26-29) — no CLI source imports it.
- **`scripts/` is covered by NO workspace typecheck** (root tsconfig is a
  project-references shell with `"files": []`; verified via listFilesOnly
  probe). Verification surface = the 12 sibling test files
  (**RED baseline: 57 pass / 0 fail / 216 expects, measured**) + eslint +
  prettier.
- `runReleaseTransaction` is a single ~420-line function — extraction
  requires refactoring it into stage functions over a shared context, not
  just moving text (pre-authorized contingency, FID-2026-0905-001 pattern).

## Proposed Solution

`scripts/public-release/` domain modules behind a byte-identical facade at
`scripts/public-release.ts` (path unchanged → zero consumer edits):
`fail`/`constants`/`changelog`/`redaction`/`local-state`/`process-tree`/
`command-runner`/`pinned-bun`/`gates`/`credentials`/`github-api`/`npm-ops`/
`git-verify`/`git-automation`/`worktree-fingerprint`/`receipts`/
`release-lock`/`stage-context`/`stages`/`verify-stages`/`transaction`/
`diagnostic`. Facade re-exports exactly the current export surface and
keeps the `import.meta.main` entrypoint.

## Verification Gates

- gate: test scripts/public-release.test.ts
- gate: test scripts/public-release-assets.test.ts
- gate: test scripts/public-release-credential-scan.test.ts
- gate: test scripts/public-release-gate-env.test.ts
- gate: test scripts/public-release-gates.test.ts
- gate: test scripts/public-release-git.test.ts
- gate: test scripts/public-release-local-state.test.ts
- gate: test scripts/public-release-lock.test.ts
- gate: test scripts/public-release-pinned-bun.test.ts
- gate: test scripts/public-release-receipts.test.ts
- gate: test scripts/public-release-redaction.test.ts

### Verification Receipt

- fingerprint: sha256:c048526e2e129c2145c9a223fb3358a07f5717f63b99259b0915f9d5cb6ce240
- verified: 2026-09-06T00:06:37.674Z
- test scripts/public-release.test.ts: exit 0
- test scripts/public-release-assets.test.ts: exit 0
- test scripts/public-release-credential-scan.test.ts: exit 0
- test scripts/public-release-gate-env.test.ts: exit 0
- test scripts/public-release-gates.test.ts: exit 0
- test scripts/public-release-git.test.ts: exit 0
- test scripts/public-release-local-state.test.ts: exit 0
- test scripts/public-release-lock.test.ts: exit 0
- test scripts/public-release-pinned-bun.test.ts: exit 0
- test scripts/public-release-receipts.test.ts: exit 0
- test scripts/public-release-redaction.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** monolith read 0-EOF (4 windows); anchor map recorded; consumer
  grep; typecheck-coverage probe; RED baseline measured (57/0/216).
- **GREEN:** module map settled at **23 domain modules + facade** with
  dependency ordering fail → leaves → domain → stages → transaction →
  facade; no import cycles (verified per-module during authoring).
- **AUDIT:** every moved body verbatim from the 0-EOF read; only import
  lines, the `runReleaseTransaction` stage-function refactor, and module
  headers are new.
- **ADVERSARIAL:** (a) "stage refactor changes release behavior" → the
  transaction decomposition preserves statement order and control flow
  exactly; the 12 test files + receipt schema pin observable behavior, and
  the next real release is the operator's live smoke. (b) "facade `export *`
  leaks internals" → explicit named re-exports only; a runtime surface check
  confirmed 52 values + 7 types present, zero missing, zero leaked internals.
  (c) "scripts/ has no typecheck gate" → honest boundary: recorded here;
  bun test + eslint + prettier are the gates, same as the pre-existing
  scripts tree.
- **CHANGE DELTA:** initial authoring.

### Loop 2 — implemented-delta corrections

- First facade draft leaked 17 internal-only helpers — caught by the
  item-by-item surface diff against `git show HEAD`, fixed before any test
  run (the adversarial gate's `export *` concern was real).
- `readCapturedOutput` and `runDiagnostic` were initially re-exported from
  the wrong modules — caught by the suites.
- One transcription defect in `credential-scan.ts` (extra `\.` inside the
  `.env` lookahead made `.env.example` filename-flagged) — caught by the
  contract test, corrected to the original regex.
- Missing `REQUIRED_NPM_MAJOR` import in `pinned-bun.ts` — caught by the
  pin test at line 20.
- First `stages.ts`/`transaction.ts` drafts accumulated mid-file imports,
  wrapper indirections, and dead code — rewritten cleanly rather than
  patched (Law 5/11); the final `stages.ts` trim (310 → 294) removed only
  my own headers, never verbatim bodies.
- **CHANGE DELTA:** all corrections inside the already-declared module
  boundaries.

### Loop 3

- Delta < 2% — converged.

## Implementation Evidence (Double Audit, 2026-09-05)

- **Facade:** `scripts/public-release.ts` 3,065 → **178 lines** (−94%);
  re-exports exactly the original surface — runtime check:
  `missing=NONE leaked=NONE` over 52 value exports + 7 types.
- **Modules:** 23 files under `scripts/public-release/`, largest
  `stages.ts` at **294** (all ≤300).
- **Suite parity:** the 12 sibling characterization files: **57 pass /
  0 fail / 216 expects** — identical to the measured RED baseline.
- eslint `--max-warnings 0` clean on all 24 files · prettier clean.
- **`quality:report`: PASS, 0 violations** (first zero since the R3
  residue was recorded).
- Law-4: consumers unchanged (13 files import `./public-release`; no edits
  required or made).
- Known pre-existing quirk (documented, NOT a regression): directory-wide
  `bun test scripts/` recurses into untracked vendored trees
  (`resources/openclaude/scripts/`) whose network-dependent tests hang;
  the pre-push gate uses workspace-scoped `bun run test` and is unaffected.
- Honest boundary: the next `bun run release:public --preview` by the
  operator is the live smoke for the transaction-stage refactor.

## Resolution

- **Closed Date:** 2026-09-05
- **Fix Description:** `scripts/public-release.ts` (3,065 lines — the last
  absolute-max monolith) decomposed into a 178-line facade plus 23 domain
  modules under `scripts/public-release/` (fail, catalog, changelog,
  redaction, local-state, process-tree, command-runner, output, pinned-bun,
  gates, github-api, lock, npm-guards, prompt, receipts, credential-scan,
  git-publish, preflight, assets, diagnostics, stages, stages-verify,
  transaction); the ~420-line `runReleaseTransaction` refactored into stage
  helpers over a shared TransactionContext with statement order and control
  flow preserved; export surface mechanically verified identical (missing=
  NONE, leaked=NONE).
- **Tests Added:** No new tests — the 12 sibling characterization files pin
  behavior; parity held at 57 pass / 0 fail / 216 expects before and after.
- **Verification Evidence:** sibling suites 57/0/216 (exact RED-baseline
  parity, re-verified after every trim); eslint `--max-warnings 0`;
  prettier clean; lint:md 0; fid:verify receipt stamped 11/11 PASS;
  `quality:report` PASS (1467 baselined files) — zero violations; commit
  `32255bb`.
- **Archived:** 2026-09-05 (moved to `dev/fids/archive/`)

## Lessons Learned

- The wc+1 lesson holds at every scale: measure files with the report's
  exact metric, not `wc -l`, or a "281-line" file is actually 305 and the
  trim happens twice.
- Stage-refactor decompositions need a mechanical surface check, not just
  green tests: diffing the facade's runtime export surface against the
  original caught 17 leaked internals AND two wrong-module re-exports
  (`readCapturedOutput`, `runDiagnostic`) that the suites surfaced only
  one at a time.
