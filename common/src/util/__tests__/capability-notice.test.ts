import { describe, expect, it } from 'bun:test'

import {
  capabilityNoticeLead,
  createCapabilityNoticeLog,
  renderCapabilityNotice,
} from '../capability-notice'

describe('capabilityNoticeLead', () => {
  it('says the capability is unavailable when nothing could run', () => {
    expect(
      capabilityNoticeLead({ label: 'Web search', state: 'unavailable' }),
    ).toBe('Web search is unavailable')
  })

  it('says the capability did not complete when it ran and did not finish', () => {
    expect(
      capabilityNoticeLead({ label: 'Web search', state: 'incomplete' }),
    ).toBe('Web search did not complete')
  })
})

describe('renderCapabilityNotice', () => {
  it('renders reason, then the one action, then the non-conclusion', () => {
    expect(
      renderCapabilityNotice({
        capability: 'web_search',
        label: 'Web search',
        state: 'unavailable',
        reason: 'no research provider is configured',
        action: 'Add a research API key in the UI.',
        consequence: 'This is not evidence that no source exists.',
      }),
    ).toBe(
      'Web search is unavailable: no research provider is configured ' +
        'Add a research API key in the UI. ' +
        'This is not evidence that no source exists.',
    )
  })

  it('omits the consequence when there is none', () => {
    expect(
      renderCapabilityNotice({
        capability: 'code_search',
        label: 'Code search',
        state: 'incomplete',
        reason: 'the ripgrep process exited 2',
        action: 'Narrow the pattern.',
      }),
    ).toBe(
      'Code search did not complete: the ripgrep process exited 2 Narrow the pattern.',
    )
  })
})

describe('createCapabilityNoticeLog', () => {
  const notice = { capability: 'web_search', reason: 'no provider configured' }

  it('claims a notice once per scope', () => {
    const log = createCapabilityNoticeLog()
    expect(log.claim(notice)).toBe(true)
    expect(log.claim(notice)).toBe(false)
    expect(log.claim({ ...notice, reason: 'other' })).toBe(true)
    expect(log.size()).toBe(2)
  })

  it('clears wholesale on overflow so a long-lived process cannot grow it', () => {
    const log = createCapabilityNoticeLog(2)
    log.claim({ ...notice, reason: 'a' })
    log.claim({ ...notice, reason: 'b' })
    expect(log.claim({ ...notice, reason: 'c' })).toBe(true)
    expect(log.size()).toBe(1)
    // The cleared key is claimable again — the cost of overflow is one repeat.
    expect(log.claim({ ...notice, reason: 'a' })).toBe(true)
  })

  it('can be cleared by its owner', () => {
    const log = createCapabilityNoticeLog()
    log.claim(notice)
    log.clear()
    expect(log.claim(notice)).toBe(true)
  })
})
