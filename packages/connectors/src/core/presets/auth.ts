import { preset } from './preset.ts'

import type { AuthInjectFn } from '../schema/hooks/mod.ts'

/**
 * presets.auth.* — auth.inject presets. Executed by the injector
 * (directTransport / hosted Relay), never by the engine pipeline;
 * `ctx.data.params` is validated against the auth credentials schema BEFORE
 * the fn runs (MISSING_CREDENTIAL). Only the RETURNED request egresses.
 *
 * (auth.query was removed deliberately — no current connector uses it;
 * it returns with semrush, whose v3 API authenticates via a `key` query
 * parameter. Catalog-side addition, zero engine impact.)
 */
export const auth = {
  /** Inject the apiKey as a named header (v1 httpProviderRuntime pattern). */
  header: preset('auth.header', (name: string): AuthInjectFn => ({ data }) => ({
    ...data.request,
    headers: { ...data.request.headers, [name]: data.params.apiKey },
  })),
  /** Inject the apiKey as an Authorization: Bearer header. */
  bearer: preset('auth.bearer', (): AuthInjectFn => ({ data }) => ({
    ...data.request,
    headers: {
      ...data.request.headers,
      Authorization: 'Bearer ' + data.params.apiKey,
    },
  })),
} as const
