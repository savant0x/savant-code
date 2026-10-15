import { SC, CompileError, CompileErrorCode } from './compile-shared.ts'
import {
  type FnRef,
  type Json,
  pruneUndefined,
  RESOURCE_GATE_ORDER,
  type ResourceDoc,
  type zEndpointDef,
} from '../core/mod.ts'

import type { FnInterner } from './fns.ts'
import type z from 'zod'

// T106 file split: the resource-bindings section (design D32/D43) extracted
// VERBATIM from compile.ts; zero behavior change. On the sync-only build the
// launch catalog declares no bindings, but the COMPILER stays
// contract-complete — binding-carrying defs still compile (and floor
// minEngineVersion), so upstream connector sources keep validating.

export interface CompiledBindings {
  provisions?: Json[]
  uses?: Json[]
  updates?: Json[]
  releases?: Json[]
  reads?: Json[]
}

export interface CompileBindingsArgs {
  bindingsSection: NonNullable<z.infer<typeof zEndpointDef>['resources']>
  providerName: string
  where: string
  endpointFile: string
  interner: FnInterner
  /** This provider's compiled resource docs, by id (`<provider>/<name>`). */
  providerResourceDocs: Record<string, ResourceDoc>
  /** The endpoint's compiled input schemas (dead-binding lint target). */
  inputSchemas: {
    body?: Record<string, Json>
    queryParams?: Record<string, Json>
    pathParams?: Record<string, Json>
  }
}

/** Returns the interned binding refs + the compiled bindings section. */
export async function compileBindings(
  args: CompileBindingsArgs,
): Promise<{ bindingRefs: FnRef[]; compiled: CompiledBindings | undefined }> {
  const {
    bindingsSection,
    providerName,
    where,
    endpointFile,
    interner,
    providerResourceDocs,
    inputSchemas,
  } = args
  const bindingRefs: FnRef[] = []
  let compiled: CompiledBindings | undefined

  const compileBinding = async (
    binding: {
      id: string
      key?: string
      seed?: unknown
      ensure?: unknown
    },
    label: string,
    slotName: 'create' | 'update' | 'release' | undefined,
  ): Promise<{ seed?: FnRef; ensure?: FnRef }> => {
    // same-provider by construction: the binding is the
    // endpoint's contract with ITS OWN provider's resource
    if (!binding.id.startsWith(`${providerName}/`)) {
      throw new CompileError(
        CompileErrorCode.DOC_MALFORMED,
        `${where}: ${label} binds ${binding.id} — a ` +
          `foreign provider; bindings are same-provider ` +
          `(cross-provider reuse goes through ensure)`,
      )
    }
    const resourceDoc = providerResourceDocs[binding.id]
    if (!resourceDoc) {
      throw new CompileError(
        CompileErrorCode.DOC_MALFORMED,
        `${where}: ${label} binds ${binding.id} — matches ` +
          `no resources/<name>/resource.ts of this ` +
          `provider (compiled: ${Object.keys(providerResourceDocs).sort().join(', ') || 'none'})`,
      )
    }
    // dead-binding lint: the ownership key must point INTO the
    // declared input surface — a key no input can carry gates
    // every run into the uniform 404.
    if (binding.key !== undefined) {
      const match = binding.key.match(
        /^\$\.(body|queryParams|pathParams)\.([A-Za-z_][A-Za-z0-9_-]*)/,
      )
      if (!match) {
        throw new CompileError(
          CompileErrorCode.DOC_MALFORMED,
          `${where}: ${label} key ${binding.key} must be ` +
            `rooted at $.body / $.queryParams / $.pathParams`,
        )
      }
      const section = inputSchemas[match[1] as keyof typeof inputSchemas]
      const properties = (section?.properties ?? {}) as Record<string, Json>
      if (!(match[2] in properties)) {
        throw new CompileError(
          CompileErrorCode.DOC_MALFORMED,
          `${where}: ${label} key ${binding.key} is a DEAD ` +
            `binding — "${match[2]}" is not a property of ` +
            `the declared input.schema.${match[1]}`,
        )
      }
    }
    // input ⊇ inputs contract (design D30): the purpose's slot
    // on the resource def is the CATALOG shape; the endpoint
    // must be able to CARRY it.
    const slot = slotName
      ? resourceDoc.inputs?.[slotName as keyof typeof resourceDoc.inputs]
      : undefined
    if (slot !== undefined) {
      const slotRequired = Array.isArray(slot.required)
        ? slot.required.filter((key): key is string => typeof key === 'string')
        : []
      const bodyProps = new Set(
        Object.keys(
          (inputSchemas.body?.properties ?? {}) as Record<string, Json>,
        ),
      )
      const missing = slotRequired.filter((key) => !bodyProps.has(key))
      if (missing.length > 0) {
        throw new CompileError(
          CompileErrorCode.DOC_MALFORMED,
          `${where}: input.schema.body is not a superset ` +
            `of ${binding.id} inputs.${slotName} — ` +
            `missing required: ${missing.join(', ')}`,
        )
      }
      lintSlotShapes(
        slot as Record<string, Json>,
        (inputSchemas.body ?? {}) as Record<string, Json>,
        `${binding.id} inputs.${slotName}`,
        where,
      )
    }
    const seed = binding.seed
      ? await interner.intern(
          binding.seed,
          `${endpointFile}#${label}.seed`,
          SC.resourcesSince,
        )
      : undefined
    const ensure = binding.ensure
      ? await interner.intern(
          binding.ensure,
          `${endpointFile}#${label}.ensure`,
          SC.resourcesSince,
        )
      : undefined
    if (seed) bindingRefs.push(seed)
    if (ensure) bindingRefs.push(ensure)
    return { seed, ensure }
  }

  compiled = {}
  for (const [index, binding] of (bindingsSection.provisions ?? []).entries()) {
    const { seed } = await compileBinding(
      binding as typeof binding & Record<string, never>,
      `resources.provisions[${index}]`,
      'create',
    )
    ;(compiled.provisions ??= []).push({
      id: (binding as { id: string }).id,
      seed: seed as unknown as Json,
    })
  }
  const slotOf = {
    uses: undefined,
    updates: 'update',
    releases: 'release',
    reads: undefined,
  } as const
  for (const purpose of RESOURCE_GATE_ORDER) {
    const declared = bindingsSection[purpose] ?? []
    for (const [index, binding] of (
      declared as Array<{
        id: string
        key?: string
        as?: string
        ensure?: unknown
      }>
    ).entries()) {
      const { ensure } = await compileBinding(
        binding,
        `resources.${purpose}[${index}]`,
        slotOf[purpose],
      )
      ;(compiled[purpose] ??= []).push(
        pruneUndefined({
          id: binding.id,
          key: binding.key,
          as: binding.as,
          ensure: ensure as unknown as Json,
        }) as Json,
      )
    }
  }
  return { bindingRefs, compiled }
}

/** The slot-shape lint moved VERBATIM from compile.ts (used here). */
export function lintSlotShapes(
  slot: Record<string, Json>,
  body: Record<string, Json>,
  label: string,
  where: string,
  depth = 0,
): void {
  const slotRequired = Array.isArray(slot.required)
    ? slot.required.filter((key): key is string => typeof key === 'string')
    : []
  const slotProps = (slot.properties ?? {}) as Record<string, Json>
  const bodyProps = (body.properties ?? {}) as Record<string, Json>
  for (const key of slotRequired) {
    const slotProp = slotProps[key]
    const bodyProp = bodyProps[key]
    if (
      typeof slotProp !== 'object' ||
      slotProp === null ||
      typeof bodyProp !== 'object' ||
      bodyProp === null
    )
      continue
    const slotType = (slotProp as Record<string, Json>).type
    const bodyType = (bodyProp as Record<string, Json>).type
    if (
      typeof slotType === 'string' &&
      typeof bodyType === 'string' &&
      slotType !== bodyType
    ) {
      throw new CompileError(
        CompileErrorCode.DOC_MALFORMED,
        `${where}: input.schema.body.${key} is "${bodyType}" but ` +
          `${label} requires "${slotType}" — the endpoint would ` +
          `reject values the catalog contract accepts`,
      )
    }
    if (slotType === 'object' && bodyType === 'object' && depth < 1) {
      lintSlotShapes(
        slotProp as Record<string, Json>,
        bodyProp as Record<string, Json>,
        `${label}.${key}`,
        where,
        depth + 1,
      )
    }
  }
}
