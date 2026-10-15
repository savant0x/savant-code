import fs from 'node:fs'
import path from 'node:path'

import {
  normalizeDesignSystemSource,
  validateDesignAuthoringInput,
  type DesignAuthoringInputV1,
  type DesignSystemResource,
} from '@savant-code/design-systems'

import {
  CUSTOM_MANIFEST_VERSION,
  customJournalPath,
  customManifestPath,
  readCustomManifest,
  reconcilePendingCommit,
  sha256,
} from './design-system-manifest'
import {
  canonicalExistingPath,
  customRoot,
  ensureRegularFile,
} from './design-system-roots'
import { setDesignSystemSelection } from './design-system-selection'
import { writeFileAtomic } from './write-file-atomic'

export function importCustomDesignSystem(
  sourcePath: string,
  scope: 'project' | 'user',
  activate: boolean,
): DesignSystemResource {
  const resolved = canonicalExistingPath(sourcePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`Design-system source file not found: ${sourcePath}`)
  }
  ensureRegularFile(resolved)
  const source = fs.readFileSync(resolved, 'utf8')
  const normalized = normalizeDesignSystemSource({
    sourceContent: source,
    sourcePath: `imports/${path.basename(resolved)}`,
    sourceRepository: 'user-import',
    sourceRevision: 'imported-working-tree',
    license: 'user-provided',
  })
  const input: DesignAuthoringInputV1 = {
    schemaVersion: '1',
    id: normalized.id,
    displayName: normalized.displayName,
    description: normalized.description,
    scope,
    targets: normalized.targets,
    colors: normalized.tokens.colors,
    typography: normalized.tokens.typography,
    spacing: normalized.tokens.spacing,
    radius: normalized.tokens.radius,
    components: normalized.tokens.components,
    accessibility: {},
    activate,
    provenance: {
      ...normalized.provenance,
      sourcePath: resolved,
    },
  }
  return saveCustomDesignSystem(input)
}

export function saveCustomDesignSystem(
  input: DesignAuthoringInputV1,
): DesignSystemResource {
  const result = validateDesignAuthoringInput(input)
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`)
  const root = customRoot(input.scope)
  fs.mkdirSync(root, { recursive: true })
  const sourceHash = result.resource.sourceContentHash
  const versionPath = `${input.id}.${sourceHash}.design.md`
  const destination = path.join(root, versionPath)
  const current = readCustomManifest(input.scope)
  const previous = current.entries.find((entry) => entry.id === input.id)
  const createdVersion = !fs.existsSync(destination)
  const entries = current.entries.filter((entry) => entry.id !== input.id)
  entries.push({
    id: input.id,
    versionPath,
    sourceContentHash: result.resource.sourceContentHash,
    normalizedContentHash: result.resource.normalizedContentHash,
    provenance: result.resource.provenance,
  })
  entries.sort((left, right) => left.id.localeCompare(right.id))
  const revisions = [
    ...current.revisions,
    {
      id: input.id,
      scope: input.scope,
      ...(previous
        ? { previousSourceContentHash: previous.sourceContentHash }
        : {}),
      sourceContentHash: result.resource.sourceContentHash,
      normalizedContentHash: result.resource.normalizedContentHash,
      valid: true as const,
      timestamp: new Date().toISOString(),
    },
  ]
  const manifestContent = `${JSON.stringify({ version: CUSTOM_MANIFEST_VERSION, entries, revisions }, null, 2)}\n`
  // Journal the intended commit before writing either artifact. The manifest
  // hash lets startup distinguish a committed transaction from an interrupted
  // one; createdVersion prevents cleanup from deleting a pre-existing revision.
  writeFileAtomic(
    customJournalPath(input.scope),
    `${JSON.stringify(
      {
        id: input.id,
        versionPath,
        sourceContentHash: result.resource.sourceContentHash,
        manifestHash: sha256(manifestContent),
        createdVersion,
      },
      null,
      2,
    )}\n`,
  )
  try {
    if (createdVersion) writeFileAtomic(destination, result.source)
    writeFileAtomic(customManifestPath(input.scope), manifestContent)
    // The manifest rename is the commit point. The journal is intentionally
    // cleared only after that durable rename succeeds.
  } catch (error) {
    reconcilePendingCommit(input.scope)
    throw error
  }
  fs.rmSync(customJournalPath(input.scope), { force: true })
  const resource = {
    ...result.resource,
    contentPath: destination,
    source: input.scope,
    status: 'custom' as const,
  }
  if (input.activate) setDesignSystemSelection(input.scope, input.id)
  return resource
}
