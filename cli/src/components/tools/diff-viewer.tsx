import { TextAttributes } from '@opentui/core'
import { memo, useMemo } from 'react'

import { useTheme } from '../../hooks/use-theme'
import {
  blendHex,
  DIFF_ADD_FOREGROUND,
  DIFF_REMOVE_FOREGROUND,
  getDiffHeaderPath,
  NEON_GREEN,
  NEON_RED,
  parseDiffLines,
} from '../../utils/diff-stats'

import type { DiffLine } from '../../utils/diff-stats'

interface DiffViewerProps {
  diffText: string
}

/** Minimum width (cells) of each old/new line-number column. */
const GUTTER_MIN_WIDTH = 3
/** Width (cells) of the sign column (`+` / `-` / blank). */
const SIGN_COLUMN_WIDTH = 2

interface DiffRowProps {
  line: DiffLine
  gutterWidth: number
  addBackground: string
  removeBackground: string
  hunkBackground: string
}

/**
 * DiffRow — one unified-diff row in the framed gutter layout.
 *
 * Layout: `[old #][new #][sign][content]`. The content column drops the
 * leading `+`/`-`/` ` prefix (that marker moved into the sign column), so the
 * sign reads as a gutter accent and content stays clean.
 */
const DiffRow = memo(
  ({
    line,
    gutterWidth,
    addBackground,
    removeBackground,
    hunkBackground,
  }: DiffRowProps) => {
    const theme = useTheme()
    const isAdd = line.kind === 'add'
    const isRemove = line.kind === 'remove'
    const isHunk = line.kind === 'hunk'
    const isHeader = line.kind === 'header'

    // The sign column carries the +/- marker; context/hunk/header rows leave
    // it blank so changed lines jump out.
    const sign = isAdd ? '+' : isRemove ? '-' : ''
    const rowBackground = isAdd
      ? addBackground
      : isRemove
        ? removeBackground
        : isHunk
          ? hunkBackground
          : undefined

    // Dark foregrounds keep tinted rows readable; hunk/header rows use the
    // theme's diff tokens; context uses the default foreground.
    let foreground = theme.foreground
    if (isAdd) foreground = DIFF_ADD_FOREGROUND
    else if (isRemove) foreground = DIFF_REMOVE_FOREGROUND
    else if (isHunk) foreground = theme.diffHunkHeader
    else if (isHeader) foreground = theme.diffMeta

    let content = line.text
    if (isAdd || isRemove || line.kind === 'context') {
      content = content.slice(1)
    }
    const displayContent = content || ' '

    return (
      <box
        style={{
          flexDirection: 'row',
          width: '100%',
          backgroundColor: rowBackground,
        }}
      >
        <text style={{ width: gutterWidth, wrapMode: 'none' }}>
          <span fg={theme.muted} attributes={TextAttributes.DIM}>
            {line.oldLine !== undefined ? line.oldLine : ''}
          </span>
        </text>
        <text style={{ width: gutterWidth, wrapMode: 'none' }}>
          <span fg={theme.muted} attributes={TextAttributes.DIM}>
            {line.newLine !== undefined ? line.newLine : ''}
          </span>
        </text>
        <text style={{ width: SIGN_COLUMN_WIDTH, wrapMode: 'none' }}>
          <span
            fg={
              isAdd
                ? DIFF_ADD_FOREGROUND
                : isRemove
                  ? DIFF_REMOVE_FOREGROUND
                  : theme.muted
            }
          >
            {sign}
          </span>
        </text>
        <text style={{ flexGrow: 1, flexShrink: 1, wrapMode: 'word' }}>
          <span fg={foreground}>{displayContent}</span>
        </text>
      </box>
    )
  },
)

/**
 * DiffViewer — framed, gutter-style diff renderer.
 *
 * Redesign (FID-2026-0816-009): wraps the proven line-by-line renderer
 * (parseDiffLines + neon tinting) in a bordered container with a header strip
 * (file path + `+N −M` counts) and a dual old/new line-number + sign gutter.
 * Hunk headers render as tinted full-width bars; `diff --git`/`index`/`---`/
 * `+++` metadata rows render muted so the change content dominates.
 */
export const DiffViewer = memo(({ diffText }: DiffViewerProps) => {
  const theme = useTheme()
  const { lines, added, removed } = useMemo(
    () => parseDiffLines(diffText),
    [diffText],
  )
  const filePath = useMemo(() => getDiffHeaderPath(diffText), [diffText])
  const addBackground = useMemo(
    () => blendHex(NEON_GREEN, theme.background, 0.5),
    [theme.background],
  )
  const removeBackground = useMemo(
    () => blendHex(NEON_RED, theme.background, 0.5),
    [theme.background],
  )
  const hunkBackground = useMemo(
    () => blendHex(theme.diffHunkHeader, theme.background, 0.15),
    [theme.background, theme.diffHunkHeader],
  )
  // Gutter width scales with the largest line number present so 5-digit hunks
  // don't clip, while small diffs stay narrow.
  const gutterWidth = useMemo(() => {
    let max = 0
    for (const line of lines) {
      if (line.oldLine !== undefined && line.oldLine > max) max = line.oldLine
      if (line.newLine !== undefined && line.newLine > max) max = line.newLine
    }
    return Math.max(GUTTER_MIN_WIDTH, String(max).length)
  }, [lines])

  return (
    <box
      style={{
        flexDirection: 'column',
        gap: 0,
        width: '100%',
        border: true,
        borderStyle: 'rounded',
        borderColor: theme.border,
        backgroundColor: theme.surface,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
            {filePath || 'EDIT'}
          </span>
        </text>
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.muted}>{` +${added} \u2212${removed}`}</span>
        </text>
      </box>
      {lines.map((line, index) => (
        <DiffRow
          key={index}
          line={line}
          gutterWidth={gutterWidth}
          addBackground={addBackground}
          removeBackground={removeBackground}
          hunkBackground={hunkBackground}
        />
      ))}
    </box>
  )
})

interface DiffStatsBarProps {
  removed: number
  added: number
}

/**
 * DiffStatsBar — the `[-N/+M]` add/remove counter (FID-2026-0804-010).
 *
 * Rendered in the CopyableBlock footer row, immediately left of the copy
 * button, so the edit section's bottom-right shows the change magnitude at a
 * glance. Muted comment foreground to match the edit-header styling.
 */
export const DiffStatsBar = ({ removed, added }: DiffStatsBarProps) => {
  const theme = useTheme()
  return (
    <text>
      <span fg={theme.syntaxComment}>
        [-{removed}/+{added}]
      </span>
    </text>
  )
}
