/**
 * gate-declarability-registry — the audited table of repository gates.
 *
 * Split from `./gate-declarability` (the guard) so the data and the logic each
 * stay under the file ceiling. See that module for the full rationale: a gate
 * that cannot be DECLARED on a FID cannot be proven by one, so every gate the
 * repository enforces is paired here with the allowlisted `fid:verify`
 * declaration that proves it (FID-2026-0823-009).
 */
import { VALIDATION_WORKSPACE_POLICY } from './validation-manifest'

/** An allowlisted `fid:verify` declaration. */
export type GateDeclaration = {
  kind: 'typecheck' | 'test' | 'probe' | 'quality'
  arg: string
}

/** Where the gate is enforced — the audit's ledger column. */
export type GateSource =
  'release-contract' | 'protocol-config' | 'pre-push-hook' | 'repo-script'

export type AuditedGate = {
  /** Gate label, exactly as the enforcing surface names it. */
  label: string
  source: GateSource
  /** The single clause this gate proves. */
  proves: string
  /**
   * The declarations that PROVE it — one per concrete form (the root typecheck
   * chain has one per workspace plus its scripts leg). Empty ONLY when
   * `memberKind` or `nonDeclarable` is set instead.
   */
  declarations: readonly GateDeclaration[]
  /**
   * Set when the gate is a CHAIN whose members are each declarable in this
   * kind, so the chain needs no single declaration and no check inside it is
   * un-recordable. The guard proves the kind is admitted mechanically.
   */
  memberKind?: 'test'
  /**
   * Set when the gate is intentionally undeclarable. Requires a reason, and the
   * label must be listed in `INTENTIONALLY_NON_DECLARABLE`.
   */
  nonDeclarable?: string
}

/**
 * The only gates allowed to be undeclarable, each for a structural reason —
 * never convenience.
 *
 * `repository-validation` LIVE RE-RUNS every active FID's declared gates (C3),
 * so declaring it on a FID would recurse into that FID's own verification
 * (lesson, FID-2026-0915-004). Its constituents are auditable individually: a
 * change to any one of them declares that one.
 *
 * `credential-scan` is scoped to a pushed COMMIT RANGE, not to tree state, so
 * it has no repository-wide form to declare.
 */
export const INTENTIONALLY_NON_DECLARABLE: ReadonlySet<string> = new Set([
  'repository-validation',
  'credential-scan',
])

/** Shorthand for the overwhelmingly common single-probe declaration. */
function probe(arg: string): GateDeclaration {
  return { kind: 'probe', arg }
}

/** Every workspace whose typecheck participates in the root `typecheck` chain. */
function requiredTypecheckWorkspaces(): string[] {
  return VALIDATION_WORKSPACE_POLICY.filter(
    (entry) => entry.requiredTypecheck,
  ).map((entry) => entry.workspace)
}

const RELEASE_CONTRACT: readonly AuditedGate[] = [
  {
    label: 'lockfile',
    source: 'release-contract',
    proves: 'the committed lockfile satisfies the manifest (frozen install)',
    declarations: [probe('scripts/lockfile-check.ts')],
  },
  {
    label: 'build:sdk',
    source: 'release-contract',
    proves: 'the SDK builds from the current tree',
    declarations: [probe('scripts/sdk-build-check.ts')],
  },
  {
    label: 'cli-bundle-resolution',
    source: 'release-contract',
    proves: 'the CLI entry bundles with every import resolved',
    declarations: [probe('scripts/cli-bundle-resolution-check.ts')],
  },
  {
    label: 'undeclared-imports',
    source: 'release-contract',
    proves: 'no import names a package the repository does not declare (T188)',
    declarations: [probe('scripts/undeclared-imports-audit.ts')],
  },
  {
    label: 'typecheck',
    source: 'release-contract',
    proves: 'every workspace and the scripts tree typechecks',
    declarations: [
      ...requiredTypecheckWorkspaces().map((workspace) => ({
        kind: 'typecheck' as const,
        arg: workspace,
      })),
      // The chain's 14th leg: `scripts` is not a bun workspace, so it has no
      // `typecheck <workspace>` form.
      probe('scripts/scripts-typecheck-check.ts'),
    ],
  },
  {
    label: 'test',
    source: 'release-contract',
    proves: 'every workspace unit suite passes',
    declarations: [],
    memberKind: 'test',
  },
  {
    label: 'eslint',
    source: 'release-contract',
    proves: 'zero ESLint errors or warnings repo-wide',
    declarations: [probe('scripts/eslint-check.ts')],
  },
  {
    label: 'repository-validation',
    source: 'release-contract',
    proves: 'the aggregated repository validator passes',
    declarations: [],
    nonDeclarable: 'live re-runs declared gates (C3) — would recurse',
  },
  {
    label: 'provider-reference',
    source: 'release-contract',
    proves: 'the provider reference surfaces are not stale',
    declarations: [probe('scripts/provider-reference-check.ts')],
  },
  {
    label: 'current-hygiene',
    source: 'release-contract',
    proves: 'no stale references or production placeholders',
    declarations: [probe('scripts/hygiene.ts')],
  },
  {
    label: 'protocol-bundle',
    source: 'release-contract',
    proves: 'the embedded protocol bundle is not stale',
    declarations: [probe('scripts/protocol-bundle-check.ts')],
  },
  {
    label: 'markdownlint',
    source: 'release-contract',
    proves: 'no markdownlint violations in governed docs',
    declarations: [probe('scripts/lint-md-check.ts')],
  },
  {
    label: 'prettier',
    source: 'release-contract',
    proves: 'every tracked file is prettier-formatted',
    declarations: [probe('scripts/prettier-check.ts')],
  },
  {
    label: 'release-eval-tier3',
    source: 'release-contract',
    proves: 'the opt-in Tier-3 capability rehearsal holds its ceiling',
    declarations: [probe('scripts/release-eval-tier-check.ts')],
  },
]

const OTHER_GATES: readonly AuditedGate[] = [
  {
    label: 'ci',
    source: 'protocol-config',
    proves: 'the release-artifact build chain (SDK + Savant-Free) succeeds',
    declarations: [probe('scripts/ci-build-check.ts')],
  },
  {
    label: 'fid:verify --check',
    source: 'pre-push-hook',
    proves: 'every fixed/verified FID carries a valid receipt',
    declarations: [probe('scripts/fid-verify-check.ts')],
  },
  {
    label: 'evals:smoke',
    source: 'pre-push-hook',
    proves: 'the zero-token Tier-1 governance smoke passes',
    declarations: [probe('scripts/evals-smoke-check.ts')],
  },
  {
    label: 'credential-scan',
    source: 'pre-push-hook',
    proves: 'the pushed commit range carries no credential-shaped content',
    declarations: [],
    nonDeclarable: 'scoped to a pushed commit range, not to tree state',
  },
  {
    label: 'quality:report',
    source: 'repo-script',
    proves: 'no file exceeds the quality ceiling outside the baseline',
    declarations: [{ kind: 'quality', arg: '' }],
  },
  {
    label: 'learnings:check',
    source: 'repo-script',
    proves: 'every structured learning entry is well-formed',
    declarations: [probe('scripts/learnings.ts')],
  },
  {
    label: 'skills:check',
    source: 'repo-script',
    proves: 'every skill package passes the mechanical validator',
    declarations: [probe('scripts/skills-check.ts')],
  },
  {
    label: 'verify:clean',
    source: 'repo-script',
    proves: 'a clean checkout installs, typechecks and compiles',
    declarations: [probe('scripts/verify-clean.ts')],
  },
  {
    label: 'audit:evidence',
    source: 'repo-script',
    proves: 'the audit-evidence manifest is produced without error',
    declarations: [probe('scripts/audit-evidence.ts')],
  },
  {
    label: 'window-coverage:check',
    source: 'repo-script',
    proves: 'the model context-window census matches the register',
    declarations: [probe('scripts/window-coverage-check.ts')],
  },
  {
    label: 'providers:parity:check',
    source: 'repo-script',
    proves: 'the provider catalog census matches the live register',
    declarations: [probe('scripts/provider-parity-check.ts')],
  },
  {
    label: 'version:check',
    source: 'repo-script',
    proves: 'every version surface is synchronized',
    declarations: [probe('scripts/version-check.ts')],
  },
  {
    label: 'design-systems:check',
    source: 'repo-script',
    proves: 'the generated design-system tokens are not stale',
    declarations: [probe('scripts/design-systems-check.ts')],
  },
  {
    label: 'release:preaudit:check',
    source: 'repo-script',
    proves: 'the release pre-audit finds nothing auto-fixable',
    declarations: [probe('scripts/release-preaudit-check.ts')],
  },
  {
    label: 'test-budget-injection',
    source: 'repo-script',
    proves:
      'no test helper calls a budgeted function without injecting a budget',
    declarations: [probe('scripts/test-budget-injection-check.ts')],
  },
]

/**
 * Every repository gate, with the declaration that proves it. Ordered by
 * enforcement surface: the root gate contract first, then everything else.
 */
export function auditedGates(): readonly AuditedGate[] {
  return [...RELEASE_CONTRACT, ...OTHER_GATES]
}
