import { z } from 'zod'

/**
 * Monetary primitives — ported from monid-services (models/monetary/*) so
 * hosted settlement consumes our `usage.cost` without translation.
 *
 * `value` is always a non-negative integer; `unit` says how to interpret it:
 *   MICRO_DOLLAR : value ÷ 1 000 000 = dollars  (canonical storage)
 *   CENT         : value ÷ 100       = dollars  (Stripe / wallet compat)
 *   DOLLAR       : value ÷ 1         = dollars  (human-readable)
 */
export const Currency = {
  USD: 'USD',
} as const
export const zCurrency = z.enum(Currency)
export type Currency = z.infer<typeof zCurrency>

export const MonetaryUnit = {
  MICRO_DOLLAR: 'MICRO_DOLLAR',
  CENT: 'CENT',
  DOLLAR: 'DOLLAR',
} as const
export const zMonetaryUnit = z.enum(MonetaryUnit)
export type MonetaryUnit = z.infer<typeof zMonetaryUnit>

export const zMonetaryValue = z.strictObject({
  currency: zCurrency,
  value: z.number().int().nonnegative(),
  unit: zMonetaryUnit,
})
export type MonetaryValue = z.infer<typeof zMonetaryValue>

/**
 * MoneyUtil — `ctx.utils.money`, the monetary half of the hook ABI
 * (implemented by the engine in engine/fn-utils.ts; interface lives here in
 * the contract package, like JsonUtil). Hook fns are closed terms, so these
 * conversions must come from the host.
 */
export interface MoneyUtil {
  /** Dollar amount → canonical MICRO_DOLLAR MonetaryValue. */
  fromDollars(dollars: number, currency?: Currency): MonetaryValue
  /** Micro-dollar amount → MonetaryValue (rounded to an integer). */
  fromMicroDollars(microDollars: number, currency?: Currency): MonetaryValue
}
