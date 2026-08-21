import type { AdResponse } from '../hooks/use-gravity-ad'

const MIN_INLINE_WIDTH_WITH_DESTINATION = 48
/** 'Ad' disclosure label rendered next to the inline title. */
export const INLINE_AD_DISCLOSURE = 'Ad'
/** Horizontal gap between inline title/description and their trailing labels. */
export const INLINE_AD_GAP = 2
/** Arrow suffix rendered after the inline destination label. */
export const INLINE_AD_LINK_SUFFIX = ' ↗'

export function truncateToLines(
  text: string,
  lineWidth: number,
  maxLines: number,
): string {
  if (lineWidth <= 0) return text
  const maxChars = lineWidth * maxLines
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}

export function truncateToWidth(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text
  return text.slice(0, width - 1) + '…'
}

export const extractDomain = (url: string): string => {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function getAdDisplayLabel(ad: Pick<AdResponse, 'title' | 'url'>): {
  text: string
  variant: 'domain' | 'title'
} {
  const url = ad.url.trim()
  if (url) {
    return { text: extractDomain(url), variant: 'domain' }
  }

  return { text: ad.title.trim() || 'Sponsored', variant: 'title' }
}

export function getInlineAdLayout(
  ad: Pick<AdResponse, 'adText' | 'title' | 'url'>,
  width: number,
): { title: string; description: string; label: string } {
  const contentWidth = Math.max(0, width - 4) // border + horizontal padding
  const displayLabel = getAdDisplayLabel(ad)
  const headerTrailingWidth = INLINE_AD_GAP + INLINE_AD_DISCLOSURE.length
  const titleWidth = Math.max(0, contentWidth - headerTrailingWidth)
  const destinationLabel =
    width >= MIN_INLINE_WIDTH_WITH_DESTINATION &&
    displayLabel.variant === 'domain'
      ? displayLabel.text
      : ''
  const maxLabelWidth = Math.max(0, Math.min(24, Math.floor(contentWidth / 3)))
  const label = truncateToWidth(destinationLabel, maxLabelWidth)
  const trailingWidth = label
    ? INLINE_AD_GAP + label.length + INLINE_AD_LINK_SUFFIX.length
    : 0
  const descriptionWidth = Math.max(0, contentWidth - trailingWidth)

  return {
    title: truncateToWidth(ad.title.trim() || displayLabel.text, titleWidth),
    description: truncateToWidth(ad.adText.trim(), descriptionWidth),
    label,
  }
}

/**
 * Calculate evenly distributed column widths that sum exactly to availableWidth.
 * Distributes remainder pixels across the first N columns so there's no gap.
 */
export function columnWidths(count: number, availableWidth: number): number[] {
  const base = Math.floor(availableWidth / count)
  const remainder = availableWidth - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}
