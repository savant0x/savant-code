import { describe, expect, it } from 'bun:test'

import { getProviderOptions } from '../llm'

interface SavantCodeProviderOptions {
  'savant-code': {
    savant_code_metadata: {
      run_id: string
      client_id: string
      savant_free_instance_id?: string
    }
  }
}

describe('getProviderOptions — savant_code_metadata', () => {
  const baseParams = {
    model: 'openrouter/anthropic/claude-sonnet-4-5',
    runId: 'run-1',
    clientSessionId: 'session-1',
  }

  it('includes run_id and client_id in savant_code_metadata', () => {
    const opts = getProviderOptions(
      baseParams,
    ) as unknown as SavantCodeProviderOptions
    const meta = opts['savant-code'].savant_code_metadata
    expect(meta).toMatchObject({
      run_id: 'run-1',
      client_id: 'session-1',
    })
  })

  it('merges extraSavantCodeMetadata into savant_code_metadata', () => {
    const opts = getProviderOptions({
      ...baseParams,
      extraSavantCodeMetadata: { savant_free_instance_id: 'abc-123' },
    }) as unknown as SavantCodeProviderOptions
    const meta = opts['savant-code'].savant_code_metadata
    expect(meta).toMatchObject({
      run_id: 'run-1',
      client_id: 'session-1',
      savant_free_instance_id: 'abc-123',
    })
  })

  it('omits extra keys when extraSavantCodeMetadata is undefined', () => {
    const opts = getProviderOptions(
      baseParams,
    ) as unknown as SavantCodeProviderOptions
    const meta = opts['savant-code'].savant_code_metadata
    expect(Object.keys(meta)).toEqual(
      expect.arrayContaining(['run_id', 'client_id']),
    )
    expect(meta.savant_free_instance_id).toBeUndefined()
  })

  it('extraSavantCodeMetadata does not overwrite reserved keys', () => {
    const opts = getProviderOptions({
      ...baseParams,
      extraSavantCodeMetadata: {
        run_id: 'evil-override',
      },
    }) as unknown as SavantCodeProviderOptions
    const meta = opts['savant-code'].savant_code_metadata
    expect(meta.run_id).toBe('run-1')
  })
})
