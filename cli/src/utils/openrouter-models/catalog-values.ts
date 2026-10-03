import { asOptionalNumber, asOptionalString } from './wire-guards'

export function catalogObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function catalogRows(value: unknown): unknown[] {
  const data = catalogObject(value).data
  return Array.isArray(data) ? data : []
}

export function catalogStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0,
  )
}

export function catalogLimit(value: unknown): number | undefined {
  const number = asOptionalNumber(value)
  return number !== undefined && number > 0 ? number : undefined
}

/** Decimal strings or numbers; zero is a reported free price. */
export function catalogPrice(value: unknown, divisor = 1): number | undefined {
  if (typeof value === 'string' && value.trim().length === 0) return undefined
  const number =
    typeof value === 'string' ? Number(value) : asOptionalNumber(value)
  return typeof number === 'number' && Number.isFinite(number) && number >= 0
    ? number / divisor
    : undefined
}

export function catalogCreated(value: unknown): string | undefined {
  if (typeof value === 'string') return asOptionalString(value)
  const epoch = asOptionalNumber(value)
  if (epoch === undefined || epoch <= 0) return undefined
  const date = new Date(epoch * 1000)
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}
