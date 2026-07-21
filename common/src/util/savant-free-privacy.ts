import type { SavantFreeIpPrivacySignal } from '../types/savant-free-session'

export const SAVANT_FREE_HARD_BLOCKED_PRIVACY_SIGNALS = [
  'vpn',
  'proxy',
  'tor',
  'res_proxy',
] as const satisfies readonly SavantFreeIpPrivacySignal[]

const SAVANT_FREE_HARD_BLOCKED_PRIVACY_SIGNAL_SET =
  new Set<SavantFreeIpPrivacySignal>(SAVANT_FREE_HARD_BLOCKED_PRIVACY_SIGNALS)

const SAVANT_FREE_HARD_BLOCKED_PRIVACY_SIGNAL_LABELS: Partial<Record<
  SavantFreeIpPrivacySignal,
  string
>> = {
  vpn: 'VPN',
  proxy: 'proxy',
  res_proxy: 'proxy',
  tor: 'Tor',
}

export function isSavantFreeHardBlockedPrivacySignal(
  signal: SavantFreeIpPrivacySignal,
): signal is SavantFreeIpPrivacySignal {
  return SAVANT_FREE_HARD_BLOCKED_PRIVACY_SIGNAL_SET.has(signal)
}

/**
 * ipinfo's `as.type` classifies the owning ASN as one of: ISP, Hosting,
 * Education, Government or Business (see ipinfo's "IPinfo Plus" sample DB).
 * Only `hosting` is a meaningful abuse signal — that's where VPN/proxy exits
 * and bot infrastructure live. The other classes are ordinary networks real
 * users sit behind, so we treat them as benign even when other heuristics
 * (e.g. ipinfo's `is_hosting` flag) would otherwise fire.
 */
const SAVANT_FREE_BENIGN_AS_TYPES = new Set([
  'isp',
  'business',
  'education',
  'government',
])

export function isSavantFreeBenignAsType(
  asType: string | null | undefined,
): boolean {
  return asType != null && SAVANT_FREE_BENIGN_AS_TYPES.has(asType.toLowerCase())
}

export function isSavantFreeHostingAsType(
  asType: string | null | undefined,
): boolean {
  return typeof asType === 'string' && asType.toLowerCase() === 'hosting'
}

export function formatSavantFreeHardBlockedPrivacySignals(
  signals: readonly SavantFreeIpPrivacySignal[] | null | undefined,
): string {
  const labels = Array.from(
    new Set(
      (signals ?? []).flatMap((signal): string[] => {
        if (!isSavantFreeHardBlockedPrivacySignal(signal)) return []
        return [SAVANT_FREE_HARD_BLOCKED_PRIVACY_SIGNAL_LABELS[signal]!]
      }),
    ),
  )

  if (labels.length === 0) return 'VPN, proxy, or Tor'
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
}

export function formatSavantFreeHardBlockedMessage(
  signals: readonly SavantFreeIpPrivacySignal[] | null | undefined,
): string {
  return `SavantFree cannot be used from ${formatSavantFreeHardBlockedPrivacySignals(
    signals,
  )} traffic. Please disable it and try again.`
}
