// Public release contract — gate manifests and package scoping. Sibling of
// the FID-2026-0819-005 Loop 317 decomposition.

import { describe, expect, test } from 'bun:test'

import { buildGateManifest, configuredReleasePackages } from './public-release'
import { repositoryValidationGates } from './validation-manifest'

describe('public release contract — gate manifests', () => {
  test('builds a deterministic gate manifest with the CLI package dry run', () => {
    const first = buildGateManifest(
      '/repo',
      '0.0.21',
      '1.3.14',
      '10.9.2',
      'a'.repeat(40),
    )
    const second = buildGateManifest(
      '/repo',
      '0.0.21',
      '1.3.14',
      '10.9.2',
      'a'.repeat(40),
    )
    expect(first.hash).toBe(second.hash)
    expect(
      buildGateManifest('/repo', '0.0.21', '1.3.14', '10.9.2', 'b'.repeat(40))
        .hash,
    ).not.toBe(first.hash)
    expect(
      first.specs.slice(0, repositoryValidationGates('/repo').length),
    ).toEqual([...repositoryValidationGates('/repo')])
    expect(first.specs.map((spec) => spec.label)).toEqual([
      ...repositoryValidationGates('/repo').map((spec) => spec.label),
      'npm-pack:savant-code',
    ])
  })

  test('scopes release packages to the configured subset', () => {
    const previousScope = process.env.SAVANT_CODE_RELEASE_PACKAGES
    try {
      delete process.env.SAVANT_CODE_RELEASE_PACKAGES
      expect(configuredReleasePackages().map((target) => target.name)).toEqual([
        'savant-code',
      ])

      process.env.SAVANT_CODE_RELEASE_PACKAGES = 'savant-code'
      expect(configuredReleasePackages().map((target) => target.name)).toEqual([
        'savant-code',
      ])

      process.env.SAVANT_CODE_RELEASE_PACKAGES =
        '  savant-code, @savant-code/sdk '
      expect(configuredReleasePackages().map((target) => target.name)).toEqual([
        '@savant-code/sdk',
        'savant-code',
      ])

      process.env.SAVANT_CODE_RELEASE_PACKAGES = 'not-a-package'
      expect(() => configuredReleasePackages()).toThrow(
        'matched no public packages',
      )
      // A typo in one name must fail the whole scope, never silently drop it.
      process.env.SAVANT_CODE_RELEASE_PACKAGES = 'savant-code,sdk'
      expect(() => configuredReleasePackages()).toThrow('sdk')
    } finally {
      if (previousScope === undefined)
        delete process.env.SAVANT_CODE_RELEASE_PACKAGES
      else process.env.SAVANT_CODE_RELEASE_PACKAGES = previousScope
    }
  })

  test('scoped gate manifests drop the excluded npm-pack dry run', () => {
    const previousScope = process.env.SAVANT_CODE_RELEASE_PACKAGES
    try {
      process.env.SAVANT_CODE_RELEASE_PACKAGES = 'savant-code'
      const scoped = buildGateManifest(
        '/repo',
        '0.0.21',
        '1.3.14',
        '10.9.2',
        'a'.repeat(40),
      )
      expect(scoped.specs.map((spec) => spec.label)).toEqual([
        ...repositoryValidationGates('/repo').map((spec) => spec.label),
        'npm-pack:savant-code',
      ])

      // The SDK is catalog-only by default, so the full (both-packages)
      // manifest requires the explicit opt-in scope.
      process.env.SAVANT_CODE_RELEASE_PACKAGES = '@savant-code/sdk,savant-code'
      const full = buildGateManifest(
        '/repo',
        '0.0.21',
        '1.3.14',
        '10.9.2',
        'a'.repeat(40),
      )
      expect(full.specs.map((spec) => spec.label)).toContain(
        'npm-pack:@savant-code/sdk',
      )
      expect(scoped.hash).not.toBe(full.hash)
    } finally {
      if (previousScope === undefined)
        delete process.env.SAVANT_CODE_RELEASE_PACKAGES
      else process.env.SAVANT_CODE_RELEASE_PACKAGES = previousScope
    }
  })

  test('the diagnostic gate manifest never invokes public mutation commands', () => {
    const { specs } = buildGateManifest(
      '/repo',
      '0.0.21',
      '1.3.14',
      '10.9.2',
      'a'.repeat(40),
    )
    expect(specs).toHaveLength(
      repositoryValidationGates('/repo').length +
        configuredReleasePackages().length,
    )

    for (const spec of specs) {
      const argv = [spec.command, ...spec.args].join(' ')
      expect(argv).not.toMatch(/\b(?:tag|push|publish|release|gh)\b/i)
    }
  })

  test('gate manifest pins the frozen-lockfile install before every other gate', () => {
    const { specs } = buildGateManifest(
      '/repo',
      '0.0.21',
      '1.3.14',
      '10.9.2',
      'a'.repeat(40),
    )
    const lockfile = specs.find((spec) => spec.label === 'lockfile')
    expect(lockfile).toEqual({
      label: 'lockfile',
      command: 'bun',
      args: ['install', '--frozen-lockfile'],
      cwd: '/repo',
    })
    expect(specs[0]?.label).toBe('lockfile')
  })
})
