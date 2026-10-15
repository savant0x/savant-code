import { z } from 'zod'

/**
 * Resource doc identity — "<provider>/<slug>", both lowercase kebab-case
 * (design D30/D45). The AUTHORED `slug` on the def must equal the
 * resource's folder name (`connectors/<provider>/resources/<slug>/`) —
 * the loader and compiler both assert it.
 */
/** The resource's FOLDER identity — lowercase kebab, the `<slug>` of
 *  `connectors/<provider>/resources/<slug>/` and the tail of the doc id
 *  `<provider>/<slug>`. Declared on the def (design D46) and asserted
 *  against the folder by the loader — identity is never implicit. */
export const zResourceSlug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'resource slug must be lowercase kebab-case')
export type ResourceSlug = z.infer<typeof zResourceSlug>

export const zResourceId = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/,
    'resource id must be <provider>/<name> (lowercase kebab-case)',
  )
export type ResourceId = z.infer<typeof zResourceId>

export const zResourceName = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    'resource FOLDER name must be lowercase kebab-case',
  )
export type ResourceName = z.infer<typeof zResourceName>
