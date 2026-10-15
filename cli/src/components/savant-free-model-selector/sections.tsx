import { SAVANT_FREE_PREMIUM_SESSION_LIMIT } from '@savant-code/common/constants/savant-free-models'
import React from 'react'

import { SECTION_GAP } from './layout'
import { ModelRowButton } from './model-row'
import { useTheme } from '../../hooks/use-theme'
import { formatSessionUnits } from '../../utils/format-session-units'

import type { Section } from './layout'
import type { ModelRowRenderContext } from './model-row'

/** One tier section: optional header (carries the shared premium-session
 *  quota inline) plus its model rows. */
export const SectionBlock: React.FC<{
  section: Section
  premiumUsed: number
  premiumExhausted: boolean
  premiumResetCountdown: string | null
  ctx: ModelRowRenderContext
}> = ({
  section,
  premiumUsed,
  premiumExhausted,
  premiumResetCountdown,
  ctx,
}) => {
  const theme = useTheme()
  return (
    <box
      key={section.key}
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
        marginTop: SECTION_GAP,
      }}
    >
      {/* wrapMode 'none' pins headers to one row — the offset math above
          assumes exactly 1 row per header, so a wrap would desync the
          focused-row auto-scroll. */}
      {section.label && (
        <text style={{ fg: theme.muted, wrapMode: 'none' }}>
          {section.label}
          {section.key === 'premium' && (
            <span fg={premiumExhausted ? theme.secondary : theme.muted}>
              {' '}
              · {formatSessionUnits(premiumUsed)} of{' '}
              {SAVANT_FREE_PREMIUM_SESSION_LIMIT} used
            </span>
          )}
          {section.key === 'premium' && premiumResetCountdown && (
            <span fg={theme.muted}> · resets in {premiumResetCountdown}</span>
          )}
        </text>
      )}
      {section.models.map((m) => (
        <ModelRowButton key={m.id} model={m} ctx={ctx} />
      ))}
    </box>
  )
}
