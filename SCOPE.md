# SCOPE — Open Work Register

> **This file holds OPEN work only.** A completed item is not in scope and does
> not appear here — not as a checked box, not as a narrative paragraph, and not
> as a machine-readable target line. Operator ruling 2026-09-28, verbatim: *"if
> the item is completed, it should not even be in scope, only active/pending
> items should be in scope"*; reaffirmed by the operator 2026-10-07 — scope is
> for currently open work, never a graveyard of past work. Completed work is
> evicted **in the same pass that closes it**. Its record is `CHANGELOG.md`, the
> archived FID under `dev/fids/archive/`, its summary under
> `dev/session-summaries/`, and its lessons in `dev/LEARNINGS.md`. The CHANGELOG
> is itself gate-covered by the ratcheted `changelog-coverage` check, so
> eviction loses no evidence.
>
> **A checked (`[x]`) box is a defect.** It marks an item that was closed and not
> evicted. Every line below is live work or an item blocked on a named blocker.
>
> **Automation levels** (protocol: `dev/echo-v0.1.2-single-agent.md` →
> "Automation Levels") are recorded per task/item as `**Automation level: N**`,
> meaning the authority that item needs to be actioned *without asking*: `1` =
> approval-gated, `2` = within approved scope, `3` = fully automatable. The
> session ceiling is `protocol.config.yaml` → `session.autonomy_level`. An item
> is actioned without approval only when its level is ≤ the session level. No
> level lifts the G-laws, credential handling, Law 3, or the project-directory
> boundary.
>
> **Operator directive 2026-09-19:** "this is a project wide quality pass,
> update every issue you find w/ automation level 3" — findings from this pass
> are tagged `3` where the fix is mechanically automatable, and `1` where the
> only remaining action needs operator input (nothing to automate).
>
> **NOTHING IS EVER OUT OF SCOPE** (protocol: Scope Boundary). Operator ruling
> 2026-09-19: "NOTHING is ever permitted to be placed 'out of scope'... We
> complete the work, we never defer, and nothing is ever out of scope." Approved
> work is completed, never trimmed. `[OUT-OF-SCOPE]`, `[OPEN-OUT-OF-SCOPE]` and
> `[DEFERRED]` are **not statuses**; every item here is either **completed**
> (with its evidence) or **blocked pending an operator ruling** whose specific
> blocker is named. The sole marker that legalizes a drop is
> `dropped::operator-approved <YYYY-MM-DD> — "<the operator's words>"`, and only
> the operator can set it. These tokens fail `validate:repository`
> (`scope.prohibited-disposition`) and are blocked at write time
> (FID-2026-0919-024).
>
> **Coverage is enforced too** (FID-2026-0919-025). The prohibition above removes
> the label, not the quiet path: an item with no line here is invisible in the
> register and can be dropped without writing any forbidden token. So every
> record in the active queue must be named in this register, and every task cited
> by an active FID or by `dev/agenda.md` (`Task NN`, `TNN-X`) must exist here as a
> `## Task NN` section or a `TNN-X` item. Both fail `validate:repository`
> (`scope.unregistered-item`) and `bun run scripts/scope-register-check.ts`.
>
> **The open-items-only rule is enforced as shape, not content — stated limit.**
> The pin is `scope-register-open-items-only.test.ts`, which asserts no
> `## Task NN` heading exists; a completed item written as a top-level checkbox
> bullet satisfies that assertion. FID-2026-0928-005 stopped *demanding*
> completed items but added nothing that *evicts* them, so eviction rested on
> discipline alone and decayed: the 2026-10-05 pass removed seven completed
> items and their target lines, and the 2026-10-06/10-07 passes re-added about
> twenty more that were never evicted — which also left ~20 completed items
> holding live write grants in the machine-readable section below, satisfying
> the Law 2 gate for most of the repository. The 2026-10-07 pass evicted all of
> them. What is still missing is a mechanical check that *fails* when a `[x]`
> box or a completed item's target line reappears; until that exists, eviction
> depends on the session that closes an item remembering to do it here.

## Open items

- [ ] **T184. Release-readiness audit and repair plan (2026-10-10).** Operator request:
      "I want you to begin a release-ready audit." **Automation level: 3.**
      Audit the current working tree: version/toolchain parity, generated
      artifacts, governance, quality, lint, formatting, full typecheck,
      workspace regression, SDK build, CLI bundle and package contents.
      Record exact command results and investigate failures before claiming
      readiness. Preserve existing edits and item-level approval boundaries.
      No version bump, tag, push, publish or deploy is authorized. The operator
      directed completion on 2026-10-11, superseding the prior no-Git hold for
      local path-scoped commits required by this FID. Push still requires
      explicit authorization. Remote release and platform artifact verification
      remain outside scope.
      Evidence: `dev/session-summaries/2026-10-10-release-readiness-audit.md`.
      Audit verdict: not release-ready. Version callout and protocol bundle
      drift; HUD preview exceeds 300 lines; quality baseline cites a deleted
      logo; telemetry Markdown exceeds 120 columns; sidebar polish FID lacks
      Code Verification Evidence; committed HEAD fails the TokenHarbor test
      typecheck. Windows cancellation failed once, then passed isolated and
      full reruns without a fix. Operator request: "make a repair fid to fix
      all issues you found so we're ready for release". Repair record:
      `dev/fids/FID-2026-1010-004-release-readiness-repair.md` (analyzed;
      R1-R6 + A1 + A3 implemented and gate-verified, R7/R8/A2 blocked).
      Repaired this pass: release-callout comparison made line-ending-agnostic
      (the real cause — README carried 1094 CRLF pairs against an LF blob) with
      a CRLF regression pin; protocol bundle regenerated; HUD preview split
      339->224 lines + new `cli/scripts/hud-preview-section.tsx`; stale
      deleted-logo quality exemption removed; telemetry draft pre-wrapped in
      `draftFor` with a 120-column pin; FID-2026-1010-003 un-fenced and stamped
      (8/8); three defects found on the way fixed (stale `ECHO ·` sidebar pins
      in FID-2026-1009-007's gates, SDK consumer fixtures passing removed
      `apiKey`; FID-2026-1010-005 was recorded, then all sidebar FIDs were operator-cancelled
      2026-10-11 after the sidebar attempt failed); `typecheck` exit 0 and
      `validate:repository` PASS.
      **Blocker:** (a) R8 — 20/20 isolated cancellation runs passed on
      2026-10-11, but two full SDK runs reproduced the failure: the Windows
      cancellation test left `parentPid` alive after its 5s deadline (one run
      completed the test in 6.98s). The taskkill result and duration were not
      captured, so the cause remains unconfirmed and no process-kill change is
      converged. (b) R7 — local path-scoped commits are now authorized under G1
      and the operator's 2026-10-11 completion direction; the release candidate
      still needs a coherent, verified commit. (c) A2 — native CLI artifact acceptance needs
      native runners and release-artifact authority. (d) remote pre-audit and
      live-provider access/budget remain operator-gated. Native release
      acceptance is unproven; no release-readiness claim is made.
      Retained outputs: `dev/scratchpad/active/release-readiness-2026-10-10/`.
      **Automation level: 1** for remediation approval and release actions.
      Read-only audit gates are complete; no release-readiness claim is made.

- [ ] **T185. Public-release content audit: README/docs staleness, bloat, scratchpad
      cleanup (2026-10-10).** Operator request, verbatim: "review the readme, looking
      for any stale info or that is no longer in sync with the code. Also need to
      clean out all bloat files. Also clean up the scratchpad. Basically a project
      wide audit getting ready for public release after a 2 week sprint."
      **Automation level: 3** for the cataloged repairs below; every file deletion
      is enumerated in the Law 2 presentation and waits for the operator's go-ahead
      (loose-instruction intake rule — interpreted scope confirmed before acting).
      Read-only audit catalog (evidence 2026-10-10, grep/tool output):
      (1) README.md claims "the full ECHO Perfection Loop now triggers at 20 lines
      instead of 75" and an EHEL "20-line threshold" — live gate is 100 lines
      (`packages/agent-runtime/src/echo/pre-write-gates-fid.ts:71`,
      `pre-write-gates.ts:15-17` "from 20 to 100"), contradicting README's own
      Execution Modes table (100-line) and `MODE_DESCRIPTIONS`;
      (2) README.md + README.zh-CN.md + docs/features.md + cli/release/README.md
      list `/login` — the command was deleted and its absence is test-pinned
      (`cli/src/commands/__tests__/router-registry.test.ts:15`, FID-2026-0929-004);
      (3) Repo Map names `scripts/tmux/` package `@savant-code/tmux` — actual is
      `@savant-code/tmux-scripts` (`scripts/tmux/package.json`); rows for `desktop/`
      and `packages/connectors/` are missing (AGENTS.md Repo Map also omits
      `packages/design-systems/` + `packages/connectors/` + `scripts/tmux/`);
      (4) `/skills` missing from the README slash-command table though it is a
      headline feature and a live registry command;
      (5) README Validation section's `bun x tsc --noEmit` checks nothing at the
      root (`tsconfig.json` has `files: []` + references) — the real gate is
      `bun run typecheck` (13-workspace chain);
      (6) knowledge.md claims the merge typecheck gate is the four-workspace
      `/verify` set — stale vs the 13-workspace chain in AGENTS.md/package.json;
      (7) `@savant-code/sdk` npmjs links (README:206, README.zh-CN:245, sdk/README.md,
      website/, common templates README) point at a package that is
      `defaultPublish: false` and currently 404s (`scripts/public-release.test.ts:99-103`,
      FID-2026-0816-001 D-02) — reword or drop pending operator ruling;
      (8) stale `cli/src/utils/constants.ts:139` comment still says "20-line
      ceremony threshold";
      (9) auto-update bullet retracted — `SAVANT_CODE_NO_AUTO_UPDATE` verified LIVE
      in `cli/release-core/launcher.js:1215` (claim is correct, no change).
      Bloat inventory: `debug/` ≈5 GB (`cli.jsonl` 2.5 GB + `trace.jsonl` 2.5 GB +
      `probe-post-terminal.log` 12 MB; gitignored, written by
      `cli/src/utils/logger/file-sink.ts` — delete only with no live writer),
      root `firebase-debug.log`, root `database.db` (+`-wal`/`-shm`; regenerable
      runtime fallback per .gitignore:94), tracked stray `website/index-2.html`
      (92 KB duplicate, session-summaries 2026-10-07). `resources/` (user-added
      reference clones, gitignored) is an operator disk decision — never
      agent-deleted. Scratchpad inventory: `dev/scratchpad` 40 MB (active 35 MB,
      archive 4.6 MB); scope-referenced protections honored: `release-readiness-
      2026-10-10/**` (T184), `t62*.ts`, `gateway-catalog-probe.ts`,
      `provider-catalogs-2026-10-03/**`, `provider-integration-*`,
      `probe-logo-geometry.tsx`, and every path cited by an active FID; root
      shape stays README+active/+archive/ per `scripts/hygiene.test.ts` P36.
      Gates after edits: `bun run validate:repository`, `bun run lint:md`,
      `bun x prettier --check`, `bun run hygiene:check`, `bun run version:check`.

- [ ] **T186. Local commit authority; push remains approval-gated (2026-10-11).**
      Operator directive: "LOCAL commits do not need authorization, only push
      does." Reconcile ECHO G1/G2, the single-agent adaptation, and generated
      protocol bundle wording: local, path-scoped commits within approved scope
      need no separate operator authorization; every push still requires
      explicit operator authorization. Preserve path-scoped staging, atomic
      commits, and any narrower item-specific prohibition already recorded.
      Reconcile active FID/SCOPE blockers that currently say commit
      authorization is required. Do not push. **Automation level: 3.**
      Record: `dev/fids/FID-2026-1011-001-local-commit-authority-push-gated.md`.

### Providers and routing

- [ ] **T119. Pending provider account access and identity.**
      **Automation level: 1.** Mapped xKiro Claude Haiku live acceptance
      returned HTTP 403 requiring an active paid plan or real deposited
      balance. Operator account access is needed before repeating that leg;
      no purchase is authorized. The possible fourth provider still needs
      its name or URL before a new converged integration FID can be prepared.
      The three confirmed services and project-wide model/documentation work
      are completed in archived `FID-2026-1003-001`, implementation commit
      `72af5480`; only these two external boundaries remain here.
      **Blocker:** operator account access (xKiro paid plan) and the fourth
      provider's identity — both external to the repository.

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

- [ ] **T62-followups (remaining items routed, not blocking `Task 62`
      closure):** (1) is **completed 2026-09-28** — commandcode catalog
      case-drift re-keyed to the live roster casing (`zai-org/GLM-5.2/5.3`),
      the two rows' windows re-sourced to the gateway's own publication, the
      keyless fail-open boundary documented on the registry entry, and the
      window-truth probe's four structurally-dead samples repaired (archived
      `FID-2026-0928-010`; the probe had been red since the realign and also
      caught a genuine bazaarlink drift, settled 2-of-3 to orcarouter).
      Remaining items are **level 1**, both blocked on operator
      credits/keys, so there is nothing to automate: (2) tokenharbor
      `deepseek-v4.1-flash:free` catalog add + free-cell identity re-run
      after 2026-09-19T04:32 allowance reset; (3) tokenrouter self-ID
      completion on operator top-up (`bun dev/scratchpad/active/t62-round3.ts`).
      **Blocker:** operator credits/keys — tokenharbor allowance reset and
      tokenrouter top-up, both external to the repository.

- [ ] **T147. Geaix/Excelnt keyed live probe, then registry integration.**
      **Automation level: 1.** The keyed probe (T146's completed probe script with
      a live key: catalog + one minimal completion on a chosen model) followed by
      the provider-registry integration FID (catalog, window seams, docs
      surfaces). Live state 2026-10-06: Geaix 0/25 active keys ("No keys
      yet"); Excelnt 0/1 — the single key revoked (2 requests recorded
      2026-10-06 02:14 UTC). **Blocker:** a live gateway key exists only
      after the operator mints it in the vendor's VS Code extension (shown
      once at creation); `/api/keys` is session-gated ("Sign in to manage
      keys.") and `.env.local` is agent-read-blocked, so the operator
      places the key on the prepared blank line. The keyed probe runs before
      any integration work, per "then i want to probe it before
      proceeding". **deferred::operator-approved 2026-10-06 — "let's
      shelf that for now and i'll revisit it later"** (operator shelved the
      provider work; the key-creation wall and the Oct 13 balance expiry
stay recorded above).

- [ ] **FID-2026-1010-001. TokenHarbor catalog live realignment (68-model
      roster, incl. `claude-haiku-5.5`).** Operator directive 2026-10-10:
      *"a new model has been released on tokenharbor, called claude haiku 5.5,
      however we don't have it in our model list. We need to add it"*. Grounding
      the add against the vendor's authenticated `/v1/models` measured a
      snapshot-freshness defect: the checked-in static catalog carried 17 ids
      against a live roster of 68 (52 missing, 1 no-longer-callable
      `th-orchestra`). Operator selected **Full realignment now** + **Paid +
      free (both)**. Record:
      `dev/fids/FID-2026-1010-001-tokenharbor-catalog-live-realignment.md`.
      **Automation level: 3.**

### Harness and process

- [ ] **T122. Savant-free feature disposition (operator-owned).** Operator
      ruling 2026-10-03, verbatim: "i think it might be smarter to leave
      savant-free alone, just fix the problems you found and i'll address it
      tomorrow when i have a clear day to spend more time on the savant-free
      feature because it's in the code deeply and i don't really feel like
      untangling it right now." Context: the full-repository battery
      surfaced 13 failing / 5 erroring savant-free e2e tests (missing built
      release binary + a stale `SavantFreeSession` import in 5 committed e2e
      files); a removal scan mapped 234 reference sites outside the
      workspace (`agents/savant/*` provider agents, the CLI free-mode
      integration, `common/src/constants`, docs, release scripts).
      **Blocker:** the feature is woven deeply through the CLI/agents/common
      surfaces — disposition (repair or removal) is a dedicated
      operator-directed session. **Automation level: 1** (no agent action;
      the e2e failures are known and operator-owned until then).

### Icon integration

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
  `dev/fids/archive/FID-2026-1010-003-sidebar-operator-polish-pass.md`,
  `dev/fids/archive/FID-2026-1009-007-sidebar-duplication-audit.md`,
  `dev/fids/archive/FID-2026-1009-004-cli-icon-integration-program.md`,
  `scripts/version-docs.ts`, `scripts/version-callouts.ts`,
  `scripts/version-docs-drift.test.ts`, `scripts/telemetry-feedback.ts`,
  `scripts/__tests__/telemetry-feedback.test.ts`,
  `cli/scripts/hud-preview-components.tsx`,
  `cli/scripts/hud-preview-section.tsx`,
  `cli/src/components/__tests__/right-sidebar-single-home.test.tsx`,
  `cli/src/components/__tests__/right-sidebar-phase-color.test.tsx`,
  `sdk/test/cjs-compatibility/test-types.ts`,
  `sdk/test/esm-compatibility/test-types.ts`,
  `sdk/src/tools/run-terminal-command.ts`,
  `sdk/src/tools/child-process-registry.ts`,
  `sdk/src/__tests__/run-terminal-command.test.ts`,
  `sdk/src/__tests__/fixtures/windows-stubborn-grandchild.ts`,
  `cli/scripts/build-binary.ts`, `cli/scripts/build-binary-main.ts`,
  `cli/scripts/smoke-binary.ts`,
  `cli/src/agents/bundled-agents.generated.ts`,
  `cli/src/agents/bundled-agents.generated-data/**`, `cli/bin/**`,
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
- FID-2026-1010-001: `dev/fids/FID-2026-1010-001-tokenharbor-catalog-live-realignment.md`,
  `common/src/constants/model-config/providers.ts`,
  `common/src/constants/model-config/tokenharbor.ts`,
  `common/src/constants/context-window-table.ts`,
  `common/src/constants/context-window-table-tokenharbor.ts`,
  `common/src/constants/window-coverage-register.ts`,
  `common/src/__tests__/model-config.test.ts`,
  `cli/src/utils/openrouter-models/static-catalogs.ts`,
  `cli/src/utils/openrouter-models/tokenharbor-names.ts`,
  `cli/src/utils/openrouter-models/__tests__/tokenharbor-catalog.test.ts`,
  `cli/src/utils/openrouter-models/__tests__/window-truth.test.ts`,
  `docs/providers.md`, `dev/session-summaries/**`, `CHANGELOG.md`
- T185: `README.md`, `README.zh-CN.md`, `knowledge.md`, `AGENTS.md`,
  `docs/**`, `cli/release/README.md`, `WINDOWS.md`, `desktop/README.md`,
  `sdk/README.md`, `common/src/templates/initial-agents-dir/README.md`,
  `cli/src/utils/constants.ts`, `dev/scratchpad/**`, `debug/**`,
  `firebase-debug.log`, `database.db`, `database.db-wal`, `database.db-shm`,
  `website/index-2.html`, `SCOPE.md`, `CHANGELOG.md`, `dev/session-summaries/**`
- T186: `ECHO.md`, `dev/echo-v0.1.2-single-agent.md`,
  `common/src/constants/protocol-bundle.generated.ts`, `SCOPE.md`,
  `dev/agenda.md`, `CHANGELOG.md`, `dev/fids/README.md`,
  `dev/fids/archive/README.md`,
  `dev/fids/archive/FID-2026-1011-001-local-commit-authority-push-gated.md`,
  `dev/fids/archive/FID-2026-1009-005-mistral-provider-integration.md`,
  `dev/fids/archive/FID-2026-1009-006-dsml-stream-parser.md`,
  `dev/fids/archive/FID-2026-1009-008-sidebar-cyberdeck-hud-modernization.md`,
  `dev/fids/archive/FID-2026-1010-005-sidebar-action-labels-and-placement.md`,
  `dev/fids/archive/FID-2026-1009-004-cli-icon-integration-program.md`,
  `dev/fids/archive/FID-2026-1009-007-sidebar-duplication-audit.md`,
  `dev/fids/archive/FID-2026-1010-003-sidebar-operator-polish-pass.md`
