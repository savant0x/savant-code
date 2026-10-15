export type ValidationIssue = {
  code: string
  message: string
}

export type WorkspaceValidationEntry = {
  workspace: string
  typecheckScript?: string
  testScript?: string
  rootTypecheckToken: string
  rootTestToken: string
  protocolTypecheckToken: string
  protocolTestToken: string
}

export type WorkspacePolicy = {
  workspace: string
  requiredTypecheck: boolean
  requiredTest: boolean
}

export const VALIDATION_WORKSPACE_POLICY: readonly WorkspacePolicy[] = [
  { workspace: 'agents', requiredTypecheck: true, requiredTest: true },
  { workspace: 'cli', requiredTypecheck: true, requiredTest: true },
  { workspace: 'common', requiredTypecheck: true, requiredTest: true },
  // Desktop shell (FID-2026-0820-009): typecheck joins the ×12 chain; runtime
  // tests are owned by `cargo test` in src-tauri and stay outside bun chains.
  { workspace: 'desktop', requiredTypecheck: true, requiredTest: false },
  { workspace: 'evals', requiredTypecheck: true, requiredTest: true },
  {
    workspace: 'packages/agent-runtime',
    requiredTypecheck: true,
    requiredTest: true,
  },
  {
    workspace: 'packages/design-systems',
    requiredTypecheck: true,
    requiredTest: true,
  },
  {
    workspace: 'packages/code-map',
    requiredTypecheck: true,
    requiredTest: true,
  },
  {
    workspace: 'packages/connectors',
    requiredTypecheck: true,
    requiredTest: true,
  },
  {
    workspace: 'packages/database',
    requiredTypecheck: true,
    requiredTest: true,
  },
  {
    workspace: 'packages/knowledge-graph',
    requiredTypecheck: true,
    requiredTest: true,
  },
  {
    workspace: 'packages/llm-providers',
    requiredTypecheck: true,
    requiredTest: true,
  },
  { workspace: 'scripts/tmux', requiredTypecheck: true, requiredTest: true },
  { workspace: 'sdk', requiredTypecheck: true, requiredTest: true },
] as const

export type MetadataValidationInput = {
  productVersion: string
  synchronizedPackageVersions: Record<string, string | undefined>
  configuredProjectVersion: string | undefined
  harnessProtocolVersion: string | undefined
  singleAgentProtocolVersion: string | undefined
  bunFileVersion: string
  packageManagerBunVersion: string | undefined
  engineBunVersion: string | undefined
}

export type CommandParityInput = {
  rootTypecheckCommand: string | undefined
  rootTestCommand: string | undefined
  protocolTypecheckCommand: string | undefined
  protocolTestCommand: string | undefined
  workspaces: WorkspaceValidationEntry[]
  workspacePolicy: readonly WorkspacePolicy[]
}

export type ValidationGateSpec = {
  label: string
  command: string
  args: string[]
  cwd: string
}

/** Validates the shared root gate contract without executing any commands. */
export function validateGateContract(
  gates: readonly ValidationGateSpec[],
  root: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Set<string>()
  for (const gate of gates) {
    if (seen.has(gate.label)) {
      issues.push({
        code: 'gate.duplicate',
        message: `${gate.label} appears more than once in the root gate contract.`,
      })
    }
    seen.add(gate.label)
    if (!gate.command || gate.args.length === 0 || gate.cwd !== root) {
      issues.push({
        code: 'gate.malformed',
        message: `${gate.label} is malformed or is not bound to repository root ${root}.`,
      })
    }
  }
  for (const label of [
    'lockfile',
    'build:sdk',
    'cli-bundle-resolution',
    'undeclared-imports',
    'typecheck',
    'test',
    'eslint',
    'repository-validation',
    'provider-reference',
    'current-hygiene',
    'protocol-bundle',
    'markdownlint',
    'prettier',
  ]) {
    if (!seen.has(label)) {
      issues.push({
        code: 'gate.missing',
        message: `${label} is missing from the root gate contract.`,
      })
    }
  }
  return issues
}

/** FID-2026-0824-019: opt-in switch for the Tier-3 capability gate. */
export const RELEASE_EVAL_TIER_ENV = 'SAVANT_CODE_RELEASE_EVAL_TIER'

/**
 * Optional Tier-3 capability stage (FID-2026-0824-019). Inactive unless the
 * operator exports SAVANT_CODE_RELEASE_EVAL_TIER=full — the rotated corpus
 * run costs ~2M tokens and stays opt-in by design. The gate executes the
 * evals CLI's structural rehearsal (deterministic rotation + token
 * ceiling), failing closed on breach; live evaluate-mode runs remain
 * operator-keyed.
 */
export function releaseEvalTierGate(
  root: string,
  env: Record<string, string | undefined> = process.env,
): ValidationGateSpec | null {
  if ((env[RELEASE_EVAL_TIER_ENV] ?? '').trim() !== 'full') return null
  return {
    label: 'release-eval-tier3',
    command: 'bun',
    args: ['run', '--cwd=evals', 'v2/src/cli.ts', '--release-tier'],
    cwd: root,
  }
}

/**
 * Canonical root validation gates shared by release execution and its
 * contract tests. Package-specific npm dry runs remain release-only gates.
 */
export function repositoryValidationGates(
  root: string,
): readonly ValidationGateSpec[] {
  return [
    {
      label: 'lockfile',
      command: 'bun',
      args: ['install', '--frozen-lockfile'],
      cwd: root,
    },
    {
      label: 'build:sdk',
      command: 'bun',
      args: ['run', 'build:sdk'],
      cwd: root,
    },
    {
      // Bundles the CLI entry with every import resolved, inside a PRISTINE
      // install of the frozen lockfile: the probe materializes the release file
      // set, installs it, runs the build's own prebundle steps, and fails when
      // any module it loaded resolved from a node_modules outside that tree.
      // The earlier form bundled the working tree, so a stray ancestor install
      // satisfied an undeclared import and the gate stayed green while CI
      // failed — v0.0.35.
      //
      // The `--external '@opentui/core-*'` rationale, the scratch-tree location
      // and the provenance check live in `scripts/clean-install-bundle.ts` and
      // `scripts/cli-bundle-resolution-check.ts`.
      label: 'cli-bundle-resolution',
      command: 'bun',
      args: ['run', 'scripts/cli-bundle-resolution-check.ts'],
      cwd: root,
    },
    {
      // T188: fails when an import names a package no manifest declares and
      // only a transitive dependency hoists — the v0.0.24/v0.0.35 class.
      label: 'undeclared-imports',
      command: 'bun',
      args: ['run', 'deps:undeclared'],
      cwd: root,
    },
    {
      label: 'typecheck',
      command: 'bun',
      args: ['run', 'typecheck'],
      cwd: root,
    },
    { label: 'test', command: 'bun', args: ['run', 'test'], cwd: root },
    {
      label: 'eslint',
      command: 'bun',
      args: ['x', 'eslint', '.', '--max-warnings', '0'],
      cwd: root,
    },
    {
      label: 'repository-validation',
      command: 'bun',
      args: ['run', 'validate:repository'],
      cwd: root,
    },
    {
      label: 'provider-reference',
      command: 'bun',
      args: ['run', 'generate:provider-docs:check'],
      cwd: root,
    },
    {
      label: 'current-hygiene',
      command: 'bun',
      args: ['run', 'hygiene:check'],
      cwd: root,
    },
    {
      label: 'protocol-bundle',
      command: 'bun',
      args: ['run', 'generate:protocol-bundle:check'],
      cwd: root,
    },
    {
      label: 'markdownlint',
      command: 'bun',
      args: ['run', 'lint:md'],
      cwd: root,
    },
    // FID-2026-0824-019: optional Tier-3 capability gate (opt-in via env).
    ...[releaseEvalTierGate(root)].filter(
      (gate): gate is ValidationGateSpec => gate !== null,
    ),
    {
      // `bun x` (not `bunx`) so the release subprocess allowlist
      // (ALLOWED_RELEASE_COMMANDS in public-release.ts) accepts it.
      label: 'prettier',
      command: 'bun',
      args: ['x', 'prettier', '--check', '.'],
      cwd: root,
    },
  ]
}

/** Public CLI release gates omit the unpublished SDK package. */
export function publicReleaseValidationGates(
  root: string,
): readonly ValidationGateSpec[] {
  return repositoryValidationGates(root)
    .filter((gate) => gate.label !== 'build:sdk')
    .map((gate) => {
      if (gate.label === 'typecheck') {
        return { ...gate, args: ['run', 'typecheck:release'] }
      }
      if (gate.label === 'test') {
        return { ...gate, args: ['run', 'test:release'] }
      }
      return gate
    })
}
