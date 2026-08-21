import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  designSystemProvenanceSchema,
  type DesignSystemResource,
} from '@savant-code/design-systems'

import { customRoot, DESIGN_SYSTEM_ID } from './design-system-roots'

export const CUSTOM_MANIFEST_VERSION = 1
export const CUSTOM_MANIFEST_FILE = 'manifest.json'
export const CUSTOM_JOURNAL_FILE = 'manifest.commit.json'

export function customManifestPath(scope: 'project' | 'user'): string {
  return path.join(customRoot(scope), CUSTOM_MANIFEST_FILE)
}

export function customJournalPath(scope: 'project' | 'user'): string {
  return path.join(customRoot(scope), CUSTOM_JOURNAL_FILE)
}

const VERSION_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-f0-9]{64}\.design\.md$/

interface PendingCommit {
  id: string
  versionPath: string
  sourceContentHash: string
  manifestHash: string
  createdVersion: boolean
}

function isPendingCommit(value: unknown): value is PendingCommit {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PendingCommit>
  return (
    typeof candidate.id === 'string' &&
    DESIGN_SYSTEM_ID.test(candidate.id) &&
    typeof candidate.versionPath === 'string' &&
    VERSION_FILE.test(candidate.versionPath) &&
    typeof candidate.sourceContentHash === 'string' &&
    /^[a-f0-9]{64}$/.test(candidate.sourceContentHash) &&
    typeof candidate.manifestHash === 'string' &&
    /^[a-f0-9]{64}$/.test(candidate.manifestHash) &&
    typeof candidate.createdVersion === 'boolean' &&
    candidate.versionPath ===
      `${candidate.id}.${candidate.sourceContentHash}.design.md`
  )
}

export function safeVersionPath(
  root: string,
  versionPath: string,
): string | undefined {
  if (!VERSION_FILE.test(versionPath)) return undefined
  const candidate = path.resolve(root, versionPath)
  const relative = path.relative(path.resolve(root), candidate)
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? undefined
    : candidate
}

export function reconcilePendingCommit(scope: 'project' | 'user'): void {
  const journalPath = customJournalPath(scope)
  if (!fs.existsSync(journalPath)) return

  let journal: PendingCommit
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
    if (!isPendingCommit(parsed)) throw new Error('journal schema is invalid')
    journal = parsed
  } catch (error) {
    // Preserve malformed evidence under a non-authoritative name and surface a
    // repairable error instead of deleting it or silently ignoring corruption.
    const quarantined = `${journalPath}.corrupt.${Date.now()}`
    fs.renameSync(journalPath, quarantined)
    throw new Error(
      `Design-system commit journal is corrupt and was quarantined at ${quarantined}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const manifestPath = customManifestPath(scope)
  const manifestCommitted =
    fs.existsSync(manifestPath) &&
    sha256(fs.readFileSync(manifestPath, 'utf8')) === journal.manifestHash
  if (manifestCommitted) {
    let committed = false
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (parsed && typeof parsed === 'object') {
        const entries = (parsed as { entries?: unknown }).entries
        if (Array.isArray(entries)) {
          committed = entries.some((entry) => {
            if (!entry || typeof entry !== 'object') return false
            const candidate = entry as Partial<CustomManifestEntry>
            return (
              candidate.id === journal.id &&
              candidate.versionPath === journal.versionPath &&
              candidate.sourceContentHash === journal.sourceContentHash
            )
          })
        }
      }
    } catch {
      committed = false
    }
    // The manifest is the commit point only when its bytes and matching entry
    // both prove this exact journaled transaction completed.
    if (committed) {
      fs.rmSync(journalPath, { force: true })
      return
    }
  }

  // The manifest is still the last known-good state. Retain every orphaned
  // version for explicit repair: a journal is not sufficient authority to
  // delete any user-authored revision, even when its fields are internally
  // consistent. Clearing the marker cannot activate an invalid file.
  fs.rmSync(journalPath, { force: true })
}

export interface CustomManifestEntry {
  id: string
  versionPath: string
  sourceContentHash: string
  normalizedContentHash: string
  provenance: DesignSystemResource['provenance']
}

export interface DesignSystemRevision {
  id: string
  scope: 'project' | 'user'
  previousSourceContentHash?: string
  sourceContentHash: string
  normalizedContentHash: string
  valid: true
  timestamp: string
}

interface CustomManifest {
  version: 1
  entries: CustomManifestEntry[]
  revisions: DesignSystemRevision[]
}

function reconcileCustomArtifacts(
  scope: 'project' | 'user',
  manifest: CustomManifest,
): void {
  const root = customRoot(scope)
  const retained = new Set([
    ...manifest.entries.map((entry) => entry.versionPath),
    ...manifest.revisions
      .filter((revision) =>
        VERSION_FILE.test(
          `${revision.id}.${revision.sourceContentHash}.design.md`,
        ),
      )
      .map(
        (revision) => `${revision.id}.${revision.sourceContentHash}.design.md`,
      ),
  ])
  for (const name of fs.readdirSync(root, { withFileTypes: true })) {
    if (name.isDirectory()) continue
    if (name.name.endsWith('.tmp')) {
      fs.rmSync(path.join(root, name.name), { force: true })
      continue
    }
    // Unreferenced version files are retained for explicit repair. Automatic
    // startup cleanup must never delete a user-authored revision merely
    // because a manifest or journal is incomplete.
    if (
      /^.+\.([a-f0-9]{64})\.design\.md$/i.test(name.name) &&
      !retained.has(name.name)
    ) {
      continue
    }
  }
}

export function readCustomManifest(scope: 'project' | 'user'): CustomManifest {
  fs.mkdirSync(customRoot(scope), { recursive: true })
  reconcilePendingCommit(scope)
  const manifestPath = customManifestPath(scope)
  if (!fs.existsSync(manifestPath))
    return { version: CUSTOM_MANIFEST_VERSION, entries: [], revisions: [] }
  try {
    const parsed = JSON.parse(
      fs.readFileSync(manifestPath, 'utf8'),
    ) as Partial<CustomManifest>
    if (
      parsed.version !== CUSTOM_MANIFEST_VERSION ||
      !Array.isArray(parsed.entries)
    ) {
      throw new Error(
        'Invalid custom design-system manifest version or entries.',
      )
    }
    const revisions = Array.isArray(parsed.revisions)
      ? parsed.revisions.filter(
          (revision): revision is DesignSystemRevision =>
            Boolean(revision) &&
            typeof revision.id === 'string' &&
            (revision.scope === 'project' || revision.scope === 'user') &&
            typeof revision.sourceContentHash === 'string' &&
            typeof revision.normalizedContentHash === 'string' &&
            revision.valid === true &&
            typeof revision.timestamp === 'string',
        )
      : []
    const entries = parsed.entries.flatMap((entry): CustomManifestEntry[] => {
      if (
        !entry ||
        typeof entry.id !== 'string' ||
        !DESIGN_SYSTEM_ID.test(entry.id) ||
        typeof entry.versionPath !== 'string' ||
        !safeVersionPath(customRoot(scope), entry.versionPath) ||
        typeof entry.sourceContentHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(entry.sourceContentHash) ||
        typeof entry.normalizedContentHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(entry.normalizedContentHash)
      ) {
        throw new Error('Custom manifest contains an invalid resource entry.')
      }
      const provenance = designSystemProvenanceSchema.safeParse(
        entry.provenance,
      )
      if (!provenance.success) {
        throw new Error(
          `Custom manifest provenance is invalid for ${entry.id}.`,
        )
      }
      return [
        {
          id: entry.id,
          versionPath: entry.versionPath,
          sourceContentHash: entry.sourceContentHash,
          normalizedContentHash: entry.normalizedContentHash,
          provenance: provenance.data,
        },
      ]
    })
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
      throw new Error('Custom manifest contains duplicate design-system IDs.')
    }
    const result: CustomManifest = {
      version: CUSTOM_MANIFEST_VERSION,
      entries,
      revisions,
    }
    reconcileCustomArtifacts(scope, result)
    return result
  } catch (error) {
    throw new Error(
      `Invalid ${scope} design-system manifest: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
