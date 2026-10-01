import { z } from 'zod'

import { zCategoryId, zEndpointId } from '../common/ids.ts'

/**
 * LEAF category — the ONLY thing endpoints ever author (`meta.categories`).
 * The registry lives at connectors/categories.ts (closed vocabulary; adding a
 * leaf = same-PR registry edit). TOP groups, provider placement, and
 * visibility are HOSTED concerns (v1 round-4 model) — never in this repo.
 */
export const zLeafCategory = z
  .object({
    /** Stable single-segment slug — must self-describe without parent context. */
    id: zCategoryId,
    displayName: z.string().min(1),
    description: z.string().optional(),
  })
  .strict()
export type LeafCategory = z.infer<typeof zLeafCategory>

/** Compiled into the bundle: the full leaf registry + endpoint membership. */
export const zTaxonomy = z
  .object({
    leaves: z.array(zLeafCategory),
    /** leafId → endpoint ids (only leaves with members appear). */
    membership: z.record(zCategoryId, z.array(zEndpointId)),
  })
  .strict()
export type Taxonomy = z.infer<typeof zTaxonomy>

/** Registry constructor — validates shape + unique ids, freezes. */
export function defineLeafCategories(
  leaves: LeafCategory[],
): readonly LeafCategory[] {
  const parsed = z.array(zLeafCategory).parse(leaves)
  const ids = new Set<string>()
  for (const leaf of parsed) {
    if (ids.has(leaf.id)) {
      throw new Error(`duplicate leaf category id: ${leaf.id}`)
    }
    ids.add(leaf.id)
  }
  return Object.freeze(parsed)
}
