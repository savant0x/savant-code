import React from 'react'

import { useNow } from '../hooks/use-now'
import { useSavantFreeSessionProgress } from '../hooks/use-savant-free-session-progress'
import { useTheme } from '../hooks/use-theme'
import { formatSessionUnits } from '../utils/format-session-units'
import { formatSavantFreePremiumResetCountdown } from '../utils/savant-free-premium-reset'

import type { SavantFreeSession } from '../types/savant-free-session'

interface SavantFreeActiveSessionSummaryProps {
  session: SavantFreeSession | null
}

export const SavantFreeActiveSessionSummary: React.FC<
  SavantFreeActiveSessionSummaryProps
> = ({ session }) => {
  const theme = useTheme()
  const now = useNow(60_000, session?.status === 'active')
  const progress = useSavantFreeSessionProgress(session)
  const quota = session?.status === 'active' ? session.rateLimit : undefined

  if (session?.status !== 'active' || !progress) {
    return null
  }

  if (!quota) {
    return null
  }

  const resetCountdown = formatSavantFreePremiumResetCountdown(
    new Date(quota.resetAt),
    now,
  )
  const label =
    'accessTier' in session && session.accessTier === 'limited'
      ? 'sessions'
      : 'premium sessions'
  // recentCount already includes the active session's 1.0-unit reservation
  // (written as an admit row at promotion), so it reflects everything counted
  // against the quota — spent plus in-flight. Show it as the total used to match
  // the model selection menu and the other session-status screens.
  return (
    <box
      style={{
        paddingLeft: 1,
        paddingRight: 1,
        marginBottom: 1,
        flexShrink: 0,
      }}
    >
      <text style={{ wrapMode: 'word', fg: theme.muted }}>
        <span fg={theme.foreground}>
          {formatSessionUnits(quota.recentCount)} of {quota.limit}
        </span>
        <span fg={theme.muted}>
          {' '}
          {label} used · resets in {resetCountdown}
        </span>
      </text>
    </box>
  )
}
