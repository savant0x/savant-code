import { TextAttributes } from '@opentui/core'
import { memo, useMemo } from 'react'

import { useTheme } from '../../hooks/use-theme'
import {
  blendHex,
  DIFF_ADD_FOREGROUND,
  DIFF_REMOVE_FOREGROUND,
  formatDiffCounts,
  getDiffHeaderPath,
  NEON_GREEN,
  NEON_RED,
  parseDiffLines,
} from '../../utils/diff-stats'
import { TrafficLightPanel } from '../traffic-light-panel'

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
}

/**
 * DiffRow — one unified-diff row in the framed gutter layout.
 *
 * Layout: `[old #][new #][sign][content]`. The content column drops the
 * leading `+`/`-`/` ` prefix (that marker moved into the sign column), so the
 * sign reads as a gutter accent and content stays clean.
 */
const DiffRow = memo(
  ({ line, gutterWidth, addBackground, removeBackground }: DiffRowProps) => {
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
        : undefined

    // Dark foregrounds keep tinted rows readable; metadata rows (header AND
    // hunk) use the theme's muted metadata token; context uses the default
    // foreground.
    //
    // FID-2026-0927-004: hunk headers were rendered in `diffHunkHeader` (the
    // design system's primary cyan) on a cyan-tinted full-width bar. On line 0
    // that made a row carrying no change information the loudest thing in the
    // panel, and it contradicted this component's own stated rule that
    // "metadata rows render muted so the change content dominates". A hunk
    // header is metadata: its text is identical in every hunk modulo the line
    // numbers already shown in the gutter. It now takes the same muted
    // treatment as the `diff --git` / `---` / `+++` rows.
    let foreground = theme.foreground
    if (isAdd) foreground = DIFF_ADD_FOREGROUND
    else if (isRemove) foreground = DIFF_REMOVE_FOREGROUND
    else if (isHunk || isHeader) foreground = theme.diffMeta

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
 * DiffViewer — traffic-lights-chromed, gutter-style diff renderer.
 *
 * Redesign (FID-2026-0816-009) + chrome migration (FID-2026-0823-005): wraps
 * the proven line-by-line renderer (parseDiffLines + neon tinting) in the
 * shared TrafficLightPanel primitive with a header strip (file path +
 * `+N -N` counts) and a dual old/new line-number + sign gutter. Hunk headers
 * and `diff --git`/`index`/`---`/`+++` rows are BOTH metadata and both render
 * muted, so the change content dominates (FID-2026-0927-004: hunk headers
 * previously rendered as tinted full-width bars in the diff accent, which made
 * line 0 the loudest element in the panel while carrying no change
 * information).
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
  // Operator directive 2026-09-27: suppress the FIRST hunk row.
  //
  // The leading `@@` carries the start numbers that seed the gutter columns
  // printed on every row beneath it, so on screen it restates what the gutter
  // already shows. Later `@@` rows are NOT suppressed: in a multi-hunk diff
  // each one marks a real elision (rows jump from line 12 to line 300), and
  // that discontinuity is information no other row carries.
  //
  // Filtering happens HERE, not in `parseDiffLines`. The parser must keep
  // emitting the row because it owns the counter reset (`diff-stats.ts:120`):
  // dropping it there would leave both counters at 0 and blank the gutter on
  // every row. This is display-only by construction.
  const firstHunkIndex = useMemo(
    () => lines.findIndex((line) => line.kind === 'hunk'),
    [lines],
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
    <TrafficLightPanel>
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
          <span fg={theme.muted}>{` ${formatDiffCounts(added, removed)}`}</span>
        </text>
      </box>
      {lines.map((line, index) =>
        index === firstHunkIndex ? null : (
          <DiffRow
            key={index}
            line={line}
            gutterWidth={gutterWidth}
            addBackground={addBackground}
            removeBackground={removeBackground}
          />
        ),
      )}
    </TrafficLightPanel>
  )
})
