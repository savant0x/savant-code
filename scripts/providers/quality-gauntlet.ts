/**
 * FID-2026-0915-001 (W6) — the quality gauntlet CLI wrapper.
 *
 * `bun run providers:quality -- <host>` — operator-run coding rubric against
 * ONE discovery candidate. Resolution order for the endpoint: the harvest
 * state's `url` for that host (candidates.json). The operator's API key is
 * read from `<SLUG>_API_KEY` (the wizard's env-var derivation) or
 * `QUALITY_API_KEY` at invocation — used in request headers only, never
 * written to disk, never logged.
 *
 * Not a merge gate. Never scheduled. Costs the operator's own quota.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { runGauntlet } from './lib/quality-core'

const TIMEOUT_MS = 60_000

function readCandidateUrl(host: string): string | null {
  const statePath = join(
    process.cwd(),
    'dev',
    'provider-candidates',
    'candidates.json',
  )
  if (!existsSync(statePath)) return null
  try {
    const parsed: unknown = JSON.parse(readFileSync(statePath, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return null
    const outer = parsed as Record<string, unknown>
    const hosts =
      typeof outer['hosts'] === 'object' && outer['hosts'] !== null
        ? outer['hosts']
        : outer
    if (typeof hosts !== 'object' || hosts === null) return null
    const entry = (hosts as Record<string, unknown>)[host]
    if (typeof entry !== 'object' || entry === null) return null
    const url = (entry as Record<string, unknown>)['url']
    return typeof url === 'string' && url.length > 0 ? url : null
  } catch {
    return null
  }
}

/** The wizard's id derivation (same charset rules). */
function hostToSlug(host: string): string {
  const stripped = host.toLowerCase().replace(/^api\./, '')
  const firstLabel = stripped.split('.')[0] ?? ''
  return firstLabel.replace(/[^a-z0-9-]/g, '')
}

async function fetchRunner(
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<(prompt: string) => Promise<{ text: string; latencyMs: number }>> {
  // /v1 normalization (mirror of probeEndpoint): OpenAI-protocol bases come
  // both with and without the /v1 suffix — append the path symmetrically so
  // a base like `https://api.host/openai` hits /openai/v1/chat/completions
  // while `https://api.host/openai/v1` does NOT double the segment.
  const base = baseUrl.replace(/\/+$/, '')
  const endpoint = base.endsWith('/v1')
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`
  /**
   * POST with manual redirect handling: fetch rewrites POST→GET on 301/302
   * (and strips Authorization on cross-origin redirects), which breaks every
   * OpenAI-protocol relay fronted by an apex→www redirect (observed LIVE on
   * orcarouter.ai: 301 → GET /v1/chat/completions → 404). Re-issue the POST
   * — method AND auth intact — at each Location, bounded at 3 hops.
   */
  const sendOnce = async (url: string, body: string): Promise<Response> => {
    let current = url
    for (let hop = 0; hop < 3; hop++) {
      const response = await fetch(current, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const location = response.headers.get('location')
      if (
        response.status >= 300 &&
        response.status < 400 &&
        typeof location === 'string' &&
        location.length > 0
      ) {
        current = new URL(location, current).toString()
        continue
      }
      return response
    }
    throw new Error(`gauntlet request failed: too many redirects from ${url}`)
  }

  return async (prompt) => {
    const started = Date.now()
    const response = await sendOnce(
      endpoint,
      JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0,
      }),
    )
    if (!response.ok) {
      throw new Error(
        `gauntlet request failed: HTTP ${response.status} (check the endpoint URL and key)`,
      )
    }
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return {
      text: body.choices?.[0]?.message?.content ?? '',
      latencyMs: Date.now() - started,
    }
  }
}

async function main(): Promise<number> {
  const host = process.argv[2]?.toLowerCase()
  if (!host) {
    console.error('Usage: bun run providers:quality -- <host>')
    return 2
  }
  const url = readCandidateUrl(host)
  if (!url) {
    console.error(
      `[quality] no candidate '${host}' in dev/provider-candidates/candidates.json — run the harvest first`,
    )
    return 2
  }
  // Key resolution: the wizard-derived env var for this host, else the
  // generic override. Read at invocation only — never persisted.
  const slug = hostToSlug(host).replace(/-/g, '_').toUpperCase()
  const apiKey = process.env[`${slug}_API_KEY`] ?? process.env.QUALITY_API_KEY
  if (!apiKey) {
    console.error(
      `[quality] no API key found — set ${slug}_API_KEY (or QUALITY_API_KEY) and retry. ` +
        'The gauntlet is operator-run: your key is used in request headers only, never stored.',
    )
    return 2
  }
  const model = process.env.QUALITY_MODEL ?? 'gpt-oss-120b'

  console.log(`[quality] gauntleting ${host} (${model}) — 8 prompts…`)
  try {
    const { score, total, avgLatencyMs, outPath } = await runGauntlet({
      host,
      apiKey,
      runner: await fetchRunner(url, apiKey, model),
    })
    console.log(
      `[quality] ${host}: ${score}/${total} · ${avgLatencyMs}ms avg · written to ${outPath}`,
    )
    console.log(
      '[quality] results appear in the report Quality section on the next harvest run.',
    )
    return 0
  } catch (error) {
    console.error(
      `[quality] gauntlet failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return 1
  }
}

process.exitCode = 1
void main().then((code) => {
  process.exitCode = code
})
