import { formatSavantFreeHardBlockedPrivacySignals } from '@savant-code/common/util/savant-free-privacy'
import React from 'react'

import { formatRetryAfter } from './format'
import { useTheme } from '../../hooks/use-theme'
import { formatSessionUnits } from '../../utils/format-session-units'

import type { SavantFreeSession } from '../../types/savant-free-session'

/** Country outside the free-mode allowlist. Terminal — polling has stopped.
 *  Tell the user up front rather than letting them send a request that the
 *  chat/completions gate would reject. */
export const CountryBlockedPanel: React.FC<{
  session: Extract<SavantFreeSession, { status: 'country_blocked' }>
}> = ({ session }) => {
  const theme = useTheme()
  return (
    <>
      <text style={{ fg: theme.secondary, marginBottom: 1 }}>
        ⚠ Free mode isn't available in your region
      </text>
      <text style={{ fg: theme.muted, wrapMode: 'word' }}>
        {session.countryBlockReason === 'anonymous_network' ? (
          <>
            We detected{' '}
            {formatSavantFreeHardBlockedPrivacySignals(
              session.ipPrivacySignals,
            )}{' '}
            traffic
            {session.countryCode === 'UNKNOWN' ? (
              ''
            ) : (
              <>
                {' '}
                from <span fg={theme.foreground}>{session.countryCode}</span>
              </>
            )}
            . SavantFree can't be used from VPN, proxy, or Tor traffic. Disable
            it and restart SavantFree to try again.
          </>
        ) : session.countryCode === 'UNKNOWN' ? (
          <>
            We couldn't verify an eligible location for this request. VPN, Tor,
            proxy, or unknown-location traffic can't use savant-free. Press
            Ctrl+C to exit.
          </>
        ) : (
          <>
            We detected your location as{' '}
            <span fg={theme.foreground}>{session.countryCode}</span>, which is
            outside the countries where savant-free is currently offered. Press
            Ctrl+C to exit.
          </>
        )}
      </text>
    </>
  )
}

/** Account banned. Terminal — polling has stopped. Blocking here stops banned
 *  bots from re-entering free mode. */
export const BannedPanel: React.FC = () => {
  const theme = useTheme()
  return (
    <>
      <text style={{ fg: theme.secondary, marginBottom: 1 }}>
        ⚠ Account unavailable
      </text>
      <text style={{ fg: theme.muted, wrapMode: 'word' }}>
        This account has been suspended and can't use savant-free. If you think
        this is a mistake, contact support@savant-code.com. Press Ctrl+C to
        exit.
      </text>
    </>
  )
}

/** Shared free-session quota exhausted. Terminal for this run — the user can
 *  exit and come back once the daily Pacific reset passes. */
export const RateLimitedPanel: React.FC<{
  session: Extract<SavantFreeSession, { status: 'rate_limited' }>
}> = ({ session }) => {
  const theme = useTheme()
  return (
    <>
      <text style={{ fg: theme.secondary, marginBottom: 1 }}>
        ⚠ Session limit reached
      </text>
      <text style={{ fg: theme.muted, wrapMode: 'word' }}>
        You've used{' '}
        <span fg={theme.foreground}>
          {formatSessionUnits(session.recentCount)} of {session.limit}
        </span>{' '}
        sessions today. Try again in{' '}
        <span fg={theme.foreground}>
          {formatRetryAfter(session.retryAfterMs)}
        </span>
        . Press Ctrl+C to exit.
      </text>
    </>
  )
}
