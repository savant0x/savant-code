import { z } from 'zod'

export const FREE_MODEL_KIND = 'FREE' as const

/**
 * FREE — this endpoint never bills (designs D25/D26): no components, no
 * metered lines, no card row. Fns return plain `{counts: {}}` (the
 * required billing triple — model + estimate + consolidate — still
 * exists, nothing silently defaults) and usage assembles to
 * `{credits: {}, evidence: {}}`: the MODEL is the free fact. Broker
 * surfaces render "free".
 *
 * FREE is a TOP-LEVEL model only — never a composite component (a free
 * component is an omitted component; structurally enforced: the
 * composite's scalar union has no FREE arm). No description/label
 * fields: those exist to explain derived counts and price lines — FREE
 * has neither, the kind says everything.
 */
export const zFreeModel = z.strictObject({
  kind: z.literal(FREE_MODEL_KIND),
})
export type FreeModel = z.infer<typeof zFreeModel>
