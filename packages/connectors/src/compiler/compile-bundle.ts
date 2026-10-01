import {
  type Bundle,
  type EndpointDoc,
  type FnEntry,
  type ProviderDoc,
  type ResourceDoc,
  zBundle,
} from '@shared/core'

import { parseDoc, semverMax } from './compile-shared.ts'

// T106 file split: the bundle-assembly tail extracted VERBATIM from
// compile.ts (300-line ceiling; zero behavior change).

export interface AssembleBundleArgs {
  providers: Record<string, ProviderDoc>
  endpoints: Record<string, EndpointDoc>
  resources: Record<string, ResourceDoc>
  allDocs: { minEngineVersion: string }[]
  allResourceDocs: { minEngineVersion: string }[]
  opts: {
    catalogVersion: string
    generatedAt: string
    compilerVersion: string
    builtWithEngineVersion: string
    leafCategories: readonly { id: string }[]
  }
  membership: Record<string, string[]>
  fnTable: Record<string, FnEntry>
}

/** Bundle assembly — cross-doc invariants live in zBundle.superRefine. */
export function assembleBundle(args: AssembleBundleArgs): Bundle {
  const {
    providers,
    endpoints,
    resources,
    allDocs,
    allResourceDocs,
    opts,
    membership,
  } = args
  return parseDoc(
    zBundle,
    {
      catalogVersion: opts.catalogVersion,
      generatedAt: opts.generatedAt,
      minEngineVersion: semverMax([
        ...allDocs.map((doc) => doc.minEngineVersion),
        ...allResourceDocs.map((doc) => doc.minEngineVersion),
      ]),
      toolchain: {
        compilerVersion: opts.compilerVersion,
        builtWithEngineVersion: opts.builtWithEngineVersion,
      },
      providers,
      endpoints,
      // ABSENT (not {}) when no provider declares one — the
      // pre-resource bundle stays byte-identical.
      ...(Object.keys(resources).length > 0 ? { resources } : {}),
      taxonomy: {
        leaves: [...opts.leafCategories],
        membership: Object.fromEntries(
          Object.keys(membership)
            .sort()
            .map((key) => [key, membership[key]]),
        ),
      },
      fnTable: args.fnTable,
    },
    'compiled bundle',
  )
}
