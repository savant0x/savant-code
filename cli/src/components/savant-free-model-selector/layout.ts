import type { SavantFreeModel } from '@savant-code/common/constants/savant-free-models'

// Right-aligned CTA shown on the focused, joinable row so the highlighted card
// reads as a button ("you can press Enter here") instead of just a selection.
// Its width is reserved in the one-line width budget below so the cue never
// overflows or wraps the row (a wrap would desync the focused-row scroll math).
export const FOCUS_CUE = 'Press Enter ↵'
export const CUE_GAP = 2 // min gap between a row's details and the focused-row cue

export const BUTTON_CHROME = 4 // 2 border + 2 padding
export const NAME_GAP = 2 // spaces between name column and details column

// Section layout constants: headers add 1 row; sections after the first add 1
// row of marginTop; the toggle adds its marginTop + 1.
export const SECTION_GAP = 1
export const TOGGLE_MARGIN = 1

// Sentinel id for the expand/collapse toggle so it can ride the same
// keyboard-navigation list as the model rows (Tab/arrow to it, Enter to fire).
export const TOGGLE_ID = '__savant_free_toggle__'

// `label` may be empty: limited-tier users only see the constrained model set,
// so the "LIMITED" header would just leak the internal tier name without
// organizing anything. Renderer treats an empty label as "no header row".
export type Section = {
  key: 'premium' | 'unlimited' | 'limited'
  label: string
  models: readonly SavantFreeModel[]
}

export interface SelectorLayout {
  wrapDetails: boolean
  buttonOuterWidth: number
  nameColumnWidth: number
  recommendedOneLineLen: number
}

// Two-column layout: a fixed name column (padded to the longest displayName
// across all rows) followed by a details column (tagline · warning ·
// deployment-hours/closed). Falls back to single-column mode on narrow
// terminals where the secondary details spill to an indented second line.
// Computed across ALL models (not just the expanded ones) so the recommended
// hero and the revealed rows share one width and nothing reflows on toggle.
export function computeSelectorLayout(opts: {
  availableModels: readonly SavantFreeModel[]
  contentMaxWidth: number
  deploymentAvailabilityLabel: string
  recommendedModel: SavantFreeModel
}): SelectorLayout {
  const {
    availableModels,
    contentMaxWidth,
    deploymentAvailabilityLabel,
    recommendedModel,
  } = opts
  const nameLen = (m: SavantFreeModel) => m.displayName.length
  const maxNameLen = Math.max(...availableModels.map(nameLen))

  const detailsParts = (model: SavantFreeModel): number[] => {
    const parts: number[] = []
    parts.push(model.tagline.length)
    if (model.warning) parts.push(model.warning.length)
    if (model.availability === 'deployment_hours') {
      parts.push(deploymentAvailabilityLabel.length)
    }
    return parts
  }

  const joinedLen = (parts: number[]): number =>
    parts.reduce((a, b) => a + b, 0) + Math.max(0, parts.length - 1) * 3 // " · "

  const oneLineLen = (model: SavantFreeModel): number =>
    2 /* indicator + space */ +
    maxNameLen +
    NAME_GAP +
    joinedLen(detailsParts(model))

  // The cue lives only on the recommended hero, so only its line needs to fit
  // the "Press Enter ↵" gutter. Folding that into the max means longer rows
  // (e.g. DeepSeek Pro's data-collection warning) keep their natural width —
  // the buttons widen only if the recommended row + cue is the longest line.
  // Returned so the render path can right-align the cue against the same
  // length the gutter was reserved for — one formula, no reserve/consume drift.
  const recommendedOneLineLen = oneLineLen(recommendedModel)
  const maxOneLineOuter =
    Math.max(
      ...availableModels.map(oneLineLen),
      recommendedOneLineLen + CUE_GAP + FOCUS_CUE.length,
    ) + BUTTON_CHROME
  if (maxOneLineOuter <= contentMaxWidth) {
    return {
      wrapDetails: false,
      buttonOuterWidth: maxOneLineOuter,
      nameColumnWidth: maxNameLen,
      recommendedOneLineLen,
    }
  }

  // Narrow: line 1 = "indicator name · tagline", line 2 (if any) =
  // "  warning · hours". Compute the max of both so all buttons stay the
  // same width.
  const labelLineLen = (m: SavantFreeModel) =>
    2 + m.displayName.length + 3 + m.tagline.length
  const detailsLineLen = (m: SavantFreeModel) => {
    const parts: number[] = []
    if (m.warning) parts.push(m.warning.length)
    if (m.availability === 'deployment_hours') {
      parts.push(deploymentAvailabilityLabel.length)
    }
    return parts.length === 0 ? 0 : 2 /* indent */ + joinedLen(parts)
  }
  const maxTwoLineInner = Math.max(
    ...availableModels.map((m) => Math.max(labelLineLen(m), detailsLineLen(m))),
  )
  return {
    wrapDetails: true,
    buttonOuterWidth: Math.min(
      maxTwoLineInner + BUTTON_CHROME,
      contentMaxWidth,
    ),
    nameColumnWidth: maxNameLen,
    recommendedOneLineLen,
  }
}

// Initial model-only height estimate. The content wrapper reports its actual
// laid-out height, including wrapped referral copy and responsive action rows;
// this estimate only avoids a zero-height first frame.
export function estimateSelectorHeight(opts: {
  recommendedModel: SavantFreeModel
  sections: readonly Section[]
  canCollapse: boolean
  wrapDetails: boolean
}): number {
  const { recommendedModel, sections, canCollapse, wrapDetails } = opts
  const rowWraps = (m: SavantFreeModel) =>
    wrapDetails && (!!m.warning || m.availability === 'deployment_hours')
  let y = 0
  const heroHeight = 2 + (rowWraps(recommendedModel) ? 2 : 1)
  y += heroHeight
  sections.forEach((section) => {
    y += SECTION_GAP // every section sits below the hero (or prior one) with a gap
    if (section.label) y += 1
    section.models.forEach((m) => {
      y += 2 + (rowWraps(m) ? 2 : 1)
    })
  })
  if (canCollapse) {
    y += TOGGLE_MARGIN
    y += 1
  }
  return y
}
