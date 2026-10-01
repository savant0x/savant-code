import {
  CC,
  CompileError,
  CompileErrorCode,
  SC,
  parseDoc,
  semverMax,
  toJsonSchema,
} from './compile-shared.ts'
import {
  assertPureJson,
  docHash,
  isEstimatedLine,
  type Json,
  type ProviderDef,
  pruneUndefined,
  stableStringify,
  zDefaultCredentials,
  zResourceDef,
  zResourceDoc,
  zResourceName,
} from '../core/mod.ts'



import type { FnInterner } from './fns.ts'
import type z from 'zod'

// T106 file split: `compileResource` extracted VERBATIM from compile.ts
// (300-line ceiling; zero behavior change).

export interface CompileResourceArgs {
  providerName: string
  providerFile: string
  provider: ProviderDef
  resourceName: string
  rawDef: unknown
  interner: FnInterner
  logger?: { warn(message: string, fields?: unknown): void }
}

export async function compileResource(
  args: CompileResourceArgs,
): Promise<z.infer<typeof zResourceDoc>> {
  const { providerName, providerFile, provider, resourceName, interner } = args
  parseDoc(
    zResourceName,
    resourceName,
    `connectors/${providerName}/resources/${resourceName} (folder name)`,
  )
  const where = `connectors/${providerName}/resources/${resourceName}`
  const resourceFile = `${where}/resource.ts`
  const def = parseDoc(zResourceDef, args.rawDef, resourceFile)
  // declared identity (design D46) — the loader asserts folder==slug on
  // disk; the compiler re-asserts for hand-built sources (tests)
  if (def.slug !== resourceName) {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: resource slug "${def.slug}" must equal the folder ` +
        `name "${resourceName}"`,
    )
  }
  const id = `${providerName}/${resourceName}`

  // ---- fused provider identity (no resource-level overrides) ----------
  const inject = provider.auth?.inject
  if (!inject) {
    throw new CompileError(
      CompileErrorCode.HOOK_UNRESOLVED,
      `${where}: provider auth.inject must resolve — resources run ` +
        `under the provider's identity (declare it in ${providerFile})`,
    )
  }
  const injectRef = await interner.intern(
    inject,
    `${providerFile}#auth.inject`,
    SC.fnAbiSince,
  )
  const credentialsSchema = toJsonSchema(
    provider.auth?.credentials ?? zDefaultCredentials,
    `${where}: auth.credentials`,
  )
  const baseUrl = provider.request?.baseUrl
  if (baseUrl === undefined) {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: provider request.baseUrl must resolve — resource ops ` +
        `target the provider origin (declare it in ${providerFile})`,
    )
  }
  const parsedBase = new URL(baseUrl)
  if (parsedBase.search !== '' || parsedBase.hash !== '') {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: baseUrl must not contain a query string or fragment`,
    )
  }
  const url = new URL(baseUrl.replace(/[?#]*$/, '').replace(/\/+$/, ''))
    .toString()
    .replace(/\/+$/, '')

  // ---- meta: same leaf rules as endpoints (docsUrl fallback, notes
  // provider-then-resource concatenation) ------------------------------
  const notes = [...(provider.meta.notes ?? []), ...(def.meta.notes ?? [])]
  const meta = pruneUndefined({
    ...def.meta,
    docsUrl: def.meta.docsUrl ?? provider.meta.docsUrl,
    notes: notes.length > 0 ? notes : undefined,
  } as unknown as Json)

  // ---- schemas ---------------------------------------------------------
  const dataSchema = toJsonSchema(def.data, `${where}: data`)
  const inputs = def.inputs
    ? (pruneUndefined({
        create: def.inputs.create
          ? toJsonSchema(def.inputs.create, `${where}: inputs.create`)
          : undefined,
        update: def.inputs.update
          ? toJsonSchema(def.inputs.update, `${where}: inputs.update`)
          : undefined,
        release: def.inputs.release
          ? toJsonSchema(def.inputs.release, `${where}: inputs.release`)
          : undefined,
      }) as Record<string, Json>)
    : undefined

  // ---- fns: lifecycle + reconcile meters + views + webhooks -----------
  const verifyRef = await interner.intern(
    def.lifecycle.verify,
    `${resourceFile}#lifecycle.verify`,
    SC.resourcesSince,
  )
  const releaseRef = await interner.intern(
    def.lifecycle.release,
    `${resourceFile}#lifecycle.release`,
    SC.resourcesSince,
  )
  const refreshRef = def.lifecycle.refresh
    ? await interner.intern(
        def.lifecycle.refresh,
        `${resourceFile}#lifecycle.refresh`,
        SC.resourcesSince,
      )
    : undefined

  // ---- reconcileUsage coherence (design D39): the sync defs cover
  // EXACTLY the estimated lines — a fixed line cannot reconcile, an
  // estimated line must.
  const estimatedLines = new Set(
    Object.entries(def.usage.lines)
      .filter(([, line]) => isEstimatedLine(line))
      .map(([name]) => name),
  )
  for (const line of Object.keys(def.reconcileUsage ?? {})) {
    if (!estimatedLines.has(line)) {
      throw new CompileError(
        CompileErrorCode.DOC_MALFORMED,
        `${where}: reconcileUsage.${line} names a line that is ` +
          `not ESTIMATED (only estimated lines reconcile)`,
      )
    }
  }
  for (const line of estimatedLines) {
    if (def.reconcileUsage?.[line] === undefined) {
      throw new CompileError(
        CompileErrorCode.DOC_MALFORMED,
        `${where}: estimated line "${line}" has no ` +
          `reconcileUsage entry — an estimation must sync`,
      )
    }
  }
  const reconcileUsage: Record<string, Json> = {}
  for (const [line, entry] of Object.entries(def.reconcileUsage ?? {}).sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    reconcileUsage[line] = {
      everyMs: entry.everyMs,
      get: (await interner.intern(
        entry.get,
        `${resourceFile}#reconcileUsage.${line}`,
        SC.resourcesSince,
      )) as unknown as Json,
    }
  }
  const views: Record<string, Json> = {}
  for (const [kind, view] of Object.entries(def.views ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    views[kind] = pruneUndefined({
      label: view.label,
      read: (await interner.intern(
        view.read,
        `${resourceFile}#views.${kind}`,
        SC.resourcesSince,
      )) as unknown as Json,
    }) as Record<string, Json>
  }
  const webhooks: Record<string, Json> = {}
  for (const [slug, hook] of Object.entries(def.webhooks ?? {}).sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    const label = `${resourceFile}#webhooks.${slug}`
    webhooks[slug] = pruneUndefined({
      verify: hook.verify as unknown as Json,
      route: (await interner.intern(
        hook.route,
        `${label}.route`,
        SC.resourcesSince,
      )) as unknown as Json,
      subscribe: (await interner.intern(
        hook.subscribe,
        `${label}.subscribe`,
        SC.resourcesSince,
      )) as unknown as Json,
      unsubscribe: hook.unsubscribe
        ? ((await interner.intern(
            hook.unsubscribe,
            `${label}.unsubscribe`,
            SC.resourcesSince,
          )) as unknown as Json)
        : undefined,
    }) as Record<string, Json>
  }

  // ---- assemble --------------------------------------------------------
  const docWithoutHash = pruneUndefined({
    specVersion: SC.specVersion,
    id,
    provider: providerName,
    // the family floor rides in explicitly: a minimal resource doc
    // (default-credential provider) might otherwise carry only
    // fnAbiSince-stamped inject
    minEngineVersion: semverMax([SC.resourcesSince]),
    meta,
    data: { schema: dataSchema },
    inputs: inputs && Object.keys(inputs).length > 0 ? inputs : undefined,
    usage: def.usage as unknown as Json,
    reconcileUsage:
      Object.keys(reconcileUsage).length > 0 ? reconcileUsage : undefined,
    lifecycle: {
      verify: verifyRef as unknown as Json,
      release: releaseRef as unknown as Json,
      refresh: refreshRef as unknown as Json,
    },
    views: Object.keys(views).length > 0 ? views : undefined,
    webhooks: Object.keys(webhooks).length > 0 ? webhooks : undefined,
    auth: {
      inject: injectRef as unknown as Json,
      credentials: credentialsSchema,
    },
    request: { url },
    timeouts: {
      requestMs:
        provider.timeouts?.requestMs ?? CC.defaultTimeouts.requestMs,
    },
  }) as Record<string, Json>

  const hash = await docHash(docWithoutHash)
  const doc = parseDoc(zResourceDoc, { ...docWithoutHash, hash }, where)

  const size = stableStringify(docWithoutHash).length
  if (size > CC.docSizeFailBytes) {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: doc size ${size} > ${CC.docSizeFailBytes}`,
    )
  }
  if (size > CC.docSizeWarnBytes) {
    args.logger?.warn(`doc size over warn threshold`, { where, size })
  }
  assertPureJson(doc, `${where} compiled doc`)
  return doc
}
