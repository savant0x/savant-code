import { familyToken } from './discovery-intelligence'
export type ProviderAlternative = {
  providerId: string
  host: string
  modelId: string
  observedAt: number
  supported: boolean
  credentialReady: boolean
  boundary: string
  removed?: boolean
  rejected?: boolean
}
export function eligibleProviderAlternative(
  row: ProviderAlternative,
  now: number,
): boolean {
  return (
    Number.isFinite(row.observedAt) &&
    row.observedAt <= now &&
    now - row.observedAt <= 24 * 3600_000 &&
    row.supported &&
    row.credentialReady &&
    row.boundary === 'boundary-ok' &&
    !row.removed &&
    !row.rejected &&
    Boolean(row.modelId)
  )
}
export function rankProviderAlternatives(
  model: string,
  rows: ProviderAlternative[],
  now: number,
): ProviderAlternative[] {
  return rows
    .filter(
      (row) =>
        eligibleProviderAlternative(row, now) &&
        familyToken(row.modelId) === familyToken(model),
    )
    .sort(
      (a, b) =>
        Number(b.modelId === model) - Number(a.modelId === model) ||
        a.providerId.localeCompare(b.providerId),
    )
}
