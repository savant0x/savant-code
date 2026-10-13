/**
 * FID-2026-1012-018 (program FID-2026-1012-022, RC2 / feature E2): the read_url
 * outcome taxonomy, URL identity, and per-run negative cache.
 *
 * `read_url` collapses every upstream condition into one flat per-call error, so
 * a URL that does not exist is retried in the next turn and the next session
 * with nothing remembering it was already known-bad — 114 recorded 404s across
 * 18 sessions, the largest class in the capture.
 *
 * Two rules shape everything here:
 *
 * 1. **The first line of every message stays byte-identical to the shape the
 *    capture already classifies** (`Failed to fetch URL: 404 Not Found`,
 *    `No readable text found at URL`, `Response exceeded …`,
 *    `Unsupported content type: …`). The taxonomy's advice goes on the following
 *    lines, so the model gets the next action while the ledger keeps counting the
 *    same class instead of silently seeing a new one
 *    (`common/src/util/experience-classes.ts`).
 * 2. **Only outcomes that are final for the run are cached.** A rate limit or a
 *    5xx is a transient condition with advice, never a memoized dead end, and the
 *    run never retries by itself.
 */

/** What a fetch outcome is, in the terms the next action depends on. */
export type FetchOutcomeKind =
  | 'not-found'
  | 'unauthorized'
  | 'denied'
  | 'method-not-allowed'
  | 'rate-limited'
  | 'unavailable'
  | 'client-error'
  | 'server-error'
  | 'oversized'
  | 'unsupported-content'
  | 'blocked'
  | 'dns'
  | 'unextractable'
  | 'other'

export interface FetchOutcome {
  kind: FetchOutcomeKind
  /** The message's first line — always the shape the capture classifies. */
  firstLine: string
  /** The next action, on the lines after `firstLine`. */
  advice: string
  /**
   * Whether the run may memoize this outcome. False for conditions that can
   * change on their own (rate limits, 5xx, DNS, timeouts).
   */
  cacheable: boolean
}

const SEARCH_FALLBACK =
  'Use web_search (or another source) to find the current location of this content.'

function http(
  status: number,
  statusText: string,
): {
  kind: FetchOutcomeKind
  advice: string
  cacheable: boolean
} {
  switch (status) {
    case 401:
      return {
        kind: 'unauthorized',
        advice:
          'The host requires credentials this run does not send. Treat it as a credential boundary rather than a transient failure, and do not retry the same request.',
        cacheable: true,
      }
    case 403:
      return {
        kind: 'denied',
        advice:
          'The host refused this client (anti-bot gate, or a feature behind a product tier). Retrying will not change it — a different source is needed.',
        cacheable: true,
      }
    case 404:
      return {
        kind: 'not-found',
        advice: `The URL does not exist. It is not retried in this run. ${SEARCH_FALLBACK}`,
        cacheable: true,
      }
    case 405:
      return {
        kind: 'method-not-allowed',
        advice:
          'The host does not serve this method for the URL. The same URL will fail the same way — use the site entry point or another source.',
        cacheable: true,
      }
    case 429:
      return {
        kind: 'rate-limited',
        advice:
          'Rate limited. Wait before addressing this host again; the run does not retry automatically, and a bounded pause is the only useful next step.',
        cacheable: false,
      }
    case 503:
      return {
        kind: 'unavailable',
        advice:
          'Transient upstream condition. One later attempt is reasonable; the run does not retry automatically.',
        cacheable: false,
      }
    default:
      return status >= 500
        ? {
            kind: 'server-error',
            advice:
              'The host reported a server error. One later attempt is reasonable; the run does not retry automatically.',
            cacheable: false,
          }
        : {
            kind: 'client-error',
            advice:
              'The host rejected this request. The same request will be rejected the same way.',
            cacheable: true,
          }
  }
}

/** Classify an HTTP status into the taxonomy and its next action. */
export function classifyHttpStatus(
  status: number,
  statusText: string,
): FetchOutcome {
  const classified = http(status, statusText)
  return {
    ...classified,
    firstLine: `Failed to fetch URL: ${status} ${statusText}`,
  }
}

export interface ExtractionEvidence {
  contentType: string
  bodyLength: number
  textLength: number
}

/**
 * Classify a response the extractor produced no text for. The cause is named
 * only when the response itself proves it: an empty body and a markup document
 * with no text are different facts, and everything else is reported as not
 * established (never guessed).
 */
export function classifyExtractionMiss(
  evidence: ExtractionEvidence,
): FetchOutcome {
  if (evidence.bodyLength === 0) {
    return {
      kind: 'unextractable',
      firstLine: 'No readable text found at URL',
      advice:
        'The response body was empty — the host returned no content for this request. A different source is needed.',
      cacheable: true,
    }
  }
  if (evidence.contentType.includes('html')) {
    return {
      kind: 'unextractable',
      firstLine: 'No readable text found at URL',
      advice:
        'The page returned markup with no extractable text — usually content rendered client-side or served behind a gate. Fetching the same URL again will not change the result.',
      cacheable: true,
    }
  }
  return {
    kind: 'unextractable',
    firstLine: 'No readable text found at URL',
    advice:
      'The response carried no text the reader could extract, and the response does not prove the cause. The failure is reported as unclassified rather than guessed.',
    cacheable: true,
  }
}

/** Every other read_url message keeps its own shape and gains no taxonomy. */
export function passthroughOutcome(
  firstLine: string,
  options: {
    kind?: FetchOutcomeKind
    advice?: string
    cacheable?: boolean
  } = {},
): FetchOutcome {
  return {
    kind: options.kind ?? 'other',
    firstLine,
    advice: options.advice ?? '',
    cacheable: options.cacheable ?? false,
  }
}

/**
 * Identity used for the per-run negative cache and for repeat detection.
 *
 * Removes the fragment and the userinfo; keeps the scheme, host, port, path
 * **including a trailing slash** and the full query (signed and tracking
 * parameters included, because they select the resource). Credentials are never
 * part of the key, so nothing secret is memoized.
 */
export function canonicalUrlKey(url: URL | string): string {
  const parsed = typeof url === 'string' ? new URL(url) : url
  const port = parsed.port ? `:${parsed.port}` : ''
  return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${port}${parsed.pathname}${parsed.search}`
}

export interface NegativeCache {
  get(key: string): FetchOutcome | undefined
  remember(key: string, outcome: FetchOutcome): void
  size(): number
  /** Drop every entry — used when a run boundary is known to have passed. */
  reset(): void
}

/**
 * Per-run memo of final outcomes. Bounded so a long session cannot grow it
 * without limit; only outcomes the taxonomy marks `cacheable` are also refused
 * on write, so a caller cannot accidentally memoize a transient condition.
 */
export function createNegativeCache(maxEntries = 100): NegativeCache {
  const entries = new Map<string, FetchOutcome>()
  return {
    get(key) {
      return entries.get(key)
    },
    remember(key, outcome) {
      if (!outcome.cacheable) return
      if (entries.size >= maxEntries && !entries.has(key)) {
        const oldest = entries.keys().next()
        if (!oldest.done) entries.delete(oldest.value)
      }
      entries.set(key, outcome)
    },
    size() {
      return entries.size
    },
    reset() {
      entries.clear()
    },
  }
}

/**
 * The process-wide cache the CLI's tool dispatch uses (one process per session,
 * so its lifetime is the run). Injectable through `readUrl`'s `cache` option for
 * callers that own their own run boundary, and clearable for tests.
 */
export const readUrlNegativeCache: NegativeCache = createNegativeCache()

/** Drop every memoized outcome — test isolation and explicit run boundaries. */
export function clearReadUrlNegativeCache(): void {
  readUrlNegativeCache.reset()
}
