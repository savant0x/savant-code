import fs from 'node:fs'
import path from 'node:path'

import {
  normalizeDesignSystemSource,
  type DesignSystemResource,
} from '@savant-code/design-systems'

import { readCustomManifest, safeVersionPath } from './design-system-manifest'
import {
  canonicalContainedPath,
  canonicalExistingPath,
  customRoot,
  DESIGN_SYSTEM_ID,
  ensureRegularFile,
} from './design-system-roots'

export type { DesignSystemRevision } from './design-system-manifest'

function sourcePathFor(scope: 'project' | 'user', id: string): string {
  return `custom/${scope}/${id}.design.md`
}

function resolveManifestCustom(
  scope: 'project' | 'user',
  id: string,
): DesignSystemResource | undefined {
  const root = customRoot(scope)
  const entry = readCustomManifest(scope).entries.find((item) => item.id === id)
  if (!entry) return undefined
  const versionPath = safeVersionPath(root, entry.versionPath)
  if (!versionPath) {
    throw new Error(
      `Custom design-system version escapes its approved root: ${id}`,
    )
  }
  const rootCanonical = canonicalExistingPath(root)
  const versionCanonical = canonicalExistingPath(versionPath)
  const relative = path.relative(rootCanonical, versionCanonical)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `Custom design-system version escapes its approved root: ${id}`,
    )
  }
  if (!fs.existsSync(versionCanonical)) {
    throw new Error(`Custom design-system version is missing: ${id}`)
  }
  ensureRegularFile(versionCanonical)
  const verifiedVersionPath = safeVersionPath(rootCanonical, entry.versionPath)
  if (!verifiedVersionPath) {
    throw new Error(
      `Custom design-system version escapes its approved root: ${id}`,
    )
  }
  const verifiedCanonicalPath = canonicalContainedPath(
    rootCanonical,
    verifiedVersionPath,
  )
  ensureRegularFile(verifiedCanonicalPath)
  // Re-canonicalize immediately before reading so a junction/reparse-point
  // swap between validation and the read cannot redirect the source.
  const readPath = canonicalContainedPath(rootCanonical, verifiedCanonicalPath)
  ensureRegularFile(readPath)
  const sourceContent = fs.readFileSync(readPath, 'utf8')
  const resource = normalizeDesignSystemSource({
    sourceContent,
    sourcePath: sourcePathFor(scope, id),
    sourceRepository: entry.provenance.sourceRepository,
    sourceRevision: entry.provenance.sourceRevision,
    license: entry.provenance.license,
  })
  if (
    resource.sourceContentHash !== entry.sourceContentHash ||
    resource.normalizedContentHash !== entry.normalizedContentHash
  ) {
    throw new Error(`Custom design-system hash mismatch: ${id}`)
  }
  return {
    ...resource,
    contentPath: readPath,
    source: scope,
    status: 'custom',
    provenance: entry.provenance,
  }
}

function resolveLegacyCustom(
  scope: 'project' | 'user',
  id: string,
): DesignSystemResource | undefined {
  if (!DESIGN_SYSTEM_ID.test(id)) return undefined
  const root = customRoot(scope)
  const legacyPath = canonicalContainedPath(
    root,
    path.join(root, `${id}.design.md`),
  )
  if (!fs.existsSync(legacyPath)) return undefined
  ensureRegularFile(legacyPath)
  const readPath = canonicalContainedPath(root, legacyPath)
  ensureRegularFile(readPath)
  const resource = normalizeDesignSystemSource({
    sourceContent: fs.readFileSync(readPath, 'utf8'),
    sourcePath: sourcePathFor(scope, id),
    sourceRepository: 'local-custom',
    sourceRevision: 'legacy-working-tree',
    license: 'user-authored',
  })
  return {
    ...resource,
    contentPath: readPath,
    source: scope,
    status: 'custom',
  }
}

export function resolveCustomInScope(
  scope: 'project' | 'user',
  id: string,
): DesignSystemResource | undefined {
  return resolveManifestCustom(scope, id) ?? resolveLegacyCustom(scope, id)
}

export function listCustomDesignSystems(): DesignSystemResource[] {
  const resources: DesignSystemResource[] = []
  for (const scope of ['project', 'user'] as const) {
    const root = customRoot(scope)
    if (!fs.existsSync(root)) continue
    const ids = new Set(
      readCustomManifest(scope).entries.map((entry) => entry.id),
    )
    for (const file of fs.readdirSync(root)) {
      if (file.endsWith('.design.md'))
        ids.add(file.slice(0, -'.design.md'.length))
    }
    for (const id of [...ids].sort()) {
      try {
        const resource = resolveCustomInScope(scope, id)
        if (resource && !resources.some((item) => item.id === resource.id))
          resources.push(resource)
      } catch {
        // Corrupt custom resources are intentionally not selectable or listed as valid.
      }
    }
  }
  return resources
}
