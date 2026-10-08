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

- [ ] **T164-C. `FID-2026-1007-012` — model-compliance telemetry (0 of 7).**
      `BO-2026-08-24`, unstarted since 2026-08-24: no
      `common/src/types/telemetry.ts`, no `dev/telemetry/`, no
      `compliance.jsonl`. `FID-2026-1007-012`. **Automation level: 2.**

- [ ] **T164-D. `FID-2026-1007-013` — eval-runner model override + usage
      telemetry (0 of 7).** `BO-2026-09-08`: `RunnerConfig` carries no `model`
      or `onUsage`, `TraceMetadata` no usage/model, and `printModeEventSchema`
      no `usage` member. `FID-2026-1007-013`. **Automation level: 2.**

- [ ] **T164-E. `FID-2026-1007-014` — git-workflow FID 4 remainder (G2 hash
      audit + G5 bundle verification).** `BO-2026-08-23`: Phase 0 and FIDs
      1–3 shipped; the pre-release preflight asserts worktree-clean and
      push-range but never the G2 closed-FID commit-hash audit or the G5
      latest-bundle-verified check. `FID-2026-1007-014`. **Automation level: 2.**

- [ ] **T164-F. `FID-2026-1007-015` — Atria handoff friction P1 and P5.**
      `BO-2026-09-16` recorded six harness friction points; P6 is fixed
      (`enforcement/tool-pipeline.ts:268-279`), P1 and P5 are still
      reproducible — the other-dirty Law 3 block
      (`pre-write-gates-law3.ts:188-195`) and the absent `green → complete`
      FSM edge (`transition-phase.ts:40`). Both are harness-behavior changes,
      not documentation. `FID-2026-1007-015`. **Automation level: 2.**

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
- T164-C: `dev/fids/FID-2026-1007-012-model-compliance-telemetry.md`,
  `dev/build-orders/BO-2026-08-24-model-compliance-telemetry.md`
- T164-D: `dev/fids/FID-2026-1007-013-eval-runner-model-override-and-usage-telemetry.md`,
  `dev/build-orders/BO-2026-09-08-eval-runner-model-override-and-usage-telemetry.md`
- T164-E: `dev/fids/FID-2026-1007-014-release-preflight-g2-g5-audit.md`,
  `dev/build-orders/BO-2026-08-23-git-workflow-enforcement.md`,
  `scripts/public-release/pre-audit*.ts`
- T164-F: `dev/fids/FID-2026-1007-015-atria-harness-friction-p1-p5.md`,
  `dev/build-orders/BO-2026-09-16-atria-friction.md`