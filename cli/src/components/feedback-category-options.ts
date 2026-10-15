import { IS_SAVANT_FREE } from '../utils/constants'

import type { FeedbackCategory } from '@savant-code/common/constants/feedback'

export type CategoryHighlightKey = 'success' | 'error' | 'warning' | 'info'

export type CategoryOption = {
  id: FeedbackCategory
  label: string
  shortLabel: string
  highlightKey: CategoryHighlightKey
  placeholder: string
}

export const CATEGORY_OPTIONS = [
  {
    id: 'good_result',
    label: 'Good result',
    shortLabel: 'Good',
    highlightKey: 'success',
    placeholder:
      'What did you like? (e.g., "Fast and accurate", "Great explanation")',
  },
  {
    id: 'bad_result',
    label: 'Bad result',
    shortLabel: 'Bad',
    highlightKey: 'error',
    placeholder:
      'What went wrong? (e.g., "Incorrect changes", "Missed the requirement")',
  },
  {
    id: 'app_bug',
    label: 'App bug',
    shortLabel: 'Bug',
    highlightKey: 'warning',
    placeholder: IS_SAVANT_FREE
      ? 'Report a problem with SavantFree (crashes, errors, UI issues, etc.)'
      : 'Report a problem with SavantCode (crashes, errors, UI issues, etc.)',
  },
  {
    id: 'other',
    label: 'Other',
    shortLabel: 'Other',
    highlightKey: 'info',
    placeholder: 'Tell us more (what happened, what you expected)...',
  },
] as const satisfies readonly CategoryOption[]

// Compile-time exhaustiveness: ensures every FeedbackCategory has a CATEGORY_OPTIONS entry.
// If a new category is added to FEEDBACK_CATEGORIES, TypeScript will error here until
// a corresponding entry is added to CATEGORY_OPTIONS above.
type CoveredCategories = (typeof CATEGORY_OPTIONS)[number]['id']
type _AssertAllCategoriesCovered = [FeedbackCategory] extends [
  CoveredCategories,
]
  ? true
  : never
const _exhaustiveCheck: _AssertAllCategoriesCovered = true
void _exhaustiveCheck

export const FEEDBACK_CONTAINER_HORIZONTAL_INSET = 4 // border + padding on each side
const CATEGORY_BUTTON_EXTRA_WIDTH = 6 // indicator + padding + border
const CATEGORY_BUTTON_GAP_WIDTH = 1

export const calculateCategoryRowWidth = (labels: readonly string[]): number =>
  labels.reduce((total, label, idx) => {
    const buttonWidth = label.length + CATEGORY_BUTTON_EXTRA_WIDTH
    const gapWidth = idx === 0 ? 0 : CATEGORY_BUTTON_GAP_WIDTH
    return total + buttonWidth + gapWidth
  }, 0)

export const FULL_CATEGORY_ROW_WIDTH = calculateCategoryRowWidth(
  CATEGORY_OPTIONS.map((opt) => opt.label),
)
