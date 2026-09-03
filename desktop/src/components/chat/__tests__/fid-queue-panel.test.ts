import { describe, expect, test } from 'bun:test'

import {
  activeFidQueue,
  boundFidRows,
  fidQueuePresentation,
  filterFidQueue,
  MAX_EXPANDED_ROWS,
  PREVIEW_ROWS,
} from '../FidQueuePanel'

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

  test('active queue drops closed FIDs (P20 — no finished work in the rail)', () => {
    const queue: FidQueueEntry[] = [
      { fidId: 'FID-A', projectId: 'repo-a', status: 'created' },
      { fidId: 'FID-B', projectId: 'repo-a', status: 'fixed' },
      { fidId: 'FID-C', projectId: 'repo-a', status: 'closed' },
    ]
    expect(activeFidQueue(queue).map((entry) => entry.fidId)).toEqual([
      'FID-A',
      'FID-B',
    ])
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

  test('bounds the fold: preview capped, expand limited (P21)', () => {
    const queue: FidQueueEntry[] = Array.from({ length: 25 }, (_, i) => ({
      fidId: `FID-${i}`,
      projectId: 'repo-a',
      status: 'created',
    }))
    // Collapsed: PREVIEW_ROWS visible.
    expect(boundFidRows(queue, false)).toHaveLength(PREVIEW_ROWS)
    // Expanded: capped at MAX_EXPANDED_ROWS, never all 25.
    expect(boundFidRows(queue, true)).toHaveLength(MAX_EXPANDED_ROWS)
    // Empty always stays empty.
    expect(boundFidRows([], false)).toHaveLength(0)
  })
})
