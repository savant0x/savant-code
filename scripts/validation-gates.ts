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
  { workspace: 'evals', requiredTypecheck: true, requiredTest: true },
  { workspace: 'savant-free', requiredTypecheck: false, requiredTest: false },
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
  { workspace: 'scripts/tmux', requiredTypecheck: false, requiredTest: false },
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
      // Bundles the CLI entry with every import resolved — the exact phase that
      // failed in CI when an undeclared dependency (phantom @noble/hashes) only
      // resolved from a node_modules outside the repo (FID-2026-0816-001 D-01).
      // A resolution failure must fail the release gates before shipping, not
      // the post-release binary workflow. Output lands in the gitignored
      // cli/bin/ so the worktree-fingerprint check stays clean.
      //
      // `--external '@opentui/core-*'` keeps the 8 platform-specific native
      // binaries (declared optionalDependencies, loaded at runtime via dynamic
      // import) out of the bundle. Only the current-OS binary is ever
      // installed, so without this the gate false-fails on every single-OS
      // machine with "Could not resolve: @opentui/core-darwin-x64" etc. — an
      // environment limitation, not an undeclared import (A–Z v0.0.25 AV-001).
      // The main `@opentui/core` package does NOT match the wildcard and is
      // still bundled/resolved, so genuine undeclared-import failures still fire.
      label: 'cli-bundle-resolution',
      command: 'bun',
      args: [
        'build',
        'cli/src/index.tsx',
        '--production',
        '--target=bun',
        '--external',
        '@opentui/core-*',
        '--outdir',
        'cli/bin/.resolution-check',
      ],
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
