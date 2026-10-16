import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, expect, test } from 'bun:test'

import { closedOwnerIssues } from '../experiences-probe'
import { collectInternalFollowupIssues } from '../internal-followup-check'
import {
  INTERNAL_FOLLOWUPS,
  readInternalFollowups,
} from '../internal-followups'
import { runSessionEndReview } from '../session-end-review'

const FID = 'FID-2026-1015-006'
const PREVIOUS = 'FID-2026-1012-017'
const KEY = 'v1:spawn_agents:incomplete-arguments:unexpected'
const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'internal-followups-'))
  roots.push(root)
  for (const directory of [
    'dev/fids/archive',
    'dev/experiences',
    'dev/tracking',
  ])
    fs.mkdirSync(path.join(root, directory), { recursive: true })
  fs.writeFileSync(
    path.join(root, `dev/fids/archive/${FID}-fixture.md`),
    `**Status:** closed\n**Continues Classes From:** ${PREVIOUS}\n` +
      '### Code Verification Evidence\nImplementation verified at 12345678.\n',
  )
  fs.writeFileSync(
    path.join(root, `dev/fids/archive/${PREVIOUS}-fixture.md`),
    '**Status:** closed\n',
  )
  fs.writeFileSync(
    path.join(root, 'dev/experiences/class-owners.json'),
    JSON.stringify({ version: 1, owners: [{ classKey: KEY, fid: FID }] }),
  )
  fs.writeFileSync(
    path.join(root, 'dev/experiences/fix-boundaries.json'),
    JSON.stringify({ version: 1, boundaries: [] }),
  )
  fs.writeFileSync(path.join(root, 'dev/experiences/raw-traces.jsonl'), '')
  const item = {
    id: 'OBS-001',
    kind: 'observation',
    status: 'open',
    owner: 'Orchestrator',
    summary: 'Collect qualified exposure.',
    nextAction: 'Wait for real exposure.',
    evidence: ['dev/experiences/class-owners.json'],
    completionEvidence: [] as string[],
    classes: [
      { classKey: KEY, implementationFid: FID, predecessorFid: PREVIOUS },
    ],
  }
  const save = () =>
    fs.writeFileSync(
      path.join(root, INTERNAL_FOLLOWUPS),
      JSON.stringify({ version: 1, followups: [item] }),
    )
  save()
  return { root, item, save }
}

test('archived implementation retains observation ownership and original waiver provenance', () => {
  const { root } = fixture()
  const classes = [{ key: KEY, owner: FID, state: 'unresolved' as const }]
  const waivers = {
    version: 1 as const,
    waivers: [
      {
        fid: PREVIOUS,
        grantedAt: '2026-10-14',
        fixCutoff: '2026-10-13T23:00:00Z',
        reason: 'Historical implementation-only closure.',
        classes: [KEY],
      },
    ],
  }
  expect(collectInternalFollowupIssues(root)).toEqual([])
  expect(closedOwnerIssues(root, [FID], classes, waivers)).toEqual([])
  expect(classes[0]?.state).toBe('unresolved')
})

test('recurrence remains a failure even with valid independent tracking', () => {
  const { root } = fixture()
  expect(
    closedOwnerIssues(
      root,
      [FID],
      [
        {
          key: KEY,
          owner: FID,
          state: 'recurred',
        },
      ],
    ),
  ).toContain(`tracked observation has recurrent class: ${KEY}`)
})

test('an arbitrary class owner or predecessor cannot grant tracking coverage', () => {
  const { root, item, save } = fixture()
  item.classes[0]!.implementationFid = PREVIOUS
  save()
  expect(readInternalFollowups(root).followups).toEqual([])
  expect(readInternalFollowups(root).issues.join('\n')).toContain(
    'ownership mismatch',
  )
  item.classes[0]!.implementationFid = FID
  item.classes[0]!.predecessorFid = 'FID-2026-1001-001'
  save()
  expect(readInternalFollowups(root).issues.join('\n')).toContain(
    'predecessor provenance',
  )
  expect(
    closedOwnerIssues(
      root,
      [FID],
      [
        {
          key: KEY,
          owner: FID,
          state: 'unresolved',
        },
      ],
    ),
  ).toContain(`closed owner has unproved class: ${KEY}`)
})

test('completed observation cannot turn evidence file existence into repair proof', () => {
  const { root, item, save } = fixture()
  item.status = 'completed'
  item.completionEvidence = ['dev/experiences/class-owners.json']
  save()
  expect(
    collectInternalFollowupIssues(root).map((issue) => issue.message),
  ).toContain(`completed observation is unproved: ${KEY} (unresolved)`)
})

test('unsafe evidence, duplicates and malformed stores fail closed', () => {
  const { root, item, save } = fixture()
  item.evidence = ['../outside.json']
  save()
  expect(readInternalFollowups(root).followups).toEqual([])
  expect(readInternalFollowups(root).issues.join('\n')).toContain(
    'unsafe evidence',
  )
  item.evidence = ['dev/experiences/class-owners.json']
  fs.writeFileSync(
    path.join(root, INTERNAL_FOLLOWUPS),
    JSON.stringify({ version: 1, followups: [item, item] }),
  )
  expect(readInternalFollowups(root).issues.join('\n')).toContain(
    'duplicate tracked class',
  )
  fs.writeFileSync(path.join(root, INTERNAL_FOLLOWUPS), '{')
  expect(readInternalFollowups(root).followups).toEqual([])
  expect(collectInternalFollowupIssues(root).length).toBeGreaterThan(0)
})

test('live comparisons cannot carry observation class associations', () => {
  const { root, item } = fixture()
  fs.writeFileSync(
    path.join(root, INTERNAL_FOLLOWUPS),
    JSON.stringify({
      version: 1,
      followups: [{ ...item, kind: 'live-comparison', sourceFids: [FID] }],
    }),
  )
  expect(readInternalFollowups(root).followups).toEqual([])
})

test('the real session-end entry point puts independent tracking into agenda and routing', () => {
  const { root } = fixture()
  const review = runSessionEndReview(root)
  expect(review.agenda).toContain('OBS-001')
  expect(review.agenda).toContain('independent of FID closure')
  expect(
    review.routing.some((note) => note.startsWith('INTERNAL: OBS-001')),
  ).toBe(true)
})

test('a clean clone without local dev state validates; malformed local state fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tracking-clean-'))
  roots.push(root)
  expect(collectInternalFollowupIssues(root)).toEqual([])
  fs.mkdirSync(path.join(root, 'dev/tracking'), { recursive: true })
  fs.writeFileSync(path.join(root, INTERNAL_FOLLOWUPS), '{')
  expect(collectInternalFollowupIssues(root).length).toBeGreaterThan(0)
})

test('a standalone live comparison requires no experience ledger or historical FIDs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tracking-live-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'dev/tracking'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'comparison.md'),
    'Comparison plan with limits.',
  )
  fs.writeFileSync(
    path.join(root, INTERNAL_FOLLOWUPS),
    JSON.stringify({
      version: 1,
      followups: [
        {
          id: 'LIVE-001',
          kind: 'live-comparison',
          status: 'open',
          owner: 'Operator',
          summary: 'Compare providers.',
          nextAction: 'Select limits.',
          evidence: ['comparison.md'],
          completionEvidence: [],
          sourceFids: [],
        },
      ],
    }),
  )
  expect(collectInternalFollowupIssues(root)).toEqual([])
  expect(runSessionEndReview(root).agenda).toContain('LIVE-001')
})
