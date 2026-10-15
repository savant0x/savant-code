import type { SavantFreeSession } from '../../types/savant-free-session'
import type { SavantFreeIpPrivacySignal } from '@savant-code/common/types/savant-free-session'

/** Landing-screen heading. Referenced both as rendered text and by the
 *  picker's height-budget math (wrappedRows), so it lives in one place to keep
 *  the two from drifting. */
export const LANDING_HEADING = 'Start coding for free'

/** "in ~3h 20m" / "in ~45 min" / "in under a minute". Used on the
 *  rate-limited screen so users know when they can try again. */
export const formatRetryAfter = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return 'any moment now'
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`
}

const PRIVACY_SIGNAL_LABELS: Partial<
  Record<SavantFreeIpPrivacySignal, string>
> = {
  anonymous: 'anonymized network',
  proxy: 'proxy',
  relay: 'relay',
  res_proxy: 'residential proxy',
  tor: 'Tor',
  vpn: 'VPN',
  hosting: 'hosting network',
  service: 'privacy service',
}

export const formatPrivacySignalList = (
  signals: SavantFreeIpPrivacySignal[] | undefined,
): string => {
  const labels = Array.from(
    new Set(
      signals
        ?.map((signal) => PRIVACY_SIGNAL_LABELS[signal])
        .filter((label): label is string => Boolean(label)) ?? [],
    ),
  )
  if (labels.length === 0) {
    return 'VPN, Tor, proxy, relay, or anonymized network'
  }
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`
}

/** "BR" → "Brazil". Falls back to the raw code when the runtime can't
 *  resolve it (malformed code, missing ICU data). */
export const formatCountryName = (countryCode: string): string => {
  try {
    return (
      new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ??
      countryCode
    )
  } catch {
    return countryCode
  }
}

// Tone matters here: this is shown to users who, through no fault of their
// own, get the smaller model set. Frame it as model *availability* ("aren't
// available in BR yet"), never as restricted *access* ("limited mode",
// "blocked") — clear enough to answer "why these models?" for someone who
// goes looking, quiet enough to ignore for someone who doesn't. The VPN case
// is the one the user can act on, so it leads with the action. Rendered
// directly under the model list — that's where "why these models?" gets asked.
export const getLimitedModeNotice = (
  session: SavantFreeSession | null,
): string | null => {
  if (!session || !('countryBlockReason' in session)) {
    return "Some models aren't available on this connection"
  }
  const countryCode =
    'countryCode' in session &&
    session.countryCode &&
    session.countryCode !== 'UNKNOWN'
      ? session.countryCode
      : null
  switch (session.countryBlockReason) {
    case 'anonymous_network':
      return `Using a ${formatPrivacySignalList(session.ipPrivacySignals ?? undefined)}? More models are available on a direct connection`
    case 'country_not_allowed':
      return `Some models aren't available in ${countryCode ? formatCountryName(countryCode) : 'your region'} yet`
    case 'anonymized_or_unknown_country':
    case 'missing_client_ip':
    case 'unresolved_client_ip':
      return "We couldn't confirm your region, so we're showing models available everywhere"
    case 'ip_privacy_lookup_failed':
      return "We couldn't finish a network check, so we're showing models available everywhere"
    default:
      return "Some models aren't available on this connection"
  }
}
