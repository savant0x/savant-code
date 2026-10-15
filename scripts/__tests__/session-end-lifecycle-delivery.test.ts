import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  acknowledgeSkillLifecycleEvents,
  appendSkillLifecycleEvent,
  claimSkillLifecycleEvents,
} from '@savant-code/common/util/skill-lifecycle-events'

import { printSessionEndReview } from '../session-end-notices'
import { runSessionEndReview } from '../session-end-review'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture(count = 1): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-delivery-'))
  roots.push(root)
  for (let index = 0; index < count; index++) {
    expect(
      appendSkillLifecycleEvent(root, {
        ts: new Date(index * 1000).toISOString(),
        skillName: 'test-draft',
        action: 'draft_created',
        proofState: 'unproven',
        trustState: 'quarantined_pending_trust',
      }).ok,
    ).toBe(true)
  }
  return root
}

describe('session-end skill notice delivery', () => {
  test('construction does not acknowledge; printed events do not repeat', () => {
    const root = fixture()
    const review = runSessionEndReview(root)
    expect(claimSkillLifecycleEvents(root, 'session-end').events).toHaveLength(
      1,
    )
    const lines: string[] = []
    printSessionEndReview(root, review, (line) => {
      lines.push(line)
    })
    expect(lines.some((line) => line.includes("skill 'test-draft'"))).toBe(true)
    expect(runSessionEndReview(root).lifecycleEvents).toHaveLength(0)
    expect(claimSkillLifecycleEvents(root, 'cli').events).toHaveLength(1)
    expect(claimSkillLifecycleEvents(root, 'desktop').events).toHaveLength(1)
  })

  test('interactive acknowledgement never suppresses the review', () => {
    const root = fixture()
    acknowledgeSkillLifecycleEvents(
      root,
      'cli',
      claimSkillLifecycleEvents(root, 'cli').events,
    )
    expect(runSessionEndReview(root).lifecycleEvents).toHaveLength(1)
  })

  test('failed output replays the batch; overflow stays unread', () => {
    const root = fixture(12)
    const review = runSessionEndReview(root)
    expect(review.lifecycleEvents).toHaveLength(10)
    expect(review.routing.some((line) => line.includes('2 more'))).toBe(true)
    expect(() =>
      printSessionEndReview(root, review, () => {
        throw new Error('output unavailable')
      }),
    ).toThrow('output unavailable')
    expect(runSessionEndReview(root).lifecycleEvents).toHaveLength(10)
    printSessionEndReview(root, review, () => {})
    const next = runSessionEndReview(root)
    expect(next.lifecycleEvents).toHaveLength(2)
    printSessionEndReview(root, next, () => {})
    expect(runSessionEndReview(root).lifecycleEvents).toHaveLength(0)
    expect(
      claimSkillLifecycleEvents(root, 'cli', { limit: 20 }).events,
    ).toHaveLength(12)
  })
})
