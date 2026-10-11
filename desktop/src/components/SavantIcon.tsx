import { memo } from 'react'

import { savantIconSvg, type SavantIconName } from '../icons.generated'

import type { JSX } from 'react'

/**
 * Inline family icon for the desktop renderer (FID-2026-1009-004 Phase 3).
 *
 * Renders the generated SVG for a stable icon name, sized by CSS (default
 * 1em) so host surfaces control scale/alignment. `className` composes with
 * the base `savant-icon` class. Unknown names render empty — Law 14: a
 * cosmetic lookup never throws and never breaks the host row.
 */
export const SavantIcon = memo(function SavantIcon({
  name,
  className,
  title,
}: {
  name: SavantIconName
  className?: string
  /** Accessibility label; omit for decorative marks. */
  title?: string
}): JSX.Element {
  const svg = savantIconSvg(name)
  if (!svg)
    return (
      <span className="savant-icon savant-icon-missing" aria-hidden="true" />
    )
  return (
    <span
      className={className ? `savant-icon ${className}` : 'savant-icon'}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
})
