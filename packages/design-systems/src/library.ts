import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  DEFAULT_DESIGN_SYSTEM_ID,
  designSystemManifestSchema,
  designSystemResourceSchema,
  type ActiveDesignSystem,
  type DesignSystemManifest,
  type DesignSystemResource,
  type DesignSystemScope,
} from './types'

const RESOURCE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function containedPath(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(candidate)
  const relative = path.relative(resolvedRoot, resolvedCandidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Design resource escapes approved root: ${candidate}`)
  }
  return resolvedCandidate
}

export function loadDesignManifest(manifestPath: string): DesignSystemManifest {
  const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const result = designSystemManifestSchema.safeParse(parsed)
  if (!result.success)
    throw new Error(`Invalid design-system manifest: ${result.error.message}`)
  if (
    result.data.rawCount !== result.data.admittedCount ||
    result.data.admittedCount !== result.data.resources.length
  ) {
    throw new Error('Design-system manifest count mismatch.')
  }
  return result.data
}

export function resolveEmbeddedDesignSystem(params: {
  skillRoot: string
  manifest: DesignSystemManifest
  id: string
}): DesignSystemResource {
  if (!RESOURCE_ID.test(params.id))
    throw new Error(`Invalid design-system id: ${params.id}`)
  const entry = params.manifest.resources.find(
    (resource) => resource.id === params.id,
  )
  if (!entry) throw new Error(`Design system not found: ${params.id}`)
  const resourcePath = containedPath(
    params.skillRoot,
    path.join(params.skillRoot, 'resources', `${params.id}.json`),
  )
  const parsed: unknown = JSON.parse(
    fs.readFileSync(resourcePath, 'utf8').split('\n\n---\n\n')[0] ?? '',
  )
  const result = designSystemResourceSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`Invalid design-system resource: ${result.error.message}`)
  }
  const resourceText = fs.readFileSync(resourcePath, 'utf8')
  const separator = '\n\n---\n\n'
  const separatorIndex = resourceText.indexOf(separator)
  const sourceContent =
    separatorIndex >= 0
      ? resourceText.slice(separatorIndex + separator.length)
      : undefined
  const sourceContentHash =
    sourceContent !== undefined
      ? createHash('sha256').update(sourceContent, 'utf8').digest('hex')
      : undefined
  if (
    result.data.id !== entry.id ||
    sourceContentHash !== entry.sourceContentHash ||
    result.data.normalizedContentHash !== entry.normalizedContentHash
  ) {
    throw new Error(
      `Design-system resource does not match manifest: ${params.id}`,
    )
  }
  return result.data
}

export function selectDesignSystem(params: {
  sessionId?: string
  projectId?: string
  userId?: string
  resolve: (id: string) => DesignSystemResource
  defaultId?: string
}): ActiveDesignSystem {
  const candidates: Array<{ id?: string; scope: DesignSystemScope }> = [
    { id: params.sessionId, scope: 'session' },
    { id: params.projectId, scope: 'project' },
    { id: params.userId, scope: 'user' },
    { id: params.defaultId ?? DEFAULT_DESIGN_SYSTEM_ID, scope: 'default' },
  ]
  for (const candidate of candidates) {
    if (!candidate.id) continue
    const resource = params.resolve(candidate.id)
    return { ...resource, selectionScope: candidate.scope }
  }
  throw new Error('No valid design system selection is available.')
}
