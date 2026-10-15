import { EngineError, EngineErrorCode } from './errors.ts'
import { fnUtils } from './fn-utils.ts'
import { resolveFn } from './resolve.ts'
import { validateAgainst } from './validate.ts'
import {
  type AuthData,
  AuthInjectContract,
  type AuthInjectFn,
  type HookLogger,
  type HttpRequestParts,
  type JsonSchemaDoc,
} from '../core/mod.ts'

import type { PreparedRequest } from './interfaces/mod.ts'

/**
 * The ONLY place credentials meet a request. Called by injectors
 * (directTransport here; the hosted Relay runs the same procedure):
 *   1. validate RESOLVED params against the auth credentials JSON Schema
 *      (fail-closed presence check → MISSING_CREDENTIAL);
 *   2. hash-verify + instantiate the inject fn from the traveling entry;
 *   3. run it through the auth slot contract on {request, params} —
 *      only the RETURNED (contract-validated) request egresses.
 */
export async function applyAuth(
  req: PreparedRequest & { auth: NonNullable<PreparedRequest['auth']> },
  params: Record<string, string>,
): Promise<HttpRequestParts> {
  const check = validateAgainst(req.auth.credentials, params)
  if (!check.ok) {
    // name the variables THIS doc's credential shape asks for — a
    // two-key provider must not be hinted at a one-key convention
    const hint = credentialFieldsOf(req.auth.credentials)
      .map((field) => credentialEnvVarsFor(req.provider, field).join(' or '))
      .join(', ')
    throw new EngineError(
      EngineErrorCode.MISSING_CREDENTIAL,
      `provider ${req.provider}: credentials invalid: ${check.message}` +
        ` (hint: set ${hint})`,
    )
  }
  const raw = await resolveFn(
    req.auth.inject.ref,
    { [req.auth.inject.ref.$fn.key]: req.auth.inject.entry },
    // the entry already passed the engine's ABI gate at load; re-verify integrity only
    req.auth.inject.entry.api,
    `${req.provider}#auth.inject`,
  )
  const impl = AuthInjectContract.implement(raw as AuthInjectFn)
  const data: AuthData = {
    request: {
      url: req.url,
      headers: { ...req.headers },
      query: { ...req.query },
      ...(req.body !== undefined ? { body: req.body } : {}),
    },
    params,
  }
  try {
    return impl({ data, utils: fnUtils, logger: SILENT_LOGGER })
  } catch (error) {
    throw new EngineError(
      EngineErrorCode.FN_CONTRACT,
      `${req.provider}: auth.inject broke its contract: ${error}`,
      { cause: error },
    )
  }
}

/** The auth hook's logger is DELIBERATELY silent regardless of host
 *  configuration: resolved credentials are in scope here, and a log line is
 *  the one way an inject fn could leak them. */
const SILENT_LOGGER: HookLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
}

/**
 * THE local env convention: one variable per credential FIELD, so the
 * environment and the doc's `auth.credentials` correspond 1:1 —
 * `<PROVIDER>_CREDENTIALS_<FIELD>`. The provider's dashes and the field's
 * camelCase humps both become underscores:
 *
 *   exa        + apiKey         → EXA_CREDENTIALS_API_KEY
 *   contactout + workApiKey     → CONTACTOUT_CREDENTIALS_WORK_API_KEY
 *   contactout + personalApiKey → CONTACTOUT_CREDENTIALS_PERSONAL_API_KEY
 *
 * It is the same name monid-services' AppConfig derives from the config
 * path `contactout.credentials.work_api_key`, so local env and hosted
 * config spell a credential identically.
 */
export function credentialEnvVarFor(provider: string, field: string): string {
  const slug = provider.toUpperCase().replaceAll('-', '_')
  const name = field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
  return `${slug}_CREDENTIALS_${name}`
}

/** The ONE alias: `apiKey` is the near-universal shape, so the bare
 *  `<PROVIDER>_API_KEY` keeps answering for that field alone. No other
 *  field has one. */
export function envVarFor(provider: string): string {
  return `${provider.toUpperCase().replaceAll('-', '_')}_API_KEY`
}

/** Every variable that can supply `field`, in PRECEDENCE order — the
 *  canonical name first, the `apiKey` alias second. */
export function credentialEnvVarsFor(
  provider: string,
  field: string,
): string[] {
  const canonical = credentialEnvVarFor(provider, field)
  return field === 'apiKey' ? [canonical, envVarFor(provider)] : [canonical]
}

/** The credential field names a compiled doc declares. The compiler always
 *  materializes `auth.credentials` (`zDefaultCredentials` = `{apiKey}` when
 *  nobody declared one), so `properties` is the authoritative field list;
 *  the `["apiKey"]` floor only guards a hand-built doc. */
export function credentialFieldsOf(credentials: JsonSchemaDoc): string[] {
  const properties = credentials.properties
  if (
    properties === null ||
    typeof properties !== 'object' ||
    Array.isArray(properties)
  ) {
    return ['apiKey']
  }
  const fields = Object.keys(properties)
  return fields.length > 0 ? fields : ['apiKey']
}
