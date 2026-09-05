// Public release contract — plan, changelog, versions, packages, and the
// GitHub REST surface. Family split from the FID-2026-0819-005 Loop 317
// decomposition; see public-release-receipts.test.ts et al. for siblings.

import { describe, expect, test } from 'bun:test'

import {
  PUBLIC_PACKAGES,
  PUBLIC_REPOSITORY,
  buildPublicReleasePlan,
  extractChangelogSection,
  getGitHubToken,
  githubApiRequest,
  isNotFoundResult,
  isReleaseAutomationEnabled,
  isStageComplete,
  buildTokenSafeGitPushEnv,
  validateReleaseCommand,
  validateReleaseVersions,
} from './public-release'

describe('public release contract — plan & API', () => {
  test('allowlists release subprocess executables', () => {
    for (const command of [
      'bun',
      'npm',
      'git',
      'gh',
      'powershell.exe',
      'taskkill',
    ]) {
      expect(() => validateReleaseCommand(command)).not.toThrow()
    }
    expect(() => validateReleaseCommand('sh')).toThrow('not allowlisted')
    expect(() => validateReleaseCommand('node -e malicious')).toThrow(
      'not allowlisted',
    )
  })

  test('extracts exactly the requested changelog section', () => {
    const changelog = [
      '# Changelog',
      '',
      '## v0.0.21 — 2026-08-08',
      '',
      '### Added',
      '- Release workflow',
      '',
      '## v0.0.20 — 2026-08-06',
      '',
      '- Older release',
    ].join('\n')

    expect(extractChangelogSection(changelog, '0.0.21')).toBe(
      '## v0.0.21 — 2026-08-08\n\n### Added\n- Release workflow',
    )
  })

  test('rejects missing or duplicate changelog versions', () => {
    expect(() =>
      extractChangelogSection('## v0.0.20 — old\n- old', '0.0.21'),
    ).toThrow('found 0')
    expect(() =>
      extractChangelogSection(
        '## v0.0.21 — first\n- one\n## v0.0.21 — duplicate\n- two',
        '0.0.21',
      ),
    ).toThrow('found 2')
    expect(() =>
      extractChangelogSection(
        '## v0.0.20 — older\n- older\n## v0.0.21 — newer\n- newer',
        '0.0.21',
      ),
    ).toThrow('reverse-chronological')
  })

  test('validates package versions', () => {
    expect(() =>
      validateReleaseVersions('0.0.21', {
        'package.json': '{"version":"0.0.21"}',
        'sdk/package.json': '{"version":"0.0.21"}',
      }),
    ).not.toThrow()
    expect(() =>
      validateReleaseVersions('0.0.21', {
        'cli/release/package.json': '{"version":"0.0.20"}',
      }),
    ).toThrow('expected 0.0.21')
  })

  test('catalogs only public packages; default publish set is the CLI only', () => {
    expect(PUBLIC_PACKAGES.map(({ name }) => name)).toEqual([
      '@savant-code/sdk',
      'savant-code',
    ])
    expect(PUBLIC_PACKAGES.some(({ name }) => name === 'savant-free')).toBe(
      false,
    )
    // The SDK scope does not exist and is never published in a normal release;
    // it stays catalog-only and opt-in (FID-2026-0816-001 D-02).
    expect(
      PUBLIC_PACKAGES.find(({ name }) => name === '@savant-code/sdk'),
    ).toMatchObject({ defaultPublish: false })
    expect(
      PUBLIC_PACKAGES.find(({ name }) => name === 'savant-code'),
    ).toMatchObject({ defaultPublish: true })
  })

  test('plans the canonical public mutation sequence (CLI default; SDK opt-in)', () => {
    const plan = buildPublicReleasePlan('0.0.21')
    expect(plan.join('\n')).toContain(PUBLIC_REPOSITORY)
    // The default publish set is the CLI only — the SDK is never auto-published.
    expect(plan.join('\n')).toContain('npm publish savant-code')
    expect(plan.join('\n')).not.toContain('npm publish @savant-code/sdk')
    expect(plan.join('\n')).toContain('GitHub REST release for v0.0.21')

    // With the SDK explicitly opted in, it stays first (the CLI artifact
    // depends on the SDK build).
    const previousScope = process.env.SAVANT_CODE_RELEASE_PACKAGES
    try {
      process.env.SAVANT_CODE_RELEASE_PACKAGES = '@savant-code/sdk,savant-code'
      const scoped = buildPublicReleasePlan('0.0.21')
      expect(scoped.indexOf('npm publish @savant-code/sdk')).toBeLessThan(
        scoped.indexOf('npm publish savant-code'),
      )
    } finally {
      if (previousScope === undefined)
        delete process.env.SAVANT_CODE_RELEASE_PACKAGES
      else process.env.SAVANT_CODE_RELEASE_PACKAGES = previousScope
    }
  })

  test('uses explicit automation mode and token fallback without exposing it', () => {
    expect(
      isReleaseAutomationEnabled({ SAVANT_CODE_RELEASE_AUTOMATION: '1' }),
    ).toBe(true)
    expect(
      isReleaseAutomationEnabled({ SAVANT_CODE_RELEASE_AUTOMATION: '0' }),
    ).toBe(false)
    expect(getGitHubToken({ GITHUB_TOKEN: 'primary' })).toBe('primary')
    expect(getGitHubToken({ GH_TOKEN: 'fallback' })).toBe('fallback')
    expect(() => getGitHubToken({})).toThrow('GITHUB_TOKEN or GH_TOKEN')
  })

  test('supports idempotent stage checks', () => {
    expect(
      isStageComplete({ completedStages: ['PREFLIGHT'] }, 'PREFLIGHT'),
    ).toBe(true)
    expect(
      isStageComplete({ completedStages: ['PREFLIGHT'] }, 'GIT_PUSH'),
    ).toBe(false)
  })

  test('does not expose tokens in token-safe Git environment values', () => {
    const env = buildTokenSafeGitPushEnv('github-secret')
    expect(env.GIT_CONFIG_VALUE_0).not.toContain('github-secret')
    expect(env.GIT_CONFIG_VALUE_0).toContain('AUTHORIZATION: basic')
    expect(env.GIT_TERMINAL_PROMPT).toBe('0')
  })

  test('uses GitHub REST headers and fails closed on unexpected statuses', async () => {
    const requests: RequestInit[] = []
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(init ?? {})
      return new Response(JSON.stringify({ login: 'release-bot' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await githubApiRequest<{ login: string }>('/user', {
      token: 'github-secret',
      fetchImpl,
    })

    expect(result.body?.login).toBe('release-bot')
    expect(requests[0]?.headers).toMatchObject({
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer github-secret',
      'X-GitHub-Api-Version': '2022-11-28',
    })

    await expect(
      githubApiRequest('/user', {
        token: 'github-secret',
        fetchImpl: async () =>
          new Response(JSON.stringify({ message: 'forbidden' }), {
            status: 403,
          }),
      }),
    ).rejects.toThrow('HTTP 403')
  })

  test('recognizes npm not-found responses across npm output formats', () => {
    expect(
      isNotFoundResult({
        stdout: '',
        stderr: "npm error 404 No match found for version '0.0.21'",
      }),
    ).toBe(true)
    expect(
      isNotFoundResult({
        stdout: '',
        stderr: 'npm ERR! code E404 Not Found',
      }),
    ).toBe(true)
    expect(
      isNotFoundResult({ stdout: '', stderr: 'npm error E401 Unauthorized' }),
    ).toBe(false)
  })

  test('accepts only explicit API absence and sanitizes failures', async () => {
    const absent = await githubApiRequest('/release', {
      token: 'github-secret',
      expectedStatuses: [200, 404],
      fetchImpl: async () => new Response('', { status: 404 }),
    })
    expect(absent.status).toBe(404)

    await expect(
      githubApiRequest('/release', {
        token: 'github-secret',
        expectedStatuses: [200, 404],
        fetchImpl: async () =>
          new Response(JSON.stringify({ message: 'rate limited' }), {
            status: 429,
          }),
      }),
    ).rejects.toThrow('HTTP 429')
  })
})
