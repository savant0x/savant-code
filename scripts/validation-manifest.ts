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

export const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

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

function addVersionIssue(
  issues: ValidationIssue[],
  code: string,
  label: string,
  value: string | undefined,
): void {
  if (!value) {
    issues.push({ code, message: `${label} is missing.` })
  } else if (!VERSION_PATTERN.test(value)) {
    issues.push({ code, message: `${label} is malformed: ${value}.` })
  }
}

/** Validates product/package/protocol/toolchain metadata without mutation. */
export function validateMetadata(
  input: MetadataValidationInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  addVersionIssue(
    issues,
    'metadata.product.missing',
    'Product VERSION',
    input.productVersion,
  )

  for (const [filePath, version] of Object.entries(
    input.synchronizedPackageVersions,
  )) {
    addVersionIssue(issues, `metadata.package.${filePath}`, filePath, version)
    if (version && version !== input.productVersion) {
      issues.push({
        code: 'metadata.package.drift',
        message: `${filePath} is ${version}; expected synchronized product version ${input.productVersion}.`,
      })
    }
  }

  addVersionIssue(
    issues,
    'metadata.project.missing',
    'protocol.config.yaml project.version',
    input.configuredProjectVersion,
  )
  if (
    input.configuredProjectVersion &&
    input.configuredProjectVersion !== input.productVersion
  ) {
    issues.push({
      code: 'metadata.project.drift',
      message: `protocol.config.yaml project.version is ${input.configuredProjectVersion}; expected ${input.productVersion}.`,
    })
  }

  addVersionIssue(
    issues,
    'metadata.protocol.harness',
    'Harness protocol version',
    input.harnessProtocolVersion,
  )
  addVersionIssue(
    issues,
    'metadata.protocol.single-agent',
    'Single-agent protocol version',
    input.singleAgentProtocolVersion,
  )

  const bunFileVersion = input.bunFileVersion.trim()
  addVersionIssue(
    issues,
    'metadata.toolchain.bun-file',
    '.bun-version',
    bunFileVersion,
  )
  addVersionIssue(
    issues,
    'metadata.toolchain.package-manager',
    'packageManager Bun version',
    input.packageManagerBunVersion,
  )
  addVersionIssue(
    issues,
    'metadata.toolchain.engine',
    'root Bun engine version',
    input.engineBunVersion,
  )
  if (
    input.packageManagerBunVersion &&
    input.packageManagerBunVersion !== bunFileVersion
  ) {
    issues.push({
      code: 'metadata.toolchain.package-manager.drift',
      message: `packageManager requires Bun ${input.packageManagerBunVersion}; .bun-version is ${bunFileVersion}.`,
    })
  }
  if (input.engineBunVersion && input.engineBunVersion !== bunFileVersion) {
    issues.push({
      code: 'metadata.toolchain.engine.drift',
      message: `root Bun engine is ${input.engineBunVersion}; .bun-version is ${bunFileVersion}.`,
    })
  }

  return issues
}

function includesToken(command: string | undefined, token: string): boolean {
  return typeof command === 'string' && command.includes(token)
}

function isRootScriptAlias(
  command: string | undefined,
  category: 'typecheck' | 'test',
): boolean {
  return command?.trim() === `bun run ${category}`
}

function validateWorkspaceInventory(
  workspaces: readonly WorkspaceValidationEntry[],
  policy: readonly WorkspacePolicy[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const expected = new Map(policy.map((entry) => [entry.workspace, entry]))
  const seen = new Set<string>()

  for (const workspace of workspaces) {
    if (seen.has(workspace.workspace)) {
      issues.push({
        code: 'parity.workspace.duplicate',
        message: `${workspace.workspace} appears more than once in the workspace inventory.`,
      })
    }
    seen.add(workspace.workspace)
    if (!expected.has(workspace.workspace)) {
      issues.push({
        code: 'parity.workspace.unknown',
        message: `${workspace.workspace} is not declared in the validation workspace policy.`,
      })
    }
  }

  for (const entry of policy) {
    if (!seen.has(entry.workspace)) {
      issues.push({
        code: 'parity.workspace.missing',
        message: `${entry.workspace} is missing from the root workspace inventory.`,
      })
    }
  }
  return issues
}

/** Validates that declared workspace gates are represented in root/config commands. */
export function validateCommandParity(
  input: CommandParityInput,
): ValidationIssue[] {
  const issues = validateWorkspaceInventory(
    input.workspaces,
    input.workspacePolicy,
  )
  for (const workspace of input.workspaces) {
    const policy = input.workspacePolicy.find(
      (entry) => entry.workspace === workspace.workspace,
    )
    if (!policy) continue

    if (policy.requiredTypecheck) {
      if (!workspace.typecheckScript) {
        issues.push({
          code: 'parity.workspace.typecheck-missing',
          message: `${workspace.workspace} has no typecheck script but is required by the validation manifest.`,
        })
      }
      for (const [label, command, token] of [
        [
          'root typecheck',
          input.rootTypecheckCommand,
          workspace.rootTypecheckToken,
        ],
        [
          'protocol type_check',
          input.protocolTypecheckCommand,
          workspace.protocolTypecheckToken,
        ],
      ] as const) {
        const labelText = String(label)
        if (
          !includesToken(command, token) &&
          !(
            labelText === 'protocol type_check' &&
            isRootScriptAlias(command, 'typecheck')
          )
        ) {
          issues.push({
            code: 'parity.typecheck.omitted',
            message: `${workspace.workspace} is missing from ${labelText} coverage (${token}).`,
          })
        }
      }
    }

    if (policy.requiredTest) {
      if (!workspace.testScript) {
        issues.push({
          code: 'parity.workspace.test-missing',
          message: `${workspace.workspace} has no test script but is required by the validation manifest.`,
        })
      }
      for (const [label, command, token] of [
        ['root test', input.rootTestCommand, workspace.rootTestToken],
        [
          'protocol test',
          input.protocolTestCommand,
          workspace.protocolTestToken,
        ],
      ] as const) {
        const labelText = String(label)
        if (
          !includesToken(command, token) &&
          !(labelText === 'protocol test' && isRootScriptAlias(command, 'test'))
        ) {
          issues.push({
            code: 'parity.test.omitted',
            message: `${workspace.workspace} is missing from ${labelText} coverage (${token}).`,
          })
        }
      }
    }
  }
  return issues
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return 'validation: PASS'
  return [
    `validation: FAIL (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    ...issues.map(({ code, message }) => `- [${code}] ${message}`),
  ].join('\n')
}
