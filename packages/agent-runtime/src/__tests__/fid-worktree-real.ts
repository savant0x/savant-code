/** Real-git fixtures: isolated repositories, never the operator's working tree. */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

export const REAL_FID = 'FID-2026-1017-901'
export const REAL_GIT_TIMEOUT_MS = 30_000

export function realGit(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0)
    throw new Error(`git ${args.join(' ')}: ${result.stderr}`)
  return result.stdout.trim()
}

export function realRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'fid lane test '))
  realGit(root, ['init', '-b', 'main'])
  realGit(root, ['config', 'user.name', 'Probe'])
  realGit(root, ['config', 'user.email', 'probe@savant.local'])
  realGit(root, ['config', 'core.hooksPath', '.git/hooks'])
  mkdirSync(path.join(root, 'dev/fids'), { recursive: true })
  writeFileSync(path.join(root, '.gitignore'), '.savant/\nnode_modules/\n')
  writeFileSync(path.join(root, 'src.ts'), 'export const value = 1\n')
  writeFileSync(
    path.join(root, 'SCOPE.md'),
    '# Scope\n\n## Machine-readable scope targets\n\n- TEST: `src.ts`\n',
  )
  writeFileSync(
    path.join(root, `dev/fids/${REAL_FID}-fixture.md`),
    '**Status:** converged\n',
  )
  realGit(root, [
    'add',
    '.gitignore',
    'src.ts',
    'SCOPE.md',
    `dev/fids/${REAL_FID}-fixture.md`,
  ])
  realGit(root, ['commit', '-m', 'fixture base'])
  return root
}

export function commitFile(
  root: string,
  name: string,
  content: string,
): string {
  writeFileSync(path.join(root, name), content)
  realGit(root, ['add', '--', name])
  realGit(root, ['commit', '-m', 'fixture change'])
  return realGit(root, ['rev-parse', 'HEAD'])
}
