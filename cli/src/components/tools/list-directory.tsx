import React from 'react'

import { SimpleToolCallItem } from './tool-call-item'
import { defineToolComponent, getString, isJSONObject } from './types'
import { useTheme } from '../../hooks/use-theme'

import type { ToolRenderConfig } from './types'

/**
 * UI component for list_directory tool.
 * Displays a single line showing the directories being listed.
 * Does not support expand/collapse - always shows as a single line.
 */
export const ListDirectoryComponent = defineToolComponent({
  toolName: 'list_directory',

  render(toolBlock): ToolRenderConfig {
    const input = toolBlock.input

    // Extract directories from input
    let directories: string[] = []

    const rawDirectories = input?.directories
    if (Array.isArray(rawDirectories)) {
      directories = rawDirectories
        .map((dir) => {
          if (isJSONObject(dir) && typeof dir.path === 'string') {
            return dir.path
          }
          return dir
        })
        .filter(
          (path): path is string =>
            typeof path === 'string' && path.trim().length > 0,
        )
    } else {
      const singlePath = getString(input, 'path')
      if (singlePath && singlePath.trim().length > 0) {
        directories = [singlePath.trim()]
      }
    }

    if (directories.length === 0) {
      return { content: null }
    }

    // Format directory list
    const description = directories.join(', ')

    // Use a wrapper component to access theme
    const ListDirectoryContent = () => {
      const theme = useTheme()
      return (
        <SimpleToolCallItem
          name="List"
          description={description}
          descriptionColor={theme.directory}
        />
      )
    }

    return {
      content: <ListDirectoryContent />,
    }
  },
})
