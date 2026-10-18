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

### LIVE-003 — model picker live observation (completed 2026-10-18)

- [x] Reproduced. `/model` with three bashers active kills the CLI instantly
  and clears the terminal; no process survived and no fatal record was
  written. This answers the item's open question: the CLI exits, it does not
  stay alive on a blank screen. The probe in `scripts/probes/` remains as the
  repeatable PTY observation harness.

The defect is tracked as FID-2026-1018-008. That record, not this observation,
now owns the cause and the repair.

### FID-2026-1018-008 — silent `/model` death (open)

- [ ] Authority: automation level 3. Capture the evidence outside the
  alternate screen, make silent deaths durable, narrow the trigger, then fix
  the cause. No change to the terminal reset or watchdog paths until the death
  itself is explained.

### HOME-SKILLS-001 — external skill diagnostics (blocked)

- [ ] `skills:check` reports 22 home-skill warnings and zero repository errors.
  Third-party frontmatter, size and command-policy diagnostics occur outside
  this project. Changing those installed skills requires an operator decision
  on the external targets; this repository audit does not grant that authority.
  Details are preserved in the hygiene audit report; no external fix is claimed.

## Machine-readable scope targets

- LIVE-003: `scripts/probes/live-003-picker-pty.ts`, `dev/scratchpad/**`
- FID-2026-1018-008: `cli/src/components/model-picker.tsx`,
  `cli/src/components/model-picker-rows.tsx`,
  `cli/src/utils/model-picker-open.ts`, `cli/src/utils/renderer-cleanup.ts`,
  `cli/src/utils/terminal-watchdog.ts`, `cli/src/index.tsx`,
  `cli/src/components/__tests__/**`, `debug/**`, `dev/**`
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
