import { describe, expect, test } from 'bun:test'

import {
  formatValidationIssues,
  repositoryValidationGates,
  validateCommandParity,
  validateGateContract,
  validateMetadata,
} from './validation-manifest'

describe('validateGateContract', () => {
  test('accepts the canonical root gate set and rejects omissions', () => {
    const gates = repositoryValidationGates('/repo')
    expect(validateGateContract(gates, '/repo')).toEqual([])
    expect(
      validateGateContract(gates.slice(1), '/repo').map((issue) => issue.code),
    ).toContain('gate.missing')
  })
})

describe('validateMetadata', () => {
  const valid = {
    productVersion: '0.0.23',
    synchronizedPackageVersions: {
      'package.json': '0.0.23',
      'sdk/package.json': '0.0.23',
    },
    configuredProjectVersion: '0.0.23',
    harnessProtocolVersion: '0.2.0',
    singleAgentProtocolVersion: '0.1.2-single-agent',
    bunFileVersion: '1.3.14',
    packageManagerBunVersion: '1.3.14',
    engineBunVersion: '1.3.14',
  }

  test('passes synchronized product metadata and independent protocol versions', () => {
    expect(validateMetadata(valid)).toEqual([])
  })

  test('reports product/project version drift without forcing protocol equality', () => {
    const issues = validateMetadata({
      ...valid,
      configuredProjectVersion: '0.0.22',
    })
    expect(issues.map((issue) => issue.code)).toContain(
      'metadata.project.drift',
    )
    expect(issues.map((issue) => issue.code)).not.toContain(
      'metadata.protocol.drift',
    )
  })

  test('fails on missing and malformed metadata', () => {
    const issues = validateMetadata({
      ...valid,
      productVersion: '',
      synchronizedPackageVersions: { 'sdk/package.json': 'bad' },
      configuredProjectVersion: undefined,
      bunFileVersion: 'not-a-version',
      packageManagerBunVersion: undefined,
      engineBunVersion: 'also-invalid',
    })
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'metadata.product.missing',
        'metadata.package.sdk/package.json',
        'metadata.project.missing',
        'metadata.toolchain.bun-file',
        'metadata.toolchain.package-manager',
        'metadata.toolchain.engine',
      ]),
    )
  })
})

describe('validateCommandParity', () => {
  const workspace = {
    workspace: 'common',
    typecheckScript: 'tsc --noEmit',
    testScript: 'bun test',
    rootTypecheckToken: '--cwd=common',
    rootTestToken: '--cwd=common',
    protocolTypecheckToken: '--cwd=common',
    protocolTestToken: '--cwd=common',
  }
  const requiredPolicy = {
    workspace: 'common',
    requiredTypecheck: true,
    requiredTest: true,
  }

  test('passes when root and protocol commands include the workspace', () => {
    expect(
      validateCommandParity({
        rootTypecheckCommand: 'bun run --cwd=common typecheck',
        rootTestCommand: 'bun run --cwd=common test',
        protocolTypecheckCommand: 'bun run --cwd=common typecheck',
        protocolTestCommand: 'bun run --cwd=common test',
        workspaces: [workspace],
        workspacePolicy: [requiredPolicy],
      }),
    ).toEqual([])
  })

  test('reports omitted workspace coverage', () => {
    const issues = validateCommandParity({
      rootTypecheckCommand: 'bun run --cwd=common typecheck',
      rootTestCommand: undefined,
      protocolTypecheckCommand: undefined,
      protocolTestCommand: 'bun run --cwd=common test',
      workspaces: [workspace],
      workspacePolicy: [requiredPolicy],
    })
    expect(formatValidationIssues(issues)).toContain('validation: FAIL')
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'parity.test.omitted',
        'parity.typecheck.omitted',
      ]),
    )
  })

  test('reports unknown and duplicate workspaces', () => {
    const issues = validateCommandParity({
      rootTypecheckCommand: undefined,
      rootTestCommand: undefined,
      protocolTypecheckCommand: undefined,
      protocolTestCommand: undefined,
      workspaces: [
        workspace,
        workspace,
        { ...workspace, workspace: 'new-workspace' },
      ],
      workspacePolicy: [requiredPolicy],
    })
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'parity.workspace.duplicate',
        'parity.workspace.unknown',
      ]),
    )
  })

  test('allows intentionally non-required workspace categories', () => {
    expect(
      validateCommandParity({
        rootTypecheckCommand: undefined,
        rootTestCommand: undefined,
        protocolTypecheckCommand: undefined,
        protocolTestCommand: undefined,
        workspaces: [workspace],
        workspacePolicy: [
          { ...requiredPolicy, requiredTypecheck: false, requiredTest: false },
        ],
      }),
    ).toEqual([])
  })
})
