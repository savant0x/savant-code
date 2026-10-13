# Canonical Learning Rules

Normative behavior remains owned by executable code and protocol documents.
This catalog provides stable names for lessons that explain those authorities.

## Rule: focusable-requires-a-focus-mover

- **Authority:** `cli/src/components/right-sidebar-focus.ts`
- **Validation:** `cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx`
- **Tier:** reference
- **Tier reason:** Active sidebar keyboard-access invariant, retained for focused UI work.

## Rule: count-only-consumers-get-count-paths

- **Authority:** `cli/src/utils/fid-loader.ts`
- **Validation:** `cli/src/utils/__tests__/fid-loader.test.ts`
- **Tier:** reference
- **Tier reason:** Active loader-cost invariant; count projections remain live under file changes.

## Rule: reserve-slots-mechanically-notices-are-metadata-only

- **Authority:** `common/src/util/skill-proposals.ts`, `common/src/util/skill-lifecycle-events.ts`
- **Validation:** `scripts/__tests__/lessons-to-skills-drafting.test.ts`
- **Tier:** reference
- **Tier reason:** Active proposal reservation and notice provenance invariant, without public promotion.

## Rule: generated-artifact-drift

- **Authority:** `scripts/generate-protocol-bundle.ts`
- **Validation:** `bun run generate:protocol-bundle:check`
- **Tier:** boot
- **Tier reason:** Public boot guidance for validating generated source shape.
- **Invariant:** Generated content is trustworthy only when extraction validates the source's observed structure.
- **Guard:** `bun run generate:protocol-bundle:check`

## Rule: release-preflight-restoration

- **Authority:** `scripts/public-release.ts`
- **Validation:** `scripts/public-release.test.ts`
- **Tier:** boot
- **Tier reason:** Public boot guidance for reversible release preparation.
- **Invariant:** Local release checks are reversible and must report direct command outcomes.
- **Guard:** `bun run validate:repository`

## Rule: learning-schema

- **Authority:** `scripts/learnings-validation.ts`
- **Validation:** `bun run learnings:check`
- **Tier:** reference
- **Tier reason:** Current schema authority retained for on-demand engineering reference.

## Rule: learning-supersession

- **Authority:** `scripts/learnings-validation.ts`
- **Validation:** `scripts/learnings.test.ts`
- **Tier:** boot
- **Tier reason:** Public boot guidance for replacing stale learning guidance.
- **Invariant:** Superseded guidance retains its history but names an existing replacement and canonical rule.
- **Guard:** `bun run learnings:check`

## Rule: protocol-variant-boundary

- **Authority:** `common/src/util/boot-contract.ts`
- **Validation:** `common/src/util/__tests__/boot-contract.test.ts`
- **Tier:** boot
- **Tier reason:** Public boot guidance for keeping protocol variants explicit.
- **Invariant:** Each governance branch is explicit and must not silently fall
  through to another contract; harness-injected context selects only the harness contract.
- **Guard:** `bun run generate:protocol-bundle:check`

## Rule: dependency-resolution-repo-bound

- **Authority:** `scripts/validation-manifest.ts`
- **Engine:** `scripts/clean-install-bundle.ts` (pristine tree + resolution provenance)
- **Validation:** `bun run release:public:diagnose` (cli-bundle-resolution gate)
- **Tier:** reference
- **Tier reason:** Release-engine reference for dependency provenance and clean-install resolution.

## Rule: dispatch-ref-branch-or-tag

- **Authority:** `.github/workflows/build-release-binaries.yml`
- **Validation:** `scripts/public-release.test.ts`
- **Tier:** reference
- **Tier reason:** Release workflow reference for dispatch ref selection.

## Rule: release-only-commits

- **Authority:** `scripts/public-release.ts` (automation commit sweeps the whole worktree at release time)
- **Validation:** `dev/session-summaries/2026-08-21-1629-v0.0.27-release-and-release-engine-hardening.md`
- **Tier:** reference
- **Tier reason:** Release workflow reference for commit ownership at publication time.

## Rule: fid-closure-requires-implementation-evidence

- **Authority:** `ECHO.md` (FID Ground-Truth Verification)
- **Validation:** `bun run learnings:check`
- **Tier:** reference
- **Tier reason:** FID lifecycle reference for implementation-grounded closure.

## Rule: archived-runbook-is-claim-not-contract

- **Authority:** `common/src/providers/audit.ts` (the live contract an archived runbook describes)
- **Validation:** `bun run learnings:check`
- **Tier:** reference
- **Tier reason:** Provider audit reference for interpreting archived operational guidance.

## Rule: test-renderer-not-proxy

- **Authority:** `cli/src/components/tools/diff-viewer.tsx`
- **Validation:** `cli/src/components/tools/__tests__/diff-viewer.test.tsx`
- **Tier:** reference
- **Tier reason:** CLI rendering reference retained for focused UI audits.

## Rule: timeline-loop-duration

- **Authority:** `cli/src/hooks/use-animation-timeline.ts`
- **Validation:** `cli/src/hooks/__tests__/animation-timeline-loop.test.ts`
- **Tier:** reference
- **Tier reason:** CLI animation reference retained for on-demand UI audits.

## Rule: brand-color-provenance-operator-confirmed

- **Authority:** `cli/src/utils/theme-system/palette.ts`
- **Validation:** `packages/design-systems/src/__tests__/default.test.ts`
  (no-navy neutral-family assertion)
- **Tier:** reference
- **Tier reason:** Operator-confirmed visual-system reference, not boot guidance.

## Rule: large-file-edits-bypass-the-tool-read-path

- **Authority:** the harness tool read path — the 100,000-char cap is shared by every
  read-before-write tool (`str_replace`, `read_files` and `write_file` all inherit
  it, so it is a property of the read step and not of one edit tool; not a
  repository module)
- **Validation:** `wc -c <file>` before choosing an edit tool; the staged-copy
  route is recorded in `dev/LEARNINGS.md`
  (`Files over the 100k-character tool read limit break every in-place edit path`)
- **Tier:** reference
- **Tier reason:** Harness editing reference for choosing a safe read/write path.

## Rule: string-split-byte-identity-gate

- **Authority:** `cli/src/commands/graph-export/universe-app-script.ts`
- **Validation:** `bun test cli/src/commands/__tests__/graph-export.test.ts`
- **Tier:** reference
- **Tier reason:** Graph export reference for byte-preserving string splitting.

## Rule: null-keyed-suppression-is-always-broken

- **Authority:** `cli/src/state/chat-store/sidebar-reset.ts` (`applyCompactionStatus`)
- **Validation:** `cli/src/state/__tests__/chat-store-compaction.test.ts`
- **Tier:** reference
- **Tier reason:** Sidebar state reference for null-safe suppression keys.

## Rule: fid-verification-section-is-contract

- **Authority:** `scripts/learnings-validation.ts` (`validateCanonicalRuleCatalog`)
- **Validation:** `bun run learnings:check`
- **Tier:** reference
- **Tier reason:** FID documentation reference for the verification-section contract.

## Rule: active-ledger-status-admission

- **Authority:** `scripts/fid-ledger.ts` (`ALLOWED_ACTIVE_STATUSES`)
- **Validation:** `bun run validate:repository`
- **Tier:** reference
- **Tier reason:** FID ledger reference for active status admission.

## Rule: no-attribution-fid-metadata

- **Authority:** `scripts/fid-ledger.ts` (`FORBIDDEN_ATTRIBUTION`)
- **Validation:** `bun run validate:repository`
- **Tier:** reference
- **Tier reason:** Governance reference for attribution-free FID metadata.

## Rule: post-terminal-breaker-autonomy-carveout

- **Authority:** `packages/agent-runtime/src/run-agent-step/post-terminal-breaker.ts`
- **Validation:** `packages/agent-runtime/src/__tests__/post-terminal-breaker.test.ts`
- **Tier:** reference
- **Tier reason:** Runtime autonomy reference for preserving user-directed continuation.

## Rule: kill-proof-probes-and-forge-relay

- **Authority:** `packages/agent-runtime/src/__tests__/post-terminal-breaker-integration.test.ts`
- **Validation:** `bun run learnings:check`
- **Tier:** reference
- **Tier reason:** Runtime probe reference for kill-proof verification and Forge relay.

## Rule: no-environment-dependent-guards

- **Authority:** `packages/agent-runtime/src/tools/handlers/tool/recorder-stall-check.ts` (`isAllowedWritePath`)
- **Validation:** `packages/agent-runtime/src/tools/handlers/tool/__tests__/recorder-stall-check.test.ts`
  (cwd-independence case: arbitrary NON-cwd root must count)
- **Tier:** reference
- **Tier reason:** Harness guard reference for environment-independent path checks.

## Rule: networked-downstream-defeats-boundary-pin

- **Authority:** `scripts/public-release/npm-guards.ts` (`awaitPublishedPackage`)
- **Validation:** `scripts/__tests__/public-release-npm-guards.test.ts`
  (both legs hermetic; the transient-404 leg is load-bearing — a single-shot
  window fails it)
- **Tier:** reference
- **Tier reason:** Release-network reference for downstream retry and boundary evidence.

## Rule: pin-mode-parameter-on-every-verdict-branch

- **Authority:** `scripts/public-release/pre-audit-local.ts` (`checkStaleTag`)
- **Validation:** `scripts/__tests__/pre-audit.test.ts`
  (tag-on-origin + resume warns while mutation mode still blocks)
- **Tier:** reference
- **Tier reason:** Release pre-audit reference for verdict-branch pinning.

## Rule: gate-grammar-decides-condensable-scope

- **Authority:** `packages/agent-runtime/src/echo/scope-register-completeness.ts`
  (`scanUnregisteredTaskReferences` / `collectRegisteredTasks` — a `## Task NN`
  heading is the registration of every `TNN-X` item under it)
- **Validation:** `bun run scripts/scope-register-check.ts`
- **Tier:** reference
- **Tier reason:** Scope parser reference for grammar-controlled task registration.

## Rule: prose-parser-must-separate-description-from-declaration

- **Authority:** `scripts/session-end-review.ts` (`pendingOperatorDecisions` — a
  blocker is *declared* by a line-leading `**Blocker:**`, so a register entry that
  quotes the convention in prose is not read as a decision)
- **Validation:** `scripts/__tests__/session-end-review.test.ts`
  (the quoting-item pin; recorded in
  `dev/fids/archive/FID-2026-1003-007-pending-operator-decision-surfacing.md`)
- **Tier:** reference
- **Tier reason:** Session-review reference for separating prose from declarations.

## Rule: truncation-budget-includes-its-rendered-prefix

- **Authority:** `scripts/session-end-review.ts` (`AGENDA_MAX_LINE` — the agenda
  is a committed markdown artifact, so each field's budget is what remains after
  its own rendered prefix, not a constant slice)
- **Validation:** `scripts/__tests__/session-end-review.test.ts`
  (the line-length pin; `bun run lint:md` is the gate that caught it)
- **Tier:** reference
- **Tier reason:** Session-review reference for rendered agenda budgets.

## Rule: library-complete-needs-a-named-consumer

- **Authority:** `dev/fids/archive/FID-2026-1006-003-wire-uncalled-adoption-modules.md`
  (the wiring record a limitation-stating closure is required to produce)
- **Validation:** `bun run validate:repository` (the disposition must be a register item
  or an active FID, so a closed record cannot be its own follow-up)
- **Tier:** reference
- **Tier reason:** FID hand-off reference for naming a live consumer of completed work.

## Rule: call-graph-proof-asserts-the-caller

- **Authority:** `ECHO.md` (Law 4 — Verify Call-Graph Reachability: compilation and a
  green module suite are both silent about whether production calls the code)
- **Validation:** the six wiring suites declared as gates on
  `dev/fids/archive/FID-2026-1006-003-wire-uncalled-adoption-modules.md`, plus
  `bun run fid:verify dev/fids/archive/FID-2026-1006-003-wire-uncalled-adoption-modules.md --check`
- **Tier:** reference
- **Tier reason:** ECHO Law 4 reference for proving production callers, not only tests.

## Rule: embedded-scopes-need-data-seams

- **Authority:** `agents/context-pruner/summarization-context.ts` (`cutPlan` — read from
  spawn params, because the pruner is serialized via `.toString()` and cannot import
  runtime code)
- **Validation:** `packages/agent-runtime/src/__tests__/compaction-cut-plan-wiring.test.ts`
- **Tier:** reference
- **Tier reason:** Serialized-agent reference for data-shaped integration seams.

## Rule: config-loader-parses-the-formatted-file

- **Authority:** `common/src/util/orchestration-preset.ts` (`parseOrchestrationPresetConfig`
  — must read the prettier-wrapped shape the repository actually ships)
- **Validation:** `common/src/util/__tests__/orchestration-preset.test.ts`
- **Tier:** reference
- **Tier reason:** Configuration reference for parsing formatter-shaped repository input.

## Rule: extractions-carry-their-census-pins

- **Authority:** `scripts/hook-events-census.ts` (`hookEventSites` — a site is a call,
  not a mention, so a moved call reds the census)
- **Validation:** `bun run scripts/hook-events-check.ts`
- **Tier:** reference
- **Tier reason:** Quality-census reference for preserving call-site pins through extraction.
