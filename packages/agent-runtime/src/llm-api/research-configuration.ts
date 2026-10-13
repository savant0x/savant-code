/** One authority for the selector and the non-network run-start inventory. */
export const WEB_SEARCH_API_KEYS = {
  serper: 'SERPER_API_KEY',
  parallel: 'PARALLEL_API_KEY',
  tavily: 'TAVILY_API_KEY',
  exa: 'EXA_API_KEY',
  firecrawl: 'FIRECRAWL_API_KEY',
} as const

/** Names only; credential values never leave the selector's process. */
export function configuredResearchProviders(): string[] {
  return Object.values(WEB_SEARCH_API_KEYS).filter((key) =>
    Boolean(process.env[key]?.trim()),
  )
}
