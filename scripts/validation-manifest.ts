import type {
  CommandParityInput,
  MetadataValidationInput,
  ValidationIssue,
  WorkspacePolicy,
  WorkspaceValidationEntry,
} from './validation-gates'

export {
  releaseEvalTierGate,
  repositoryValidationGates,
  RELEASE_EVAL_TIER_ENV,
  validateGateContract,
  VALIDATION_WORKSPACE_POLICY,
} from './validation-gates'
export type {
  CommandParityInput,
  MetadataValidationInput,
  ValidationGateSpec,
  ValidationIssue,
  WorkspacePolicy,
  WorkspaceValidationEntry,
} from './validation-gates'

export const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

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
