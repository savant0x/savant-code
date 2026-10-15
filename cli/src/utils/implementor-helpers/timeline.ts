import {
  extractDiff,
  isCreateFile,
  isFailedEditToolBlock,
} from './edit-analysis'
import {
  ALL_EDIT_TOOL_NAMES,
  getBaseToolName,
  extractFilePath,
} from './identify'

import type { ContentBlock, ToolContentBlock } from '../../types/chat'

export interface TimelineItem {
  type: 'commentary' | 'edit'
  content: string // For commentary: the text. For edits: file path
  diff?: string // For edits: the unified diff
  isCreate?: boolean // For edits: whether this is a new file creation
}

/** Git-style change type for files */
export type FileChangeType = 'A' | 'M' | 'D' | 'R'

export interface DiffStats {
  linesAdded: number
  linesRemoved: number
  hunks: number
}

export interface FileStats {
  path: string
  changeType: FileChangeType
  stats: DiffStats
}

/**
 * Parse diff text and extract statistics.
 */
export function parseDiffStats(diff: string | undefined): DiffStats {
  if (!diff) return { linesAdded: 0, linesRemoved: 0, hunks: 0 }

  const lines = diff.split('\n')
  let linesAdded = 0
  let linesRemoved = 0
  let hunks = 0

  for (const line of lines) {
    // Count hunk headers (lines starting with @@)
    if (line.startsWith('@@')) {
      hunks++
    }
    // Count additions (lines starting with + but not +++ header)
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      linesAdded++
    }
    // Count deletions (lines starting with - but not --- header)
    else if (line.startsWith('-') && !line.startsWith('---')) {
      linesRemoved++
    }
  }

  // If no @@ markers found but we have +/- lines, count as 1 hunk
  if (hunks === 0 && (linesAdded > 0 || linesRemoved > 0)) {
    hunks = 1
  }

  return { linesAdded, linesRemoved, hunks }
}

/**
 * Determine file change type based on tool and context.
 */
export function getFileChangeType(toolBlock: ToolContentBlock): FileChangeType {
  const baseToolName = getBaseToolName(toolBlock.toolName)
  // write_file creating new file = Added
  if (baseToolName === 'write_file') {
    const isCreate = isCreateFile(toolBlock)
    return isCreate ? 'A' : 'M'
  }

  // str_replace is always a modification
  if (baseToolName === 'str_replace') {
    return 'M'
  }

  // Default to modified
  return 'M'
}

/**
 * Get aggregated file stats from all edit blocks.
 * Groups by file path and sums up the stats.
 */
export function getFileStatsFromBlocks(
  blocks: ContentBlock[] | undefined,
): FileStats[] {
  if (!blocks || blocks.length === 0) return []

  const fileMap = new Map<string, FileStats>()

  for (const block of blocks) {
    if (
      block.type === 'tool' &&
      ALL_EDIT_TOOL_NAMES.includes(
        block.toolName as (typeof ALL_EDIT_TOOL_NAMES)[number],
      )
    ) {
      if (isFailedEditToolBlock(block)) continue

      const filePath = extractFilePath(block)
      if (!filePath) continue

      const diff = extractDiff(block)
      const stats = parseDiffStats(diff ?? undefined)
      const changeType = getFileChangeType(block)

      const existing = fileMap.get(filePath)
      if (existing) {
        // Aggregate stats for same file
        existing.stats.linesAdded += stats.linesAdded
        existing.stats.linesRemoved += stats.linesRemoved
        existing.stats.hunks += stats.hunks
      } else {
        fileMap.set(filePath, {
          path: filePath,
          changeType,
          stats,
        })
      }
    }
  }

  return Array.from(fileMap.values())
}

/**
 * Build an activity timeline from agent blocks.
 * Interleaves commentary (text blocks) and edits (tool calls).
 * Includes both executed tools (str_replace, write_file) and proposed tools.
 */
export function buildActivityTimeline(
  blocks: ContentBlock[] | undefined,
): TimelineItem[] {
  if (!blocks || blocks.length === 0) return []

  const timeline: TimelineItem[] = []

  for (const block of blocks) {
    if (block.type === 'text' && block.textType !== 'reasoning') {
      const content = block.content.trim()
      if (content) {
        timeline.push({ type: 'commentary', content })
      }
    } else if (
      block.type === 'tool' &&
      ALL_EDIT_TOOL_NAMES.includes(
        block.toolName as (typeof ALL_EDIT_TOOL_NAMES)[number],
      )
    ) {
      if (isFailedEditToolBlock(block)) continue

      const filePath = extractFilePath(block)
      const diff = extractDiff(block)
      const isCreate = isCreateFile(block)

      timeline.push({
        type: 'edit',
        content: filePath || 'unknown file',
        diff: diff || undefined,
        isCreate,
      })
    }
  }

  return timeline
}

/**
 * Truncate text to fit within maxWidth, adding ellipsis if needed.
 */
export function truncateWithEllipsis(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text
  if (maxWidth <= 3) return text.slice(0, maxWidth)
  return text.slice(0, maxWidth - 3) + '...'
}
