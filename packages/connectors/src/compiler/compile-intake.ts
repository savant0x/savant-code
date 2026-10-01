import type { ConnectorSource, EndpointDoc, ProviderDef } from '@shared/core'

// T106 file split: intake validation + deterministic ordering + taxonomy
// membership, extracted VERBATIM from compile.ts (300-line ceiling; zero
// behavior change).

export interface SortedSource {
  connector: ConnectorSource
  provider: ProviderDef
}

/**
 * Intake validation — zod-first end to end even for hand-built sources —
 * then the DETERMINISM sort: input order (filesystem enumeration) is
 * platform-dependent, and iteration order decides fnTable insertion (first
 * occurrence wins provenance) — sorting by provider name makes the bundle a
 * pure function of repo content (byte-identical double compile).
 */
export function sortConnectorSources(
  connectors: ConnectorSource[],
  parse: (connector: ConnectorSource) => ProviderDef,
): SortedSource[] {
  const intake = connectors.map((connector) => parse(connector))
  return connectors
    .map((connector, index) => ({ connector, provider: intake[index] }))
    .sort((a, b) => a.provider.name.localeCompare(b.provider.name))
}

/** Taxonomy membership: closed vocabulary → sorted endpoint ids. */
export function buildMembership(
  allDocs: EndpointDoc[],
): Record<string, string[]> {
  const membership: Record<string, string[]> = {}
  for (const doc of [...allDocs].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const categoryId of doc.meta.categories ?? []) {
      ;(membership[categoryId] ??= []).push(doc.id)
    }
  }
  return membership
}
