/**
 * Custom-provider CATALOG parsing (FID-2026-0913-002 split from
 * custom-providers-parse.ts): inline (models map), live (URL), or none.
 * Pure validation — no registry, no state; consumed by
 * `parseCustomProviders` and re-exported nowhere else.
 */

import { parseRegistryUrl } from './validate'

import type { CustomProviderConfig } from './types'

/** Catalog parsing: inline (models map), live (URL), or none. */
export function parseCustomCatalog(
  value: unknown,
  label: string,
  providerId: string | undefined,
): { catalog: CustomProviderConfig['catalog']; problems: string[] } {
  if (value === undefined || value === null) {
    return { catalog: { source: 'none' }, problems: [] }
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      catalog: { source: 'none' },
      problems: [`${label}: catalog must be an object when present`],
    }
  }
  const record = value as Record<string, unknown>
  const source = record['source']
  if (source === 'none') {
    return { catalog: { source: 'none' }, problems: [] }
  }
  if (source === 'live') {
    const url = record['url']
    if (typeof url !== 'string' || parseRegistryUrl(url) === null) {
      return {
        catalog: { source: 'none' },
        problems: [`${label}: live catalog url must be a valid http(s) URL`],
      }
    }
    return { catalog: { source: 'live', url }, problems: [] }
  }
  if (source === 'inline') {
    const models = record['models']
    if (
      typeof models !== 'object' ||
      models === null ||
      Array.isArray(models)
    ) {
      return {
        catalog: { source: 'none' },
        problems: [
          `${label}: inline catalog models must be an object of model id -> display name`,
        ],
      }
    }
    const problems: string[] = []
    const entries: Record<string, string> = {}
    const prefix = typeof providerId === 'string' ? `${providerId}/` : undefined
    for (const [modelId, name] of Object.entries(
      models as Record<string, unknown>,
    )) {
      if (prefix === undefined || !modelId.startsWith(prefix)) {
        problems.push(
          `${label}: inline catalog model '${modelId}' does not start with the routing prefix '${providerId ?? '<invalid id>'}'`,
        )
        continue
      }
      if (typeof name !== 'string') {
        problems.push(
          `${label}: inline catalog model '${modelId}' must map to a string display name`,
        )
        continue
      }
      entries[modelId] = name
    }
    return { catalog: { source: 'inline', models: entries }, problems }
  }
  return {
    catalog: { source: 'none' },
    problems: [`${label}: catalog.source must be 'live', 'inline', or 'none'`],
  }
}
