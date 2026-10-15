export interface DeepResearchParams {
  question: string
  queries?: string[]
  research_depth?: 'quick' | 'standard' | 'thorough'
  max_sources?: number
}

export interface GravityIndexParams {
  action:
    | 'search'
    | 'browse'
    | 'list_categories'
    | 'get_service'
    | 'report_integration'
  query?: string
  search_id?: string
  context?: Record<string, unknown>
  category?: string
  q?: string
  slug?: string
  integrated_slug?: string
}

export interface ReadDocsParams {
  libraryTitle: string
  topic: string
  max_tokens?: number
}

export interface WebSearchParams {
  query: string
  depth?: 'standard' | 'deep'
}
