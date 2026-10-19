# SCOPE — Open Work Register

This register contains active work and its machine-readable write targets.
Remove completed items and grants at closure. Evidence belongs in archived
FIDs, the changelog and session summaries. Historical register/disposition
records are preserved in `dev/tracking/scope-history-2026-10-18.md`; that
snapshot grants no current write authority.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override credential handling,
verification, releases or repository boundaries.

## Open items

### AUDIT-2026-1018 — project-wide release readiness

- [ ] Authority: automation level 3, operator-approved 2026-10-18: full project-wide
  audit and loose-end cleanup before an official release. Inspect every workspace,
  release/build gates, dependency and dead-code candidates, current documentation,
  generated artifacts, and active governance records. Fix confirmed defects with
  converged FIDs and verification; preserve historical evidence and operator files.
- [x] Resolve the LIVE-004 keystroke-evidence gap through FID-2026-1018-012's
  render-level picker keyboard test. The listener-warning, CommandPalette key,
  audit-tooling and dependency residuals closed on 2026-10-19 with
  FID-2026-1018-011, -010, -013 and -014, and FID-2026-1018-012 closed last —
  all five archived with commit hashes, CHANGELOG entries and the batch index
  `dev/fids/archive/2026-10-19-release-audit-closures.md`.
- [x] Run the complete local gate battery and release preview; record exact
  results. Gates on the committed tree: typecheck exit 0, CLI 4,233 pass /
  18 skip / 0 fail, scripts 1,122 pass / 0 fail, ESLint 0 warnings, Markdown
  lint exit 0, `validate:repository` PASS, `release:preaudit:check`
  `PASS — release preconditions clear`, `release:public:preview` exit 0 with the
  0.0.36 changelog section resolving correctly.
- [x] `release:public:diagnose` rehearsal passes on a frozen clean tree: the
  full gate manifest ran through `npm-pack:savant-code` and exited 0
  (`Diagnostic gates passed`). A first attempt bounded at 420 s was killed
  mid-manifest and reported `Diagnostic gates changed HEAD; evidence was
  discarded.` with `gateAttempts: []`; HEAD was `3d8096a6` before and after with
  a clean worktree, so the message misattributes an interrupted run. Unbounded
  re-run passed. Observation for later: an interrupted rehearsal discards its
  attempt evidence, so a guard message like that one is not proof of a commit
  change. Publication remains operator-gated.

Release publication follows the completed audit and the canonical release pipeline.
This audit does not authorize paid provider comparisons or external skill edits.

### EMBED-001 — superseded external single-agent embed (blocked)

- [ ] Authority: automation level 3. Updating the external target is reserved
  to the operator: `C:\Users\spenc\.config\opencode\agent\echo.md` lies outside
  the project directory. No automation level lifts that boundary.

The 409-line embed, last written 2026-08-11 when inspected, predates the
canonical `dev/echo-v0.1.2-single-agent.md`. The earlier audit found missing
scripted-edit and scope-disposition rules, the active scope register contract,
autonomy levels, step accounting, progress-push/archive rulings and current FID
statuses. It also found contradictory attribution and bootstrap instructions.
Exact evidence and the operator-only replacement procedure are retained in
the history snapshot. No external write or fresh external repair is claimed.
This session uses the canonical repository protocol.

### HOME-SKILLS-001 — external skill diagnostics (blocked)

- [ ] `skills:check` reports 22 home-skill warnings and zero repository errors.
  Third-party frontmatter, size and command-policy diagnostics occur outside
  this project. Changing those installed skills requires an operator decision
  on the external targets; this repository audit does not grant that authority.
  Details are preserved in the hygiene audit report; no external fix is claimed.

## Machine-readable scope targets

Operator pause, 2026-10-18: requested a handoff with 9% session credits remaining.
Resumed 2026-10-19: the CHANGELOG read completed, the 0.0.36 heading moved above
its recent entries, all five audit FIDs committed, closed and archived, and the
`dev/` record tree reorganized. The operator subsequently authorized release
resume; npm publication and post-release verification completed on 2026-10-19.
Resume checklist: `dev/session-summaries/2026-10/2026-10-18-release-audit-handoff.md`.

- AUDIT-2026-1018: `SCOPE.md`, `CHANGELOG.md`, `README.md`, `README.zh-CN.md`,
  `ARCHITECTURE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `ECHO.md`,
  `protocol.config.yaml`, `package.json`, `bun.lock`, `eslint.config.js`, `.gitignore`,
  `.markdownlintignore`, `.prettierignore`, `patches/**`, `agents/**`, `cli/**`, `common/**`,
  `desktop/**`, `evals/**`, `packages/**`, `sdk/**`, `scripts/**`, `docs/**`,
  `coding-standards/**`, `templates/**`, `.github/**`, `.githooks/**`, `dev/**`
