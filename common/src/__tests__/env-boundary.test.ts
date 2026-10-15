import { describe, expect, it } from 'bun:test'

import { allowsDevelopmentDefaults } from '../env-boundary'

describe('allowsDevelopmentDefaults', () => {
  it('allows explicit local dev/test outside protected contexts', () => {
    expect(allowsDevelopmentDefaults('dev', {})).toBe(true)
    expect(allowsDevelopmentDefaults('test', {})).toBe(true)
  })

  it('rejects an unset mode because local trust must be explicit', () => {
    expect(allowsDevelopmentDefaults(undefined, {})).toBe(false)
  })

  it('rejects production, unknown, CI, and release contexts', () => {
    expect(allowsDevelopmentDefaults('prod', {})).toBe(false)
    expect(allowsDevelopmentDefaults('release', {})).toBe(false)
    expect(allowsDevelopmentDefaults('dev', { CI: 'true' })).toBe(false)
    expect(allowsDevelopmentDefaults('dev', { CI: '1' })).toBe(false)
    expect(
      allowsDevelopmentDefaults('test', {
        SAVANT_CODE_RELEASE_AUTOMATION: '1',
      }),
    ).toBe(false)
    expect(
      allowsDevelopmentDefaults('test', {
        SAVANT_CODE_GITHUB_ACTIONS: 'TRUE',
      }),
    ).toBe(false)
    expect(
      allowsDevelopmentDefaults(undefined, { NODE_ENV: 'production' }),
    ).toBe(false)
  })
})
