import { describe, expect, test } from 'bun:test'

import { fidQueuePresentation, filterFidQueue } from '../FidQueuePanel'

import type { FidQueueEntry } from '../../../state/transcript-store'

describe('FID queue presentation', () => {
  test('labels project queues without claiming event-level filtering', () => {
    expect(
      fidQueuePresentation({
        type: 'project',
        id: 'repo-a',
        label: 'Repo A',
      }),
    ).toEqual({
      title: 'Project FIDs',
      label: 'Repo A · authoritative queue',
    })
  })

  test('filters Project FIDs by the amended project identity', () => {
    const queue: FidQueueEntry[] = [
      { fidId: 'FID-A', projectId: 'repo-a', status: 'fixed' },
      { fidId: 'FID-B', projectId: 'repo-b', status: 'verified' },
    ]
    expect(
      filterFidQueue(queue, {
        type: 'project',
        id: 'repo-a',
        label: 'Repo A',
      }),
    ).toEqual([queue[0]])
    expect(
      filterFidQueue(queue, {
        type: 'global',
        id: 'fleet',
        label: 'Global fleet',
      }),
    ).toEqual(queue)
  })

  test('labels fleet queues as the combined authoritative event view', () => {
    expect(
      fidQueuePresentation({
        type: 'global',
        id: 'fleet',
        label: 'Global fleet',
      }),
    ).toEqual({
      title: 'Fleet FIDs',
      label: 'All project queues · authoritative events',
    })
  })
})
