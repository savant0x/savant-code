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
- [ ] Resolve the LIVE-004 keystroke-evidence gap through FID-2026-1018-012's
  render-level picker keyboard test. The listener-warning, CommandPalette key,
  audit-tooling and dependency residuals closed on 2026-10-19 with
  FID-2026-1018-011, -010, -013 and -014 — all archived with commit hashes and
  CHANGELOG entries. FID-2026-1018-012 also owns release-audit documentation
  and record reconciliation.
- [ ] Run the complete local gate battery and release preview/diagnostics; record
  exact results and any external prerequisite that cannot be verified locally.

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

### Release-0.0.36 — development line (publication operator-gated)

- [ ] Version 0.0.36 is an unpublished development line. Preserve the existing
  release authority; version cuts, tags, publishing and deployment still
  require explicit operator approval. Normal verified main pushes proceed
  through mandatory gates. No publication is authorized by this audit.

### HOME-SKILLS-001 — external skill diagnostics (blocked)

- [ ] `skills:check` reports 22 home-skill warnings and zero repository errors.
  Third-party frontmatter, size and command-policy diagnostics occur outside
  this project. Changing those installed skills requires an operator decision
  on the external targets; this repository audit does not grant that authority.
  Details are preserved in the hygiene audit report; no external fix is claimed.

## Machine-readable scope targets

Operator pause, 2026-10-18: requested a handoff with 9% session credits remaining.
Resumed 2026-10-19: the CHANGELOG read completed, the 0.0.36 heading moved above
its recent entries, and the audit slices committed. Release publication is not
claimed.
Resume checklist: `dev/session-summaries/2026-10-18-release-audit-handoff.md`.

- FID-2026-1018-012: `.gitignore`, `.markdownlintignore`, `README.md`, `README.zh-CN.md`, `SCOPE.md`,
  `docs/**`, `sdk/README.md`, `sdk/PUBLISHING.md`, `common/src/templates/initial-agents-dir/**`,
  `cli/src/components/__tests__/model-picker-scroll.test.tsx`, `dev/**`, `CHANGELOG.md`
  `scripts/public-release/catalog.ts`, `scripts/public-release/backup-stage.ts`

- AUDIT-2026-1018: `SCOPE.md`, `CHANGELOG.md`, `README.md`, `README.zh-CN.md`,
  `ARCHITECTURE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `ECHO.md`,
  `protocol.config.yaml`, `package.json`, `bun.lock`, `eslint.config.js`, `.gitignore`,
  `.markdownlintignore`, `.prettierignore`, `patches/**`, `agents/**`, `cli/**`, `common/**`,
  `desktop/**`, `evals/**`, `packages/**`, `sdk/**`, `scripts/**`, `docs/**`,
  `coding-standards/**`, `templates/**`, `.github/**`, `.githooks/**`, `dev/**`

- Release-0.0.36: `VERSION`, `package.json`, `agents/package.json`,
  `cli/package.json`, `cli/release/package.json`, `common/package.json`,
  `common/src/constants/protocol-bundle.generated.ts`, `desktop/package.json`,
  `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/Cargo.toml`,
  `desktop/src-tauri/Cargo.lock`, `evals/package.json`,
  `scripts/tmux/package.json`, `sdk/package.json`, `packages/**/package.json`,
  `bun.lock`, `protocol.config.yaml`, `README.md`, `README.zh-CN.md`,
  `ARCHITECTURE.md`, `CHANGELOG.md`, `docs/**`, `SCOPE.md`, `dev/agenda.md`,
  `dev/operator-decisions.md`, `dev/fids/**`, `dev/feature-pipeline/**`,
  `dev/session-summaries/**`, `scripts/version-docs.ts`,
  `scripts/version-docs-drift.test.ts`, `.agents/skills/**/SKILL.md`
