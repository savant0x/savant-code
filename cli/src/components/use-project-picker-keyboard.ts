import { useCallback } from 'react'

import { usePathTabCompletion } from '../hooks/use-path-tab-completion'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { SelectableListItem } from './selectable-list'
import type { DirectoryEntry } from '../utils/directory-browser'

interface ProjectPickerKeyboardOptions {
  searchQuery: string
  setSearchQuery: (query: string) => void
  currentPath: string
  setCurrentPath: (path: string) => void
  expandPath: (inputPath: string) => string
  setFocusedIndex: React.Dispatch<React.SetStateAction<number>>
  filteredItems: SelectableListItem[]
  focusedIndex: number
  tryNavigateToPath: (path: string) => boolean
  directories: DirectoryEntry[]
  navigateToDirectory: (entry: DirectoryEntry) => void
}

/**
 * Keyboard intercept for the project-picker search input. Returns the
 * `onKeyIntercept` handler wired to tab completion, directory navigation,
 * focus movement, and process exit on Ctrl+C.
 */
export function useProjectPickerKeyboard(
  options: ProjectPickerKeyboardOptions,
) {
  const {
    searchQuery,
    setSearchQuery,
    currentPath,
    setCurrentPath,
    expandPath,
    setFocusedIndex,
    filteredItems,
    focusedIndex,
    tryNavigateToPath,
    directories,
    navigateToDirectory,
  } = options

  const { handleTabCompletion } = usePathTabCompletion({
    searchQuery,
    setSearchQuery,
    currentPath,
    setCurrentPath,
    expandPath,
  })

  const handleSearchKeyIntercept = useCallback(
    (key: {
      name?: string
      sequence?: string
      shift?: boolean
      ctrl?: boolean
      meta?: boolean
      option?: boolean
    }) => {
      if (key.name === 'escape') {
        if (searchQuery.length > 0) {
          setSearchQuery('')
        }
        return true
      }
      if (key.name === 'tab') {
        return handleTabCompletion()
      }
      if (key.name === 'up') {
        setFocusedIndex((prev) => Math.max(0, prev - 1))
        return true
      }
      if (key.name === 'down') {
        setFocusedIndex((prev) => Math.min(filteredItems.length - 1, prev + 1))
        return true
      }
      if (isPlainEnterKey(key)) {
        // If search looks like a path, try to navigate there directly
        if (searchQuery.startsWith('/') || searchQuery.startsWith('~')) {
          if (tryNavigateToPath(searchQuery)) {
            return true
          }
        }
        // Otherwise, navigate to the focused directory
        const focused = filteredItems[focusedIndex]
        if (focused) {
          const entry = directories.find((d) => d.path === focused.id)
          if (entry) {
            navigateToDirectory(entry)
          }
        }
        return true
      }
      // Ctrl+C always quits
      if (key.name === 'c' && key.ctrl) {
        process.exit(0)
        return true
      }
      // All other single-character keys should go to the input for typing
      return false
    },
    [
      searchQuery,
      setSearchQuery,
      handleTabCompletion,
      setFocusedIndex,
      filteredItems,
      focusedIndex,
      tryNavigateToPath,
      directories,
      navigateToDirectory,
    ],
  )

  return handleSearchKeyIntercept
}
