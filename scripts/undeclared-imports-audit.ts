#!/usr/bin/env bun
/**
 * undeclared-imports-audit — the collector and probe for ./undeclared-imports.
 *
 * SCOPE is git-tracked state and nothing here reads `node_modules`, which is
 * what makes the answer install-independent — the property the v0.0.24 gate
 * lacked when it resolved against whatever `node_modules` sat on disk.
 *
 * PROVIDERS are the two tracked sources an install resolves through: the
 * manifests declare, and `bun.lock` records what is installed. A package no
 * manifest names but the lockfile carries is a transitive dependency doing a
 * declaration's job — the `transitive` tier, and the v0.0.35 `ajv` exactly.
 */
import fs from 'node:fs'
import path from 'node:path'

import { findUndeclaredImports } from './undeclared-imports'

import type { ImportContext, UndeclaredImport } from './undeclared-imports'

export type GitRunner = (
  command: string,
  args: string[],
  cwd: string,
) => { status: number | null; stdout: string; stderr: string }

/** Tracked source surface — the same extensions ./audit-gate-env-parity covers. */
export const AUDITED_SURFACE_ARGS = ['*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs']

/** The lockfile that records every package a clean install contains. */
export const LOCKFILE = 'bun.lock'

/** Findings printed before the tail is summarized. */
const MAX_REPORTED = 40

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

/**
 * Surfaces excluded by PREFIX, each with its reason — never by pattern, so
 * every exemption is auditable at a glance. None is code this repo ships.
 */
export const EXCLUDED_SURFACES: readonly { prefix: string; reason: string }[] =
  [
    {
      prefix: 'common/src/templates/',
      reason:
        'project templates for generated agent dirs — never compiled by this repo',
    },
    {
      prefix: 'scripts/eslint-rules/__fixtures__/',
      reason: 'lint fixtures must contain the violations the rules reject',
    },
    {
      prefix: 'sdk/test/',
      reason:
        'consumer-compatibility fixtures that vendor the packed SDK into their own node_modules',
    },
  ]

type Json = Record<string, unknown>

/** What the whole repository makes available to an import. */
export type InstallIndex = {
  /** Declared as a dependency by at least one manifest. */
  provided: ReadonlySet<string>
  /** Package names the tracked lockfile records, transitive ones included. */
  installed: ReadonlySet<string>
  /** Members of the root `workspaces`, linked into the root install. */
  linked: ReadonlySet<string>
  /** Which manifests declare each name, for the report. */
  owners: ReadonlyMap<string, readonly string[]>
}

function defaultRunner(
  command: string,
  args: string[],
  cwd: string,
): { status: number | null; stdout: string; stderr: string } {
  const spawned = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const { exitCode, stdout, stderr } = spawned
  return {
    status: exitCode,
    stdout: stdout.toString(),
    stderr: stderr.toString(),
  }
}

function readJson(file: string): Json | null {
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Json
  } catch {
    return null
  }
}

/** True when a repo-relative path sits inside an excluded surface. */
export function isExcluded(relativePath: string): boolean {
  return EXCLUDED_SURFACES.some((surface) =>
    relativePath.startsWith(surface.prefix),
  )
}

/** The dependency names one manifest declares. */
export function dependencyNames(manifest: Json): string[] {
  const names: string[] = []
  for (const field of DEPENDENCY_FIELDS) {
    const block = manifest[field]
    if (block === null || typeof block !== 'object') continue
    names.push(...Object.keys(block))
  }
  return names
}

/** The tracked paths a git glob resolves to, or why the list could not be read. */
function trackedPaths(
  root: string,
  patterns: readonly string[],
  runner: GitRunner,
): { files: string[]; error?: string } {
  const result = runner('git', ['ls-files', '--', ...patterns], root)
  if ((result.status ?? 1) !== 0) {
    return {
      files: [],
      error: `Unable to list tracked paths (git ls-files exit ${result.status}): ${result.stderr.trim()}`,
    }
  }
  return {
    files: result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().replaceAll('\\', '/'))
      .filter((file) => file !== '' && !isExcluded(file)),
  }
}

/** The in-scope tracked sources. */
export function auditedFiles(
  root: string,
  runner: GitRunner = defaultRunner,
): { files: string[]; error?: string } {
  return trackedPaths(root, AUDITED_SURFACE_ARGS, runner)
}

/** Every tracked manifest, so nested package scopes are indexed too. */
export function trackedManifests(
  root: string,
  runner: GitRunner = defaultRunner,
): { files: string[]; error?: string } {
  return trackedPaths(root, ['*package.json'], runner)
}

/**
 * Every package name the lockfile records, read from its `name@version` entries
 * as text (bun.lock is not strict JSON — it writes bare property names). The
 * version must be semver, so no name is scraped out of another quoted string,
 * and the name is non-greedy, which keeps scoped names whole.
 */
export function installedNames(lockText: string): Set<string> {
  const names = new Set<string>()
  for (const match of lockText.matchAll(/"([^"]+?)@\d+\.\d+\.\d+[^"]*"/g)) {
    const name = match[1]
    if (name !== undefined) names.add(name)
  }
  return names
}

/**
 * Index what the repository provides. Members of the root `workspaces` are
 * tracked separately because bun links all of them into the root `node_modules`
 * whatever any manifest asks for, so an undeclared workspace import resolves.
 */
export function buildInstallIndex(
  root: string,
  manifestPaths: readonly string[],
  lockText: string,
): InstallIndex {
  const owners = new Map<string, string[]>()
  for (const manifestPath of manifestPaths) {
    const manifest = readJson(path.join(root, manifestPath)) ?? {}
    for (const name of dependencyNames(manifest)) {
      const list = owners.get(name)
      if (list === undefined) owners.set(name, [manifestPath])
      else list.push(manifestPath)
    }
  }
  const rootManifest = readJson(path.join(root, 'package.json'))
  const members = Array.isArray(rootManifest?.workspaces)
    ? rootManifest.workspaces
    : []
  const linked = new Set<string>()
  for (const member of members) {
    if (typeof member !== 'string') continue
    const manifest = readJson(path.join(root, member, 'package.json'))
    if (typeof manifest?.name === 'string') linked.add(manifest.name)
  }
  return {
    provided: new Set(owners.keys()),
    installed: installedNames(lockText),
    linked,
    owners,
  }
}

/**
 * Grade every in-scope tracked source. Ordered by file and line so the report
 * is deterministic across platforms.
 */
export function collectUndeclaredImportIssues(
  root: string,
  runner: GitRunner = defaultRunner,
): { issues: UndeclaredImport[]; error?: string } {
  const manifests = trackedManifests(root, runner)
  if (manifests.error !== undefined)
    return { issues: [], error: manifests.error }
  const sources = auditedFiles(root, runner)
  if (sources.error !== undefined) return { issues: [], error: sources.error }
  const lockPath = path.join(root, LOCKFILE)
  if (!fs.existsSync(lockPath)) {
    return {
      issues: [],
      error: `${LOCKFILE} is missing, so what a clean install provides cannot be read.`,
    }
  }
  const install = buildInstallIndex(
    root,
    manifests.files,
    fs.readFileSync(lockPath, 'utf8'),
  )
  const context: ImportContext = {
    provided: install.provided,
    installed: install.installed,
    linked: install.linked,
    owners: install.owners,
  }
  const issues: UndeclaredImport[] = []
  for (const file of sources.files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    issues.push(...findUndeclaredImports(file, source, context))
  }
  return {
    issues: issues.sort((a, b) =>
      a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
    ),
  }
}

function describe(issue: UndeclaredImport): string {
  const why =
    issue.tier === 'absent'
      ? 'nothing declares it and the lockfile has no such package'
      : 'no manifest declares it — only a transitive dependency hoists it'
  return `${issue.file}:${issue.line} imports "${issue.specifier}" (${issue.packageName}: ${why})`
}

function report(issues: readonly UndeclaredImport[]): number {
  if (issues.length === 0) {
    console.log(
      'undeclared-imports PASS — every import in tracked sources is declared by a manifest or linked by the workspace install.',
    )
    return 0
  }
  const owned = new Set(issues.map((issue) => issue.packageName))
  console.error(
    `undeclared-imports FAILED — ${issues.length} import(s) of ${owned.size} package(s) no manifest in the repository declares:`,
  )
  for (const issue of issues.slice(0, MAX_REPORTED)) {
    console.error(`- ${describe(issue)}`)
  }
  if (issues.length > MAX_REPORTED) {
    console.error(`- … and ${issues.length - MAX_REPORTED} more`)
  }
  console.error(
    'Declare the package in the importing workspace manifest, or add the surface to EXCLUDED_SURFACES with a reason.',
  )
  return 1
}

function probeMain(): number {
  const root = path.resolve(import.meta.dir, '..')
  const { issues, error } = collectUndeclaredImportIssues(root)
  if (error !== undefined) {
    console.error(`undeclared-imports FAILED — ${error}`)
    return 1
  }
  return report(issues)
}

if (import.meta.main) {
  process.exitCode = probeMain()
}
