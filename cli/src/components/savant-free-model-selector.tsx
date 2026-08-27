import { TextAttributes } from '@opentui/core'
import React from 'react'

import { Button } from './button'
import { TOGGLE_ID, TOGGLE_MARGIN } from './savant-free-model-selector/layout'
import { ModelRowButton } from './savant-free-model-selector/model-row'
import { SectionBlock } from './savant-free-model-selector/sections'
import { useModelSelectorState } from './savant-free-model-selector/use-model-selector-state'
import { SavantFreeReferralBanner } from './savant-free-referral-banner'
import { createChatScrollbarOptions } from '../chat/styles'
import { useTheme } from '../hooks/use-theme'

import type { SavantFreeModel } from '@savant-code/common/constants/savant-free-models'

// The picker opens collapsed to a single recommended hero so a new user can
// start with one Enter press without reading six boxes. The "see all models"
// toggle reveals the rest, grouped into the same product/availability tiers.
//
// Section grouping (expanded view): model rows keep their tiers, but the
// premium models share one daily session quota while the unlimited ones have
// none. Putting the tier on a section header lets each row drop its redundant
// "Premium"/"Unlimited" chip. The PREMIUM header carries the shared quota
// inline — "N of M used · resets in …" — once any session is spent (turning
// amber when exhausted, the moment its rows grey out). When collapsed there's
// no PREMIUM header, but the recommended hero is unlimited, so the premium
// count is irrelevant and simply doesn't show; only the limited tier (no
// premium section) keeps a parent-rendered below-picker counter.
//
// Keyboard navigation: Tab / arrow keys move the green highlight; Enter (or
// Space) commits the focused row — or, on the toggle, expands/collapses the
// list. Mouse click commits in one step. On short terminals the parent passes
// `maxHeight`: the model rows and the referral/GLM controls live in one
// scrollbox capped at that many rows.
type SavantFreeModelSelectorProps = {
  /** Max vertical rows the picker may occupy. When the rendered rows exceed
   *  this, the list scrolls (scrollbar shown, focused row kept in view);
   *  otherwise the scrollbox shrinks to fit and no scrollbar appears. */
  maxHeight: number
  /** Notifies the parent whenever the picker expands/collapses. The landing
   *  screen uses it to promote the wordmark to the full ASCII logo while the
   *  picker is collapsed (the freed rows make room). */
  onExpandedChange?: (expanded: boolean) => void
}

export const SavantFreeModelSelector: React.FC<
  SavantFreeModelSelectorProps
> = ({ maxHeight, onExpandedChange }) => {
  const theme = useTheme()
  const s = useModelSelectorState({ maxHeight, onExpandedChange })

  // Everything a rendered row needs from the picker, bundled so ModelRowButton
  // and SectionBlock stay presentational. Rebuilt each render — the state hook
  // returns a fresh bundle anyway and the row path is cheap.
  const rowCtx = {
    focusedId: s.focusedId,
    hoveredId: s.hoveredId,
    pending: s.pending,
    committedModelId: s.committedModelId,
    nameColumnWidth: s.nameColumnWidth,
    buttonOuterWidth: s.buttonOuterWidth,
    wrapDetails: s.wrapDetails,
    recommendedOneLineLen: s.recommendedOneLineLen,
    deploymentAvailabilityLabel: s.deploymentAvailabilityLabel,
    isJoinable: s.isJoinable,
    onFocus: s.setFocusedId,
    onPick: s.pick,
    onHoverStart: s.setHoveredId,
    onHoverEnd: (modelId: string) =>
      s.setHoveredId((curr) => (curr === modelId ? null : curr)),
  }

  const renderRow = (model: SavantFreeModel, recommended = false) => (
    <ModelRowButton
      key={model.id}
      model={model}
      recommended={recommended}
      ctx={rowCtx}
    />
  )

  // Expand/collapse affordance. Collapsed: "see all N models" invites the user
  // to browse past the recommended pick. Expanded: a quiet way back to the
  // single-card view.
  const toggleFocused = s.focusedId === TOGGLE_ID
  const toggleHovered = s.hoveredId === TOGGLE_ID
  const toggleColor = toggleFocused
    ? theme.primary
    : toggleHovered
      ? theme.foreground
      : theme.muted
  const toggleLabel = s.expanded
    ? '↑  Show fewer'
    : `↓  See all ${s.availableModels.length} models`
  const toggleContent = s.canCollapse ? (
    <Button
      id={TOGGLE_ID}
      onClick={s.toggleExpanded}
      onMouseOver={() => s.setHoveredId(TOGGLE_ID)}
      onMouseOut={() =>
        s.setHoveredId((curr) => (curr === TOGGLE_ID ? null : curr))
      }
      style={{ marginTop: TOGGLE_MARGIN }}
    >
      <text style={{ wrapMode: 'none' }}>
        <span
          fg={toggleColor}
          attributes={toggleFocused ? TextAttributes.BOLD : TextAttributes.NONE}
        >
          {toggleLabel}
        </span>
      </text>
    </Button>
  ) : null

  // Scrollbox clamped to the rows the parent can spare. When everything fits
  // it shrinks to the content height and no scrollbar shows, so tall
  // terminals look exactly like a plain column.
  return (
    <scrollbox
      ref={s.scrollRef}
      scrollX={false}
      scrollbarOptions={{ visible: false }}
      verticalScrollbarOptions={{
        visible: s.needsScroll,
        ...createChatScrollbarOptions(theme),
      }}
      style={{
        height: s.scrollViewportHeight,
        // A scrollbox stretches to fill its parent, which would left-align
        // the picker; pin it to the button column width (plus a gutter for
        // the scrollbar) so the landing block stays content-sized and the
        // parent can center it as it did before this was a scrollbox.
        width: s.buttonOuterWidth + (s.needsScroll ? 1 : 0),
        flexShrink: 0,
        rootOptions: {
          flexDirection: 'row',
          backgroundColor: 'transparent',
        },
        wrapperOptions: {
          border: false,
          backgroundColor: 'transparent',
          flexDirection: 'column',
        },
        contentOptions: {
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0,
          backgroundColor: 'transparent',
        },
      }}
    >
      <box
        ref={s.contentRef}
        onSizeChange={s.syncContentHeight}
        style={{
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0,
          width: s.buttonOuterWidth,
          flexShrink: 0,
        }}
      >
        {renderRow(s.recommendedModel, true)}
        {s.sections.map((section) => (
          <SectionBlock
            key={section.key}
            section={section}
            premiumUsed={s.premiumUsed}
            premiumExhausted={s.premiumExhausted}
            premiumResetCountdown={s.premiumResetCountdown}
            ctx={rowCtx}
          />
        ))}
        {toggleContent}
        {s.referral && (
          <SavantFreeReferralBanner
            width={s.buttonOuterWidth}
            referral={s.referral}
            accessTier={s.accessTier}
            focusedId={s.focusedId}
            onFocusTargetsChange={s.setExtraTargets}
          />
        )}
      </box>
    </scrollbox>
  )
}
