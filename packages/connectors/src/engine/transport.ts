import { zJsonSchemaDoc, type Json, type JsonSchemaDoc } from '@shared/core'
import { z } from 'zod'



import { applyAuth, credentialEnvVarsFor, credentialFieldsOf } from './auth.ts'
import { EngineError, EngineErrorCode } from './errors.ts'

import type {
  ParamsResolver,
  PreparedRequest,
  Transport,
  TransportResponse,
} from './interfaces/mod.ts'

// T106 port note: `pino` was the upstream credential-schema validator here
// (one call site: `pino(...).level`). The Savant port validates the doc's
// credential shape with zod directly — same fail-closed contract, no new
// dependency (recorded in PORT-NOTES.md).

const credentialShape = z.record(z.string(), z.string())

/**
 * Sniffing decode — the universal body rule (no per-endpoint flag): JSON if
 * it parses, else the COMPLETE raw body as a faithful string (a string IS
 * Json). Shared by the pipeline; vendor error pages are already flagged by
 * the HTTP status (isProviderError).
 */
export function sniffDecode(response: TransportResponse): Json {
  const text = response.body
  if (text.trim() === '') return null
  try {
    return JSON.parse(text) as Json
  } catch {
    return text
  }
}

/**
 * The default resolver, ONE convention: read `<NAME>_CREDENTIALS_<FIELD>`
 * for every field the doc's credential shape declares (plus the single
 * `<NAME>_API_KEY` alias for a field named `apiKey`). `fields` comes from
 * the doc — a caller that omits it gets the `{apiKey}` default shape.
 *
 * A variable that is SET BUT EMPTY is reported as the empty string, not
 * skipped: the credential schema's own `.min(1)` then rejects it as
 * MISSING_CREDENTIAL naming the variable. Blanking the canonical name is a
 * configuration error, never a silent fall-through to the alias.
 *
 * The resolver only READS; the injector validates the result against the
 * doc's credentials schema.
 */
export const envParamsResolver: ParamsResolver = (provider, fields) => {
  const params: Record<string, string> = {}
  for (const field of fields ?? ['apiKey']) {
    const value = resolveCredentialEnv(provider, field)
    if (value !== undefined) params[field] = value
  }
  return Promise.resolve(params)
}

/**
 * THE precedence rule, in ONE place: the first variable that is DEFINED wins,
 * whatever its value. A set-but-EMPTY canonical name therefore SHADOWS the
 * alias and is returned as `""` rather than skipped — blanking it is a
 * configuration error, and the credential schema's own `.min(1)` rejects it
 * by name. Falling through to the alias would hide a broken deployment.
 *
 * Every reader of the convention resolves through here — the params resolver
 * and the live-test gate — so the two can never disagree about which variable
 * supplies a field.
 */
export function resolveCredentialEnv(
  provider: string,
  field: string,
): string | undefined {
  for (const name of credentialEnvVarsFor(provider, field)) {
    const value = process.env[name] // port: was Deno.env.get (PORT-NOTES.md)
    if (value !== undefined) return value
  }
  return undefined
}

/** Live-test gate: does every declared credential field resolve to a
 *  NON-EMPTY value? Same precedence as the resolver (above), so the gate
 *  never opens onto a run the resolver would reject. `fields` defaults to
 *  the `{apiKey}` shape. */
export function envCredentialsPresent(
  provider: string,
  fields?: readonly string[],
): boolean {
  const wanted = fields ?? ['apiKey']
  return (
    wanted.length > 0 &&
    wanted.every((field) => {
      const value = resolveCredentialEnv(provider, field)
      return value !== undefined && value !== ''
    })
  )
}

/** Structural guard over the doc-declared credential shape before the
 *  injector zod-validates the resolved values against it. */
function parseCredentialSchema(doc: JsonSchemaDoc): JsonSchemaDoc {
  const parsed = zJsonSchemaDoc.safeParse(doc)
  if (!parsed.success) {
    throw new EngineError(
      EngineErrorCode.BAD_DOC,
      `auth.credentials is not a JSON Schema: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

function parseResolvedCredentials(resolved: Json): Record<string, string> {
  const parsed = credentialShape.safeParse(resolved)
  if (!parsed.success) {
    throw new EngineError(
      EngineErrorCode.MISSING_CREDENTIAL,
      `resolved credentials failed the record<string,string> shape: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

/**
 * OSS / local / tests: inject credentials HERE, then fetch. Auth travels
 * UNEXECUTED through the pipeline (PreparedRequest.auth) and is applied at
 * THIS egress boundary — credentials never enter the request pipeline
 * itself. `fetch` is injectable → fixture replay. Resolved values never
 * logged.
 */
export function directTransport(
  opts: {
    params?: ParamsResolver
    // port: was `typeof fetch` — narrowed to what the engine itself
    // exercises (string url); Bun's global fetch is still assignable
    // (PORT-NOTES.md)
    fetch?: (input: string, init?: RequestInit) => Promise<Response>
  } = {},
): Transport {
  const resolveParams = opts.params ?? envParamsResolver
  const doFetch = opts.fetch ?? fetch
  return {
    async execute(req: PreparedRequest): Promise<TransportResponse> {
      // No auth block ⇒ the request egresses BARE — credentials are
      // never even resolved for it.
      const authed = req.auth
        ? await applyAuth(
            { ...req, auth: req.auth },
            parseResolvedCredentials(
              await resolveParams(
                req.provider,
                credentialFieldsOf(
                  parseCredentialSchema(req.auth.credentials),
                ),
              ),
            ),
          )
        : {
            url: req.url,
            headers: { ...req.headers },
            query: { ...req.query },
            ...(req.body !== undefined ? { body: req.body } : {}),
          }

      const url = new URL(authed.url)
      for (const [key, values] of Object.entries(authed.query)) {
        // append (never set) once per value — several values under
        // one key IS the repeated-parameter spelling, and ORDER is
        // the caller's
        for (const value of values) url.searchParams.append(key, value)
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), req.timeouts.requestMs)
      try {
        const response = await doFetch(url.toString(), {
          method: req.method,
          headers: {
            ...(authed.body !== undefined
              ? { 'content-type': 'application/json' }
              : {}),
            ...authed.headers,
          },
          body:
            authed.body !== undefined ? JSON.stringify(authed.body) : undefined,
          signal: controller.signal,
          redirect: 'manual',
        })
        const body = await response.text()
        return {
          status: response.status,
          body,
          // `redirect: "manual"` above means a 3xx arrives WITH its
          // Location intact and an empty body — the header IS the
          // payload for presigned-URL endpoints. Header keys are
          // lowercased (multi-values comma-joined) by the Fetch
          // spec's Headers iterator.
          headers: Object.fromEntries(response.headers),
          contentType: response.headers.get('content-type') ?? undefined,
        }
      } catch (error) {
        if (error instanceof EngineError) throw error
        throw new EngineError(
          EngineErrorCode.EXECUTION_FAILED,
          `transport failure calling ${req.provider}: ${error}`,
          { cause: error },
        )
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
