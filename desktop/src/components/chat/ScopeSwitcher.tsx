import { memo } from 'react'

import type { WorkspaceScope } from '../../state/workspace-scope'
import type { JSX } from 'react'

export const ScopeSwitcher = memo(function ScopeSwitcher({
  scope,
  onToggle,
}: {
  scope: WorkspaceScope
  onToggle(): void
}): JSX.Element {
  return (
    <button
      className="scope-switcher"
      type="button"
      aria-label={`Switch workspace scope, currently ${scope.label}`}
      onClick={onToggle}
    >
      <span className="scope-switcher-kind">
        {scope.type === 'project' ? 'Project' : 'Fleet'}
      </span>
      <span className="scope-switcher-label">{scope.label}</span>
    </button>
  )
})
