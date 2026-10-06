/**
 * Project-trust store (FID-2026-1006-002 WP9).
 *
 * The persistence half of project-trust.ts: canonical directory keys,
 * closest-first ancestor chains, and the small JSON file under the Savant
 * home directory. A missing, unreadable or corrupt store resolves to
 * "nothing recorded" rather than throwing: an unreadable trust file must not
 * take the CLI down, and the fall-through to `ask` is already the safe
 * direction.
 *
 * Decision/decider semantics live in `project-trust.ts`, which re-exports
 * this module — one import path for consumers.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

/** A recorded decision for one directory. */
export type RecordedProjectTrust = 'trusted' | 'denied'

export const PROJECT_TRUST_STORE_VERSION = 1

export type ProjectTrustStore = {
  version: number
  /** Canonical directory key → recorded decision. */
  projects: Record<string, RecordedProjectTrust>
}

export function defaultProjectTrustStorePath(): string {
  return path.join(os.homedir(), '.savant-free', 'project-trust.json')
}

/**
 * Canonical key for a directory: symlinks resolved when the path exists, then
 * normalized, with a trailing separator removed — except at a filesystem root,
 * where the separator IS the path (`C:\`, `/`) and stripping it would produce a
 * key no ancestor walk can reach. Windows compares case-insensitively, so keys
 * are lowercased there — two spellings of one directory must share a key or
 * inheritance silently misses.
 */
export function canonicalTrustKey(directory: string): string {
  let resolved: string
  try {
    resolved = fs.realpathSync.native(directory)
  } catch {
    resolved = path.resolve(directory)
  }
  const normalized = path.normalize(resolved)
  const isRoot = normalized === path.parse(normalized).root
  const trimmed =
    !isRoot && normalized.length > 1 && normalized.endsWith(path.sep)
      ? normalized.slice(0, -1)
      : normalized
  return process.platform === 'win32' ? trimmed.toLowerCase() : trimmed
}

/**
 * Canonical keys of `directory` and each ancestor, NEAREST FIRST, ending at
 * the filesystem root. This is the inheritance order: the first key present in
 * the store wins.
 */
export function trustAncestry(directory: string): string[] {
  const chain: string[] = []
  let current = canonicalTrustKey(directory)
  for (;;) {
    chain.push(current)
    const parent = path.dirname(current)
    if (parent === current || parent === '') break
    current = process.platform === 'win32' ? parent.toLowerCase() : parent
    if (chain.includes(current)) break
  }
  return chain
}

/** Read the store. A missing or corrupt file reads as "nothing recorded". */
export function readProjectTrustStore(
  storePath: string = defaultProjectTrustStorePath(),
): ProjectTrustStore {
  const empty: ProjectTrustStore = {
    version: PROJECT_TRUST_STORE_VERSION,
    projects: {},
  }
  let raw: string
  try {
    raw = fs.readFileSync(storePath, 'utf8')
  } catch {
    return empty
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return empty
    const projects = (parsed as { projects?: unknown }).projects
    if (projects === null || typeof projects !== 'object') return empty
    const recorded: Record<string, RecordedProjectTrust> = {}
    for (const [key, value] of Object.entries(
      projects as Record<string, unknown>,
    )) {
      if (value === 'trusted' || value === 'denied') recorded[key] = value
    }
    return {
      version: PROJECT_TRUST_STORE_VERSION,
      projects: recorded,
    }
  } catch {
    // Corrupt store: resolve as if nothing were recorded rather than throwing.
    return empty
  }
}

export function writeProjectTrustStore(
  store: ProjectTrustStore,
  storePath: string = defaultProjectTrustStorePath(),
): void {
  fs.mkdirSync(path.dirname(storePath), { recursive: true })
  fs.writeFileSync(
    storePath,
    `${JSON.stringify(
      { version: PROJECT_TRUST_STORE_VERSION, projects: store.projects },
      null,
      2,
    )}\n`,
  )
}

/** Record a decision for one directory (canonicalized). */
export function setProjectTrust(
  directory: string,
  decision: RecordedProjectTrust,
  storePath: string = defaultProjectTrustStorePath(),
): ProjectTrustStore {
  const store = readProjectTrustStore(storePath)
  store.projects[canonicalTrustKey(directory)] = decision
  writeProjectTrustStore(store, storePath)
  return store
}

/** Forget a directory's recorded decision (its parent's then applies). */
export function clearProjectTrust(
  directory: string,
  storePath: string = defaultProjectTrustStorePath(),
): ProjectTrustStore {
  const store = readProjectTrustStore(storePath)
  delete store.projects[canonicalTrustKey(directory)]
  writeProjectTrustStore(store, storePath)
  return store
}

/**
 * Nearest-first lookup of the first ancestor carrying a real decision.
 * Shared with the resolution chain in `project-trust.ts`.
 */
export function recordedFor(
  ancestry: readonly string[],
  store: ProjectTrustStore,
): { decision: RecordedProjectTrust; key: string } | undefined {
  for (const key of ancestry) {
    const recorded = store.projects[key]
    if (recorded !== undefined) return { decision: recorded, key }
  }
  return undefined
}
