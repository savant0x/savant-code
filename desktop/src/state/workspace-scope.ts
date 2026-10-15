export type WorkspaceScopeType = 'project' | 'global'

export type WorkspaceScope =
  | { type: 'project'; id: string; label: string }
  | { type: 'global'; id: 'fleet'; label: string }

export function projectWorkspaceScope(
  projectId = 'current-project',
): WorkspaceScope {
  return {
    type: 'project',
    id: projectId,
    label: projectId === 'current-project' ? 'Current project' : projectId,
  }
}

export const DEFAULT_WORKSPACE_SCOPE = projectWorkspaceScope()

export function nextWorkspaceScope(
  scope: WorkspaceScope,
  projectId = DEFAULT_WORKSPACE_SCOPE.id,
): WorkspaceScope {
  return scope.type === 'project'
    ? { type: 'global', id: 'fleet', label: 'Global fleet' }
    : projectWorkspaceScope(projectId)
}
