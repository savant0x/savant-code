import { describe, expect, it } from 'bun:test'

import { resolveExecutionPolicy } from './execution-policy'

describe('resolveExecutionPolicy', () => {
  it('fails closed for strict sessions even when devMode is true', () => {
    const policy = resolveExecutionPolicy({
      fileContext: { devMode: true },
      agentState: {
        protocolStrictMode: true,
        protocolVariant: 'harness',
      },
    })

    expect(policy).toEqual({
      allowCapabilityOverride: false,
      allowFsmOverride: false,
      allowSandboxOverride: false,
    })
  })

  it('fails closed for single-agent sessions even when devMode is true', () => {
    const policy = resolveExecutionPolicy({
      fileContext: { devMode: true },
      agentState: {
        protocolStrictMode: false,
        protocolVariant: 'single-agent',
      },
    })

    expect(policy.allowCapabilityOverride).toBe(false)
    expect(policy.allowFsmOverride).toBe(false)
    expect(policy.allowSandboxOverride).toBe(false)
  })

  it('allows the explicitly non-strict harness development policy', () => {
    const policy = resolveExecutionPolicy({
      fileContext: { devMode: true },
      agentState: {
        protocolStrictMode: false,
        protocolVariant: 'harness',
      },
    })

    expect(policy).toEqual({
      allowCapabilityOverride: true,
      allowFsmOverride: true,
      allowSandboxOverride: true,
    })
  })

  it('defaults absent development state to fail closed', () => {
    const policy = resolveExecutionPolicy({
      fileContext: { devMode: undefined },
      agentState: {
        protocolStrictMode: false,
        protocolVariant: 'harness',
      },
    })

    expect(policy.allowCapabilityOverride).toBe(false)
    expect(policy.allowFsmOverride).toBe(false)
    expect(policy.allowSandboxOverride).toBe(false)
  })
})
