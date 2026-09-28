# Canonical Learning Rules

Normative behavior remains owned by executable code and protocol documents.
This catalog provides stable names for lessons that explain those authorities.

## Rule: generated-artifact-drift

- **Authority:** `scripts/generate-protocol-bundle.ts`
- **Validation:** `bun run generate:protocol-bundle:check`

## Rule: release-preflight-restoration

- **Authority:** `scripts/public-release.ts`
- **Validation:** `scripts/public-release.test.ts`

## Rule: learning-schema

- **Authority:** `scripts/learnings-validation.ts`
- **Validation:** `bun run learnings:check`

## Rule: learning-supersession

- **Authority:** `scripts/learnings-validation.ts`
- **Validation:** `scripts/learnings.test.ts`

## Rule: protocol-variant-boundary

- **Authority:** `common/src/util/boot-contract.ts`
- **Validation:** `common/src/util/__tests__/boot-contract.test.ts`

## Rule: dependency-resolution-repo-bound

- **Authority:** `scripts/validation-manifest.ts`
- **Validation:** `bun run release:public:diagnose` (cli-bundle-resolution gate)

## Rule: dispatch-ref-branch-or-tag

- **Authority:** `.github/workflows/build-release-binaries.yml`
- **Validation:** `scripts/public-release.test.ts`

## Rule: release-only-commits

- **Authority:** `scripts/public-release.ts` (automation commit sweeps the whole worktree at release time)
- **Validation:** `dev/session-summaries/2026-08-21-1629-v0.0.27-release-and-release-engine-hardening.md`

## Rule: fid-closure-requires-implementation-evidence

- **Authority:** `ECHO.md` (FID Ground-Truth Verification)
- **Validation:** `bun run learnings:check`

## Rule: archived-runbook-is-claim-not-contract

- **Authority:** `common/src/providers/audit.ts` (the live contract an archived runbook describes)
- **Validation:** `bun run learnings:check`

## Rule: test-renderer-not-proxy

- **Authority:** `cli/src/components/tools/diff-viewer.tsx`
- **Validation:** `cli/src/components/tools/__tests__/diff-viewer.test.tsx`

## Rule: timeline-loop-duration

- **Authority:** `cli/src/hooks/use-animation-timeline.ts`
- **Validation:** `cli/src/hooks/__tests__/animation-timeline-loop.test.ts`

## Rule: brand-color-provenance-operator-confirmed

- **Authority:** `cli/src/utils/theme-system/palette.ts`
- **Validation:** `packages/design-systems/src/__tests__/default.test.ts`
  (no-navy neutral-family assertion)

## Rule: large-file-edits-bypass-the-tool-read-path

- **Authority:** the harness tool read path — the 100,000-char cap is shared by every
  read-before-write tool (`str_replace`, `read_files` and `write_file` all inherit
  it, so it is a property of the read step and not of one edit tool; not a
  repository module)
- **Validation:** `wc -c <file>` before choosing an edit tool; the staged-copy
  route is recorded in `dev/LEARNINGS.md`
  (`Files over the 100k-character tool read limit break every in-place edit path`)

## Rule: string-split-byte-identity-gate

- **Authority:** `cli/src/commands/graph-export/universe-app-script.ts`
- **Validation:** `bun test cli/src/commands/__tests__/graph-export.test.ts`

## Rule: null-keyed-suppression-is-always-broken

- **Authority:** `cli/src/state/chat-store/sidebar-reset.ts` (`applyCompactionStatus`)
- **Validation:** `cli/src/state/__tests__/chat-store-compaction.test.ts`

## Rule: fid-verification-section-is-contract

- **Authority:** `scripts/learnings-validation.ts` (`validateCanonicalRuleCatalog`)
- **Validation:** `bun run learnings:check`

## Rule: active-ledger-status-admission

- **Authority:** `scripts/fid-ledger.ts` (`ALLOWED_ACTIVE_STATUSES`)
- **Validation:** `bun run validate:repository`

## Rule: no-attribution-fid-metadata

- **Authority:** `scripts/fid-ledger.ts` (`FORBIDDEN_ATTRIBUTION`)
- **Validation:** `bun run validate:repository`

## Rule: post-terminal-breaker-autonomy-carveout

- **Authority:** `packages/agent-runtime/src/run-agent-step/post-terminal-breaker.ts`
- **Validation:** `packages/agent-runtime/src/__tests__/post-terminal-breaker.test.ts`

## Rule: kill-proof-probes-and-forge-relay

- **Authority:** `packages/agent-runtime/src/__tests__/post-terminal-breaker-integration.test.ts`
- **Validation:** `bun run learnings:check`

## Rule: no-environment-dependent-guards

- **Authority:** `packages/agent-runtime/src/tools/handlers/tool/recorder-stall-check.ts` (`isAllowedWritePath`)
- **Validation:** `packages/agent-runtime/src/tools/handlers/tool/__tests__/recorder-stall-check.test.ts`
  (cwd-independence case: arbitrary NON-cwd root must count)

## Rule: networked-downstream-defeats-boundary-pin

- **Authority:** `scripts/public-release/npm-guards.ts` (`awaitPublishedPackage`)
- **Validation:** `scripts/__tests__/public-release-npm-guards.test.ts`
  (both legs hermetic; the transient-404 leg is load-bearing — a single-shot
  window fails it)

## Rule: pin-mode-parameter-on-every-verdict-branch

- **Authority:** `scripts/public-release/pre-audit-local.ts` (`checkStaleTag`)
- **Validation:** `scripts/__tests__/pre-audit.test.ts`
  (tag-on-origin + resume warns while mutation mode still blocks)

## Rule: gate-grammar-decides-condensable-scope

- **Authority:** `packages/agent-runtime/src/echo/scope-register-completeness.ts`
  (`scanUnregisteredTaskReferences` / `collectRegisteredTasks` — a `## Task NN`
  heading is the registration of every `TNN-X` item under it)
- **Validation:** `bun run scripts/scope-register-check.ts`
