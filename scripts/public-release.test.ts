import { spawnSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  PUBLIC_PACKAGES,
  PUBLIC_REPOSITORY,
  RELEASE_BINARY_TARBALLS,
  acquireReleaseLock,
  assertNoUnrestoredPriorRelease,
  buildDiagnosticReceipt,
  ensurePinnedBunOnPath,
  pinnedBunCandidates,
  resolvePinnedBun,
  assetPollIntervalMs,
  assetRetryTimeoutMs,
  buildGateManifest,
  changedWorktreePaths,
  classifyCommandResult,
  configuredReleasePackages,
  fingerprintWorktree,
  ignoredPathDelta,
  readCapturedOutput,
  redactSecretText,
  releaseLockPath,
  sanitizedGateEnv,
  scanStagedCredentials,
  settingsAlreadyPublic,
  validateToolVersions,
  validateReleaseCommand,
  sha256Text,
  applyPublicProfile,
  buildPublicReleasePlan,
  buildTokenSafeGitPushEnv,
  commitAllAutomationChanges,
  recoverAutomationCommit,
  extractChangelogSection,
  getGitHubToken,
  githubApiRequest,
  isReleaseAutomationEnabled,
  isNotFoundResult,
  isStageComplete,
  redactReceipt,
  finalizeSuccessfulReleaseReceipt,
  snapshotLocalState,
  validateReleaseVersions,
  validateResumeReceipt,
  verifyReleaseAssets,
  withLocalStateRestoration,
} from './public-release'
import { repositoryValidationGates } from './validation-manifest'

describe('public release contract', () => {
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

  test('classifies exit, signal, spawn, timeout, malformed, and success results', () => {
    expect(classifyCommandResult({ status: 0, signal: null })).toBe('success')
    expect(classifyCommandResult({ status: 2, signal: null })).toBe('exit')
    expect(classifyCommandResult({ status: null, signal: 'SIGTERM' })).toBe(
      'signal',
    )
    expect(
      classifyCommandResult({
        status: null,
        signal: null,
        error: new Error('spawn'),
      }),
    ).toBe('spawn-error')
    expect(
      classifyCommandResult({
        status: null,
        signal: null,
        error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
      }),
    ).toBe('timeout')
    expect(classifyCommandResult({ status: null, signal: null })).toBe(
      'malformed',
    )
  })

  test('fails closed on uncertain credential-shaped output', () => {
    expect(() => redactSecretText('Authorization: Bearer short')).not.toThrow()
    expect(() =>
      redactSecretText('credential: definitely-not-safe-123456'),
    ).toThrow('Unclassified credential-shaped output')
    expect(() =>
      redactSecretText('token=unclassified-secret-value-123456'),
    ).not.toThrow()
  })

  test('redacts token-shaped output and preserves a stable hash', () => {
    const output =
      'API_KEY=secret TOKEN:token-value Authorization: Bearer bearer-secret'
    const redacted = redactSecretText(output)
    expect(redacted).not.toContain('secret')
    expect(redacted).not.toContain('token-value')
    expect(redacted).not.toContain('bearer-secret')
    expect(sha256Text('same')).toBe(sha256Text('same'))
    expect(sha256Text('same')).not.toBe(sha256Text('different'))
  })

  test('requires the pinned Bun and npm compatibility contract', () => {
    expect(() => validateToolVersions('1.3.14', '10.9.2')).not.toThrow()
    expect(() => validateToolVersions('1.3.11', '10.9.2')).toThrow('Bun 1.3.14')
    expect(() => validateToolVersions('1.3.14', '9.9.9')).toThrow('npm 10.x')
  })

  test('probes the version-pinned Bun install before the standard location', () => {
    const home = mkdtempSync(path.join(os.tmpdir(), 'savant-bun-home-'))
    try {
      const candidates = pinnedBunCandidates(home)
      expect(candidates).toHaveLength(2)
      expect(candidates[0]).toContain('.bun-1.3.14')
      expect(candidates[1]).toContain(path.join('.bun', 'bin'))
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('resolvePinnedBun returns undefined when no pinned install exists', () => {
    const home = mkdtempSync(path.join(os.tmpdir(), 'savant-bun-empty-'))
    try {
      expect(resolvePinnedBun(process.cwd(), home)).toBeUndefined()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  // Environment-dependent by design: this machine's contract is that `bun` on
  // PATH is the pinned version OR a version-pinned install exists to fall back
  // to. On a machine where neither holds the test fails, which is the same
  // fail-closed contract the release gate enforces.
  test('ensurePinnedBunOnPath makes the pinned Bun the effective runtime', () => {
    const previousPath = process.env.PATH
    try {
      ensurePinnedBunOnPath(process.cwd())
      const probe = spawnSync('bun', ['--version'], {
        encoding: 'utf8',
        windowsHide: true,
      })
      expect(probe.status).toBe(0)
      expect(probe.stdout.trim()).toBe('1.3.14')
    } finally {
      if (previousPath === undefined) delete process.env.PATH
      else process.env.PATH = previousPath
    }
  })

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

  test('clears historical failure text during successful receipt finalization', () => {
    const receipt = {
      version: '0.0.21',
      mode: 'automation' as const,
      completedStages: ['GITHUB_RELEASE'],
      failedStage: 'transient npm registry propagation',
      restored: true,
      receiptPath: '/tmp/receipt.json',
    }
    finalizeSuccessfulReleaseReceipt(receipt)
    expect(receipt.failedStage).toBeUndefined()

    const serialized = redactReceipt({
      ...receipt,
      completedStages: [...receipt.completedStages, 'POST_RELEASE_VERIFY'],
    })
    expect(serialized).not.toContain('failedStage')
    expect(serialized).toContain('POST_RELEASE_VERIFY')
  })

  test('redacts credentials from receipt failure details', () => {
    const receipt = redactReceipt({
      version: '0.0.21',
      mode: 'publish',
      schemaVersion: 'release-receipt/v2',
      completedStages: ['PREFLIGHT'],
      failedStage:
        'OPENROUTER_API_KEY=secret-or-key GITHUB_TOKEN:ghs_secret NPM_TOKEN=npm_secret Authorization: Bearer bearer-secret AUTHORIZATION: basic Z2l0LXNlY3JldA==',
      restored: true,
      receiptPath: '/tmp/receipt.json',
    })

    expect(receipt).toContain('PREFLIGHT')
    expect(receipt).toContain('[REDACTED]')
    expect(receipt).not.toContain('secret-or-key')
    expect(receipt).not.toContain('ghs_secret')
    expect(receipt).not.toContain('npm_secret')
    expect(receipt).not.toContain('bearer-secret')
    expect(receipt).not.toContain('Z2l0LXNlY3JldA==')
  })

  test('rejects completed gate evidence without an explicit HEAD binding', () => {
    const receipt = {
      schemaVersion: 'release-receipt/v2' as const,
      version: '0.0.21' as const,
      mode: 'publish' as const,
      headSha: 'a'.repeat(40),
      completedStages: ['GATES_AND_PACKAGE_DRY_RUNS'],
      restored: true,
      receiptPath: '/tmp/receipt.json',
      gateManifestHash: 'b'.repeat(64),
      gateAttempts: [],
      evidenceFinalized: true,
    }
    expect(() =>
      validateResumeReceipt('0.0.21', receipt, receipt.receiptPath),
    ).toThrow('incomplete gate evidence')
  })

  test('rejects tampered or missing transcript evidence before resume', () => {
    const transcriptPath = path.join(
      mkdtempSync(path.join(os.tmpdir(), 'savant-release-transcript-')),
      'gate.log',
    )
    try {
      writeFileSync(transcriptPath, 'original transcript')
      const receipt = {
        schemaVersion: 'release-receipt/v2' as const,
        version: '0.0.21' as const,
        mode: 'publish' as const,
        headSha: 'a'.repeat(40),
        completedStages: ['GATES_AND_PACKAGE_DRY_RUNS'],
        restored: true,
        receiptPath: '/tmp/receipt.json',
        gateManifestHash: 'b'.repeat(64),
        evidenceHeadSha: 'a'.repeat(40),
        gateAttempts: [
          {
            label: 'test',
            command: 'bun',
            args: ['run', 'test'],
            cwd: '/repo',
            attempt: 1,
            failureClass: 'success' as const,
            status: 0,
            signal: null,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 1,
            transcriptPath,
            transcriptSha256: sha256Text('different transcript'),
            transcriptFinalized: true,
            summary: '',
          },
        ],
        evidenceFinalized: true,
      }
      expect(() =>
        validateResumeReceipt('0.0.21', receipt, receipt.receiptPath),
      ).toThrow('hash mismatch')
      writeFileSync(transcriptPath, 'original transcript')
      receipt.gateAttempts[0].transcriptSha256 = sha256Text(
        'original transcript',
      )
      expect(
        validateResumeReceipt('0.0.21', receipt, receipt.receiptPath)
          .gateAttempts?.[0]?.transcriptFinalized,
      ).toBe(true)
      rmSync(transcriptPath)
      expect(() =>
        validateResumeReceipt('0.0.21', receipt, receipt.receiptPath),
      ).toThrow('transcript is missing')
    } finally {
      rmSync(path.dirname(transcriptPath), { recursive: true, force: true })
    }
  })

  test('rejects unsafe resume receipts and accepts a restored, HEAD-bound receipt', () => {
    const validReceipt = {
      version: '0.0.21' as const,
      schemaVersion: 'release-receipt/v2' as const,
      mode: 'publish' as const,
      headSha: 'a'.repeat(40),
      completedStages: ['GIT_PUSH'],
      restored: true,
      receiptPath: '/tmp/receipt.json',
    }

    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, schemaVersion: undefined },
        validReceipt.receiptPath,
      ),
    ).toThrow('incompatible')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, restored: false },
        validReceipt.receiptPath,
      ),
    ).toThrow('did not confirm local-state restoration')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, headSha: undefined },
        validReceipt.receiptPath,
      ),
    ).toThrow('no commit binding')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, headSha: 'not-a-sha' },
        validReceipt.receiptPath,
      ),
    ).toThrow('invalid commit binding')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, completedStages: ['GIT_PUSH', 'GIT_PUSH'] },
        validReceipt.receiptPath,
      ),
    ).toThrow('invalid or duplicate stages')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        validReceipt,
        validReceipt.receiptPath,
        'automation',
      ),
    ).toThrow('incompatible')
    expect(
      validateResumeReceipt('0.0.21', validReceipt, validReceipt.receiptPath)
        .headSha,
    ).toBe('a'.repeat(40))
  })

  test('recovers a release commit created before receipt persistence', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-recover-'))
    try {
      const runGit = (args: string[]) => {
        const result = Bun.spawnSync({
          cmd: ['git', ...args],
          cwd: repo,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (result.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(result.stderr))
        }
      }
      runGit(['init'])
      runGit(['config', 'user.email', 'release-test@example.invalid'])
      runGit(['config', 'user.name', 'Release Test'])
      writeFileSync(path.join(repo, 'base.txt'), 'base')
      runGit(['add', '--all'])
      runGit(['commit', '-m', 'base'])
      const previousHead = new TextDecoder()
        .decode(
          Bun.spawnSync({
            cmd: ['git', 'rev-parse', 'HEAD'],
            cwd: repo,
            stdout: 'pipe',
            stderr: 'pipe',
          }).stdout,
        )
        .trim()
      writeFileSync(path.join(repo, 'release.txt'), 'release')
      const committed = commitAllAutomationChanges(repo, '0.0.21')

      expect(recoverAutomationCommit(repo, previousHead, '0.0.21')).toEqual(
        committed,
      )
      expect(
        recoverAutomationCommit(repo, 'b'.repeat(40), '0.0.21'),
      ).toBeUndefined()
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('creates one automation commit containing tracked and untracked changes', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-git-'))
    try {
      const runGit = (args: string[]) => {
        const result = Bun.spawnSync({
          cmd: ['git', ...args],
          cwd: repo,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (result.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(result.stderr))
        }
      }
      runGit(['init'])
      runGit(['config', 'user.email', 'release-test@example.invalid'])
      runGit(['config', 'user.name', 'Release Test'])
      writeFileSync(path.join(repo, 'tracked.txt'), 'tracked')
      writeFileSync(path.join(repo, 'untracked.txt'), 'untracked')

      const committed = commitAllAutomationChanges(repo, '0.0.21')

      expect(committed.files).toEqual(['tracked.txt', 'untracked.txt'])
      expect(committed.headSha).toMatch(/^[0-9a-f]{40}$/)
      const log = Bun.spawnSync({
        cmd: ['git', 'log', '-1', '--format=%s'],
        cwd: repo,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      expect(new TextDecoder().decode(log.stdout).trim()).toBe(
        'chore(release): prepare v0.0.21',
      )
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('accepts staged deletions without scanning the missing worktree path', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-delete-'))
    try {
      const runGit = (args: string[]) => {
        const result = Bun.spawnSync({
          cmd: ['git', ...args],
          cwd: repo,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (result.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(result.stderr))
        }
      }
      runGit(['init', '-q'])
      runGit(['config', 'user.email', 'release-test@example.invalid'])
      runGit(['config', 'user.name', 'Release Test'])
      writeFileSync(path.join(repo, 'deleted.txt'), 'safe content')
      runGit(['add', '--all'])
      runGit(['commit', '-q', '-m', 'base'])
      rmSync(path.join(repo, 'deleted.txt'))
      runGit(['add', '--all'])
      expect(scanStagedCredentials(['deleted.txt'], repo)).toEqual([])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('restores local settings after a simulated failed release stage', async () => {
    const configDir = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-test-'),
    )
    const settingsPath = path.join(configDir, 'settings.json')
    const originalSettings = JSON.stringify(
      {
        savantCodeModelPreference: 'personal/model',
        savantCodeModelProviderPreference: 'personal',
      },
      null,
      2,
    )
    writeFileSync(settingsPath, originalSettings)
    const previousConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    const previousModel = process.env.SAVANT_CODE_DEFAULT_MODEL_ID
    process.env.SAVANT_CODE_CONFIG_DIR = configDir
    process.env.SAVANT_CODE_DEFAULT_MODEL_ID = 'personal/model'

    try {
      const snapshot = snapshotLocalState()
      let restored = false
      expect(
        withLocalStateRestoration(
          snapshot,
          () => {
            applyPublicProfile(snapshot)
            expect(readFileSync(settingsPath, 'utf8')).toContain(
              'openrouter/free',
            )
            throw new Error('simulated gate failure')
          },
          () => {
            restored = true
          },
        ),
      ).rejects.toThrow('simulated gate failure')
      expect(restored).toBe(true)

      expect(readFileSync(settingsPath, 'utf8')).toBe(originalSettings)
      expect(process.env.SAVANT_CODE_DEFAULT_MODEL_ID).toBe('personal/model')
    } finally {
      if (previousConfigDir === undefined)
        delete process.env.SAVANT_CODE_CONFIG_DIR
      else process.env.SAVANT_CODE_CONFIG_DIR = previousConfigDir
      if (previousModel === undefined)
        delete process.env.SAVANT_CODE_DEFAULT_MODEL_ID
      else process.env.SAVANT_CODE_DEFAULT_MODEL_ID = previousModel
      rmSync(configDir, { recursive: true, force: true })
    }
  })

  test('reports changed tracked and untracked paths between fingerprints', () => {
    const before = {
      hash: 'before',
      trackedDetails: { 'a.txt': '1', 'b.txt': '2' },
      status: '?? extra.txt',
    }
    const after = {
      hash: 'after',
      trackedDetails: { 'a.txt': '9', 'c.txt': '3' },
      status: ' M a.txt',
    }
    expect(changedWorktreePaths(before, after)).toEqual([
      'a.txt',
      'b.txt',
      'c.txt',
      'extra.txt',
    ])
  })

  test('computes added and removed ignored paths between snapshots', () => {
    expect(ignoredPathDelta('!! a/\n!! b/x.log', '!! a/\n!! c/')).toEqual({
      added: ['!! c/'],
      removed: ['!! b/x.log'],
    })
    expect(ignoredPathDelta('', '')).toEqual({ added: [], removed: [] })
  })

  test('fingerprints the tracked worktree and detects mutations', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-fp-'))
    try {
      const runGit = (args: string[]) => {
        const result = Bun.spawnSync({
          cmd: ['git', ...args],
          cwd: repo,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (result.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(result.stderr))
        }
      }
      runGit(['init'])
      runGit(['config', 'user.email', 'release-test@example.invalid'])
      runGit(['config', 'user.name', 'Release Test'])
      writeFileSync(path.join(repo, 'tracked.txt'), 'base')
      runGit(['add', '--all'])
      runGit(['commit', '-m', 'base'])

      const baseline = fingerprintWorktree(repo)
      expect(fingerprintWorktree(repo).hash).toBe(baseline.hash)

      writeFileSync(path.join(repo, 'tracked.txt'), 'changed')
      const mutated = fingerprintWorktree(repo)
      expect(mutated.hash).not.toBe(baseline.hash)
      expect(changedWorktreePaths(baseline, mutated)).toEqual(['tracked.txt'])

      writeFileSync(path.join(repo, 'tracked.txt'), 'base')
      expect(fingerprintWorktree(repo).hash).toBe(baseline.hash)

      writeFileSync(path.join(repo, 'untracked.txt'), 'new')
      const untracked = fingerprintWorktree(repo)
      expect(untracked.hash).not.toBe(baseline.hash)
      expect(changedWorktreePaths(baseline, untracked)).toEqual([
        'untracked.txt',
      ])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('rejects a live-owner lock and releases it for the next process', () => {
    const version = '9.9.9'
    const lockPath = releaseLockPath(version)
    let release: (() => void) | undefined
    try {
      release = acquireReleaseLock(version, 'test')
      expect(() => acquireReleaseLock(version, 'test')).toThrow(
        'owns the release lock',
      )
      release()
      release = undefined
      expect(existsSync(lockPath)).toBe(false)
      release = acquireReleaseLock(version, 'test')
    } finally {
      release?.()
      rmSync(lockPath, { recursive: true, force: true })
    }
  })

  test('recovers a stale lock only with valid owner metadata and a dead PID', () => {
    const version = '8.8.8'
    const lockPath = releaseLockPath(version)
    const dead = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' })
    const deadPid = dead.pid
    expect(deadPid).toBeGreaterThan(0)
    try {
      mkdirSync(lockPath)
      writeFileSync(
        path.join(lockPath, 'owner.json'),
        JSON.stringify({
          pid: deadPid,
          host: os.hostname(),
          startedAt: new Date().toISOString(),
          ownerToken: 'stale-token',
          version,
          mode: 'test',
        }),
      )
      let release: (() => void) | undefined
      try {
        release = acquireReleaseLock(version, 'test')
      } finally {
        release?.()
      }
    } finally {
      rmSync(lockPath, { recursive: true, force: true })
    }
  })

  test('refuses locks whose owner evidence cannot be safely classified', () => {
    const version = '7.7.7'
    const lockPath = releaseLockPath(version)
    try {
      mkdirSync(lockPath)
      expect(() => acquireReleaseLock(version, 'test')).toThrow(
        'owner evidence is missing',
      )
      writeFileSync(
        path.join(lockPath, 'owner.json'),
        JSON.stringify({ pid: 1 }),
      )
      expect(() => acquireReleaseLock(version, 'test')).toThrow(
        'cannot be safely classified',
      )
    } finally {
      rmSync(lockPath, { recursive: true, force: true })
    }
  })

  test('builds diagnostic receipts that fail closed and record ignored deltas', () => {
    const headSha = 'a'.repeat(40)
    const failed = buildDiagnosticReceipt(
      '0.0.21',
      undefined,
      'boom',
      undefined,
    )
    expect(failed.completedStages).toEqual([])
    expect(failed.failedStage).toBe('boom')
    expect(failed.evidenceFinalized).toBe(false)

    const attempt = {
      label: 'test',
      command: 'bun',
      args: ['run', 'test'],
      cwd: '/repo',
      attempt: 1,
      failureClass: 'success' as const,
      status: 0,
      signal: null,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 1,
      transcriptPath: '/tmp/gate.log',
      transcriptSha256: 'hash',
      transcriptFinalized: true,
      summary: '',
    }
    const passed = buildDiagnosticReceipt(
      '0.0.21',
      { manifestHash: 'm', attempts: [attempt], passed: true, headSha },
      undefined,
      { added: ['!! cli/debug/'], removed: [] },
    )
    expect(passed.completedStages).toEqual(['GATES_AND_PACKAGE_DRY_RUNS'])
    expect(passed.evidenceFinalized).toBe(true)
    expect(passed.ignoredChanges?.added).toEqual(['!! cli/debug/'])
    expect(passed.evidenceHeadSha).toBe(headSha)
  })

  test('flags credential-shaped staged files before an automation commit', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-scan-'))
    try {
      writeFileSync(path.join(repo, 'safe.ts'), 'export const x = 1\n')
      // Built at runtime from parts so the high-entropy token never appears
      // contiguously in this source file (which the scanner itself scans).
      const fakeToken = [
        'ghp',
        '_',
        'K8sT2vX9mQ4rA7cD1fH5jL0nP3wZ6yB8eG2uR',
      ].join('')
      writeFileSync(path.join(repo, 'leaked.txt'), `token ${fakeToken}\n`)
      writeFileSync(
        path.join(repo, 'client.pem'),
        '-----BEGIN PRIVATE KEY-----\nabc\n',
      )
      writeFileSync(
        path.join(repo, 'pasted-notes.txt'),
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA7vR2abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789\n-----END RSA PRIVATE KEY-----\n',
      )
      writeFileSync(
        path.join(repo, '.env.example'),
        'GITHUB_TOKEN=<replace-me>\n',
      )
      writeFileSync(
        path.join(repo, 'docs-example.txt'),
        'Use a token like ghp_abcdefghijklmnopqrstuvwxyz0123456789 in your config\n',
      )

      expect(scanStagedCredentials(['safe.ts'], repo)).toEqual([])
      expect(scanStagedCredentials(['leaked.txt'], repo)).toHaveLength(1)
      expect(scanStagedCredentials(['client.pem'], repo)).toHaveLength(1)
      expect(scanStagedCredentials(['pasted-notes.txt'], repo)).toHaveLength(1)
      expect(scanStagedCredentials(['.env.example'], repo)).toEqual([])
      // Sequential/alphabetic token-shaped prose must not block a commit.
      expect(scanStagedCredentials(['docs-example.txt'], repo)).toEqual([])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('detects settings that already carry the public release profile', () => {
    expect(settingsAlreadyPublic(undefined)).toBe(false)
    expect(settingsAlreadyPublic('{"model":"personal"}')).toBe(false)
    expect(
      settingsAlreadyPublic(
        '{"savantCodeModelPreference":"openrouter/free","directProvider":"openrouter"}',
      ),
    ).toBe(true)
  })

  test('refuses to re-bake the public profile when a prior release did not restore', () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-prior-'),
    )
    const publicSettings =
      '{"savantCodeModelPreference":"openrouter/free","directProvider":"openrouter"}'
    // Explicit, strictly increasing mtimes: rapid writeFileSync calls on the
    // same filesystem can otherwise share a timestamp, making the "most
    // recent receipt" selection order-dependent (flaky on Windows NTFS).
    const stamp = (file: string, mtimeMs: number) =>
      utimesSync(path.join(directory, file), mtimeMs / 1000, mtimeMs / 1000)
    try {
      // No receipts at all → safe.
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory),
      ).not.toThrow()
      // Diagnostic receipts never apply or restore → never evidence of a crash.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.21-diagnostic.json'),
        JSON.stringify({ restored: false }),
      )
      stamp('savant-public-release-0.0.21-diagnostic.json', 1_700_000_000_000)
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory),
      ).not.toThrow()
      // An unrestored prior release receipt fails closed.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.21.json'),
        JSON.stringify({ restored: false, version: '0.0.21' }),
      )
      stamp('savant-public-release-0.0.21.json', 1_700_000_100_000)
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory),
      ).toThrow('did not confirm restoration')
      // A newer restored receipt overrides the older unrestored one.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.22.json'),
        JSON.stringify({ restored: true, version: '0.0.22' }),
      )
      stamp('savant-public-release-0.0.22.json', 1_700_000_200_000)
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory),
      ).not.toThrow()
      // Personal settings never trigger the guard, even with unrestored receipts.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.23.json'),
        JSON.stringify({ restored: false, version: '0.0.23' }),
      )
      stamp('savant-public-release-0.0.23.json', 1_700_000_300_000)
      expect(() =>
        assertNoUnrestoredPriorRelease('{"model":"personal"}', directory),
      ).not.toThrow()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('ignores release receipts stamped for another repository', () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-foreign-'),
    )
    const publicSettings =
      '{"savantCodeModelPreference":"openrouter/free","directProvider":"openrouter"}'
    try {
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.24.json'),
        JSON.stringify({
          restored: false,
          version: '0.0.24',
          repositoryKey: 'deadbeef',
        }),
      )
      // A foreign unrestored receipt must never block this repo.
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory, 'cafebabe'),
      ).not.toThrow()
      // Matching repo identity still fails closed.
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory, 'deadbeef'),
      ).toThrow('did not confirm restoration')
      // Legacy receipts (no identity) still count for this repo.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.23.json'),
        JSON.stringify({ restored: false, version: '0.0.23' }),
      )
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory, 'cafebabe'),
      ).toThrow('did not confirm restoration')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('fails closed when the newest prior receipt is unreadable', () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-unreadable-'),
    )
    const publicSettings =
      '{"savantCodeModelPreference":"openrouter/free","directProvider":"openrouter"}'
    try {
      // A torn/corrupt receipt is exactly the crash evidence the guard exists
      // for; it must fail closed instead of being silently skipped.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.25.json'),
        '{"restored": fals',
      )
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory, 'cafebabe'),
      ).toThrow('unreadable')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('flags real-shaped tokens across provider formats without false positives', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-balance-'))
    // Every credential-shaped string is assembled from parts at runtime so no
    // contiguous high-entropy token ever appears in this source file (the
    // scanner reads the source itself during an automation commit).
    const join = (...parts: string[]) => parts.join('')
    try {
      const cases: Array<[string, string, boolean]> = [
        // [file, content, shouldFlag]
        [
          'slack.txt',
          join('xoxb-', '123456789012-1234567890123-', 'ABCDEFGHIJKLMNOPQRST'),
          true,
        ],
        // Legacy OpenAI keys are lowercase+digits only (2 classes).
        [
          'openai.txt',
          join(
            'sk-',
            'abcdefghijklmnopqrstuvwxyz0123456789',
            'abcdefghijklmnopqrst',
          ),
          true,
        ],
        // Modern OpenAI keys use the sk-proj- prefix.
        [
          'openai-proj.txt',
          join('sk-proj-', 'R8xK2vL9mQ4nA7cD1fH5jL0nP3wZ6yB'),
          true,
        ],
        // AWS access-key IDs are uppercase+digits and typically repeat chars.
        ['aws.txt', join('AKIA', 'IOSFODNN7EXAMPLE'), true],
        // Sequential ghp example (lowercase+digits) must NOT flag.
        [
          'ghp-doc.txt',
          join('token ghp', '_abcdefghijklmnopqrstuvwxyz0123456789'),
          false,
        ],
        // Repeated-character placeholder (entropy ≈ 0) must NOT flag.
        ['aws-placeholder.txt', join('AKIA', 'AAAAAAAAAAAAAAAA'), false],
      ]
      for (const [name, content, shouldFlag] of cases) {
        writeFileSync(path.join(repo, name), content)
        const flagged = scanStagedCredentials([name], repo)
        expect(
          flagged.length > 0,
          `${name} should ${shouldFlag ? 'flag' : 'pass'}`,
        ).toBe(shouldFlag)
      }
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('decodes captured gate output leniently so invalid bytes never mask a real exit code', () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-decode-'),
    )
    try {
      const capturePath = path.join(directory, 'captured.log')
      writeFileSync(capturePath, Buffer.from([0x41, 0xff, 0x42, 0x0a]))
      expect(() => readCapturedOutput(capturePath)).not.toThrow()
      expect(readCapturedOutput(capturePath)).toBe('A\uFFFD' + 'B\n')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('removes known secret variables from the gate environment', () => {
    const previousToken = process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'ghs_should-not-leak'
    try {
      const gateEnv = sanitizedGateEnv()
      expect(gateEnv).toBeDefined()
      expect(gateEnv?.GITHUB_TOKEN).toBeUndefined()
      expect(Object.keys(gateEnv ?? {}).length).toBeGreaterThan(0)
      // The helper must never mutate process.env itself.
      expect(process.env.GITHUB_TOKEN).toBe('ghs_should-not-leak')
    } finally {
      if (previousToken === undefined) delete process.env.GITHUB_TOKEN
      else process.env.GITHUB_TOKEN = previousToken
    }
  })

  test('does not discard legitimate prose from credential-shaped lines', () => {
    expect(() =>
      redactSecretText('credential: certificate-holder-name'),
    ).not.toThrow()
    expect(() =>
      redactSecretText('credential: definitely-not-safe-123456'),
    ).toThrow('Unclassified credential-shaped output')
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

  test('expects exactly the five workflow-matrix binary tarballs', () => {
    // NOT every PLATFORM_TARGETS key: the launcher map has 7 entries including
    // two baseline variants the workflow does not build. Asserting the full
    // map would fail forever (FID-2026-0809-002 Fix B / Loop 2 finding).
    expect([...RELEASE_BINARY_TARBALLS]).toEqual([
      'savant-code-linux-x64.tar.gz',
      'savant-code-linux-arm64.tar.gz',
      'savant-code-darwin-x64.tar.gz',
      'savant-code-darwin-arm64.tar.gz',
      'savant-code-win32-x64.tar.gz',
    ])
    expect(RELEASE_BINARY_TARBALLS).toHaveLength(5)
  })

  test('verifyReleaseAssets passes when all five tarballs are present', async () => {
    const previousTimeout = process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
    const previousPoll = process.env.SAVANT_RELEASE_ASSET_POLL_MS
    try {
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = '2000'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '10'
      const names = [...RELEASE_BINARY_TARBALLS]
      const fetchImpl = async () =>
        new Response(
          JSON.stringify({
            tag_name: 'v0.0.21',
            assets: names.map((name) => ({ name })),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      await expect(
        verifyReleaseAssets('0.0.21', 'github-secret', '/repo', fetchImpl),
      ).resolves.toBeUndefined()
    } finally {
      if (previousTimeout === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      else process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = previousTimeout
      if (previousPoll === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      else process.env.SAVANT_RELEASE_ASSET_POLL_MS = previousPoll
    }
  })

  test('verifyReleaseAssets fails closed when the release has zero assets', async () => {
    const previousTimeout = process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
    const previousPoll = process.env.SAVANT_RELEASE_ASSET_POLL_MS
    try {
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = '80'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '5'
      const fetchImpl = async () =>
        new Response(JSON.stringify({ tag_name: 'v0.0.21', assets: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      await expect(
        verifyReleaseAssets('0.0.21', 'github-secret', '/repo', fetchImpl),
      ).rejects.toThrow('missing binary assets')
    } finally {
      if (previousTimeout === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      else process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = previousTimeout
      if (previousPoll === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      else process.env.SAVANT_RELEASE_ASSET_POLL_MS = previousPoll
    }
  })

  test('verifyReleaseAssets fails closed when only part of the matrix uploaded', async () => {
    const previousTimeout = process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
    const previousPoll = process.env.SAVANT_RELEASE_ASSET_POLL_MS
    try {
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = '80'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '5'
      const names = RELEASE_BINARY_TARBALLS.slice(0, 4)
      const fetchImpl = async () =>
        new Response(
          JSON.stringify({
            tag_name: 'v0.0.21',
            assets: names.map((name) => ({ name })),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      await expect(
        verifyReleaseAssets('0.0.21', 'github-secret', '/repo', fetchImpl),
      ).rejects.toThrow('missing binary assets')
    } finally {
      if (previousTimeout === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      else process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = previousTimeout
      if (previousPoll === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      else process.env.SAVANT_RELEASE_ASSET_POLL_MS = previousPoll
    }
  })

  test('asset timing helpers honor env overrides and invalid values', () => {
    const previousTimeout = process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
    const previousPoll = process.env.SAVANT_RELEASE_ASSET_POLL_MS
    try {
      delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      expect(assetRetryTimeoutMs()).toBe(45 * 60 * 1_000)
      expect(assetPollIntervalMs()).toBe(30 * 1_000)
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = '5000'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '250'
      expect(assetRetryTimeoutMs()).toBe(5_000)
      expect(assetPollIntervalMs()).toBe(250)
      process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = 'not-a-number'
      process.env.SAVANT_RELEASE_ASSET_POLL_MS = '-7'
      expect(assetRetryTimeoutMs()).toBe(45 * 60 * 1_000)
      expect(assetPollIntervalMs()).toBe(30 * 1_000)
    } finally {
      if (previousTimeout === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS
      else process.env.SAVANT_RELEASE_ASSET_TIMEOUT_MS = previousTimeout
      if (previousPoll === undefined)
        delete process.env.SAVANT_RELEASE_ASSET_POLL_MS
      else process.env.SAVANT_RELEASE_ASSET_POLL_MS = previousPoll
    }
  })

  test('extracts only the real current release section', () => {
    const changelog = readFileSync(
      path.resolve(import.meta.dir, '../CHANGELOG.md'),
      'utf8',
    )
    const section = extractChangelogSection(changelog, '0.0.21')

    expect(section.startsWith('## v0.0.21 — 2026-08-06')).toBe(true)
    expect(section).toContain('### Reversible public release pipeline')
    expect(section).not.toContain('## v0.0.20 —')
  })
})
