import type { SavantCodeToolOutput } from '../../../../common/src/tools/list'

export const DEFAULT_MAX_CHARS = 20_000
export const MAX_RESPONSE_BYTES = 2_000_000
export const FETCH_TIMEOUT_MS = 20_000
export const MAX_REDIRECTS = 5
export const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
export const USER_AGENT =
  'Mozilla/5.0 (compatible; SavantCodeResearchBot/1.0; +https://savant-code.com)'

export type ReadUrlOutput = SavantCodeToolOutput<'read_url'>
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>
