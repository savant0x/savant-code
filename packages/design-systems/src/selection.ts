import { getDefaultDesignSystemResource } from './default'
import {
  DEFAULT_DESIGN_SYSTEM_ID,
  type ActiveDesignSystem,
  type DesignSystemResource,
  type DesignSystemScope,
} from './types'

export type DesignSystemSelection = {
  session?: string
  project?: string
  user?: string
}

export type DesignSystemResolver = (
  id: string,
) => DesignSystemResource | undefined

export type ScopedDesignSystemResolver = (
  scope: DesignSystemScope,
  id: string,
) => DesignSystemResource | undefined

/**
 * Resolve one active contract using session > project > user > native default.
 * A configured but invalid selection fails closed instead of falling through.
 */
export function resolveActiveDesignSystem(params: {
  selection?: DesignSystemSelection
  resolve: DesignSystemResolver
  resolveScoped?: ScopedDesignSystemResolver
  defaultResource?: DesignSystemResource
}): ActiveDesignSystem {
  const configured: Array<{ scope: DesignSystemScope; id?: string }> = [
    { scope: 'session', id: params.selection?.session },
    { scope: 'project', id: params.selection?.project },
    { scope: 'user', id: params.selection?.user },
  ]
  for (const candidate of configured) {
    if (!candidate.id) continue
    const resource = params.resolveScoped
      ? params.resolveScoped(candidate.scope, candidate.id)
      : params.resolve(candidate.id)
    if (!resource) {
      throw new Error(
        `Configured ${candidate.scope} design system is invalid or unavailable: ${candidate.id}`,
      )
    }
    return { ...resource, selectionScope: candidate.scope }
  }
  const defaultResource =
    params.defaultResource ?? getDefaultDesignSystemResource()
  if (defaultResource.id !== DEFAULT_DESIGN_SYSTEM_ID) {
    throw new Error(`Invalid design-system default: ${defaultResource.id}`)
  }
  return { ...defaultResource, selectionScope: 'default' }
}
