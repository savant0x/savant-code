#!/usr/bin/env bun
/**
 * clean-install-bundle — the pristine-install engine behind the
 * `cli-bundle-resolution` gate.
 *
 * The gate used to bundle the CLI in the working tree, so `bun build` resolved
 * imports against whatever `node_modules` the machine happened to have. That is
 * not a hypothetical hole: a stray ancestor `node_modules` holding undeclared
 * packages can supply imports while every local gate stays green and CI
 * (resolving the committed lockfile) fails.
 * A bundle in the working tree cannot answer the question the gate exists to
 * ask, so this engine answers it somewhere else.
 *
 * It materializes the working tree — the files the release would ship, tracked
 * plus untracked-but-not-ignored — into a scratch directory, installs the
 * frozen lockfile there, runs the release build's own prebundle steps, and
 * bundles. Two properties make the verdict trustworthy:
 *
 *  1. **The install is pristine.** It comes from `bun install --frozen-lockfile`
 *     against the committed `bun.lock`, never from a `node_modules` that may
 *     have drifted.
 *  2. **Resolution provenance is checked, not assumed.** `--metafile` records
 *     every module the bundler loaded with its path; any input resolving
 *     OUTSIDE the scratch tree is a violation. That is what turns a polluted
 *     ancestor directory from a silent pass into a failure — and why the tree
 *     does not need a `node_modules`-free ancestor chain, which no path under a
 *     user profile or the OS temp dir has.
 *
 * Boundaries, stated because they are real and not because they are deferred:
 * the install skips package lifecycle scripts (`--ignore-scripts`) so the tree
 * resolves the *declared* dependency graph and nothing else; and the bundle
 * target is the host's `bun` condition set, so per-platform `os`/`cpu` export
 * conditions remain the release workflow's coverage rather than this gate's.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Env override for the scratch tree, for a CI volume or a known-clean path. */
export const CLEAN_BUNDLE_ROOT_ENV = 'SAVANT_CODE_CLEAN_BUNDLE_ROOT'

/** Where the bundler writes its module graph inside the scratch tree. */
export const METAFILE_NAME = '.resolution-metafile.json'

/** One command the release runs before bundling; `cwd` is repo-relative. */
export type BuildStep = { cwd: string; argv: readonly string[] }

/**
 * Validate the installed security patches before the release build's prebundle
 * steps: the SDK first (the CLI resolves `@savant-code/sdk` through its `dist`
 * exports) and the generated agent modules second (gitignored build output, so
 * a pristine tree starts without them).
 */
export const PREBUNDLE_STEPS: readonly BuildStep[] = [
  { cwd: '.', argv: ['scripts/probes/dependency-security.ts'] },
  { cwd: 'sdk', argv: ['run', 'scripts/build.ts'] },
  { cwd: 'cli', argv: ['run', 'scripts/prebuild-agents.ts'] },
]

/**
 * The bundle argv (`--metafile` is appended per run). Unchanged from the gate's
 * original contract: the resolution phase is identical whether the bundle is
 * later compiled, so the flags that matter to this check are the entry, the
 * production mode, the target condition set and the externals.
 *
 * `--external '@opentui/core-*'` keeps the 8 platform-specific native binaries
 * (declared optionalDependencies, loaded at runtime via dynamic import) out of
 * the bundle: only the current OS binary is ever installed, so without it the
 * gate false-fails on every single-OS machine (A–Z v0.0.25 AV-001). The main
 * `@opentui/core` package does NOT match the wildcard and is still resolved.
 */
export const BUNDLE_ARGV: readonly string[] = [
  'build',
  'cli/src/index.tsx',
  '--production',
  '--target=bun',
  '--external',
  '@opentui/core-*',
  '--outdir',
  'cli/bin/.resolution-check',
]

/**
 * The scratch tree for this run: the operator's override when set, else a
 * pid-scoped directory under the OS temp dir (the convention the release engine
 * already uses for its evidence, and the only location this gate writes).
 */
export function scratchRoot(
  env: Record<string, string | undefined> = process.env,
  tmpdir: string = os.tmpdir(),
  pid: number = process.pid,
): string {
  const override = env[CLEAN_BUNDLE_ROOT_ENV]?.trim()
  if (override) return path.resolve(override)
  return path.join(tmpdir, `savant-clean-bundle-${pid}`)
}

/**
 * The files the release would ship: tracked paths plus untracked ones git does
 * not ignore. Tracked paths are copied from the working tree, so uncommitted
 * edits are what gets tested — the same state `fid:verify` grades. `git` is the
 * authority (a filesystem walk is not repository state, and would drag the
 * local `node_modules` in); a missing `.env*` is by construction, since
 * `.gitignore` excludes both.
 */
export function collectTreeFiles(repoRoot: string): string[] {
  const listed = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  )
  return listed.split('\0').filter(Boolean)
}

/** Copy `files` (repo-relative) from `repoRoot` into `treeRoot`. */
export function materializeTree(
  repoRoot: string,
  treeRoot: string,
  files: readonly string[],
): void {
  for (const file of files) {
    const destination = path.join(treeRoot, file)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(path.join(repoRoot, file), destination)
  }
}

/**
 * Why a scratch root is unusable, or `undefined` when it is fine. A tree inside
 * the repository is refused: `collectTreeFiles` reads `git ls-files --others`,
 * so the next run would copy the previous run's install into itself, and the
 * install would sit inside the release tree it is supposed to be measuring.
 */
export function scratchRootProblem(
  repoRoot: string,
  treeRoot: string,
): string | undefined {
  if (!isInsideTree(repoRoot, treeRoot)) return undefined
  return (
    `the scratch tree ${treeRoot} is inside the repository ${repoRoot}: git ` +
    'would enumerate it as release input, so the next run would copy its ' +
    'install into itself'
  )
}

/** True when `candidate` is `root` itself or lives beneath it. */
export function isInsideTree(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  if (relative === '') return true
  const [head] = relative.split(path.sep)
  return head !== '..' && !path.isAbsolute(relative)
}

/**
 * Is this metafile key a filesystem path at all? Runtime builtins and virtual
 * modules (`node:fs`, `bun:ffi`) appear in the graph as bare specifiers with no
 * separator; they cannot resolve to a stray install and are not provenance.
 */
export function isPathLikeInput(input: string): boolean {
  return path.isAbsolute(input) || /[/\\]/.test(input)
}

/** Input keys from a bundler metafile; `[]` when the shape is not a metafile. */
export function parseMetafileInputs(text: string): string[] {
  const parsed = JSON.parse(text) as { inputs?: Record<string, unknown> }
  return Object.keys(parsed.inputs ?? {})
}

/**
 * The metafile inputs that resolve outside `treeRoot` — each one a module the
 * pristine install does not provide, satisfied by a `node_modules` somewhere
 * up the ancestor chain. This is the v0.0.35 precondition, made loud.
 */
export function outsideTreeInputs(
  inputs: readonly string[],
  treeRoot: string,
  cwd: string = treeRoot,
): string[] {
  const outside: string[] = []
  for (const input of inputs) {
    if (!isPathLikeInput(input)) continue
    const absolute = path.isAbsolute(input) ? input : path.resolve(cwd, input)
    if (!isInsideTree(treeRoot, absolute)) outside.push(input)
  }
  return outside
}
