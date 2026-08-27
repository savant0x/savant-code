import os from 'os'

import React, { useCallback, useMemo } from 'react'

import { Button } from './button'
import { MultilineInput } from './multiline-input'
import { computeProjectPickerLayout, LAYOUT } from './project-picker-layout'
import { ProjectPickerRecents } from './project-picker-recents'
import { SelectableList } from './selectable-list'
import { useProjectPickerKeyboard } from './use-project-picker-keyboard'
import { useDirectoryBrowser } from '../hooks/use-directory-browser'
import { useLogo } from '../hooks/use-logo'
import { useSearchableList } from '../hooks/use-searchable-list'
import { useTerminalLayout } from '../hooks/use-terminal-layout'
import { useTheme } from '../hooks/use-theme'
import { formatCwd } from '../utils/path-helpers'
import { loadRecentProjects } from '../utils/recent-projects'

import type { SelectableListItem } from './selectable-list'

interface ProjectPickerScreenProps {
  /** Called when user selects a directory to open as project */
  onSelectProject: (projectPath: string) => void
  /** Initial path to browse from */
  initialPath?: string
}

export const ProjectPickerScreen: React.FC<ProjectPickerScreenProps> = ({
  onSelectProject,
  initialPath,
}) => {
  const theme = useTheme()

  const {
    currentPath,
    setCurrentPath,
    directories,
    expandPath,
    tryNavigateToPath,
    navigateToDirectory,
  } = useDirectoryBrowser({ initialPath })

  const directoryItems: SelectableListItem[] = useMemo(
    () =>
      directories.map((entry) => ({
        id: entry.path,
        label: entry.name,
        icon: entry.isParent ? '📂' : '📁',
        accent: entry.isGitRepo,
      })),
    [directories],
  )

  const {
    searchQuery,
    setSearchQuery,
    focusedIndex,
    setFocusedIndex,
    filteredItems: filteredDirectoryItems,
    handleFocusChange,
  } = useSearchableList({
    items: directoryItems,
    resetKey: currentPath,
  })

  const recentProjects = useMemo(() => {
    const homeDir = os.homedir()
    return loadRecentProjects().filter((project) => project.path !== homeDir)
  }, [])

  const { terminalWidth, terminalHeight } = useTerminalLayout()
  const {
    contentMaxWidth,
    contentWidth,
    isCompactMode,
    mainPadding,
    canShowFilePicker,
    maxListHeight,
    canShowLogo,
    canShowHelpText,
    canShowRecents,
    maxRecentsToShow,
    shouldCenterContent,
  } = computeProjectPickerLayout(
    terminalWidth,
    terminalHeight,
    recentProjects.length,
  )

  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
    // No applySheenToChar — static logo, no animation
    textColor: theme.foreground,
  })

  const handleDirectorySelect = useCallback(
    (item: SelectableListItem) => {
      const entry = directories.find((d) => d.path === item.id)
      if (entry) {
        navigateToDirectory(entry)
      }
    },
    [directories, navigateToDirectory],
  )

  const selectCurrentDirectory = useCallback(() => {
    onSelectProject(currentPath)
  }, [currentPath, onSelectProject])

  const handleSearchKeyIntercept = useProjectPickerKeyboard({
    searchQuery,
    setSearchQuery,
    currentPath,
    setCurrentPath,
    expandPath,
    setFocusedIndex,
    filteredItems: filteredDirectoryItems,
    focusedIndex,
    tryNavigateToPath,
    directories,
    navigateToDirectory,
  })

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.surface,
        padding: 0,
        flexDirection: 'column',
      }}
    >
      {/* Main content area - fills available space */}
      <box
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: shouldCenterContent ? 'center' : 'flex-start',
          width: '100%',
          padding: mainPadding,
          gap: isCompactMode ? 0 : 1,
          flexGrow: 1,
          flexShrink: 1,
        }}
      >
        {/* Logo - show when there's enough space after essentials */}
        {canShowLogo && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              marginTop: isCompactMode ? 0 : LAYOUT.LOGO_MARGIN_TOP,
              marginBottom: isCompactMode ? 0 : LAYOUT.LOGO_MARGIN_BOTTOM,
              flexShrink: 0,
            }}
          >
            <box style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              {logoComponent}
            </box>
          </box>
        )}

        {/* Help text - show only when there's plenty of space */}
        {canShowHelpText && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: contentMaxWidth,
              marginBottom: isCompactMode ? 0 : LAYOUT.HELP_TEXT_MARGIN_BOTTOM,
              flexShrink: 0,
            }}
          >
            <text style={{ fg: theme.muted, wrapMode: 'word' }}>
              Navigate to your project folder and press Open.
            </text>
          </box>
        )}

        {/* Search/filter input - always visible, high priority */}
        <box
          style={{
            width: contentWidth,
            flexShrink: 0,
            marginBottom: 0,
          }}
        >
          <MultilineInput
            value={searchQuery}
            onChange={({ text }) => setSearchQuery(text)}
            onSubmit={() => {}} // Enter key handled by onKeyIntercept
            onPaste={() => {}} // Paste not needed for path input
            onKeyIntercept={handleSearchKeyIntercept}
            placeholder="Select project directory..."
            focused={true}
            maxHeight={1}
            minHeight={1}
            cursorPosition={searchQuery.length}
          />
        </box>

        {/* Directory list - only show if we have enough space */}
        {canShowFilePicker && (
          <box
            style={{
              flexDirection: 'column',
              width: contentWidth,
              borderStyle: 'single',
              borderColor: theme.muted,
              flexShrink: 0,
            }}
            border={['top', 'bottom', 'left', 'right']}
          >
            <SelectableList
              items={filteredDirectoryItems}
              focusedIndex={focusedIndex}
              maxHeight={maxListHeight}
              onSelect={handleDirectorySelect}
              onFocusChange={handleFocusChange}
              emptyMessage={
                searchQuery ? 'No matching directories' : 'No subdirectories'
              }
            />
          </box>
        )}

        {/* Recent Projects - show when there's space after file picker */}
        {canShowRecents && (
          <box
            style={{
              flexDirection: 'column',
              width: contentWidth,
            }}
          >
            <ProjectPickerRecents
              projects={recentProjects}
              maxToShow={maxRecentsToShow}
              isCompactMode={isCompactMode}
              onSelectProject={onSelectProject}
            />
          </box>
        )}
      </box>

      {/* Bottom bar - fixed at bottom with Open button */}
      <box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          paddingTop: 0,
          paddingBottom: 0,
          borderStyle: 'single',
          borderColor: theme.border,
          flexShrink: 0,
          backgroundColor: theme.surface,
        }}
        border={['top']}
      >
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: contentWidth,
          }}
        >
          {/* Current directory path */}
          <box style={{ flexGrow: 1, flexShrink: 1, overflow: 'hidden' }}>
            <text style={{ fg: theme.muted }}>{formatCwd(currentPath)}</text>
          </box>

          {/* Open button */}
          <Button
            onClick={selectCurrentDirectory}
            style={{
              paddingLeft: 2,
              paddingRight: 2,
              paddingTop: 0,
              paddingBottom: 0,
              borderStyle: 'single',
              borderColor: theme.primary,
              backgroundColor: theme.primary,
            }}
            border={['top', 'bottom', 'left', 'right']}
          >
            {/* FID-2026-0822-007: text on the primary fill → theme.onPrimary */}
            <text style={{ fg: theme.onPrimary }}>Open</text>
          </Button>
        </box>
      </box>
    </box>
  )
}
