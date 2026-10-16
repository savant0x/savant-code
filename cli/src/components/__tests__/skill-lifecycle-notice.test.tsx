/**
 * FID-2026-1016-014 — the mount that makes `SkillLifecycleNotice` a live
 * surface. FID-2026-1005-003 Step 4 wrote this component for the CLI and
 * never wired it: it was rendered by nothing, so a mechanically created skill
 * draft appeared only in `session-end:review` and `/skills activity`. The
 * render assertion here is the "prove it renders" half of the repair; the
 * wiring itself is pinned by the source check at the bottom of this file,
 * because a static render cannot see which parent mounts a child.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { appendSkillLifecycleEvent } from '@savant-code/common/util/skill-lifecycle-events'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../hooks/use-theme'
import { SkillLifecycleNoticeAuto } from '../skill-lifecycle-notice'
import { mockOpentuiReactForStaticRender } from '../tools/__tests__/helpers/mock-opentui-react-static'

import type { SkillLifecycleEvent } from '@savant-code/common/util/skill-lifecycle-events'

// TrafficLights (via TerminalCommandDisplay) mounts opentui focus/renderer
// hooks, which throw under react-dom/server. Same inert-stub harness the
// compaction-signal and right-sidebar static-render suites use.

mockOpentuiReactForStaticRender()
// TrafficLights reads the theme store; uninitialized it throws under
// react-dom/server (same prerequisite the compaction-signal suite documents).
initializeThemeStore()

const tempRoots: string[] = []

function fixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-lifecycle-notice-'))
  tempRoots.push(root)
  return root
}

function draftEvent(
  overrides: Partial<Omit<SkillLifecycleEvent, 'id'>> = {},
): Omit<SkillLifecycleEvent, 'id'> {
  return {
    ts: '2026-10-16T22:00:00.000Z',
    skillName: 'quarantine-demo',
    action: 'draft_created',
    draftSha: 'a'.repeat(64),
    proofState: 'unproven',
    trustState: 'quarantined_pending_trust',
    sessionId: 'session-1',
    ...overrides,
  }
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('SkillLifecycleNotice (FID-2026-1016-014: the Step-4 surface, mounted)', () => {
  test('renders an unseen draft as a traffic-light row with the trust boundary', () => {
    const root = fixtureRoot()
    const appended = appendSkillLifecycleEvent(root, draftEvent())
    expect(appended.ok).toBe(true)

    const markup = renderToStaticMarkup(
      <SkillLifecycleNoticeAuto projectRoot={root} />,
    )

    // The chrome comes from TerminalCommandDisplay, the body from the
    // metadata-only formatter — never raw tool or model prose.
    expect(markup).toContain('skill lifecycle')
    expect(markup).toContain('quarantine-demo')
    expect(markup).toContain('●')
  })

  test('paints NOTHING when this surface has no unseen event', () => {
    const root = fixtureRoot()

    const markup = renderToStaticMarkup(
      <SkillLifecycleNoticeAuto projectRoot={root} />,
    )

    // Empty state must be an empty row: this component sits in the ghost
    // slot of a sticky-bottom scrollbox, where anything painted becomes a
    // fake last message.
    expect(markup).toBe('')
  })

  test('renders nothing for events in a log for a different project root', () => {
    const populated = fixtureRoot()
    appendSkillLifecycleEvent(populated, draftEvent())
    const other = fixtureRoot()

    expect(
      renderToStaticMarkup(<SkillLifecycleNoticeAuto projectRoot={other} />),
    ).toBe('')
  })

  test('is mounted by the chat panels, not merely exported', () => {
    // A static render cannot prove who mounts a child, and the defect this
    // FID repairs was exactly an unwired component that every unit test
    // passed on. Pin the mount site itself.
    const panels = fs.readFileSync(
      path.resolve(import.meta.dir, '..', '..', 'chat', 'panels.tsx'),
      'utf8',
    )
    expect(panels).toContain('SkillLifecycleNoticeAuto')
    expect(panels).toContain('projectRoot={getProjectRoot()}')
  })
})
