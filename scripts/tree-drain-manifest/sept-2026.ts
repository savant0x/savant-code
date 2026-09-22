import type { DrainGroup } from '../tree-drain-manifest.js'

/**
 * The Sept 2026 governance wave (Tasks 73–82): the 0.0.33 version surfaces,
 * the B.AI gateway/credit-gate sweep corrections, the hook-surface + lifecycle
 * contract work, the handoff-transport program, the FID-contract widening, and
 * the whitespace normalization those passes left behind.
 *
 * Appended last so the Sept work lands after the Aug drain in the log.
 *
 * Every FID attribution here is evidence-based, not proximity-based: the FID is
 * cited in the ADDED lines of that path's own working-tree diff
 * (`git diff -U0 -- <path> | grep '^+'`). The version-surface group cites
 * FID-2026-0919-023 ("release quality pass — automation levels,
 * documented-version surfaces"), verified by each manifest's diff being the
 * single `version` field 0.0.32 → 0.0.33. The final group has no FID because
 * its diffs are whitespace-only (`0 insertions, 1 deletion` of a blank line).
 */
export const SEPT_GROUPS: DrainGroup[] = [
  {
    message: [
      'chore(release): 0.0.33 version + documented-version surfaces',
      '',
      'Bump VERSION and every workspace manifest to 0.0.33 and sync the',
      'documented-version surfaces (SAVANT-VERSIONING, privacy, sdk-overview,',
      'README.zh-CN badges + release prose). Version-shaped only: each manifest',
      'diff is the single "version" field.',
      '',
      'FID: FID-2026-0919-023 (release quality pass — documented-version surfaces).',
    ].join('\n'),
    paths: [
      'VERSION',
      'README.zh-CN.md',
      'agents/package.json',
      'cli/package.json',
      'cli/release/package.json',
      'packages/agent-runtime/package.json',
      'packages/code-map/package.json',
      'packages/database/package.json',
      'packages/design-systems/package.json',
      'packages/knowledge-graph/package.json',
      'packages/llm-providers/package.json',
      'savant-free/package.json',
      'savant-free/cli/release/package.json',
      'scripts/tmux/package.json',
      'docs/SAVANT-VERSIONING.md',
      'docs/privacy.md',
      'docs/sdk-overview.md',
      'scripts/version.ts',
      'scripts/version-docs.ts',
      'scripts/bump-version.test.ts',
      'packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts',
    ],
  },
  {
    message: [
      'fix(cli,common): B.AI credit-gate sweep corrections',
      '',
      'Health-command and fallback-hint surfaces, plus the provider registry',
      'partition/type contract pins, corrected against the credit-gate audit.',
      '',
      'FID: FID-2026-0919-026 (B.AI credit-gate audit).',
    ].join('\n'),
    paths: [
      'cli/src/commands/health-command.ts',
      'cli/src/hooks/helpers/__tests__/fallback-hints.test.ts',
      'cli/src/hooks/helpers/send-message/fallback-hints.ts',
      'cli/src/hooks/helpers/send-message/run-results.ts',
      'common/src/providers/__tests__/provider-contract-pins.test.ts',
      'common/src/providers/registry-partitioned.ts',
      'common/src/providers/types.ts',
    ],
  },
  {
    message: [
      'docs(hooks): hook-surface + lifecycle-event contract truth',
      '',
      'The hook-system doc read back against the runtime, and the run-outcome',
      'plumbing the boundary-enumeration work added.',
      '',
      'FIDs: FID-2026-0919-029 (boundary outcome + enumeration),',
      'FID-2026-0919-030 (hook surface truth),',
      'FID-2026-0919-031 (lifecycle events + contract truth).',
    ].join('\n'),
    paths: [
      'docs/design/hook-system.md',
      'packages/agent-runtime/src/main-prompt-run.ts',
    ],
  },
  {
    message: [
      'fix(agent-runtime): subagent propagation contract pin',
      '',
      'The inter-agent handoff transport contract, pinned at the propagation',
      'boundary.',
      '',
      'FID: FID-2026-0919-027 (inter-agent handoff transport).',
    ].join('\n'),
    paths: [
      'packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts',
    ],
  },
  {
    message: [
      'chore(scripts,sdk): FID contract widening + receipt completeness',
      '',
      'fid-check enforcement, the audit-gate env-parity gate, and the ripgrep',
      'vendor-gap path fallback with its suite.',
      '',
      'FIDs: FID-2026-0919-021 (FID contract widening),',
      'FID-2026-0919-022 (receipt contract completeness).',
    ].join('\n'),
    paths: [
      'scripts/audit-gate-env-parity.ts',
      'scripts/fid-check.ts',
      'sdk/scripts/ensure-ripgrep-vendor.ts',
      'sdk/src/__tests__/ensure-ripgrep-vendor.test.ts',
    ],
  },
  {
    message: [
      'style: whitespace normalization left by the Sept passes',
      '',
      'Blank-line and import-spacing only — no semantic change. Kept separate so',
      'the FID commits above stay reviewable as behaviour.',
      '',
      'No FID: formatting-only (each diff is whitespace).',
    ].join('\n'),
    paths: [
      'cli/src/commands/router/bash.ts',
      'cli/src/utils/__tests__/openrouter-models-fid-0919-016.test.ts',
      'packages/agent-runtime/src/templates/database-template-clamp.ts',
      'scripts/public-release-git.test.ts',
    ],
  },
]
