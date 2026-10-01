import { z } from 'zod'

import { zEnsureFn, zProvisionSeedFn } from '../hooks/resource-binding.ts'
import { zResourceId } from '../resource/ids.ts'

/**
 * ENDPOINT↔RESOURCE BINDINGS (design D32, reshaped by
 * refine-resource-model D43) — ONE optional `resources:` block on the
 * endpoint def, PURPOSE-KEYED: the key names the relationship (v1's
 * interaction vocabulary, pluralized), the value is ALWAYS an array —
 * an endpoint may touch several owned resources in one run (transfer a
 * call FROM one number TO another). ENDPOINT-ONLY — a provider cannot
 * default a binding (which endpoints touch resources is the least
 * provider-uniform fact there is).
 *
 *   - `provisions` (≤1, compile-checked): a success PROVISIONS — `seed`
 *     maps the settled envelope to the persisted record. ONE per
 *     endpoint: a run that could provision two things is two endpoints.
 *   - `uses`:     the run consumes an owned resource (places a call FROM
 *     your number): ownership-gated via `key`; marks the resource for
 *     usage reconcile at settle.
 *   - `updates`:  mutates upstream resource state (connect/disconnect):
 *     ownership-gated; marks it for refresh at settle.
 *   - `releases`: tears down: ownership-gated; a success marks the
 *     instance released (billing stops host-side).
 *   - `reads`:    read-only against an owned resource: ownership-gated,
 *     no settle marks.
 *
 * GATE ORDER is canonical: uses → updates → releases → reads,
 * declaration order within each purpose. Every KEYED binding's gated
 * instance rides into the lifecycle fns as `data.resources[alias]`
 * (`as` names the alias; default = the key path's last segment) — pure
 * hooks stay input-only.
 */

/** The interaction vocabulary as DATA — the cross-doc words (settle
 *  marks, webhook routing verdicts) name relationships with these. */
export const ResourceInteraction = {
  CREATES: 'CREATES',
  USES: 'USES',
  UPDATES: 'UPDATES',
  RELEASES: 'RELEASES',
  READS: 'READS',
} as const
export type ResourceInteraction =
  (typeof ResourceInteraction)[keyof typeof ResourceInteraction]

export const zResourceInteraction = z.enum(ResourceInteraction)

/** The purpose keys of the `resources:` block, in canonical gate order
 *  (provisions never gates — nothing exists yet to gate on). */
export const RESOURCE_GATE_ORDER = [
  'uses',
  'updates',
  'releases',
  'reads',
] as const
export type ResourcePurpose = (typeof RESOURCE_GATE_ORDER)[number]

/** provisions[]: nothing exists yet — no key, no alias, no ensure (the
 *  run itself IS the provisioner; a prerequisite that provisions belongs
 *  on the endpoints that USE the resource). */
export const zProvisionBinding = z.strictObject({
  /** The bound resource doc — "<provider>/<name>"; same-provider
   *  (compile-checked against the connector's own resources). */
  id: zResourceId,
  seed: zProvisionSeedFn,
})
export type ProvisionBinding = z.infer<typeof zProvisionBinding>

/** uses[] / reads[]: `key` OPTIONAL — an ANCHOR endpoint derives
 *  ownership in-fn via `utils.resources` (saperly's call artifacts); a
 *  pure reader serves from the reader alone (list-numbers). `ensure`
 *  makes prerequisites TRUE pre-run (v1 ensureResources). */
export const zGatedBinding = z.strictObject({
  id: zResourceId,
  /** JSONPath into the VALIDATED input naming the externalId the run
   *  targets (e.g. `$.body.from`). When present the engine resolves it
   *  and pre-gates: not owned ⇒ the uniform vendor-shaped 404 AS DATA,
   *  zero usage, upstream never touched — and the gated instance rides
   *  into the lifecycle fns as `data.resources[alias]`. */
  key: z.string().min(1).optional(),
  /** The instance's alias under `data.resources` — defaults to the key
   *  path's last segment; unique across ALL purposes. Keyed bindings
   *  only. */
  as: z.string().min(1).optional(),
  ensure: zEnsureFn.optional(),
})
export type GatedBinding = z.infer<typeof zGatedBinding>

/** updates[] / releases[]: `key` REQUIRED — their settle marks need a
 *  target. No ensure (mutating an instance you had to provision first is
 *  a uses-side prerequisite). */
export const zTargetedBinding = z.strictObject({
  id: zResourceId,
  key: z.string().min(1),
  as: z.string().min(1).optional(),
})
export type TargetedBinding = z.infer<typeof zTargetedBinding>

/** The alias a KEYED binding's gated instance rides under — `as`, or the
 *  key path's last segment (`$.body.fromNumberId` → "fromNumberId"). */
export function bindingAlias(binding: {
  key?: string
  as?: string
}): string | undefined {
  if (binding.as !== undefined) return binding.as
  if (binding.key === undefined) return undefined
  const segments = binding.key.split('.')
  return segments[segments.length - 1]
}

/** The binding invariants over the STRUCTURAL subset def and doc
 *  sections share ({id, key?, as?} arrays by purpose — fn slots differ,
 *  the invariants don't). ONE checker, applied by BOTH schemas'
 *  superRefines: a compiled doc crosses a trust boundary (disk, hosts),
 *  so the engine-side shape must re-enforce what the authoring schema
 *  enforced — a doctored two-provisions doc must fail LOAD, not
 *  silently run provisions[0]; duplicate aliases must fail load, not
 *  make `data.resources` last-write-wins. */
export interface ResourcesSectionShape {
  provisions?: ReadonlyArray<unknown>
  uses?: ReadonlyArray<{ key?: string; as?: string }>
  updates?: ReadonlyArray<{ key?: string; as?: string }>
  releases?: ReadonlyArray<{ key?: string; as?: string }>
  reads?: ReadonlyArray<{ key?: string; as?: string }>
}

export function resourcesSectionIssues(
  section: ResourcesSectionShape,
): Array<{ path: (string | number)[]; message: string }> {
  const issues: Array<{ path: (string | number)[]; message: string }> = []
  if ((section.provisions?.length ?? 0) > 1) {
    issues.push({
      path: ['provisions'],
      message:
        'an endpoint provisions at most ONE resource — a run ' +
        'that could provision two things is two endpoints',
    })
  }
  // `as` without `key` is unanchored — there is no instance to alias
  for (const purpose of ['uses', 'reads'] as const) {
    ;(section[purpose] ?? []).forEach((binding, index) => {
      if (binding.as !== undefined && binding.key === undefined) {
        issues.push({
          path: [purpose, index, 'as'],
          message:
            '`as` without `key` aliases nothing — a ' +
            'keyless binding gates no instance',
        })
      }
    })
  }
  // alias uniqueness ACROSS purposes — data.resources is one flat map
  const seen = new Map<string, string>()
  for (const purpose of RESOURCE_GATE_ORDER) {
    ;(section[purpose] ?? []).forEach((binding, index) => {
      const alias = bindingAlias(binding)
      if (alias === undefined) return
      const prior = seen.get(alias)
      if (prior !== undefined) {
        issues.push({
          path: [purpose, index],
          message:
            `alias "${alias}" collides with ${prior} — ` +
            `disambiguate with \`as\``,
        })
        return
      }
      seen.set(alias, `${purpose}[${index}]`)
    })
  }
  return issues
}

export const zResourcesSection = z
  .strictObject({
    provisions: z
      .array(zProvisionBinding)
      .max(
        1,
        'an endpoint provisions at most ONE resource — a run that could ' +
          'provision two things is two endpoints',
      )
      .optional(),
    uses: z.array(zGatedBinding).optional(),
    updates: z.array(zTargetedBinding).optional(),
    releases: z.array(zTargetedBinding).optional(),
    reads: z.array(zGatedBinding).optional(),
  })
  .superRefine((section, ctx) => {
    const purposes = [
      section.provisions,
      section.uses,
      section.updates,
      section.releases,
      section.reads,
    ]
    if (purposes.every((list) => (list?.length ?? 0) === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'resources: block declares no bindings — drop it',
      })
    }
    for (const issue of resourcesSectionIssues(section)) {
      ctx.addIssue({ code: 'custom', ...issue })
    }
  })
export type ResourcesSection = z.infer<typeof zResourcesSection>
