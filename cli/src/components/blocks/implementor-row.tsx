import { TextAttributes } from '@opentui/core'
import React, { memo, useCallback, useMemo, useState } from 'react'

import { CopyableBlock } from './copyable-block'
import { CompactFileStats } from './implementor-file-stats'
import { useGridLayout } from '../../hooks/use-grid-layout'
import { useTheme } from '../../hooks/use-theme'
import { getAgentStatusInfo } from '../../utils/agent-helpers'
import {
  buildActivityTimeline,
  getImplementorDisplayName,
  getImplementorIndex,
  getFileStatsFromBlocks,
} from '../../utils/implementor-helpers'
import { PROPOSAL_BORDER_CHARS } from '../../utils/ui-constants'

import type { AgentContentBlock, ContentBlock } from '../../types/chat'

/** Horizontal padding inside implementor cards (left + right) */
const CARD_HORIZONTAL_PADDING = 4
/** Minimum inner content width */
const MIN_INNER_WIDTH = 10

/** Labels for proposal cards when no file changes exist */
const EMPTY_STATE_LABELS = {
  running: 'generating...',
  complete: 'no changes',
  failed: 'failed',
  cancelled: 'cancelled',
} as const

interface ImplementorGroupProps {
  implementors: AgentContentBlock[]
  siblingBlocks: ContentBlock[]
  availableWidth: number
}

export const ImplementorGroup = memo(
  ({ implementors, siblingBlocks, availableWidth }: ImplementorGroupProps) => {
    const { columnWidth: cardWidth, columnGroups } = useGridLayout(
      implementors,
      availableWidth,
    )

    return (
      <box
        style={{
          flexDirection: 'column',
          gap: 1,
          width: '100%',
          marginTop: 1,
        }}
      >
        {/* Masonry layout: columns side by side, cards stack vertically in each */}
        <box
          style={{
            flexDirection: 'row',
            gap: 1,
            width: '100%',
            alignItems: 'flex-start',
          }}
        >
          {columnGroups.map((columnItems, colIdx) => {
            // Use first agent's ID as stable column key
            const columnKey = columnItems[0]?.agentId ?? `col-${colIdx}`
            const columnCopyText = columnItems
              .map((agentBlock) => {
                const lines: string[] = [
                  `[Implementor: ${getImplementorDisplayName(
                    agentBlock.agentType,
                    getImplementorIndex(agentBlock, siblingBlocks),
                  )}]`,
                ]
                agentBlock.blocks?.forEach((b) => {
                  if (b.type === 'text') lines.push(b.content)
                  if (b.type === 'tool')
                    lines.push(
                      `[Tool: ${b.toolName}]\nInput: ${JSON.stringify(
                        b.input,
                      )}\nOutput: ${b.output ?? '(no output)'}`,
                    )
                })
                return lines.join('\n\n')
              })
              .join('\n\n---\n\n')

            return (
              <CopyableBlock getCopyText={() => columnCopyText}>
                <box
                  key={columnKey}
                  style={{
                    flexDirection: 'column',
                    gap: 0,
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    minWidth: 0,
                  }}
                >
                  {columnItems.map((agentBlock) => {
                    const implementorIndex = getImplementorIndex(
                      agentBlock,
                      siblingBlocks,
                    )

                    return (
                      <ImplementorCard
                        key={agentBlock.agentId}
                        agentBlock={agentBlock}
                        implementorIndex={implementorIndex}
                        cardWidth={cardWidth}
                      />
                    )
                  })}
                </box>
              </CopyableBlock>
            )
          })}
        </box>
      </box>
    )
  },
)

interface ImplementorCardProps {
  agentBlock: AgentContentBlock
  implementorIndex?: number
  cardWidth: number
}

const ImplementorCard = memo(
  ({ agentBlock, implementorIndex, cardWidth }: ImplementorCardProps) => {
    const theme = useTheme()
    const [selectedFile, setSelectedFile] = useState<string | null>(null)

    const isComplete = agentBlock.status === 'complete'

    const displayName = getImplementorDisplayName(
      agentBlock.agentType,
      implementorIndex,
    )

    // Get file stats for compact view
    const fileStats = useMemo(
      () => getFileStatsFromBlocks(agentBlock.blocks),
      [agentBlock.blocks],
    )

    // Build timeline to extract diffs
    const timeline = useMemo(
      () => buildActivityTimeline(agentBlock.blocks),
      [agentBlock.blocks],
    )

    // Build map of file path -> diff for inline display
    const fileDiffs = useMemo(() => {
      const diffs = new Map<string, string>()
      for (const item of timeline) {
        if (item.type === 'edit' && item.diff) {
          diffs.set(item.content, item.diff)
        }
      }
      return diffs
    }, [timeline])

    // Get status info from helper
    const {
      indicator: statusIndicator,
      label: statusLabel,
      color: statusColor,
    } = getAgentStatusInfo(agentBlock.status, theme)
    // Format: "● running" when streaming, "completed ✓" when done (checkmark at end)
    const statusText =
      statusIndicator === '✓'
        ? `${statusLabel} ${statusIndicator}`
        : `${statusIndicator} ${statusLabel}`

    // Use cardWidth for internal truncation calculations (approximate internal space)
    const innerWidth = Math.max(
      MIN_INNER_WIDTH,
      cardWidth - CARD_HORIZONTAL_PADDING,
    )

    // Toggle file selection - clicking same file deselects it
    const handleFileSelect = useCallback((filePath: string) => {
      setSelectedFile((prev) => (prev === filePath ? null : filePath))
    }, [])

    return (
      <box
        border
        borderStyle="single"
        customBorderChars={PROPOSAL_BORDER_CHARS}
        borderColor={isComplete ? theme.muted : theme.primary}
        style={{
          flexDirection: 'column',
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        {/* Header: Model name + Status */}
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1,
            width: '100%',
          }}
        >
          <text
            fg={theme.foreground}
            attributes={TextAttributes.BOLD}
            style={{ wrapMode: 'none' }}
          >
            {displayName}
          </text>
          <text
            fg={statusColor}
            attributes={TextAttributes.DIM}
            style={{ wrapMode: 'none' }}
          >
            {statusText}
          </text>
        </box>

        {/* Prompt provided to this proposal */}
        {agentBlock.initialPrompt && (
          <box style={{ marginTop: 1, width: '100%' }}>
            <text fg={theme.muted} attributes={TextAttributes.ITALIC}>
              {agentBlock.initialPrompt}
            </text>
          </box>
        )}

        {/* File stats - click file name to view diff inline */}
        {fileStats.length > 0 && (
          <CompactFileStats
            fileStats={fileStats}
            availableWidth={innerWidth}
            selectedFile={selectedFile}
            onSelectFile={handleFileSelect}
            fileDiffs={fileDiffs}
          />
        )}

        {/* Show status-appropriate message when no file changes */}
        {fileStats.length === 0 && (
          <text
            fg={theme.muted}
            attributes={TextAttributes.ITALIC}
            style={{ marginTop: 1 }}
          >
            {EMPTY_STATE_LABELS[agentBlock.status]}
          </text>
        )}
      </box>
    )
  },
)

// Keep the old exports for backward compatibility during transition
export { ImplementorCard as ImplementorRow }
