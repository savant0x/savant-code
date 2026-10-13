import { promises as fs } from 'node:fs'

import { describe, expect, test } from 'bun:test'

import { createClientCapabilityProbe } from '../native/capability-preflight'
import { buildAgentRuntimeImpl } from '../run/agent-runtime-impl'

describe('FID-019 client capability preflight', () => {
  test('unused tools and host overrides never probe a bundled executable', async () => {
    const deps = {
      resolve: () => {
        throw new Error('must not resolve')
      },
      starts: async () => {
        throw new Error('must not start')
      },
    }
    expect(
      await createClientCapabilityProbe({ overriddenSearch: false }, deps)([]),
    ).toEqual([])
    const probe = createClientCapabilityProbe({ overriddenSearch: true }, deps)
    expect((await probe(['code_search']))[0]?.state).toBe('unverified')
  })

  test('missing and unstartable binaries produce a bounded safe remedy', async () => {
    for (const failResolution of [true, false]) {
      const probe = createClientCapabilityProbe(
        { overriddenSearch: false },
        {
          resolve: () => {
            if (failResolution) throw new Error('secret-fixture-value')
            return '/configured/binary'
          },
          starts: async () => false,
        },
      )
      const result = await probe(['code_search'])
      expect(result[0]?.state).toBe('unavailable')
      expect(result[0]?.action).toContain('fetch-ripgrep')
      expect(JSON.stringify(result)).not.toContain('secret-fixture-value')
      expect(JSON.stringify(result)).not.toContain('/configured/binary')
    }
  })

  test('concurrent children share one check, and changed configuration rechecks', async () => {
    const previous = process.env.SAVANT_CODE_RG_PATH
    let starts = 0
    try {
      const probe = createClientCapabilityProbe(
        { overriddenSearch: false },
        {
          resolve: () => '/fixture/rg',
          starts: async () => {
            starts += 1
            return true
          },
        },
      )
      const results = await Promise.all([
        probe(['code_search']),
        probe(['code_search']),
      ])
      expect(results.every((result) => result[0]?.state === 'ready')).toBe(true)
      expect(starts).toBe(1)
      process.env.SAVANT_CODE_RG_PATH = 'changed-fixture'
      await probe(['code_search'])
      expect(starts).toBe(2)
    } finally {
      if (previous === undefined) delete process.env.SAVANT_CODE_RG_PATH
      else process.env.SAVANT_CODE_RG_PATH = previous
    }
  })

  test('cancelled runs do not probe', async () => {
    const controller = new AbortController()
    controller.abort()
    const probe = createClientCapabilityProbe(
      {
        overriddenSearch: false,
        signal: controller.signal,
      },
      {
        resolve: () => {
          throw new Error('must not resolve')
        },
        starts: async () => false,
      },
    )
    expect((await probe(['code_search']))[0]?.state).toBe('unverified')
  })

  test('the real version adapter rejects an executable that is not ripgrep', async () => {
    const previous = process.env.SAVANT_CODE_RG_PATH
    process.env.SAVANT_CODE_RG_PATH = process.execPath
    try {
      const probe = createClientCapabilityProbe({ overriddenSearch: false })
      expect((await probe(['code_search']))[0]?.state).toBe('unavailable')
    } finally {
      if (previous === undefined) delete process.env.SAVANT_CODE_RG_PATH
      else process.env.SAVANT_CODE_RG_PATH = previous
    }
  })

  test('the SDK runtime carries its real override-aware client callback', async () => {
    const runtime = buildAgentRuntimeImpl({
      fs,
      overrideTools: { code_search: async () => [] },
      customToolDefinitions: [],
      onError: () => {},
      onResponseChunk: async () => {},
      onSubagentResponseChunk: async () => {},
      handlePromptResponseAction: () => {},
    })
    expect(runtime.probeClientCapabilities).toBeDefined()
    const result = await runtime.probeClientCapabilities?.(['code_search'])
    expect(result?.[0]?.state).toBe('unverified')
    expect(result?.[0]?.reason).toContain('Host override')
  })
})
