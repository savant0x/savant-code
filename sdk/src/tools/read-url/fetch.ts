import { assertUrlAllowed, type HostLookup } from '../ssrf'
import {
  DEFAULT_MAX_CHARS,
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  REDIRECT_STATUSES,
  USER_AGENT,
  type FetchLike,
  type ReadUrlOutput,
} from './constants'
import {
  extractTextByContentType,
  isSupportedContentType,
  truncateText,
} from './extract'
import {
  canonicalUrlKey,
  classifyExtractionMiss,
  classifyHttpStatus,
  passthroughOutcome,
  readUrlNegativeCache,
  type FetchOutcome,
  type NegativeCache,
} from './outcomes'
import { readResponseBody } from './response-body'

/**
 * read-url — fetch orchestration with SSRF re-validation on every redirect.
 * (FID-2026-0809-016: extracted from `read-url.ts`.)
 */

function errorResult(
  url: string | undefined,
  errorMessage: string,
): ReadUrlOutput {
  return [{ type: 'json', value: { ...(url ? { url } : {}), errorMessage } }]
}

/**
 * FID-2026-1012-018: the message the model reads is the classified first line
 * plus the next action. The first line is unchanged from the pre-taxonomy shape
 * so the capture keeps counting the same class
 * (`common/src/util/experience-classes.ts`).
 */
function outcomeMessage(outcome: FetchOutcome): string {
  return outcome.advice
    ? `${outcome.firstLine}\n${outcome.advice}`
    : outcome.firstLine
}

const REPEAT_NOTE =
  'This URL was already attempted in this run; the memoized outcome is reported instead of another request.'

/** Final outcomes are memoized per run; transient ones never are. */
function rememberOutcome(
  cache: NegativeCache,
  key: string,
  outcome: FetchOutcome,
): void {
  cache.remember(key, outcome)
}

// The error shapes this function raises itself, classified to the taxonomy.
const OVERSIZED_ERROR = /Response (?:is too large|exceeded)\b/
const BLOCKED_ERROR = /resolves to a private or reserved address/
const DNS_ERROR = /Could not resolve host|ENOTFOUND|getaddrinfo/

function getHeader(headers: Headers, name: string): string | undefined {
  return headers.get(name) ?? undefined
}

export async function readUrl({
  url,
  max_chars = DEFAULT_MAX_CHARS,
  fetch: fetchImpl = globalThis.fetch,
  lookupHost,
  resolveDns = fetchImpl === globalThis.fetch,
  signal,
  cache = readUrlNegativeCache,
}: {
  url: string
  max_chars?: number
  fetch?: FetchLike
  /**
   * FID-2026-1012-018: the per-run memo of final outcomes. Injectable so a
   * caller that owns its own run boundary can scope it; the default is the
   * process-wide cache the CLI's dispatch uses (one process per session).
   */
  cache?: NegativeCache
  /** Override hostname resolution (defaults to node:dns). */
  lookupHost?: HostLookup
  /**
   * Whether to DNS-resolve hostnames for SSRF checks. Defaults to true only
   * when using the real global fetch; a caller-supplied fetch (e.g. a test
   * stub) skips resolution but IP-literal hosts are still rejected.
   */
  resolveDns?: boolean
  /** External abort (e.g. user interrupt); cancels the fetch mid-flight. */
  signal?: AbortSignal
}): Promise<ReadUrlOutput> {
  if (signal?.aborted) {
    return errorResult(url, 'Cancelled: the run was aborted by the user.')
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return errorResult(url, 'Invalid URL')
  }

  // FID-2026-1012-018: a URL this run already resolved to a final outcome is
  // answered from the memo instead of being fetched again.
  const cacheKey = canonicalUrlKey(parsedUrl)
  const memoized = cache.get(cacheKey)
  if (memoized) {
    return errorResult(url, `${outcomeMessage(memoized)}\n${REPEAT_NOTE}`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort, { once: true })

  try {
    // Follow redirects manually so every hop is re-validated against the SSRF
    // policy — a public URL must not be able to 30x its way to an internal one.
    let currentUrl = parsedUrl
    let response: Response
    for (let redirects = 0; ; redirects++) {
      try {
        // NOTE: this resolves the hostname for validation; `fetch` resolves it
        // again independently, so a short-TTL attacker domain could rebind
        // between the two (DNS-rebinding TOCTOU). Fully closing that needs
        // IP-pinning (an undici dispatcher), which Bun's fetch ignores, so it's
        // an accepted residual gap — the common literal/internal-host vectors
        // are still blocked.
        await assertUrlAllowed(currentUrl, { lookupHost, resolveDns })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Blocked URL'
        if (!BLOCKED_ERROR.test(message) && !DNS_ERROR.test(message)) {
          return errorResult(url, message)
        }
        const outcome = BLOCKED_ERROR.test(message)
          ? passthroughOutcome(message, {
              kind: 'blocked',
              advice:
                'The host resolves inside this machine or a reserved range, so the request is refused by policy. Do not retry this host.',
              cacheable: true,
            })
          : passthroughOutcome(message, {
              kind: 'dns',
              advice:
                'The hostname did not resolve. Check the spelling or use another source; the run does not retry automatically.',
              cacheable: false,
            })
        rememberOutcome(cache, cacheKey, outcome)
        return errorResult(url, outcomeMessage(outcome))
      }

      response = await fetchImpl(currentUrl.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': USER_AGENT,
        },
      })

      if (!REDIRECT_STATUSES.has(response.status)) {
        break
      }

      const location = getHeader(response.headers, 'location')
      if (!location) {
        break
      }
      if (redirects >= MAX_REDIRECTS) {
        return errorResult(url, `Too many redirects (>${MAX_REDIRECTS})`)
      }
      try {
        currentUrl = new URL(location, currentUrl)
      } catch {
        return errorResult(url, `Invalid redirect location: ${location}`)
      }
    }

    if (!response.ok) {
      const failure = classifyHttpStatus(response.status, response.statusText)
      rememberOutcome(cache, cacheKey, failure)
      return errorResult(url, outcomeMessage(failure))
    }

    const contentType = getHeader(response.headers, 'content-type') ?? ''
    if (contentType && !isSupportedContentType(contentType)) {
      const unsupported = passthroughOutcome(
        `Unsupported content type: ${contentType || 'unknown'}`,
        {
          kind: 'unsupported-content',
          advice:
            'The reader extracts HTML, plain text and JSON. A binary or document format needs a different path — do not re-fetch the same URL expecting text.',
          cacheable: true,
        },
      )
      rememberOutcome(cache, cacheKey, unsupported)
      return errorResult(url, outcomeMessage(unsupported))
    }

    let body: string
    try {
      body = await readResponseBody(response, MAX_RESPONSE_BYTES)
    } catch (error) {
      if (!(error instanceof Error) || !OVERSIZED_ERROR.test(error.message)) {
        throw error
      }
      const oversized = passthroughOutcome(error.message, {
        kind: 'oversized',
        advice: `The response is larger than the ${MAX_RESPONSE_BYTES}-byte cap this reader accepts, so the whole document was not read. Fetch a narrower resource (a section, a raw/plain variant, an API endpoint) instead.`,
        cacheable: true,
      })
      rememberOutcome(cache, cacheKey, oversized)
      return errorResult(url, outcomeMessage(oversized))
    }
    const extracted = extractTextByContentType(contentType, body)
    const truncated = truncateText(extracted.text, max_chars)

    if (!truncated.text) {
      const miss = classifyExtractionMiss({
        contentType,
        bodyLength: body.length,
        textLength: extracted.text.length,
      })
      rememberOutcome(cache, cacheKey, miss)
      return errorResult(url, outcomeMessage(miss))
    }

    return [
      {
        type: 'json',
        value: {
          url,
          finalUrl: response.url || currentUrl.toString(),
          status: response.status,
          ...(contentType ? { contentType } : {}),
          ...(extracted.title ? { title: extracted.title } : {}),
          ...(extracted.description
            ? { description: extracted.description }
            : {}),
          text: truncated.text,
          truncated: truncated.truncated,
        },
      },
    ]
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    if (isAbort && !signal?.aborted) {
      // Transient by nature: advised, never memoized. The first line keeps the
      // pre-taxonomy shape so the capture's class is unchanged.
      return errorResult(
        url,
        `Timed out after ${FETCH_TIMEOUT_MS} ms\nThe host did not answer within this reader's budget. One later attempt is reasonable; the run does not retry automatically.`,
      )
    }
    return errorResult(
      url,
      isAbort
        ? 'Cancelled: the run was aborted by the user.'
        : error instanceof Error
          ? error.message
          : 'Unknown error',
    )
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}
