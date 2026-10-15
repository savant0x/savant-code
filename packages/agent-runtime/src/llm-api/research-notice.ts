/**
 * The `web_search` exhaustion notice (FID-2026-1012-019), extracted from
 * `research-sources.ts` so the selector module stays inside the file ceiling.
 *
 * The notice is built from the state the selector actually observed — which
 * keys exist and which providers ran and returned nothing — because the class
 * this replaces ("No web search results were returned. Add a research API key
 * … for higher-quality results") read as a completed search of lower quality,
 * and an agent that believes it searched concludes the web has no match.
 */

import { renderCapabilityNotice } from '@savant-code/common/util/capability-notice'

export function buildWebSearchExhaustionNotice(params: {
  /** Every provider key the selector knows how to read. */
  knownKeys: readonly string[]
  /** The subset of `knownKeys` that is not configured. */
  absentKeys: readonly string[]
  /**
   * The providers that WERE configured, ran, and returned no result. Named in
   * the notice so “nothing configured” and “configured and empty” stay
   * distinguishable to the agent.
   */
  ranAndReturnedNothing: readonly string[]
}): string {
  const { knownKeys, absentKeys, ranAndReturnedNothing } = params
  const nothingConfigured = absentKeys.length === knownKeys.length
  const providerState = nothingConfigured
    ? `no research provider is configured (checked ${absentKeys.join(', ')})`
    : `no configured provider produced a result (${ranAndReturnedNothing.join(', ')})`

  return renderCapabilityNotice({
    capability: 'web_search',
    label: 'Web search',
    state: nothingConfigured ? 'unavailable' : 'incomplete',
    reason: `${providerState} and the keyless search port returned nothing`,
    action:
      'Add a research API key in the UI (Serper, Parallel, Tavily, Exa or ' +
      'Firecrawl), or answer from the codebase and the sources you already ' +
      'have; a retry without a change returns the same outcome.',
    consequence:
      'This is not evidence that no matching source exists on the web.',
  })
}
