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

- [ ] **T165. `FID-2026-1007-016` — provider identity sweep verdict controls.**
      The `--all` catalog sweep reports per-route status and a served-label
      classification but every row's identity `verdict` is `inconclusive`,
      because the sweep threads no control into the runner
      (`scripts/providers/lib/identity-matrix.ts:111`). The single-target path
      already accepts `--control-*`; the sweep does not. `FID-2026-1007-016`.
      **Automation level: 2.**

- [ ] **FID-2026-1009-001. Boot false-positive "credentials changed" error.**
      Env-sourced providers with no `credentials.json` revision anchor fail
      the persisted route's `accountRevision` check on the first message of
      every process: the check compares a process-memory random UUID against
      a persisted one with no cross-process bridge. Fix A (operator-approved
      2026-10-09): adopt-if-unobserved seeding in `getModelRouteConfig` and
      at CLI boot (`applyPersistedProviderApiKeys`), preserving the
      mid-session and anchored strict comparisons. Record:
      `dev/fids/FID-2026-1009-001-first-message-credentials-changed-false-positive.md`.
      **Automation level: 2.**

- [ ] **T167. `FID-2026-1008-001` — KiosAPI picker catalog: full public
      square.** The picker's KiosAPI group served the stored Free-group key's
      36-row `/v1/models` view while the vendor publishes 80 on its public
      pricing feed — every flagship (gpt-5.6-sol, claude-opus-5-5,
      gemini-3.8-flash, grok-4.7 …) was absent. Swap the catalog source to
      `https://kiosapi.com/api/pricing` (unauthenticated) so the list matches
      the site. `FID-2026-1008-001`.      **Automation level: 2.**

- [ ] **T168. `FID-2026-1008-002` phase 1 — every-boot free-provider launch
      summary.** The launch digest is gated to once per calendar day
      (`use-chat-bootstrap.ts`), so a same-day relaunch never shows the
      free-provider summary. Operator decision 2026-10-08: "Show a launch
      summary every boot." `FID-2026-1008-002`. **Automation level: 2.**

- [ ] **T169. `FID-2026-1008-002` phase 2 — auto-wire selected free providers.**
      Selecting a free provider in the UI should update the provider and
      `/model` lists as a first-class custom provider. Operator decision
      2026-10-08: "full support". Design review before implementation.
      `FID-2026-1008-002`. **Automation level: 2.**

- [ ] **T171. `FID-2026-1008-004` — free-provider follow-ups.** A: boot-path
      decision extracted to `runLaunchDigest` and pinned. B: offers ending within
      72h counted and printed (applied). C: auto-wire of selected free providers is
      **blocked pending operator ruling** — operator directed a harvested-candidate
      design draft 2026-10-08 (option 2 of FID section "C"); design presented,
      implementation gated on the ruling. **Automation level: 2.**

- [ ] **T172. `FID-2026-1008-005` — /model stale-while-revalidate, gauntlet docs,
      registry-only auto-wire.** (1) `/model` opens from the cache and refreshes
      in the background. (2) `docs/provider-gauntlets.md` linked from AGENTS.md.
      (3) Selecting an unkeyed registry provider runs the key flow and wires the
      picked model on save. **Automation level: 2.**

- [ ] **FID-2026-1009-002. Context meter resets to 0/1,000,000.**
      Two defects: the sidebar's `contextTokensUsed` is never seeded from
      the restored chat at boot (only the cap is), so a resumed session
      reads 0/1,000,000 until the first run recomputes; and `dampTokenCount`
      adopts any incoming ≤ 10,000 — including 0 — exactly, so a
      non-positive runtime reading (`reconcileTokenCount` can prefer a
      provider usage reporting 0 input tokens) wipes an established count
      mid-session. Fix: suppress non-positive incoming in the display path,
      seed the meter from the restored session, guard the reconcile's
      provider-usage precedence, and add an explicit `/new` meter reset.
      Record:
      `dev/fids/FID-2026-1009-002-context-meter-resets-to-zero-mid-session.md`.
      **Automation level: 2.**

- [ ] **FID-2026-1009-003. Auto-compact silent before window overflow.**
      A long session hard-fails with `RequestInputBudgetError` (input
      estimate past the window) because the compaction trigger chain
      evaluates a count the reconcile could zero (fixed by
      FID-2026-1009-002 Layer 3) and the fixed 15k force margin can be
      jumped by a single large tool result. Fix: SDK overflow seam
      (compact-and-retry instead of hard-throw), proportional force
      margin (max(15k, 2% of window)), escalation-hold release near the
      force margin. Record:
      `dev/fids/FID-2026-1009-003-auto-compact-silent-before-window-overflow.md`.
      **Automation level: 2.**

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

### Build orders (formalized as FIDs 2026-10-07)

- [ ] **T164-B. `FID-2026-1007-011` — tree-drain manifest coverage under a
      moving directory.** The manifest names exact paths inside
      `dev/build-orders/`, whose contents move to `archive/`; any move aborts
      the drain tool with `UNCOVERED PATHS`. Needs a directory-scoped entry
      plus a regression test — the manifest is a fail-closed contract with no
      coverage today. `FID-2026-1007-011`. **Automation level: 2.**

- [ ] **T164-D. `FID-2026-1007-013` — eval-runner model override + usage
      telemetry (stage 1-2 of 7; wire stage open).** `--model` override, inline
      clone, run-usage fold + tree-summed `TraceMetadata.usage`/`model`, CLI
      flag — implemented and gate-verified (receipt 5/5, commit `8ead0378`).
      Open: the print-mode `usage` wire member + host-facing `onUsage`
      callback, gated on a NAMED consumer outside the eval harness.
      `FID-2026-1007-013`. **Automation level: 2.**

- [ ] **T164-E. `FID-2026-1007-014` — git-workflow FID 4 remainder (G2 hash
      audit + G5 bundle verification).** `BO-2026-08-23`: Phase 0 and FIDs
      1–3 shipped; the pre-release preflight asserts worktree-clean and
      push-range but never the G2 closed-FID commit-hash audit or the G5
      latest-bundle-verified check. `FID-2026-1007-014`. **Automation level: 2.**

- [ ] **T164-F. `FID-2026-1007-015` — Atria handoff friction P1 and P5 —
      RULED AND IMPLEMENTED 2026-10-08.** P1: operator ruling verbatim "verify
      once seems optimal" — the Law 3 other-dirty branch is advisory in the
      `green` phase (batch-verify-once; target-dirty still blocks everywhere;
      turn-end Law 15 unchanged; non-green phases keep the hard block). P5:
      approved — the `green → complete` edge exists, guarded by
      enforcement-layer verification credit read through the cached factory.
      Receipt 5/5, commit `4eaf57cc`. Remaining: closure ceremony (needs the
      ruling recorded in the archived record + CHANGELOG entry).
      `FID-2026-1007-015`. **Automation level: 2.**

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
- T165: `dev/fids/FID-2026-1007-016-provider-identity-sweep-verdict-controls.md`,
  `scripts/providers/**`
- T167: `dev/fids/FID-2026-1008-001-kiosapi-full-square-catalog.md`,
  `common/src/providers/registry-partitioned.ts`,
  `cli/src/utils/openrouter-models/kiosapi.ts`,
  `cli/src/utils/__tests__/openrouter-models-gateway*.test.ts`,
  `common/src/constants/context-window-table-kiosapi.ts`
- T168: `dev/fids/FID-2026-1008-002-free-provider-launch-and-autowire.md`,
  `cli/src/chat/use-chat-bootstrap.ts`,
  `cli/src/utils/__tests__/free-options-digest.test.ts`
- T169: `dev/fids/FID-2026-1008-002-free-provider-launch-and-autowire.md`,
  `cli/src/commands/provider-subcommands-handlers.ts`,
  `common/src/providers/custom-providers.ts`,
  `cli/src/utils/settings/io.ts`
- T170: `dev/fids/FID-2026-1008-003-launch-announce-wired-and-offers.md`,
  `cli/src/utils/free-options.ts`,
  `cli/src/utils/free-options-render.ts`,
  `cli/src/utils/free-options-types.ts`,
  `cli/src/utils/__tests__/free-options.test.ts`
- T171: `dev/fids/FID-2026-1008-004-free-provider-followups.md`,
  `cli/src/utils/launch-digest.ts`,
  `cli/src/utils/__tests__/launch-digest.test.ts`,
  `cli/src/chat/use-chat-bootstrap.ts`,
  `cli/src/utils/provider-offers.ts`,
  `cli/src/utils/free-options.ts`,
  `cli/src/utils/free-options-types.ts`,
  `cli/src/utils/free-options-render.ts`,
  `cli/src/utils/__tests__/free-options.test.ts`
- T172: `dev/fids/FID-2026-1008-005-model-picker-swr-gauntlet-docs-autowire.md`,
  `cli/src/utils/model-picker-open.ts`,
  `cli/src/utils/__tests__/model-picker-open.test.ts`,
  `cli/src/utils/model-picker-autowire.ts`,
  `cli/src/utils/__tests__/model-picker-autowire.test.ts`,
  `cli/src/state/model-picker-store.ts`,
  `cli/src/commands/defs/model-provider-commands.ts`,
  `cli/src/chat/use-chat-pickers.ts`,
  `cli/src/commands/router/route-masked-key-setup.ts`,
  `cli/src/chat/__tests__/model-picker-activation.test.ts`,
  `docs/provider-gauntlets.md`,
  `AGENTS.md`
- T62-followups: `dev/scratchpad/active/t62*.ts` (the catalog itself is
  gateway-side; the local write surface is the probe scripts — verified
  2026-10-02: no local catalog directory exists)
- T147: `dev/scratchpad/active/gateway-catalog-probe.ts`,
  `dev/session-summaries/2026-10-06-geaix-excelnt-probe.md`,
  `dev/fids/**` (the integration FID)
- T122: (no write surface — operator-owned)
- T164-B: `dev/fids/FID-2026-1007-011-tree-drain-manifest-move-safety.md`,
  `scripts/tree-drain-manifest/**`,
  `scripts/tree-drain.ts`,
  `scripts/__tests__/*drain*`
- T164-D: `dev/fids/FID-2026-1007-013-eval-runner-model-override-and-usage-telemetry.md`,
  `dev/build-orders/BO-2026-09-08-eval-runner-model-override-and-usage-telemetry.md`
- T164-E: `dev/fids/FID-2026-1007-014-release-preflight-g2-g5-audit.md`,
  `dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md`,
  `scripts/public-release/pre-audit*.ts`
- T164-F: `dev/fids/FID-2026-1007-015-atria-harness-friction-p1-p5.md`,
  `dev/build-orders/BO-2026-09-16-atria-friction.md`
- FID-2026-1009-001: `common/src/providers/model-route.ts`
  `common/src/providers/provider-account-revisions.ts`
  `cli/src/utils/provider-key-store.ts`
  `cli/src/utils/provider-key-persistence.ts`
  `common/src/providers/__tests__/model-route-account-adoption.test.ts`
  `cli/src/utils/__tests__/provider-key-store-account-adoption.test.ts`
  `dev/scratchpad/active/fid-1009-001-first-message-probe.ts`
- FID-2026-1009-002: `cli/src/state/chat-store/compaction-helpers.ts`,
  `cli/src/state/chat-store/sidebar-actions.ts`,
  `cli/src/state/chat-store/sidebar-reset.ts`,
  `cli/src/state/chat-store/chat-store-actions.ts`,
  `cli/src/hooks/use-send-message.ts`,
  `cli/src/utils/run-state-storage/load.ts`,
  `cli/src/utils/run-state-storage.ts`,
  `packages/agent-runtime/src/run-agent-step/reconcile-token-count.ts`,
  `cli/src/state/chat-store/__tests__/context-token-damping.test.ts`,
  `cli/src/state/chat-store/__tests__/context-token-reset.test.ts`,
  `cli/src/utils/__tests__/restored-context-token-count.test.ts`,
  `packages/agent-runtime/src/__tests__/reconcile-token-count.test.ts`
- FID-2026-1009-003: `sdk/src/impl/model-provider/request-budget-policy.ts`,
  `sdk/src/impl/model-provider/request-budget.ts`,
  `sdk/src/impl/model-provider/request-token-count.ts`,
  `sdk/src/impl/model-provider/types.ts`,
  `sdk/src/impl/model-provider/apply-request-budget.ts`,
  `sdk/src/impl/model-provider/__tests__/request-overflow-recovery.test.ts`,
  `sdk/src/impl/llm/stream-request-setup.ts`,
  `sdk/src/impl/__tests__/request-budget.test.ts`,
  `common/src/types/contracts/llm.ts`,
  `packages/agent-runtime/src/prompt-agent-stream.ts`,
  `packages/agent-runtime/src/run-agent-step/step.ts`,
  `agents/savant/handle-steps-template.ts`,
  `agents/savant/handle-steps-template-body-b.ts`,
  `agents/__tests__/handle-steps-force-margin.test.ts`,
  `cli/src/agents/bundled-agents.generated-data/*.ts`