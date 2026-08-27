import { describe, expect, it } from 'bun:test'

import {
  AUTORATER_KEY_ENV_VAR,
  AUTORATER_TIMEOUT_ENV_VAR,
  AUTORATER_URL_ENV_VAR,
  httpAutoraterProcess,
  makeEndpointGovernanceAutorater,
  resolveAutoraterEndpoint,
} from '../src/raters/endpoint'

import type { GovernanceTask } from '../src/governance'
import type { AutoraterEndpointConfig, FetchLike } from '../src/raters/endpoint'

const fixtureTask: GovernanceTask = {
  task_id: 'fsm-transition-legality',
  description: 'fixture task for autorater endpoint glue tests',
  trace: {
    task_id: 'fsm-transition-legality',
    run_id: 'fixture-run',
    started_at: '2026-01-01T00:00:00.000Z',
    finished_at: '2026-01-01T00:00:00.001Z',
    events: [{ type: 'phase_transition', from: 'idle', to: 'red' }],
    current_phase: 'complete',
    metadata: {
      total_steps: 1,
      subagent_count: 0,
      tool_call_count: 0,
      phase_transition_count: 1,
      final_phase: 'complete',
    },
  },
  assertions: [{ kind: 'fsm_legal' }],
}

function stubConfig(
  overrides?: Partial<AutoraterEndpointConfig>,
): AutoraterEndpointConfig {
  return {
    url: new URL('https://judge.example.internal/grade'),
    timeoutMs: 5_000,
    ...overrides,
  }
}

function unusedCapture(): CapturedRequest {
  return { url: new URL('https://unused.invalid') }
}

type CapturedRequest = {
  url: URL
  method?: string
  redirect?: string
  authorization?: string
  contentType?: string
  body?: string
}

function recordingFetch(
  captured: CapturedRequest,
  respond: () => Response,
): FetchLike {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.url = input instanceof URL ? input : new URL(String(input))
    captured.method = init?.method
    captured.redirect = init?.redirect
    const headers = new Headers(init?.headers)
    captured.authorization = headers.get('authorization') ?? undefined
    captured.contentType = headers.get('content-type') ?? undefined
    captured.body = typeof init?.body === 'string' ? init.body : undefined
    return respond()
  }
}

function failingFetch(failure: Error): FetchLike {
  return async () => {
    throw failure
  }
}

describe('resolveAutoraterEndpoint', () => {
  it('is disabled when the URL variable is absent', () => {
    expect(resolveAutoraterEndpoint({})).toEqual({ configured: false })
  })

  it('is disabled when the URL variable is blank', () => {
    expect(
      resolveAutoraterEndpoint({ [AUTORATER_URL_ENV_VAR]: '   ' }),
    ).toEqual({ configured: false })
  })

  it('resolves an https endpoint with defaults and no key', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
    })
    if (!resolved.configured) throw new Error('expected a configured endpoint')
    expect(resolved.config.url.href).toBe(
      'https://judge.example.internal/grade',
    )
    expect(resolved.config.apiKey).toBeUndefined()
    expect(resolved.config.timeoutMs).toBe(30_000)
  })

  it('allows an http localhost judge endpoint', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: 'http://127.0.0.1:8080/judge',
    })
    expect(resolved.configured).toBe(true)
  })

  it('trims whitespace around values and carries the optional key', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: '  https://judge.example.internal/grade  ',
      [AUTORATER_KEY_ENV_VAR]: ' secret-token ',
    })
    if (!resolved.configured) throw new Error('expected a configured endpoint')
    expect(resolved.config.apiKey).toBe('secret-token')
  })

  it('treats a blank key as absent', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
      [AUTORATER_KEY_ENV_VAR]: '',
    })
    if (!resolved.configured) throw new Error('expected a configured endpoint')
    expect(resolved.config.apiKey).toBeUndefined()
  })

  it('honors a valid timeout override', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
      [AUTORATER_TIMEOUT_ENV_VAR]: '5000',
    })
    if (!resolved.configured) throw new Error('expected a configured endpoint')
    expect(resolved.config.timeoutMs).toBe(5_000)
  })

  it('accepts timeout bounds inclusively', () => {
    for (const raw of ['500', '120000']) {
      const resolved = resolveAutoraterEndpoint({
        [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
        [AUTORATER_TIMEOUT_ENV_VAR]: raw,
      })
      expect(resolved.configured).toBe(true)
    }
  })

  it('rejects invalid timeouts naming the variable', () => {
    for (const raw of ['abc', '0', '-5', '499', '120001']) {
      expect(() =>
        resolveAutoraterEndpoint({
          [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
          [AUTORATER_TIMEOUT_ENV_VAR]: raw,
        }),
      ).toThrow(AUTORATER_TIMEOUT_ENV_VAR)
    }
  })

  it('rejects unparseable URLs without echoing the value', () => {
    let message = ''
    try {
      resolveAutoraterEndpoint({
        [AUTORATER_URL_ENV_VAR]: 'not-an-endpoint-value',
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(AUTORATER_URL_ENV_VAR)
    expect(message).not.toContain('not-an-endpoint-value')
  })

  it('rejects non-http(s) protocols', () => {
    for (const candidate of ['ftp://judge.example.internal', 'file:///judge']) {
      expect(() =>
        resolveAutoraterEndpoint({ [AUTORATER_URL_ENV_VAR]: candidate }),
      ).toThrow(AUTORATER_URL_ENV_VAR)
    }
  })

  it('rejects embedded credentials without echoing them', () => {
    let message = ''
    try {
      resolveAutoraterEndpoint({
        [AUTORATER_URL_ENV_VAR]: 'https://user:hunter2@judge.example.internal',
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(AUTORATER_URL_ENV_VAR)
    expect(message).not.toContain('hunter2')
  })
})

describe('httpAutoraterProcess', () => {
  it('posts the request as JSON with bearer auth when a key is set', async () => {
    const captured: CapturedRequest = { url: new URL('https://unused.invalid') }
    const transport = httpAutoraterProcess(
      stubConfig({ apiKey: 'k-123' }),
      recordingFetch(captured, () => new Response('A: pass')),
    )
    const raw = await transport({
      rubric: 'r',
      candidateA: 'a',
      candidateB: 'b',
      timeoutMs: 5_000,
    })
    expect(raw).toBe('A: pass')
    expect(captured.method).toBe('POST')
    expect(captured.redirect).toBe('error')
    expect(captured.contentType).toBe('application/json')
    expect(captured.authorization).toBe('Bearer k-123')
    expect(captured.body).toContain('"candidateA":"a"')
  })

  it('omits the authorization header when no key is configured', async () => {
    const captured: CapturedRequest = { url: new URL('https://unused.invalid') }
    const transport = httpAutoraterProcess(
      stubConfig(),
      recordingFetch(captured, () => new Response('B')),
    )
    await transport({
      rubric: 'r',
      candidateA: 'a',
      candidateB: 'b',
      timeoutMs: 5_000,
    })
    expect(captured.authorization).toBeUndefined()
  })

  it('fails closed on non-ok statuses without echoing the body', async () => {
    const transport = httpAutoraterProcess(
      stubConfig(),
      recordingFetch(
        unusedCapture(),
        () => new Response('service exploded', { status: 503 }),
      ),
    )
    let message = ''
    try {
      await transport({
        rubric: 'r',
        candidateA: 'a',
        candidateB: 'b',
        timeoutMs: 5_000,
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('HTTP 503')
    expect(message).not.toContain('service exploded')
  })

  it('propagates transport failures', async () => {
    const transport = httpAutoraterProcess(
      stubConfig(),
      failingFetch(new Error('ECONNREFUSED')),
    )
    await expect(
      transport({
        rubric: 'r',
        candidateA: 'a',
        candidateB: 'b',
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow('ECONNREFUSED')
  })
})

describe('makeEndpointGovernanceAutorater', () => {
  it('passes on choice A with rationale and fails on B', async () => {
    const passing = makeEndpointGovernanceAutorater(
      stubConfig(),
      () => ({ rubric: 'r', candidateA: 'compliant', candidateB: 'deficient' }),
      recordingFetch(
        unusedCapture(),
        () => new Response('A: compliant summary'),
      ),
    )
    const result = await passing(fixtureTask, fixtureTask.trace)
    expect(result.passed).toBe(true)
    expect(result.choice).toBe('A')
    expect(result.rationale).toBe('compliant summary')

    const rejecting = makeEndpointGovernanceAutorater(
      stubConfig(),
      () => ({ rubric: 'r', candidateA: 'compliant', candidateB: 'deficient' }),
      recordingFetch(unusedCapture(), () => new Response('B')),
    )
    const failed = await rejecting(fixtureTask, fixtureTask.trace)
    expect(failed.passed).toBe(false)
  })

  it('masks project origin before the payload leaves the process', async () => {
    const captured: CapturedRequest = { url: new URL('https://unused.invalid') }
    const autorater = makeEndpointGovernanceAutorater(
      stubConfig(),
      () => ({
        rubric: 'Savant-Code FID-2026-0824-017 verdict C:\\dev\\proj\\t.json',
        candidateA: 'a',
        candidateB: 'b',
      }),
      recordingFetch(captured, () => new Response('A')),
    )
    await autorater(fixtureTask, fixtureTask.trace)
    const body = captured.body ?? ''
    expect(body).toContain('[PROJECT]')
    expect(body).toContain('[FID]')
    expect(body).toContain('[PATH]')
    expect(body).not.toContain('savant-code')
  })

  it('enforces the bounded timeout against a slow judge', async () => {
    const autorater = makeEndpointGovernanceAutorater(
      stubConfig({ timeoutMs: 40 }),
      () => ({ rubric: 'r', candidateA: 'a', candidateB: 'b' }),
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 250))
        return new Response('A')
      },
    )
    await expect(autorater(fixtureTask, fixtureTask.trace)).rejects.toThrow(
      'Autorater timeout',
    )
  })
})
