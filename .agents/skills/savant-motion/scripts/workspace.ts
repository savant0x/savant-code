#!/usr/bin/env bun
/**
 * savant-motion workspace resolution and seeding.
 *
 * Resolution order (first hit wins):
 *   1. SAVANT_MOTION_HOME environment variable
 *   2. nearest `.motion.json` walking up from cwd, { "workspace": "path" }
 *   3. `<project-root>/motion/` where project root is the nearest ancestor
 *      holding a `.git`, else cwd
 *
 * Usage:
 *   bun run .agents/skills/savant-motion/scripts/workspace.ts [--ensure] [--json] [--force]
 *
 * `--ensure` creates builds/, verify/, and an empty registry.json when absent.
 * It refuses to seed into a non-empty workspace without `--force`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const REGISTRY_VERSION = 1

export interface WorkspaceInfo {
  root: string
  buildsDir: string
  verifyDir: string
  registryPath: string
}

export interface RegistryFile {
  schemaVersion: number
  rows: unknown[]
}

function hasProjectMarker(dir: string): boolean {
  return existsSync(path.join(dir, '.git'))
}

/** Nearest ancestor (or start dir) containing a .git marker; falls back to start. */
export function findProjectRoot(startDir: string): string {
  let current = path.resolve(startDir)
  for (;;) {
    if (hasProjectMarker(current)) return current
    const parent = path.dirname(current)
    if (parent === current) return path.resolve(startDir)
    current = parent
  }
}

function readMotionConfig(startDir: string): string | undefined {
  let current = path.resolve(startDir)
  for (;;) {
    const candidate = path.join(current, '.motion.json')
    if (existsSync(candidate)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(candidate, 'utf8'))
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          'workspace' in parsed &&
          typeof (parsed as { workspace: unknown }).workspace === 'string'
        ) {
          return path.resolve(
            current,
            (parsed as { workspace: string }).workspace,
          )
        }
      } catch {
        // Malformed config files are skipped, mirroring upstream resolution.
      }
    }
    const parent = path.dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

/** Resolve the savant-motion workspace without creating anything. */
export function resolveWorkspace(cwd = process.cwd()): WorkspaceInfo {
  const envHome = process.env.SAVANT_MOTION_HOME
  const configured = readMotionConfig(cwd)
  const root =
    envHome !== undefined && envHome.length > 0
      ? path.resolve(envHome)
      : (configured ?? path.join(findProjectRoot(cwd), 'motion'))
  return {
    root,
    buildsDir: path.join(root, 'builds'),
    verifyDir: path.join(root, 'verify'),
    registryPath: path.join(root, 'registry.json'),
  }
}

export function emptyRegistry(): RegistryFile {
  return { schemaVersion: REGISTRY_VERSION, rows: [] }
}

export function loadRegistry(registryPath: string): RegistryFile {
  if (!existsSync(registryPath)) return emptyRegistry()
  try {
    const parsed: unknown = JSON.parse(readFileSync(registryPath, 'utf8'))
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'rows' in parsed &&
      Array.isArray((parsed as { rows: unknown }).rows)
    ) {
      const file = parsed as RegistryFile
      return {
        schemaVersion: file.schemaVersion ?? REGISTRY_VERSION,
        rows: file.rows,
      }
    }
  } catch {
    // Fall through to a fresh registry; gate.ts validates row shapes itself.
  }
  return emptyRegistry()
}

export interface EnsureResult {
  workspace: WorkspaceInfo
  createdDirs: string[]
  seededRegistry: boolean
}

/** Create the workspace skeleton; refuse a populated workspace unless forced. */
export function ensureWorkspace(
  force = false,
  cwd = process.cwd(),
): EnsureResult {
  const workspace = resolveWorkspace(cwd)
  const createdDirs: string[] = []
  const existingContent = existsSync(workspace.root)
    ? existsSync(workspace.buildsDir) ||
      existsSync(workspace.verifyDir) ||
      existsSync(workspace.registryPath)
    : false
  if (existingContent && !force) {
    throw new Error(
      `workspace ${workspace.root} already contains motion state; pass --force to seed anyway`,
    )
  }
  for (const dir of [
    workspace.root,
    workspace.buildsDir,
    workspace.verifyDir,
  ]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
      createdDirs.push(dir)
    }
  }
  let seededRegistry = false
  if (!existsSync(workspace.registryPath)) {
    writeFileSync(
      workspace.registryPath,
      `${JSON.stringify(emptyRegistry(), null, 2)}\n`,
    )
    seededRegistry = true
  }
  return { workspace, createdDirs, seededRegistry }
}

function main(): void {
  const args = new Set(process.argv.slice(2))
  const json = args.has('--json')
  if (args.has('--ensure')) {
    const result = ensureWorkspace(args.has('--force'))
    if (json) {
      console.log(
        JSON.stringify({
          root: result.workspace.root,
          createdDirs: result.createdDirs,
          seededRegistry: result.seededRegistry,
        }),
      )
    } else {
      console.log(`workspace: ${result.workspace.root}`)
      console.log(`builds:    ${result.workspace.buildsDir}`)
      console.log(`registry:  ${result.workspace.registryPath}`)
      if (result.seededRegistry)
        console.log('registry seeded empty (that is correct)')
    }
    return
  }
  const info = resolveWorkspace()
  if (json) {
    console.log(
      JSON.stringify({ root: info.root, registry: info.registryPath }),
    )
    return
  }
  console.log(`workspace: ${info.root}`)
  console.log(
    `registry:  ${info.registryPath}${existsSync(info.registryPath) ? '' : ' (absent)'}`,
  )
}

if (import.meta.main) main()
