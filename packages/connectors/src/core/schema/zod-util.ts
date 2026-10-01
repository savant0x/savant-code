import { ZodDiscriminatedUnion, ZodObject } from 'zod'

import type { ZodType } from 'zod'

/**
 * Extract the discriminator VALUES from a zod discriminated union — the
 * monid-services `@shared/utils/zod` helper, ported (v1 zPriceTypes
 * pattern): derived enums can never go stale against their union, because
 * they are computed FROM it (usage/model/mod.ts derives zUsageModelKind
 * this way).
 */
// port: typed against the union's own options — replaces the upstream
// `any` instantiations (PORT-NOTES.md). The return is deliberately widened
// to `string[]`: zod's generics cannot express the precise literal tuple
// here without `any`, and the sole caller (usage/model/mod.ts) casts the
// result to the enum tuple anyway.
type DiscUnion<K extends string> = ZodDiscriminatedUnion<readonly ZodType[], K>

export function extractZodDiscriminatorKeys<K extends string>(
  union: DiscUnion<K>,
  key: K,
): string[] {
  const keys: string[] = []
  for (const option of union.options) {
    if (option instanceof ZodObject) {
      const leaf = (
        option.shape as unknown as Record<
          string,
          { values?: Iterable<string> } | undefined
        >
      )[key]
      if (leaf?.values) keys.push(...leaf.values)
    } else if (option instanceof ZodDiscriminatedUnion) {
      keys.push(...extractZodDiscriminatorKeys(option as DiscUnion<K>, key))
    }
  }
  return keys
}
