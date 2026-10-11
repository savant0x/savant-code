# SCOPE — Open Work Register

This register lists active work only. On closure, remove the item and its write
targets; retain evidence in the changelog, archived FID, session summary, and
learnings. Never use `[x]`, `deferred`, or `out of scope` as a disposition.
Every active FID and agenda task must be registered here. Machine-readable
targets grant write authority only for the corresponding open item.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override ECHO laws, credential
handling, or repository boundaries. Operator approval applies only where a
recorded decision or external dependency requires it.

## Open items

- [ ] **T184. Release-readiness repair.** Active repair record:
      `dev/fids/FID-2026-1010-004-release-readiness-repair.md`.
      R1-R2, R5, R8, A1 and A2 are implemented; Windows/Linux artifact smoke
      passes. Root checks pass. Remaining: local candidate commit and receipt.
      macOS is not a declared target. Push and release are not part of this FID.
      Push, publish, and release remain unauthorized. **Automation level: 3.**

- [ ] **T185. Public-release content and bloat audit.** Compare README/docs with
      current code, commands, package publication, and validation gates. Review
      the identified debug logs, generated databases, duplicate website file,
      and scratchpad; preserve user-owned resources and evidence cited by active
      FIDs. Complete safe stale-content fixes and approved cleanup, then run
      repository, hygiene, lint, formatting, and version checks.
      **Automation level: 3.**

### Providers and routing

- [ ] **T119. Provider account access and identity.** xKiro acceptance needs
      an operator-provided paid account; a possible fourth provider needs its
      name or URL. No purchase is authorized. **Automation level: 1.**

- [ ] **T175. Sweep control-manifest authorship + control-armed re-run.**
      Open remainder of archived `FID-2026-1007-016`: the seam is built, but
      verdicts need the operator-owned `<provider>/<family>` control manifest,
      a funded control-armed re-run, ToS comfort for scaled dual-model
      probing, a probe-budget number, the no-control verdict-naming ruling,
      and a credential-epoch rotation source. Design is in archived
      `FID-2026-1007-016` Loops 2 and 4.
      **Blocker:** operator manifest content, funding, ToS, budget, naming,
      and rotation source — all external to the repository.
      **Automation level: 1** (no agent action; operator-owned until then).

- [ ] **T171. Harvested-candidate auto-wire.** Open remainder of archived
      `FID-2026-1008-002` phase 2 and `FID-2026-1008-004` item C, option 2.
      Reuse the discovery wizard prefill when selecting a discovery-only
      provider; design is in archived `FID-2026-1008-004` Loop 4.
      **Blocker:** operator ruling on the stricter verdict gate (exclude
      `open-relay`) and consent shape (inline wizard with Enter per step
      versus one confirmation). **Automation level: 1.**

- [ ] **T173. KiosAPI window-table rows for five exact feed ids.**
      Open remainder of archived `FID-2026-1008-001`: `gpt-oss-20b`,
      `claude-haiku-4-5-20251001`, `llama-3.2-11b-vision-instruct`,
      `deepseek-v4-pro-0813`, `codex-auto-review` have no fallback row and
      retain the conservative 200k default.
      **Blocker:** vendor-published window values for these exact ids;
      the previous public-source search did not establish them.
      **Automation level: 1.**

- [ ] **T62-followups.** TokenHarbor needs a free-cell identity re-run after
      its allowance resets; TokenRouter self-identification needs an operator
      top-up. **Blocker:** provider credits/keys. **Automation level: 1.**

- [ ] **T147. Geaix/Excelnt live probe and registry integration.** The operator
      must provide a live gateway key for the probe before integration begins.
      Both vendors lacked active keys at last check. **Automation level: 1.**

### Harness and process

- [ ] **T122. Savant-Free disposition.** Operator decision required: repair
      the known failing integration or remove the feature. Its references span
      CLI, agents, common, docs, and release tooling. **Automation level: 1.**

### Build orders (formalized as FIDs 2026-10-07)

- [ ] **T164-D. Eval-runner wire-stage usage telemetry.** Open remainder
      of archived `FID-2026-1007-013`: the print-mode `usage` wire member,
      emission from the existing `step.ts` hook, and host-facing `onUsage`
      callback.
      **Blocker:** a NAMED consumer outside the eval harness plus operator
      decisions on eval billing keys and wire-stage ratification.
      **Automation level: 1.**

## Machine-readable scope targets

<!-- FID-2026-1001-003 step 5a: per-item write targets for the Law 2 gate
     (operator-approved 2026-10-02, "present before writing" honored). Each
     line maps a register item to the paths its approved work may touch.
     No pattern = non-covering, fail-closed. Items with no write surface
     (operator-only actions) carry none. Governance surfaces the protocol
     itself mandates are GATE-LEVEL exemptions (operator ruling 2026-10-02),
     deliberately not register items.

     Only OPEN items carry a line here. A completed item's authority must
     leave with the item: while its globs remain, `loadScopeArtifact` grants
     them to every write, so "present before act" is satisfied by work that
     finished days ago. Evict the line in the pass that closes the item. -->

- T184: `dev/fids/FID-2026-1010-004-release-readiness-repair.md`,
  `dev/fids/README.md`, `dev/fids/archive/README.md`,
  `dev/fids/archive/FID-2026-1010-001-tokenharbor-catalog-live-realignment.md`,
  `scripts/version-docs.ts`, `scripts/version-callouts.ts`,
  `scripts/version-docs-drift.test.ts`, `scripts/telemetry-feedback.ts`,
  `scripts/__tests__/telemetry-feedback.test.ts`,
  `sdk/test/cjs-compatibility/test-types.ts`,
  `sdk/test/esm-compatibility/test-types.ts`,
  `sdk/src/tools/run-terminal-command.ts`,
  `sdk/src/tools/child-process-registry.ts`,
  `sdk/src/__tests__/run-terminal-command.test.ts`,
  `sdk/src/__tests__/fixtures/windows-stubborn-grandchild.ts`,
  `sdk/src/impl/__tests__/model-provider-free-mode-test-setup.ts`,
  `sdk/src/impl/__tests__/model-provider-free-mode-mistral.test.ts`,
  `cli/src/utils/openrouter-models/gateway-live-results.ts`,
  `cli/src/utils/openrouter-models/__tests__/fid-2026-1009-005-mistral.test.ts`,
  `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts`,
  `common/src/__tests__/model-config.test.ts`,
  `cli/scripts/build-binary.ts`, `cli/scripts/build-binary-main.ts`,
  `cli/scripts/smoke-binary.ts`,
  `cli/src/agents/bundled-agents.generated.ts`,
  `cli/src/agents/bundled-agents.generated-data/**`, `cli/bin/**`,
  `node_modules/@opentui/core-linux-x64/**`,
  `node_modules/@opentui/core-linux-x64-musl/**`,
  `cli/node_modules/@opentui/core-linux-x64/**`,
  `cli/node_modules/@opentui/core-linux-x64-musl/**`,
  `dev/quality-baseline.json`,
  `dev/telemetry/proposals/law15-dominance.md`,
  `common/src/constants/protocol-bundle.generated.ts`,
  `dev/session-summaries/2026-10-10-release-readiness-audit.md`,
  `dev/session-summaries/2026-10-10-release-readiness-repair-planning.md`,
  `dev/session-summaries/2026-10-10-release-readiness-repair.md`,
  `dev/scratchpad/active/release-readiness-2026-10-10/**`,
  `SCOPE.md`, `CHANGELOG.md`
- T119: `.env.local`, `docs/providers.md`,
  `dev/session-summaries/2026-10-03-provider-*.md`,
  `dev/scratchpad/active/provider-catalogs-2026-10-03/**`,
  `dev/scratchpad/active/provider-integration-*`
- T175: (no write surface — operator-owned)
- T171: `cli/src/utils/provider-wizard-discovery.ts`,
  `cli/src/chat/use-chat-pickers.ts`,
  `cli/src/chat/__tests__/model-picker-activation.test.ts`,
  `cli/src/utils/__tests__/provider-wizard-discovery.test.ts`
- T173: `common/src/constants/context-window-table-kiosapi.ts`
- T62-followups: `dev/scratchpad/active/t62*.ts` (the catalog itself is
  gateway-side; the local write surface is the probe scripts — verified
  2026-10-02: no local catalog directory exists)
- T147: `dev/scratchpad/active/gateway-catalog-probe.ts`,
  `dev/session-summaries/2026-10-06-geaix-excelnt-probe.md`,
  `dev/fids/**` (the integration FID)
- T122: (no write surface — operator-owned)
- T164-D: `common/src/types/print-mode.ts`,
`packages/agent-runtime/src/run-agent-step/step.ts`,
  `evals/v2/src/runner.ts`, `sdk/src/run/types.ts`
- T185: `README.md`, `README.zh-CN.md`, `knowledge.md`, `AGENTS.md`,
  `docs/**`, `cli/release/README.md`, `WINDOWS.md`, `desktop/README.md`,
  `sdk/README.md`, `common/src/templates/initial-agents-dir/README.md`,
  `cli/src/utils/constants.ts`, `dev/scratchpad/**`, `debug/**`,
  `firebase-debug.log`, `database.db`, `database.db-wal`, `database.db-shm`,
  `website/index-2.html`, `SCOPE.md`, `CHANGELOG.md`, `dev/session-summaries/**`
