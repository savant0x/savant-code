import { z } from 'zod'

import { assembleBundle } from './compile-bundle.ts'
import { compileEndpointPhaseA } from './compile-endpoint-a.ts'
import { compileEndpointPhaseB } from './compile-endpoint-b.ts'
import { compileBindings } from './compile-endpoint-bindings.ts'
import { assembleEndpointDoc } from './compile-endpoint-doc.ts'
import { buildMembership, sortConnectorSources } from './compile-intake.ts'
import {
  assembleProviderDoc,
  checkProviderPoolsDrained,
} from './compile-provider.ts'
import { compileResource } from './compile-resource.ts'
import { parseCategories, parseDoc } from './compile-shared.ts'
import { FnInterner } from './fns.ts'
import {
  assertPureJson,
  type Bundle,
  type ConnectorSource,
  type EndpointDoc,
  type FnRef,
  type Json,
  type LeafCategory,
  type ProviderDoc,
  type ResourceDoc,
  zEndpointDef,
  zEndpointName,
  zProviderDef,
} from '../core/mod.ts'

import type { Logger } from '../shared/logging.ts'

// T106 file split: compile.ts is now the compileBundle ORCHESTRATOR. The
// phases moved VERBATIM to compile-shared.ts (errors, parseDoc, semverMax,
// toJsonSchema, resolve, category lint), compile-endpoint-a.ts (identity,
// meta, request, lifecycle, auth, pure hooks), compile-endpoint-b.ts (usage
// model, quantities pair, vendor meter), compile-endpoint-credits.ts,
// compile-endpoint-bindings.ts, compile-resource.ts, compile-provider.ts.
// Zero behavior change; the mod.ts surface (compileBundle, CompileError,
// CompileErrorCode, CompileOptions) is unchanged.

export { CompileError, CompileErrorCode } from './compile-shared.ts'

export interface CompileOptions {
  /** Toolchain provenance — never gates (engine gates on minEngineVersion + specVersion). */
  compilerVersion: string
  builtWithEngineVersion: string
  catalogVersion: string
  generatedAt: string
  /** The closed category vocabulary (connectors/categories.ts). */
  leafCategories: readonly LeafCategory[]
  logger?: Logger
}

/**
 * compileBundle — the compiler's SOLE job: the pure mapping
 * (defs, options) → bundle. Folder identity is a LOADER concern
 * (loadConnectorDefs asserts folder == provider.name); here everything keys
 * off `provider.name`. Loading lives in @shared/core (load/); list/inspect
 * over bundles lives in core's catalog.
 *
 * ONE composition rule (design D20): everything resolves LEAF-WISE, closest
 * wins — endpoint ?? provider ?? config default. That includes hooks
 * (endpoint toRequest/fromResponse/evidence REPLACES the provider's) and
 * meta leaves (docsUrl/categories). Headers merge key-wise (each key is a
 * leaf).
 */
export async function compileBundle(
  connectors: ConnectorSource[],
  opts: CompileOptions,
): Promise<Bundle> {
  const logger = opts.logger
  // categories ∈ registry, zod-delegated: an enum built from the vocabulary
  const zCategories = z
    .array(
      z.enum(
        opts.leafCategories.map((leaf) => leaf.id) as [string, ...string[]],
      ),
    )
    .optional()
  const interner = new FnInterner()
  const providers: Record<string, ProviderDoc> = {}
  const endpoints: Record<string, EndpointDoc> = {}
  const resources: Record<string, ResourceDoc> = {}
  const allDocs: EndpointDoc[] = []
  const allResourceDocs: ResourceDoc[] = []

  // intake validation + deterministic sort (extracted verbatim — see
  // compile-intake.ts)
  const sorted = sortConnectorSources(connectors, (connector) =>
    parseDoc(zProviderDef, connector.provider, 'provider def'),
  )

  for (const { connector, provider } of sorted) {
    const providerName = provider.name
    const providerFile = `connectors/${providerName}/provider.ts`
    parseCategories(zCategories, provider.meta.categories, providerFile)

    // ---- RESOURCES first (design D30): endpoint bindings resolve
    // against this provider's compiled resource docs, so they must
    // exist before the endpoint loop runs.
    const providerResourceDocs: Record<string, ResourceDoc> = {}
    const sortedResources = [...(connector.resources ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    ) // determinism
    for (const { name: resourceName, def: rawDef } of sortedResources) {
      const doc = await compileResource({
        providerName,
        providerFile,
        provider,
        resourceName,
        rawDef,
        interner,
        logger,
      })
      providerResourceDocs[doc.id] = doc
      resources[doc.id] = doc
      allResourceDocs.push(doc)
    }

    const providerEndpointDocs: EndpointDoc[] = []
    // D6b: a PROVIDER-declared pool is a provider-wide fact — it must
    // be drained by at least ONE of its endpoints, not by each one.
    const drainedByProvider = new Set<string>()
    const sortedEndpoints = [...connector.endpoints].sort((a, b) =>
      a.name.localeCompare(b.name),
    ) // determinism (see above)
    for (const { name: endpointName, def: rawDef } of sortedEndpoints) {
      parseDoc(
        zEndpointName,
        endpointName,
        `connectors/${providerName}/endpoints/${endpointName} (folder name)`,
      )
      const where = `connectors/${providerName}/endpoints/${endpointName}`
      const endpointFile = `${where}/endpoint.ts`
      const def = parseDoc(zEndpointDef, rawDef, endpointFile)

      // ---- phase A: identity/meta/request/lifecycle/auth/hooks ----
      const phaseA = await compileEndpointPhaseA({
        def,
        provider,
        providerName,
        where,
        endpointFile,
        providerFile,
        endpoints,
        interner,
        zCategories,
      })

      // ---- phase B: usage model/quantities/credits/schemas/cadence -
      const phaseB = await compileEndpointPhaseB({
        def,
        provider,
        where,
        endpointFile,
        providerFile,
        interner,
        lifecyclePollResolved: phaseA.lifecyclePollResolved,
        drainedByProvider,
      })

      // ---- resource bindings (design D32/D43) ----------------------
      const { bindingRefs, compiled: compiledBindings } =
        def.resources === undefined
          ? { bindingRefs: [] as FnRef[], compiled: undefined }
          : await compileBindings({
              bindingsSection: def.resources,
              providerName,
              where,
              endpointFile,
              interner,
              providerResourceDocs,
              inputSchemas: phaseB.inputSchemas,
            })

      // ---- minEngineVersion AUTO + doc assembly + validation ------
      const doc = await assembleEndpointDoc({
        def,
        providerName,
        where,
        interner,
        phaseA,
        phaseB,
        bindingRefs,
        compiledBindings: compiledBindings as Record<string, Json> | undefined,
        hasResources: def.resources !== undefined,
        loggerWarn: (message, fields) => logger?.warn(message, fields),
      })

      assertPureJson(doc, `${where} compiled doc`)
      providerEndpointDocs.push(doc)
      endpoints[doc.id] = doc // sorted insertion (see determinism note)
      allDocs.push(doc)
    }

    // ---- D6b: provider pools drained check (moved verbatim) --------
    checkProviderPoolsDrained({
      provider,
      providerFile,
      drainedByProvider,
    })

    // ---- ProviderDoc: identity + display (+ webhooks) ---------------
    providers[providerName] = await assembleProviderDoc({
      provider,
      providerName,
      providerFile,
      interner,
      providerEndpointDocs,
      providerResourceDocs,
    })
  }

  // ---- taxonomy: closed vocabulary + endpoint membership ----------------
  const membership = buildMembership(allDocs)

  // ---- bundle assembly — cross-doc invariants live in zBundle.superRefine
  const bundle = assembleBundle({
    providers,
    endpoints,
    resources,
    allDocs,
    allResourceDocs,
    opts,
    membership,
    fnTable: interner.sorted(),
  })
  assertPureJson(bundle, 'bundle')
  return bundle
}
