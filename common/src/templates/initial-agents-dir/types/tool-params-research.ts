import type { JSONValue } from './util-types'

/**
 * Use the Gravity Index tool discovery and install API.
 */
export interface GravityIndexParams {
  /** Which Gravity Index operation to perform. search: recommend a provider; browse: list catalog services; list_categories: list categories with counts; get_service: full detail for a known slug; report_integration: report a completed integration. */
  action:
    | 'search'
    | 'browse'
    | 'list_categories'
    | 'get_service'
    | 'report_integration'
  /** For action "search": what the user needs, including stack, constraints, and required capabilities. */
  query?: string
  /** For action "search": continue a previous search. For action "report_integration": the search_id from the earlier search result (required). */
  search_id?: string
  /** For action "search": optional structured JSON context about the project, stack, or constraints. */
  context?: Record<string, JSONValue>
  /** For action "browse": optional category filter, e.g. Database, Auth, Payments, Hosting, Email, AI. */
  category?: string
  /** For action "browse": optional keyword filter, e.g. sendgrid or postgres. */
  q?: string
  /** For action "get_service": service slug, e.g. supabase, stripe, sendgrid (required). */
  slug?: string
  /** For action "report_integration": slug of the service that was actually integrated (required). */
  integrated_slug?: string
}

/**
 * Fetch up-to-date documentation for libraries and frameworks using Context7 API.
 */
export interface ReadDocsParams {
  /** The library or framework name (e.g., "Next.js", "MongoDB", "React"). Use the official name as it appears in documentation if possible. Only public libraries available in Context7's database are supported, so small or private libraries may not be available. */
  libraryTitle: string
  /** Optional specific topic to focus on (e.g., "routing", "hooks", "authentication") */
  topic?: string
  /** Optional ecosystem to disambiguate the library when its name exists in multiple registries (e.g., "cobra" is a Go CLI and a Python package). One of "npm", "pypi", "crates.io", "rubygems", "go". */
  ecosystem?: 'npm' | 'pypi' | 'crates.io' | 'rubygems' | 'go'
  /** Optional maximum number of tokens to return. Defaults to 20000. Values less than 10000 are automatically increased to 10000. */
  max_tokens?: number
}

/**
 * Fetch a URL and extract readable text from the page.
 */
export interface ReadUrlParams {
  /** The full http:// or https:// URL to fetch and extract readable text from. */
  url: string
  /** Maximum number of extracted text characters to return. Defaults to 20000. */
  max_chars?: number
}

/**
 * Search the web for current information using Serper API.
 */
export interface WebSearchParams {
  /** The search query to find relevant web content */
  query: string
  /** Search depth - 'standard' for quick results, 'deep' for more comprehensive search. Default is 'standard'. */
  depth?: 'standard' | 'deep'
}
