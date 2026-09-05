// Public release contract — staged-credential scanning. Sibling of the
// FID-2026-0819-005 Loop 317 decomposition.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { scanStagedCredentials } from './public-release'

describe('public release contract — credential scan', () => {
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
      // Source files named credentials* / secrets* are content-scanned, not
      // filename-blocked (FID-2026-0821-002 P3): clean modules pass, and a
      // real secret inside one still flags via the content scan.
      const credentialsModule = path.join(repo, 'sdk/src/credentials.ts')
      mkdirSync(path.dirname(credentialsModule), { recursive: true })
      writeFileSync(credentialsModule, 'export const apiKey = getApiKey()\n')
      expect(scanStagedCredentials(['sdk/src/credentials.ts'], repo)).toEqual(
        [],
      )
      writeFileSync(credentialsModule, `export const apiKey = '${fakeToken}'\n`)
      expect(
        scanStagedCredentials(['sdk/src/credentials.ts'], repo),
      ).toHaveLength(1)
      writeFileSync(path.join(repo, 'secrets.ts'), 'export const s = 1\n')
      expect(scanStagedCredentials(['secrets.ts'], repo)).toEqual([])
      writeFileSync(
        path.join(repo, 'secrets.js'),
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA7vR2abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789\n-----END RSA PRIVATE KEY-----\n',
      )
      expect(scanStagedCredentials(['secrets.js'], repo)).toHaveLength(1)
      // Config-shaped credential stores stay filename-blocked regardless of
      // content: credentials.json is the canonical secret-store name.
      writeFileSync(path.join(repo, 'credentials.json'), '{}\n')
      expect(scanStagedCredentials(['credentials.json'], repo)).toHaveLength(1)
    } finally {
      rmSync(repo, { recursive: true, force: true })
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
})
