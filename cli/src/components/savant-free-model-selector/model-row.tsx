import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useTheme } from '../../hooks/use-theme'
import { Button } from '../button'
import { BUTTON_CHROME, CUE_GAP, FOCUS_CUE, NAME_GAP } from './layout'

import type { SavantFreeModel } from '@savant-code/common/constants/savant-free-models'

/** Everything a rendered model row needs from the parent picker. Bundled so
 *  the row stays presentational and the parent owns state + actions. */
export interface ModelRowRenderContext {
  focusedId: string | null
  hoveredId: string | null
  pending: string | null
  committedModelId: string | null
  nameColumnWidth: number
  buttonOuterWidth: number
  wrapDetails: boolean
  recommendedOneLineLen: number
  deploymentAvailabilityLabel: string
  isJoinable: (modelId: string) => boolean
  onFocus: (modelId: string) => void
  onPick: (modelId: string) => void
  onHoverStart: (modelId: string) => void
  onHoverEnd: (modelId: string) => void
}

export const ModelRowButton: React.FC<{
  model: SavantFreeModel
  recommended?: boolean
  ctx: ModelRowRenderContext
}> = ({ model, recommended = false, ctx }) => {
  const theme = useTheme()
  // Single visual state: the focused row IS the highlight. The user's
  // saved/committed pick is not shown separately — it just sets where
  // focus lands when the picker opens. Pressing Enter on the focused
  // row commits it.
  const isHovered = ctx.hoveredId === model.id
  const isFocused = ctx.focusedId === model.id
  const canJoin = ctx.isJoinable(model.id)
  // Clickable whenever picking would actually do something — i.e.
  // anything except re-picking the queue we're already in.
  const interactable =
    !ctx.pending && canJoin && model.id !== ctx.committedModelId

  // Focused row: green border + arrow indicator + bold name. The name
  // itself stays the normal foreground color so it doesn't shout — the
  // border and arrow do the highlighting. Off-focus rows are default.
  const indicator = isFocused ? '›' : ' '
  const fgColor = canJoin ? theme.foreground : theme.muted
  const mutedColor = theme.muted
  const warningColor = theme.secondary

  // Focused row gets the bright primary border (and arrow). Every other row —
  // including the recommended card when the cursor has moved elsewhere — stays
  // quiet (gray border, brightening only on hover) so it never competes with
  // the user's current selection. The recommended card still reads as special
  // via its "RECOMMENDED" border title, which the border color carries.
  const borderColor = isFocused
    ? theme.primary
    : isHovered
      ? theme.foreground
      : theme.border

  // Deployment-hours rows show "until 5pm PT" while open and "opens 9am ET"
  // while closed (the label flips inside getSavantFreeDeploymentAvailabilityLabel),
  // so the same string carries both the in-hours and out-of-hours signals
  // without a separate "Closed" chip. Greyed-out fgColor handles the rest.
  const hasHours = model.availability === 'deployment_hours'
  const hasWarning = !!model.warning

  // Spaces inside <span>s render verbatim, so we hand-pad the name to align
  // taglines into a column. nameColumnWidth is the longest name across all
  // rows, so the diff is >= 0; +NAME_GAP guarantees breathing room even on
  // the widest row.
  const namePadding = ' '.repeat(
    ctx.nameColumnWidth - model.displayName.length + NAME_GAP,
  )

  // Right-aligned "Press Enter ↵" cue on the focused recommended row only.
  // Right-align against recommendedOneLineLen — the exact length the gutter was
  // reserved against above — so reserve and consume can't drift. The reservation
  // guarantees cuePad >= CUE_GAP in one-line mode; the guard keeps it safe in
  // wrap mode (no gutter reserved there) and against any contentMaxWidth clamp.
  const cuePad =
    ctx.buttonOuterWidth -
    BUTTON_CHROME -
    ctx.recommendedOneLineLen -
    FOCUS_CUE.length
  const showCue =
    recommended &&
    isFocused &&
    interactable &&
    !ctx.wrapDetails &&
    cuePad >= CUE_GAP

  return (
    <Button
      id={model.id}
      title={recommended ? ' RECOMMENDED ' : undefined}
      titleAlignment={recommended ? 'left' : undefined}
      onClick={() => {
        ctx.onFocus(model.id)
        if (canJoin) ctx.onPick(model.id)
      }}
      onMouseOver={() => interactable && ctx.onHoverStart(model.id)}
      onMouseOut={() => ctx.onHoverEnd(model.id)}
      style={{
        borderStyle: 'single',
        borderColor,
        paddingLeft: 1,
        paddingRight: 1,
        width: ctx.buttonOuterWidth,
      }}
      border={['top', 'bottom', 'left', 'right']}
    >
      <text>
        <span fg={fgColor}>{indicator} </span>
        <span
          fg={fgColor}
          attributes={isFocused ? TextAttributes.BOLD : TextAttributes.NONE}
        >
          {model.displayName}
        </span>
        {ctx.wrapDetails ? (
          <span fg={mutedColor}> · {model.tagline}</span>
        ) : (
          <>
            <span fg={mutedColor}>{namePadding + model.tagline}</span>
            {hasWarning && <span fg={warningColor}> · {model.warning}</span>}
            {hasHours && (
              <span fg={mutedColor}> · {ctx.deploymentAvailabilityLabel}</span>
            )}
            {showCue && (
              <span fg={theme.primary} attributes={TextAttributes.BOLD}>
                {' '.repeat(cuePad) + FOCUS_CUE}
              </span>
            )}
          </>
        )}
      </text>
      {ctx.wrapDetails && (hasWarning || hasHours) && (
        <text>
          <span> </span>
          {hasWarning && <span fg={warningColor}>{model.warning}</span>}
          {hasWarning && hasHours && <span fg={mutedColor}> · </span>}
          {hasHours && (
            <span fg={mutedColor}>{ctx.deploymentAvailabilityLabel}</span>
          )}
        </text>
      )}
    </Button>
  )
}
