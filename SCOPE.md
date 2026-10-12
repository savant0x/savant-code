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

- [ ] **Release v0.0.35.** Commit all current intended worktree changes, then
      publish all 189 existing local commits and the release commit via the
      public release pipeline. Verify the full release preview and gates first.
      **Automation level: 3.**

- [ ] **T185. Public-release content and bloat audit.** Compare README/docs with
      current code, commands, package publication, and validation gates. Review
      the identified debug logs, generated databases, duplicate website file,
      and scratchpad; preserve user-owned resources and evidence cited by active
      FIDs. Complete safe stale-content fixes and approved cleanup, then run
      repository, hygiene, lint, formatting, and version checks.
      **Automation level: 3.**

- [ ] **T186. Two registered workspaces sit outside every typecheck and test
      chain.** `package.json` registers 15 workspaces, but the root `typecheck`
      and `test` chains each cover 13; `savant-free` (17 tracked TS/TSX files,
      including `savant-free/cli/build.ts` and its e2e suites) and
      `scripts/tmux` (11 tracked TS/TSX files under `tmux-viewer/`) have no leg,
      and neither workspace declares a `typecheck` script. The doc surfaces
      asserting "all 13 workspaces" were corrected this pass to state the real
      coverage.
      **Blocker:** adding a leg changes the fail-closed release gate battery
      (`protocol.config.yaml` `type_check`/`test` plus the root scripts), and
      `savant-free`'s disposition is operator-owned under T122 — both need an
      operator ruling. **Automation level: 1.**

- [ ] **T187. Five trusted skills carry no `version` frontmatter.**
      `bun run skills:check` reports 0 errors / 35 warnings, five of them
      `missing 'version' frontmatter (legacy default 0.1.0; add it on the next
      edit)` for `release-workflow`, `savant-design`, `savant-design-systems`,
      `savant-motion`, and `startup-playbook`.
      **Blocker:** `.agents/skills/**` is the operator-only release surface
      (`/skills trust`); an agent write to a SKILL.md is a skills mutation, so
      the frontmatter addition belongs to the operator's next edit.
      **Automation level: 1.**

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
  `CONTRIBUTING.md`,
  `docs/**`, `cli/release/README.md`, `WINDOWS.md`, `desktop/README.md`,
  `sdk/README.md`, `common/src/templates/initial-agents-dir/README.md`,
  `cli/src/utils/constants.ts`, `dev/scratchpad/**`, `debug/**`,
  `firebase-debug.log`, `database.db`, `database.db-wal`, `database.db-shm`,
  `website/index-2.html`, `SCOPE.md`, `CHANGELOG.md`, `dev/session-summaries/**`
- T186: (no write surface — blocked pending the operator ruling on the gate chain)
- T187: (no write surface — operator-owned skills surface)
