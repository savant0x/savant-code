import {
  resolve,
  SC,
  CC,
  CompileError,
  CompileErrorCode,
  parseCategories,
  parseDoc,
  toJsonSchema,
} from './compile-shared.ts'
import {
  type Json,
  pruneUndefined,
  zDefaultCredentials,
  zEndpointPath,
} from '../core/mod.ts'


import type {
  EndpointPhaseAArgs,
  EndpointPhaseAResult,
} from './compile-endpoint-types.ts'

// T106 file split: endpoint sections 1–6 extracted VERBATIM from compile.ts
// (identity, meta, request, lifecycle, auth, pure hook refs); zero behavior
// change. Argument/result contracts live in compile-endpoint-types.ts.

export async function compileEndpointPhaseA(
  args: EndpointPhaseAArgs,
): Promise<EndpointPhaseAResult> {
  const {
    def,
    provider,
    providerName,
    where,
    endpointFile,
    providerFile,
    endpoints,
    interner,
    zCategories,
  } = args

  // ---- PUBLIC identity (design D22): the def's `endpoint` path
  // ?? request.path (trailing slashes stripped) — folder names
  // are ORGANIZATIONAL only, never identity. id = provider# + the
  // path minus its leading slash ("apify#apidojo/tweet-scraper").
  const endpointPath = parseDoc(
    zEndpointPath,
    def.endpoint ?? def.request.path.replace(/\/+$/, ''),
    `${endpointFile}#endpoint (?? request.path)`,
  )
  const id = `${providerName}#${endpointPath.slice(1)}`
  if (endpoints[id] !== undefined) {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: duplicate endpoint identity ${id} — two defs ` +
        `resolve to the same endpoint path`,
    )
  }

  // ---- meta: leaf-wise fallback (docsUrl/categories) ------------
  const categories = def.meta.categories ?? provider.meta.categories
  parseCategories(zCategories, categories, where)
  // `notes` is the ONE ADDITIVE leaf (design add-meta-notes D1):
  // provider-then-endpoint concatenation, not closest-wins.
  const notes = [...(provider.meta.notes ?? []), ...(def.meta.notes ?? [])]
  const meta = pruneUndefined({
    ...def.meta,
    docsUrl: def.meta.docsUrl ?? provider.meta.docsUrl,
    notes: notes.length > 0 ? notes : undefined,
    categories,
  } as unknown as Json)

  // ---- request: baseUrl fallback, key-wise header merge ---------
  const baseUrl = def.request.baseUrl ?? provider.request?.baseUrl
  if (baseUrl === undefined) {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: no baseUrl — set request.baseUrl on the endpoint ` +
        `or request.baseUrl on the provider`,
    )
  }
  // CONCATENATE, don't URL-resolve — URL-resolution would DROP the
  // base's path prefix, and a base query/fragment would swallow the
  // path (both upstream-discovered bugs). Reject base query/fragment.
  const parsedBase = new URL(baseUrl)
  if (parsedBase.search !== '' || parsedBase.hash !== '') {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: baseUrl must not contain a query string or ` +
        `fragment (got ${baseUrl})`,
    )
  }
  // The URL constructor percent-encodes `{pathParam}` placeholders —
  // restore them AFTER normalization so substituteUrl can match.
  const url = new URL(
    baseUrl.replace(/[?#]*$/, '').replace(/\/+$/, '') + def.request.path,
  )
    .toString()
    .replace(/%7B([A-Za-z_][A-Za-z0-9_]*)%7D/g, '{$1}')
  const headers = {
    ...provider.request?.headers,
    ...def.request.headers,
  }

  // ---- lifecycle: leaf-wise phase fallback + completeness -------
  const lifecycleStart = resolve(
    def.lifecycle?.start,
    `${endpointFile}#lifecycle.start`,
    provider.lifecycle?.start,
    `${providerFile}#lifecycle.start`,
  )
  const lifecyclePoll = resolve(
    def.lifecycle?.poll,
    `${endpointFile}#lifecycle.poll`,
    provider.lifecycle?.poll,
    `${providerFile}#lifecycle.poll`,
  )
  const lifecycleStop = resolve(
    def.lifecycle?.stop,
    `${endpointFile}#lifecycle.stop`,
    provider.lifecycle?.stop,
    `${providerFile}#lifecycle.stop`,
  )
  if ((lifecyclePoll || lifecycleStop) && !lifecycleStart) {
    throw new CompileError(
      CompileErrorCode.HOOK_UNRESOLVED,
      `${where}: lifecycle.poll/stop without lifecycle.start — ` +
        `start must resolve (endpoint ?? provider) whenever any ` +
        `lifecycle phase does`,
    )
  }
  // Lifecycle fns are the ASYNC hook family — stamped with
  // schema.async_since, which floors minEngineVersion for the doc.
  const lifecycleStartRef = lifecycleStart
    ? await interner.intern(
        lifecycleStart.value,
        lifecycleStart.label,
        SC.asyncSince,
      )
    : undefined
  const lifecyclePollRef = lifecyclePoll
    ? await interner.intern(
        lifecyclePoll.value,
        lifecyclePoll.label,
        SC.asyncSince,
      )
    : undefined
  const lifecycleStopRef = lifecycleStop
    ? await interner.intern(
        lifecycleStop.value,
        lifecycleStop.label,
        SC.asyncSince,
      )
    : undefined

  // TYPED STATE (lifecycle.state → doc.lifecycle.stateSchema):
  // resolved leaf-wise like the phase fns; a declared state
  // schema without a resolved start is dead config.
  const lifecycleState = resolve(
    def.lifecycle?.state,
    `${endpointFile}#lifecycle.state`,
    provider.lifecycle?.state,
    `${providerFile}#lifecycle.state`,
  )
  if (lifecycleState && !lifecycleStart) {
    throw new CompileError(
      CompileErrorCode.STATE_SCHEMA_INVALID,
      `${where}: lifecycle.state is dead config — no resolved ` +
        `lifecycle.start`,
    )
  }
  const stateSchema = lifecycleState
    ? toJsonSchema(
        lifecycleState.value,
        `${where}: lifecycle.state`,
        CompileErrorCode.STATE_SCHEMA_INVALID,
      )
    : undefined

  // pollMs is meaningful only for pollable docs: an ENDPOINT-level
  // pollMs on a doc without a resolved poll is dead config (a
  // provider-level pollMs is a legitimate default over a mixed
  // sync/async endpoint set and is simply not emitted).
  if (def.timeouts?.pollMs !== undefined && !lifecyclePoll) {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: timeouts.pollMs is dead config — the endpoint ` +
        `has no resolved lifecycle.poll`,
    )
  }
  const timeouts = {
    requestMs:
      def.timeouts?.requestMs ??
      provider.timeouts?.requestMs ??
      CC.defaultTimeouts.requestMs,
    runMs:
      def.timeouts?.runMs ??
      provider.timeouts?.runMs ??
      CC.defaultTimeouts.runMs,
    pollMs: lifecyclePoll
      ? (def.timeouts?.pollMs ??
        provider.timeouts?.pollMs ??
        CC.defaultTimeouts.pollMs)
      : undefined,
  }

  // ---- auth: inject REQUIRED; credentials ?? default ------------
  const inject = resolve(
    def.auth?.inject,
    `${endpointFile}#auth.inject`,
    provider.auth?.inject,
    `${providerFile}#auth.inject`,
  )
  if (!inject) {
    throw new CompileError(
      CompileErrorCode.HOOK_UNRESOLVED,
      `${where}: auth.inject must resolve — declare it on the endpoint ` +
        `or the provider (e.g. presets.auth.header("x-api-key"))`,
    )
  }
  const injectRef = await interner.intern(
    inject.value,
    inject.label,
    SC.fnAbiSince,
  )
  const credentialsSchema = toJsonSchema(
    def.auth?.credentials ??
      provider.auth?.credentials ??
      zDefaultCredentials,
    `${where}: auth.credentials`,
  )

  // ---- hooks: FALLBACK (endpoint hook replaces provider's) ------
  const toRequest = resolve(
    def.input?.toRequest,
    `${endpointFile}#input.toRequest`,
    provider.input?.toRequest,
    `${providerFile}#input.toRequest`,
  )
  const toRequestRef = toRequest
    ? await interner.intern(toRequest.value, toRequest.label, SC.fnAbiSince)
    : undefined
  const fromResponse = resolve(
    def.output?.fromResponse,
    `${endpointFile}#output.fromResponse`,
    provider.output?.fromResponse,
    `${providerFile}#output.fromResponse`,
  )
  const fromResponseRef = fromResponse
    ? await interner.intern(
        fromResponse.value,
        fromResponse.label,
        SC.fnAbiSince,
      )
    : undefined
  const fromError = resolve(
    def.output?.fromError,
    `${endpointFile}#output.fromError`,
    provider.output?.fromError,
    `${providerFile}#output.fromError`,
  )
  const fromErrorRef = fromError
    ? await interner.intern(fromError.value, fromError.label, SC.fnAbiSince)
    : undefined
  return {
    id,
    endpointPath,
    meta,
    url,
    headers,
    timeouts,
    lifecycleStartRef,
    lifecyclePollRef,
    lifecycleStopRef,
    lifecyclePollResolved: lifecyclePoll !== undefined,
    stateSchema,
    injectRef,
    credentialsSchema,
    toRequestRef,
    fromResponseRef,
    fromErrorRef,
  }
}


