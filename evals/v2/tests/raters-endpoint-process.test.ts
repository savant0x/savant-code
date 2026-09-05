import { describe, expect, it } from 'bun:test'

import {
  httpAutoraterProcess,
  makeEndpointGovernanceAutorater,
} from '../src/raters/endpoint'

import type { GovernanceTask } from '../src/governance'
import type { AutoraterEndpointConfig, FetchLike } from '../src/raters/endpoint'

// FID-2026-0819-005 Loop 172: httpAutoraterProcess +
// makeEndpointGovernanceAutorater suites split verbatim from
// raters-endpoint.test.ts. Shared helpers (fixtureTask, stubConfig,
// CapturedRequest, recordingFetch, failingFetch) are copied verbatim so the
// file is self-contained.

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

function unusedCapture(): CapturedRequest {
  return { url: new URL('https://unused.invalid') }
}

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
