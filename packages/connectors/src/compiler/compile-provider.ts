import {
  docHash,
  type Json,
  type ProviderDef,
  type ProviderDoc,
  pruneUndefined,
  zProviderDoc,
} from '@shared/core'

import {
  SC,
  parseDoc,
  semverMax,
  CompileErrorCode,
  CompileError,
} from './compile-shared.ts'

import type { FnInterner } from './fns.ts'

// T106 file split: the provider-level finishing sections extracted VERBATIM
// from compile.ts (300-line ceiling; zero behavior change): the D6b
// drained-pool check, the provider webhooks section, and ProviderDoc
// assembly (minEngineVersion = max over the provider's WHOLE family).

/** D6b: every PROVIDER-declared pool is drained by at least ONE endpoint. */
export function checkProviderPoolsDrained(args: {
  provider: ProviderDef
  providerFile: string
  drainedByProvider: Set<string>
}): void {
  const { provider, providerFile, drainedByProvider } = args
  for (const id of Object.keys(provider.usage?.credits ?? {})) {
    if (!drainedByProvider.has(id)) {
      throw new CompileError(
        CompileErrorCode.HOOK_UNRESOLVED,
        `${providerFile}: declared credit "${id}" is drained ` +
          `by no endpoint — remove it or reference it from ` +
          `a line's consumes.credit (drained: ` +
          `${[...drainedByProvider].sort().join(', ') || 'none'})`,
      )
    }
  }
}

export async function assembleProviderDoc(args: {
  provider: ProviderDef
  providerName: string
  providerFile: string
  interner: FnInterner
  providerEndpointDocs: { minEngineVersion: string }[]
  providerResourceDocs: Record<string, { minEngineVersion: string }>
}): Promise<ProviderDoc> {
  const {
    provider,
    providerName,
    providerFile,
    interner,
    providerEndpointDocs,
    providerResourceDocs,
  } = args

  // ---- provider webhooks (design D36/D44): scope is positional —
  // a hook on the provider def IS the account stream
  let webhooksDoc: Record<string, Json> | undefined
  if (provider.webhooks) {
    webhooksDoc = {}
    for (const [slug, hook] of Object.entries(provider.webhooks).sort(
      ([a], [b]) => a.localeCompare(b),
    )) {
      const label = `${providerFile}#webhooks.${slug}`
      webhooksDoc[slug] = pruneUndefined({
        verify: hook.verify as unknown as Json,
        route: (await interner.intern(
          hook.route,
          `${label}.route`,
          SC.resourcesSince,
        )) as unknown as Json,
        subscribe: hook.subscribe
          ? ((await interner.intern(
              hook.subscribe,
              `${label}.subscribe`,
              SC.resourcesSince,
            )) as unknown as Json)
          : undefined,
        unsubscribe: hook.unsubscribe
          ? ((await interner.intern(
              hook.unsubscribe,
              `${label}.unsubscribe`,
              SC.resourcesSince,
            )) as unknown as Json)
          : undefined,
      }) as Record<string, Json>
    }
  }

  // ---- ProviderDoc: identity + display (+ webhooks, the one
  // fn-bearing section) — minEngineVersion is the max over the
  // provider's WHOLE family: endpoints, resources, webhook fns.
  const providerWithoutHash = pruneUndefined({
    specVersion: SC.specVersion,
    name: providerName,
    minEngineVersion: semverMax([
      ...providerEndpointDocs.map((doc) => doc.minEngineVersion),
      ...Object.values(providerResourceDocs).map(
        (doc) => doc.minEngineVersion,
      ),
      ...(provider.webhooks ? [SC.resourcesSince] : []),
    ]),
    meta: provider.meta as unknown as Json,
    webhooks: webhooksDoc as unknown as Json,
  }) as Record<string, Json>
  const doc = parseDoc(
    zProviderDoc,
    {
      ...providerWithoutHash,
      hash: await docHash(providerWithoutHash),
    },
    providerFile,
  )
  return doc
}
