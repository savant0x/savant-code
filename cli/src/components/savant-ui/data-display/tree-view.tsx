import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface TreeViewNode {
  label: string
  children?: TreeViewNode[]
  expanded?: boolean
}

export interface TreeViewProps {
  nodes: TreeViewNode[]
  defaultExpanded?: boolean
  level?: number
}

export function TreeView({
  nodes,
  defaultExpanded = false,
  level = 0,
}: TreeViewProps) {
  const theme = useTheme()

  return (
    <box flexDirection="column">
      {nodes.map((node, i) => {
        const isLast = i === nodes.length - 1
        const prefix = level === 0 ? '' : isLast ? '└─ ' : '├─ '
        const hasChildren = node.children && node.children.length > 0
        const icon = hasChildren
          ? (node.expanded ?? defaultExpanded)
            ? '▼ '
            : '▶ '
          : '  '

        return (
          <box key={i} flexDirection="column">
            <text fg={theme.foreground}>
              {prefix}
              {icon}
              {node.label}
            </text>
            {hasChildren && (node.expanded ?? defaultExpanded) && (
              <TreeView
                nodes={node.children!}
                defaultExpanded={defaultExpanded}
                level={level + 1}
              />
            )}
          </box>
        )
      })}
    </box>
  )
}
