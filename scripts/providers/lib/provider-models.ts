/**
 * FID-2026-1007-008 — enumerating a provider's catalog so the gauntlet can
 * sweep every route instead of one.
 *
 * The source is the checked-in allowlist (`MODEL_CATALOGS[config.catalog
 * .modelsRef]`). A `live` catalog is not enumerated here on purpose: the whole
 * reason the audited gateways carry a static catalog is that their live
 * `/v1/models` listings include dead and substituted ids.
 *
 * A single route being down says nothing about the provider — on 2026-10-07
 * HCNSec answered `glm-5.3-flash` with 200 while `kimi-k3` returned 500 — so
 * the sweep reports per model and never rolls a route failure up to the host.
 */
import { MODEL_CATALOGS } from '@savant-code/common/providers/model-catalogs'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

export interface ProviderRoute {
  provider: string
  /** The wire model id the provider is asked for. */
  model: string
  baseUrl: string
}

/** Wire id: strip the `<provider>/` routing prefix when the transform says so. */
function wireId(
  provider: string,
  catalogValue: string,
  idTransform: string,
): string {
  if (idTransform === 'keep') return catalogValue
  const prefix = `${provider}/`
  return catalogValue.startsWith(prefix)
    ? catalogValue.slice(prefix.length)
    : catalogValue
}

/**
 * Every checked-in route for a provider, in catalog order. Returns [] for an
 * unknown slug or a provider with no static catalog (nothing to sweep).
 */
export function providerRoutes(slug: string): ProviderRoute[] {
  const entry = Object.values(PROVIDER_REGISTRY).find((p) => p.id === slug)
  if (entry === undefined) return []
  if (entry.catalog.source !== 'static') return []
  const catalog = MODEL_CATALOGS[entry.catalog.modelsRef]
  if (catalog === undefined) return []
  return Object.values(catalog).map((catalogValue) => ({
    provider: entry.id,
    model: wireId(entry.id, catalogValue, entry.idTransform),
    baseUrl: entry.baseUrl,
  }))
}

/** The provider's declared endpoint, so a sweep needs no hand-typed URL. */
export function providerBaseUrl(slug: string): string | undefined {
  return Object.values(PROVIDER_REGISTRY).find((p) => p.id === slug)?.baseUrl
}
