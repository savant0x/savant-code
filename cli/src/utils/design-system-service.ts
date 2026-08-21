import fs from 'node:fs'
import path from 'node:path'

import {
  BUILT_IN_DESIGN_SYSTEM_COUNT,
  clearDesignDraft,
  discardDesignDraft,
  getDesignDraft,
  listDesignDrafts,
  normalizeDesignSystemSource,
  saveDesignDraft,
  type DesignAuthoringInputV1,
  type DesignSystemResource,
} from '@savant-code/design-systems'

import {
  canonicalContainedPath,
  customRoot,
  ensureRegularFile,
} from './design-system-roots'
import {
  resolveBuiltIn,
  resolveDesignSystemInScope,
} from './design-system-selection'

// Re-export the full public surface from the original path (consumers
// unchanged): resolution, selection, drafts, and the revision contract.
export type { DesignSystemRevision } from './design-system-manifest'
export {
  listDesignSystems,
  resolveDesignSystem,
} from './design-system-selection'
export {
  getDesignSystemSelection,
  setDesignSystemSelection,
  resetDesignSystemSelection,
  resolveCurrentDesignSystem,
  getActiveDesignContract,
  validateDesignInput,
  resolveDesignSystemInScope,
} from './design-system-selection'

export function resolveDesignSystemReference(
  value: string,
  scope: 'project' | 'user' = 'project',
): DesignSystemResource | undefined {
  const byId = resolveDesignSystemInScope(scope, value) ?? resolveBuiltIn(value)
  if (byId) return byId
  const root = customRoot(scope)
  const candidate = canonicalContainedPath(root, value)
  if (!fs.existsSync(candidate)) return undefined
  ensureRegularFile(candidate)
  // Path references are restricted to the approved custom root and checked
  // again immediately before reading to resist reparse-point replacement.
  const readPath = canonicalContainedPath(root, candidate)
  ensureRegularFile(readPath)
  const parsed = normalizeDesignSystemSource({
    sourceContent: fs.readFileSync(readPath, 'utf8'),
    sourcePath: `references/${path.basename(readPath)}`,
    sourceRepository: 'path-reference',
    sourceRevision: 'working-tree',
    license: 'user-provided',
  })
  return {
    ...parsed,
    source: scope,
    status: 'custom',
    contentPath: readPath,
    provenance: {
      ...parsed.provenance,
      sourcePath: readPath,
    },
  }
}

export function designDraftRoot(scope: 'project' | 'user'): string {
  return customRoot(scope)
}

export function listCustomDesignDrafts(scope: 'project' | 'user') {
  return listDesignDrafts(designDraftRoot(scope))
}

export function saveCustomDesignDraft(
  scope: 'project' | 'user',
  input: DesignAuthoringInputV1,
  draftId?: string,
) {
  return saveDesignDraft(designDraftRoot(scope), input, draftId)
}

export function getCustomDesignDraft(
  scope: 'project' | 'user',
  draftId: string,
) {
  return getDesignDraft(designDraftRoot(scope), draftId)
}

export function discardCustomDesignDraft(
  scope: 'project' | 'user',
  draftId: string,
): boolean {
  return discardDesignDraft(designDraftRoot(scope), draftId)
}

export function clearCustomDesignDraft(
  scope: 'project' | 'user',
  draftId: string,
): void {
  clearDesignDraft(designDraftRoot(scope), draftId)
}

export {
  importCustomDesignSystem,
  saveCustomDesignSystem,
} from './design-system-write'

export const DESIGN_SYSTEM_BUILT_IN_COUNT = BUILT_IN_DESIGN_SYSTEM_COUNT
