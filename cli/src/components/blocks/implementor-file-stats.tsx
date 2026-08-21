import { TextAttributes } from '@opentui/core'
import { memo, useState } from 'react'

import { useTheme } from '../../hooks/use-theme'
import {
  truncateWithEllipsis,
  type FileStats,
} from '../../utils/implementor-helpers'
import { getRelativePath } from '../../utils/path-helpers'
import { Button } from '../button'
import { CollapseButton } from '../collapse-button'
import { DiffViewer } from '../tools/diff-viewer'

/** Fixed width for the +/- bar visualization */
const STATS_BAR_WIDTH = 5

interface CompactFileStatsProps {
  fileStats: FileStats[]
  availableWidth: number
  selectedFile: string | null
  onSelectFile: (filePath: string) => void
  /** Map of file path to diff content */
  fileDiffs: Map<string, string>
}

export const CompactFileStats = memo(
  ({
    fileStats,
    availableWidth,
    selectedFile,
    onSelectFile,
    fileDiffs,
  }: CompactFileStatsProps) => {
    const _theme = useTheme()

    // Fixed bar width - keeps layout simple and predictable
    const maxBarWidth = STATS_BAR_WIDTH

    // Calculate max string widths for alignment (so all bars meet at center axis)
    // Always include +0/-0 in width calculation since we always show them
    const maxAddedStrWidth = Math.max(
      ...fileStats.map((f) => `+${f.stats.linesAdded}`.length),
      2, // Minimum "+0"
    )
    const maxRemovedStrWidth = Math.max(
      ...fileStats.map((f) => `-${f.stats.linesRemoved}`.length),
      2, // Minimum "-0"
    )

    return (
      <box style={{ flexDirection: 'column', marginTop: 1 }}>
        {fileStats.map((file, idx) => (
          <CompactFileRow
            key={`${file.path}-${idx}`}
            file={file}
            availableWidth={availableWidth}
            maxBarWidth={maxBarWidth}
            maxAddedStrWidth={maxAddedStrWidth}
            maxRemovedStrWidth={maxRemovedStrWidth}
            isSelected={selectedFile === file.path}
            onSelect={() => onSelectFile(file.path)}
            diff={fileDiffs.get(file.path)}
          />
        ))}
      </box>
    )
  },
)

interface CompactFileRowProps {
  file: FileStats
  availableWidth: number
  maxBarWidth: number
  maxAddedStrWidth: number
  maxRemovedStrWidth: number
  isSelected: boolean
  onSelect: () => void
  diff?: string
}

const CompactFileRow = memo(
  ({
    file,
    availableWidth,
    maxBarWidth,
    maxAddedStrWidth,
    maxRemovedStrWidth,
    isSelected,
    onSelect,
    diff,
  }: CompactFileRowProps) => {
    const theme = useTheme()
    const [isHovered, setIsHovered] = useState(false)

    // Format numbers - always show counts, including +0 and -0
    const addedStr = `+${file.stats.linesAdded}`
    const removedStr = `-${file.stats.linesRemoved}`

    // Full-width colored sections with numbers inside:
    // - Added section: green bar extending to center with +N in white (right-aligned)
    // - Removed section: red bar extending from center with -N in white (left-aligned)
    const addedSectionWidth = maxBarWidth + maxAddedStrWidth
    const removedSectionWidth = maxBarWidth + maxRemovedStrWidth

    // +N right-aligned within the green section with 1 space padding before the center edge
    const addedContent = (addedStr + ' ').padStart(addedSectionWidth)
    // -N left-aligned within the red section with 1 space padding after the center edge
    const removedContent = (' ' + removedStr).padEnd(removedSectionWidth)

    // Calculate available width for file path
    // Layout: changeType(1) + spaces(2) + filePath + spaces(2) + bars
    // Total bar section width: 2*maxBarWidth + maxAddedStrWidth + maxRemovedStrWidth (no center gap)
    const barWidth = 2 * maxBarWidth + maxAddedStrWidth + maxRemovedStrWidth
    const fixedWidth = 1 + 2 + 2 + barWidth
    const maxFilePathWidth = Math.max(10, availableWidth - fixedWidth)

    // Get and truncate file path
    const relativePath = getRelativePath(file.path)
    const displayPath = truncateWithEllipsis(relativePath, maxFilePathWidth)

    return (
      <box style={{ flexDirection: 'column' }}>
        {/* File row */}
        <box style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Change type: fixed */}
          <text fg={theme.muted} style={{ flexShrink: 0 }}>
            {file.changeType}
          </text>
          <text style={{ flexShrink: 0 }}> </text>

          {/* File path: clickable with underline on hover, flexes to push bars right */}
          <Button
            onClick={onSelect}
            onMouseOver={() => setIsHovered(true)}
            onMouseOut={() => setIsHovered(false)}
            style={{
              paddingLeft: 0,
              paddingRight: 0,
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: 0,
            }}
          >
            <text
              fg={theme.foreground}
              attributes={
                isHovered || isSelected ? TextAttributes.UNDERLINE : undefined
              }
              style={{
                wrapMode: 'none',
              }}
            >
              {displayPath}
            </text>
          </Button>
          <text style={{ flexShrink: 0 }}> </text>

          {/* Bar visualization: full-width bars meeting at center with numbers inside */}
          <text style={{ flexShrink: 0, wrapMode: 'none' }}>
            {/* Added section: muted gray-green bar with +N inside */}
            <span fg={theme.foreground} bg="#3A5A3A">
              {addedContent}
            </span>
            {/* Removed section: muted gray-red bar with -N inside */}
            <span fg={theme.foreground} bg="#5A3A3A">
              {removedContent}
            </span>
          </text>
        </box>

        {/* Inline diff viewer when selected - aligns with card content (full width) */}
        {isSelected && diff && (
          <box style={{ flexDirection: 'column', marginTop: 1, width: '100%' }}>
            <box
              style={{
                flexDirection: 'column',
                width: '100%',
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 1,
                paddingBottom: 1,
                backgroundColor: theme.surface,
              }}
            >
              <DiffViewer diffText={diff} />
            </box>
            <CollapseButton onClick={onSelect} />
          </box>
        )}
      </box>
    )
  },
)
