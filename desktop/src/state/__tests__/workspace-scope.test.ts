import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_WORKSPACE_SCOPE,
  nextWorkspaceScope,
  projectWorkspaceScope,
} from '../workspace-scope'

describe('workspace scope', () => {
  test('uses the gateway project identity for Project scope', () => {
    expect(projectWorkspaceScope('repo-a')).toEqual({
      type: 'project',
      id: 'repo-a',
      label: 'repo-a',
    })
  })

  test('toggles between project and global fleet scopes', () => {
    const fleet = nextWorkspaceScope(DEFAULT_WORKSPACE_SCOPE)
    expect(fleet).toEqual({
      type: 'global',
      id: 'fleet',
      label: 'Global fleet',
    })
    expect(nextWorkspaceScope(fleet)).toEqual(DEFAULT_WORKSPACE_SCOPE)
  })
})
