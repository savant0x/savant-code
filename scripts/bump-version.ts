#!/usr/bin/env bun

import path from 'node:path'

import { VERSION_PATTERN } from './validation-manifest.js'
import { findVersionReferences, updateDocSurfaces } from './version-docs.js'
import {
  SYNCHRONIZED_PACKAGE_PATHS,
  collectVersionDrift,
  patchLockfileWorkspaceVersions,
  readProductVersion,
  writeConfiguredProjectVersion,
  writeManifestVersion,
  writeProductVersion,
} from './version.js'

const repoRoot = path.resolve(import.meta.dir, '..')

export type IncrementKind = 'patch' | 'minor' | 'major'

export type BumpMode = {
  kind: 'bump'
  target: string
  dryRun: boolean
  docs: boolean
  force: boolean
}

export type Mode =
  | BumpMode
  | { kind: 'check' }
  | { kind: 'report'; version: string }
  | { kind: 'help' }

const USAGE = `usage: bun run scripts/bump-version.ts <version> [--patch|--minor|--major] [--dry-run] [--docs] [--force]
       bun run scripts/bump-version.ts --check
       bun run scripts/bump-version.ts --report [version]

Updates VERSION, the ${SYNCHRONIZED_PACKAGE_PATHS.length} synchronized package manifests,
protocol.config.yaml project.version, and bun.lock in one shot. Use --dry-run to
preview, --docs to also update README/docs/ARCHITECTURE/CHANGELOG, and --check to
fail when the enforced surfaces drift.`

export function parseArgs(argv: string[], current: string): Mode {
  const flags = new Set<string>()
  const positional: string[] = []
  for (const arg of argv) {
    if (arg.startsWith('--')) flags.add(arg)
    else positional.push(arg)
  }

  if (flags.has('--help') || flags.has('-h')) return { kind: 'help' }

  if (flags.has('--check')) {
    if (positional.length > 0) {
      throw new Error('--check takes no positional arguments')
    }
    return { kind: 'check' }
  }

  if (flags.has('--report')) {
    return { kind: 'report', version: positional[0] ?? current }
  }

  const increment = (['patch', 'minor', 'major'] as const).find((kind) =>
    flags.has(`--${kind}`),
  )
  const target = positional[0]
  if (target === undefined && !increment) {
    throw new Error(
      'Provide a target version or one of --patch|--minor|--major.\n' + USAGE,
    )
  }
  if (target !== undefined && increment) {
    throw new Error(
      'Provide either a target version or an increment flag, not both.',
    )
  }
  if (target !== undefined && !VERSION_PATTERN.test(target)) {
    throw new Error(`Malformed target version: ${target}`)
  }

  return {
    kind: 'bump',
    target: increment
      ? incrementVersion(current, increment)
      : (target as string),
    dryRun: flags.has('--dry-run'),
    docs: flags.has('--docs'),
    force: flags.has('--force'),
  }
}

export function incrementVersion(current: string, kind: IncrementKind): string {
  const base = current.split('-')[0]
  const parts = base.split('.').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    throw new Error(`Cannot auto-increment non-semver version: ${current}`)
  }
  const [major, minor, patch] = parts
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('-')[0].split('.').map(Number)
  const pb = b.split('-')[0].split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** Writes VERSION, the synchronized manifests, and protocol.config project.version. */
export function applyVersionFiles(root: string, target: string): string[] {
  const written: string[] = []
  writeProductVersion(root, target)
  written.push('VERSION')
  for (const relativePath of SYNCHRONIZED_PACKAGE_PATHS) {
    writeManifestVersion(root, relativePath, target)
    written.push(relativePath)
  }
  writeConfiguredProjectVersion(root, target)
  written.push('protocol.config.yaml project.version')
  return written
}

export function verifyLockfile(root: string): { ok: boolean; output: string } {
  return spawnBunInstall(root, ['--frozen-lockfile'])
}

function regenerateProtocolBundle(root: string): {
  ok: boolean
  output: string
} {
  const result = Bun.spawnSync(['bun', 'run', 'generate:protocol-bundle'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    ok: result.exitCode === 0,
    output: [
      result.stdout?.toString() ?? '',
      result.stderr?.toString() ?? '',
    ].join(''),
  }
}

function spawnBunInstall(
  root: string,
  args: string[],
): { ok: boolean; output: string } {
  const result = Bun.spawnSync(['bun', 'install', ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const output = [
    result.stdout?.toString() ?? '',
    result.stderr?.toString() ?? '',
  ].join('')
  return { ok: result.exitCode === 0, output }
}

export function checkVersion(root: string): string[] {
  return collectVersionDrift(root).map(
    (entry) =>
      `${entry.file}: ${entry.version ?? 'missing'} (expected ${readProductVersion(root)})`,
  )
}

function main(): void {
  const mode = parseArgs(process.argv.slice(2), readProductVersion(repoRoot))
  switch (mode.kind) {
    case 'help':
      console.log(USAGE)
      return
    case 'check': {
      const drift = checkVersion(repoRoot)
      if (drift.length === 0) {
        console.log('version: PASS (enforced surfaces synchronized)')
        return
      }
      console.error(`version: FAIL (${drift.length} drift(s))`)
      for (const line of drift) console.error(`- ${line}`)
      process.exitCode = 1
      return
    }
    case 'report': {
      const hits = findVersionReferences(repoRoot, mode.version)
      console.log(
        `files referencing ${mode.version} (historical records excluded):`,
      )
      if (hits.length === 0) console.log('  (none)')
      for (const file of hits) console.log(`  ${file}`)
      return
    }
    case 'bump': {
      const current = readProductVersion(repoRoot)
      if (compareVersions(mode.target, current) <= 0 && !mode.force) {
        throw new Error(
          `Target ${mode.target} is not greater than current ${current}. Use --force to override.`,
        )
      }
      if (mode.dryRun) {
        console.log(`[dry-run] would bump ${current} -> ${mode.target}`)
        for (const file of [
          'VERSION',
          ...SYNCHRONIZED_PACKAGE_PATHS,
          'protocol.config.yaml project.version',
        ]) {
          console.log(`[dry-run]   ${file}`)
        }
        console.log('[dry-run]   bun.lock (workspace version patch)')
        if (mode.docs) {
          console.log('[dry-run]   README/docs/ARCHITECTURE/CHANGELOG')
        }
        return
      }

      const written = applyVersionFiles(repoRoot, mode.target)
      const patched = patchLockfileWorkspaceVersions(repoRoot, mode.target)
      const lock = verifyLockfile(repoRoot)
      if (!lock.ok) {
        console.error('bun install --frozen-lockfile verification failed:')
        console.error(lock.output.trim())
        process.exitCode = 1
        return
      }
      console.log(`bumped ${current} -> ${mode.target}`)
      console.log(
        `lockfile synced (${patched} workspace version(s)) and verified (--frozen-lockfile)`,
      )
      if (mode.docs) {
        const changed = updateDocSurfaces(repoRoot, current, mode.target)
        if (changed.length > 0) {
          console.log('doc surfaces updated:')
          for (const file of changed) console.log(`  ${file}`)
        }
        const bundle = regenerateProtocolBundle(repoRoot)
        if (!bundle.ok) {
          console.error('protocol bundle regeneration failed:')
          console.error(bundle.output.trim())
          process.exitCode = 1
          return
        }
        console.log('protocol bundle regenerated')
      }
      console.log(`wrote ${written.length} enforced surface(s)`)
      return
    }
  }
}

if (import.meta.main) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
