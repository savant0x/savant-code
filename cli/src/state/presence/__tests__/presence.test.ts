import { describe, expect, it } from 'bun:test'

import {
  mapSanitizedState,
  resolveAgentAsset,
  resolveModeAsset,
  resolvePhaseState,
  resolveStateLine,
} from '../presence-mapper'
import {
  maskSearchQuery,
  SAFE_PRESENCE_PAYLOAD,
  sanitizeAgentType,
  sanitizeFidId,
  sanitizeModel,
  sanitizeProject,
  sanitizeRawState,
  sanitizeToolActivity,
  validatePayload,
} from '../presence-privacy'
import { shouldDispatch, TokenBucket } from '../presence-selector'

describe('presence privacy (redaction)', () => {
  it('reduces a path to its basename', () => {
    expect(sanitizeProject('C:\\Corporate\\NextGen\\AuthService')).toBe(
      'AuthService',
    )
    expect(sanitizeProject('/home/dev/projects/api')).toBe('api')
  })

  it('strips the FID kebab title (may name a vulnerability)', () => {
    expect(
      sanitizeFidId('FID-2026-0819-042-fix-jwt-bypass-vulnerability.md'),
    ).toBe('FID-2026-0819-042')
  })

  it('drops tool arguments absolutely', () => {
    expect(sanitizeToolActivity('write_file').includes('write_file')).toBe(true)
    expect(sanitizeToolActivity('write_file')).not.toContain('crypto/keys.ts')
  })

  it('masks search queries', () => {
    expect(maskSearchQuery()).not.toContain('secret')
  })

  it('trims the provider prefix and variant suffix from the model', () => {
    expect(sanitizeModel('deepseek/deepseek-v4-pro')).toBe('deepseek-v4-pro')
    expect(sanitizeModel('nous/meituan/longcat-2.0:free')).toBe('longcat-2.0')
    expect(sanitizeModel('openrouter/deepseek-v4-pro:free')).toBe(
      'deepseek-v4-pro',
    )
    expect(sanitizeModel('minimax/minimax-m3')).toBe('minimax-m3')
    expect(sanitizeModel('claude-3-5-sonnet')).toBe('claude-3-5-sonnet')
    // `:free` is stripped anywhere it appears as a variant marker.
    expect(sanitizeModel('foo/bar:free:online')).toBe('bar')
  })

  it('gives the openrouter/free boot default a readable label', () => {
    expect(sanitizeModel('openrouter/free')).toBe('OpenRouter Free')
  })

  it('composes raw state with no path/query/FID-title surviving', () => {
    const sanitized = sanitizeRawState({
      cwd: '/home/dev/projects/api',
      model: 'openrouter/free',
      mode: 'STRICT',
      phase: 'red',
      agentId: 'detective',
      activityKind: 'tool',
      toolName: 'write_file',
      activityAgentType: null,
      activeFid: 'FID-2026-0819-042-fix-jwt.md',
    })
    expect(sanitized.project).toBe('api')
    expect(sanitized.model).toBe('OpenRouter Free')
    expect(sanitized.mode).toBe('STRICT')
    expect(sanitized.activity).toBe('using tool: write_file')
    expect(sanitized.fidId).toBe('FID-2026-0819-042')
  })

  it('maps thinking and subagent activity to live narratives', () => {
    const thinking = sanitizeRawState({
      cwd: '/home/dev/api',
      model: 'openrouter/free',
      mode: 'HYBRID',
      phase: 'idle',
      agentId: 'orchestrator',
      activityKind: 'thinking',
      toolName: null,
      activityAgentType: null,
      activeFid: null,
    })
    expect(thinking.activity).toBe('Thinking…')

    const delegating = sanitizeRawState({
      cwd: '/home/dev/api',
      model: 'openrouter/free',
      mode: 'HYBRID',
      phase: 'idle',
      agentId: 'orchestrator',
      activityKind: 'subagent',
      toolName: null,
      activityAgentType: 'savant-code/context-pruner',
      activeFid: null,
    })
    expect(delegating.activity).toBe('Delegating to savant-code-context-pruner')
  })

  it('neutralizes path separators in a subagent type', () => {
    expect(sanitizeAgentType('savant-code/context-pruner')).toBe(
      'savant-code-context-pruner',
    )
    expect(sanitizeAgentType('a\\b')).toBe('a-b')
  })
})

describe('presence privacy (Zod + fail-closed)', () => {
  it('rejects a path separator in details and falls back to the safe payload', () => {
    const result = validatePayload({
      details: 'Project: /etc/passwd',
      state: 'x'.repeat(2),
      startTimestamp: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.payload).toEqual(SAFE_PRESENCE_PAYLOAD)
  })

  it('rejects an out-of-charset asset key', () => {
    const result = validatePayload({
      details: 'ok',
      state: 'ok',
      largeImageKey: 'BAD key!',
      startTimestamp: 1,
    })
    expect(result.ok).toBe(false)
  })

  it('accepts a valid payload', () => {
    const result = validatePayload({
      details: 'Project: api | Model: claude-3-5-sonnet',
      state: 'RED Phase: Investigating Codebase',
      largeImageKey: 'agent_detective',
      startTimestamp: 12345,
    })
    expect(result.ok).toBe(true)
  })
})

describe('presence mapper', () => {
  it('resolves phase narratives and agent assets', () => {
    expect(resolvePhaseState('red')).toBe('RED Phase: Investigating Codebase')
    expect(resolvePhaseState('unknown')).toBe('Awaiting Operator Input')
    expect(resolveAgentAsset('detective').key).toBe('agent_detective')
    expect(resolveAgentAsset(null).key).toBe('agent_orchestrator')
    expect(resolveModeAsset('STRICT').key).toBe('mode_strict')
    expect(resolveModeAsset(undefined).key).toBe('mode_hybrid')
  })

  it('resolveStateLine prefers a non-idle phase and appends the FID', () => {
    expect(resolveStateLine('green', 'using tool: write_file', null)).toBe(
      'GREEN Phase: Implementing Fixes',
    )
    expect(resolveStateLine('idle', 'Thinking…', null)).toBe('Thinking…')
    expect(resolveStateLine('idle', null, null)).toBe('Awaiting Operator Input')
    expect(resolveStateLine('idle', null, 'FID-2026-0819-042')).toBe(
      'Awaiting Operator Input | FID: FID-2026-0819-042',
    )
    expect(
      resolveStateLine('red', 'using tool: write_file', 'FID-2026-0819-042'),
    ).toBe('RED Phase: Investigating Codebase | FID: FID-2026-0819-042')
  })

  it('synthesizes the payload with asset keys and no paths', () => {
    const payload = mapSanitizedState(
      {
        project: 'api',
        model: 'claude-3-5-sonnet',
        mode: 'HYBRID',
        phase: 'green',
        agentId: 'forge',
        activity: null,
        fidId: null,
      },
      42,
    )
    expect(payload.details).toBe('Project: api · Model: claude-3-5-sonnet')
    expect(payload.state).toBe('GREEN Phase: Implementing Fixes')
    expect(payload.largeImageKey).toBe('agent_forge')
    expect(payload.smallImageKey).toBe('mode_hybrid')
    expect(payload.smallImageText).toBe('Hybrid Mode')
    expect(payload.startTimestamp).toBe(42)
  })

  it('keeps the mode in the overlay and surfaces activity in the state line', () => {
    const idle = mapSanitizedState(
      {
        project: 'api',
        model: 'deepseek-v4-pro',
        mode: 'STRICT',
        phase: 'idle',
        agentId: null,
        activity: null,
        fidId: null,
      },
      1,
    )
    // Line 1 = project + model (both short), line 2 = the live action; the
    // mode stays the overlay — never mislabeled as the model.
    expect(idle.details).toBe('Project: api · Model: deepseek-v4-pro')
    expect(idle.details).not.toContain('STRICT')
    expect(idle.state).toBe('Awaiting Operator Input')
    expect(idle.smallImageKey).toBe('mode_strict')
    expect(idle.smallImageText).toBe('STRICT Mode')

    const active = mapSanitizedState(
      {
        project: 'api',
        model: 'deepseek-v4-pro',
        mode: 'STRICT',
        phase: 'idle',
        agentId: null,
        activity: 'using tool: write_file',
        fidId: null,
      },
      1,
    )
    // The live activity surfaces on the visible `state` line in real time.
    expect(active.state).toBe('using tool: write_file')
    expect(active.smallImageKey).toBe('mode_strict')
    expect(active.smallImageText).toBe('STRICT Mode')
  })
})

describe('presence rate limiter', () => {
  it('caps dispatch at capacity then refills', () => {
    const bucket = new TokenBucket(5, 4000, 0)
    for (let i = 0; i < 5; i += 1) {
      expect(shouldDispatch(bucket, null, { i }, 0)).toBe(true)
    }
    expect(shouldDispatch(bucket, null, { i: 99 }, 0)).toBe(false)
    // After 4s, one token refills.
    expect(shouldDispatch(bucket, { i: 99 }, { i: 100 }, 4000)).toBe(true)
  })

  it('skips identical snapshots even with a token', () => {
    const bucket = new TokenBucket(5, 4000, 0)
    const snapshot = { project: 'api' }
    expect(shouldDispatch(bucket, snapshot, snapshot, 0)).toBe(false)
  })
})
