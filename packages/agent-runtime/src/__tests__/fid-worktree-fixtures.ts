/**
 * Shared fakes for the FID-worktree lifecycle suites (FID-2026-1017-007).
 * The lifecycle takes its git runner and filesystem by injection, so these are
 * deterministic adapters rather than module mocks.
 */
import type { GitResult, GitRunner } from '../echo/parallel/fid-worktree-git'
import type { WorktreeFs } from '../echo/parallel/fid-worktree-record'

export const REPO = 'C:/repo'
export const FID = 'FID-2026-1017-007'
export const BASE_SHA = 'a'.repeat(40)

export type MemoryFs = WorktreeFs & {
  files: Map<string, string>
  dirs: Set<string>
  links: Map<string, string>
}

function normalize(target: string): string {
  return target.replace(/\\/g, '/')
}

export function memoryFs(initialDirs: string[] = []): MemoryFs {
  const files = new Map<string, string>()
  const dirs = new Set<string>(initialDirs.map(normalize))
  const links = new Map<string, string>()
  const fs: MemoryFs = {
    files,
    dirs,
    links,
    detachLinks: (target) => {
      const key = normalize(target)
      for (const link of links.keys()) {
        if (link === key || link.startsWith(`${key}/`)) links.delete(link)
      }
      return true
    },
    exists: (target) => {
      const key = normalize(target)
      return files.has(key) || dirs.has(key) || links.has(key)
    },
    mkdirp: (target) => {
      dirs.add(normalize(target))
    },
    list: (target) => {
      const prefix = `${normalize(target)}/`
      const names = new Set<string>()
      for (const key of [...files.keys(), ...dirs]) {
        if (!key.startsWith(prefix)) continue
        names.add(key.slice(prefix.length).split('/')[0] ?? '')
      }
      return [...names].filter(Boolean)
    },
    read: (target) => files.get(normalize(target)) ?? null,
    write: (target, content) => {
      const key = normalize(target)
      files.set(key, content)
      // Mirror mkdirSync's recursive behavior so the parent is listable.
      const parts = key.split('/')
      parts.pop()
      for (let i = 1; i <= parts.length; i += 1) {
        dirs.add(parts.slice(0, i).join('/'))
      }
    },
    removeFile: (target) => {
      files.delete(normalize(target))
    },
    removeDir: (target) => {
      const key = normalize(target)
      const prefix = `${key}/`
      let removed = false
      for (const file of [...files.keys()]) {
        if (file === key || file.startsWith(prefix)) {
          files.delete(file)
          removed = true
        }
      }
      for (const dir of [...dirs]) {
        if (dir === key || dir.startsWith(prefix)) {
          dirs.delete(dir)
          removed = true
        }
      }
      for (const link of [...links.keys()]) {
        if (link === key || link.startsWith(prefix)) links.delete(link)
      }
      dirs.delete(key)
      return removed || !fs.exists(key)
    },
    linkDir: (target, link) => {
      links.set(normalize(link), normalize(target))
      return true
    },
  }
  return fs
}

export type MemoryGit = {
  runner: GitRunner
  calls: string[][]
  /** Force a status for a command prefix, e.g. `worktree add`. */
  fail: Set<string>
  /** Commands recorded even when they fail. */
  onAdd?: () => void
}

export function memoryGit(
  options: {
    fs?: MemoryFs
    branchExists?: boolean
    /** SHA returned for `rev-parse refs/heads/<branch>` when it exists. */
    branchSha?: string
    /** Whether `merge-base --is-ancestor <base> <branch>` succeeds. */
    branchDescends?: boolean
    onCreateLane?: (path: string) => void
    onRemoveLane?: (path: string) => void
    failPrefixes?: string[]
  } = {},
): MemoryGit {
  const calls: string[][] = []
  const fail = new Set(options.failPrefixes ?? [])
  const git: MemoryGit = {
    calls,
    fail,
    runner: (args, _cwd): GitResult => {
      calls.push([...args])
      const joined = args.join(' ')
      for (const prefix of fail) {
        if (joined.startsWith(prefix)) {
          return { status: 1, stdout: '', stderr: `forced failure: ${prefix}` }
        }
      }
      if (joined === 'rev-parse HEAD') {
        return { status: 0, stdout: `${BASE_SHA}\n`, stderr: '' }
      }
      if (joined.startsWith('show-ref')) {
        return options.branchExists
          ? { status: 0, stdout: '', stderr: '' }
          : { status: 1, stdout: '', stderr: '' }
      }
      if (joined.startsWith('merge-base --is-ancestor')) {
        return {
          status: options.branchDescends ? 0 : 1,
          stdout: '',
          stderr: '',
        }
      }
      if (joined.startsWith('rev-parse refs/heads/')) {
        return options.branchExists
          ? {
              status: 0,
              stdout: `${options.branchSha ?? BASE_SHA}\n`,
              stderr: '',
            }
          : { status: 1, stdout: '', stderr: '' }
      }
      if (joined.startsWith('worktree add')) {
        const lane = args[4]
        if (lane) options.onCreateLane?.(lane)
        return { status: 0, stdout: '', stderr: '' }
      }
      if (joined.startsWith('worktree remove')) {
        const lane = args[3]
        if (lane) options.onRemoveLane?.(lane)
        return { status: 0, stdout: '', stderr: '' }
      }
      if (joined === 'worktree list --porcelain') {
        return {
          status: 0,
          stdout: `worktree C:/repo\nHEAD ${BASE_SHA}\nbranch refs/heads/main\n`,
          stderr: '',
        }
      }
      if (joined === 'status --porcelain') {
        return { status: 0, stdout: '', stderr: '' }
      }
      return { status: 0, stdout: '', stderr: '' }
    },
  }
  return git
}
