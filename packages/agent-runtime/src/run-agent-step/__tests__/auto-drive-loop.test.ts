import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  archiveCompletedFid,
  buildChangelogEntry,
  driveAutoTurns,
  fidKebabTitle,
  markDriveBlocked,
} from '../auto-drive-loop'

import type { LoopAgentStepsParams, LoopAgentStepsResult } from '../types'
import type { AgentState } from '@savant-code/common/types/session-state'

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const tmpDirs: string[] = []
function makeRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-drive-loop-'))
  tmpDirs.push(dir)
  fs.mkdirSync(path.join(dir, 'dev', 'fids'), { recursive: true })
  return dir
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const FID_FILE = 'FID-2026-0818-999-test-child.md'
const FID_ID = 'FID-2026-0818-999'

/** Full phase evidence — satisfies every phase's presence check. */
const FULL_EVIDENCE = [
  '# FID test',
  '',
  '**Status:** closed',
  '**ID:** ' + FID_ID,
  '**Filename:** `' + FID_FILE + '`',
  '',
  '## Summary',
  '',
  'test child',
  '',
  '### RED',
  '',
  '- issue at src/x.ts:12',
  '',
  '### GREEN',
  '',
  'the fix',
  '',
  '### Missed Questions',
  '',
  '1. q — Decision: answer',
  '',
  '### Code Verification Evidence',
  '',
  '- typecheck exit 0',
  '- Verifier verdict: PASS',
  '',
  '### ADVERSARIAL',
  '',
  '- Adversary verdict: PASS',
  '',
  '## Resolution',
  '',
  'closed',
  '',
].join('\n')

function makeAgentState(drive?: AgentState['drive']): AgentState {
  return {
    agentId: 'main-agent',
    agentType: 'savant',
    agentContext: {},
    ancestorRunIds: [],
    subagents: [],
    childRunIds: [],
    messageHistory: [],
    stepsRemaining: 40,
    creditsUsed: 0,
    directCreditsUsed: 0,
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount: 0,
    ...(drive ? { drive } : {}),
  }
}

function makeParams(
  root: string,
  agentState: AgentState,
): LoopAgentStepsParams {
  return {
    agentState,
    logger: noopLogger,
    signal: new AbortController().signal,
    prompt: 'original prompt',
    fileContext: { projectRoot: root, cwd: root },
  } as unknown as LoopAgentStepsParams
}

type MockLoopFn = (
  params: LoopAgentStepsParams,
) => Promise<LoopAgentStepsResult>

describe('archiveCompletedFid', () => {
  test('moves the FID to archive and appends a CHANGELOG entry', () => {
    const root = makeRoot()
    fs.writeFileSync(path.join(root, 'dev', 'fids', FID_FILE), FULL_EVIDENCE)
    fs.writeFileSync(
      path.join(root, 'CHANGELOG.md'),
      '# Changelog\n\n## 2026-08-01 — FID-0000-0000-000\n',
    )

    const { archivePath, changelogEntry } = archiveCompletedFid(root, {
      id: FID_ID,
      fileName: FID_FILE,
    })

    expect(fs.existsSync(archivePath)).toBe(true)
    expect(fs.existsSync(path.join(root, 'dev', 'fids', FID_FILE))).toBe(false)
    expect(changelogEntry).toContain(FID_ID)
    expect(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')).toContain(
      FID_ID,
    )
  })
})

describe('fidKebabTitle + buildChangelogEntry', () => {
  test('derives the kebab title and builds an entry', () => {
    expect(fidKebabTitle(FID_FILE)).toBe('test-child')
    const entry = buildChangelogEntry(FID_ID, FID_FILE)
    expect(entry).toContain(FID_ID)
    expect(entry).toContain('test-child')
    expect(entry).toContain('(closed)')
  })
})

describe('driveAutoTurns', () => {
  test('drives one FID through the loop and archives it', async () => {
    const root = makeRoot()
    fs.writeFileSync(
      path.join(root, 'dev', 'fids', FID_FILE),
      FULL_EVIDENCE.replace('**Status:** closed', '**Status:** analyzed'),
    )

    const drive: NonNullable<AgentState['drive']> = {
      driveId: 'drive-1',
      goal: 'ship it',
      acceptanceCriteria: ['typecheck'],
      status: 'active',
      startedAt: Date.now(),
    }
    const agentState = makeAgentState(drive)
    const turns: string[] = []

    const loopFn: MockLoopFn = async (params) => {
      const st = params.agentState as AgentState
      turns.push(st.drive?.expectPhase ?? 'none')
      // The "agent" writes phase evidence to the active FID each turn. The
      // status stays non-closed until the COMPLETE phase, mirroring the real
      // ceremony (status closes only at COMPLETE).
      const fid = st.drive?.activeFid
      if (fid) {
        const files = fs.readdirSync(path.join(root, 'dev', 'fids'))
        const name = files.find((f) => f.startsWith(fid))
        if (name) {
          const closed = st.drive?.expectPhase === 'complete'
          const content = closed
            ? FULL_EVIDENCE
            : FULL_EVIDENCE.replace(
                '**Status:** closed',
                '**Status:** analyzed',
              )
          fs.writeFileSync(path.join(root, 'dev', 'fids', name), content)
        }
      }
      return { agentState: st, output: { type: 'lastMessage', value: [] } }
    }

    await driveAutoTurns(makeParams(root, agentState), loopFn)

    // red → green → audit → adversarial → complete (5 phase turns), then archive.
    expect(turns).toEqual(['red', 'green', 'audit', 'adversarial', 'complete'])
    expect(
      fs.existsSync(path.join(root, 'dev', 'fids', 'archive', FID_FILE)),
    ).toBe(true)
    expect(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')).toContain(
      FID_ID,
    )
    expect(drive.activeFid).toBeNull()
    expect(drive.expectPhase).toBeUndefined()
  })

  test('delegates to loopFn when no active drive', async () => {
    const root = makeRoot()
    const agentState = makeAgentState()
    const loopFn: MockLoopFn = async (params) => ({
      agentState: params.agentState,
      output: { type: 'lastMessage', value: [] },
    })
    const result = await driveAutoTurns(makeParams(root, agentState), loopFn)
    expect(result.output.type).toBe('lastMessage')
  })

  test('marks the drive blocked at the turn cap (rung 7)', async () => {
    const root = makeRoot()
    fs.writeFileSync(
      path.join(root, 'dev', 'fids', FID_FILE),
      FULL_EVIDENCE.replace('**Status:** closed', '**Status:** analyzed'),
    )
    const drive: NonNullable<AgentState['drive']> = {
      driveId: 'drive-2',
      goal: 'x',
      acceptanceCriteria: [],
      status: 'active',
      startedAt: Date.now(),
      expectPhase: 'red',
    }
    const agentState = makeAgentState(drive)
    // Never writes evidence → the phase never completes → cap trips.
    const loopFn: MockLoopFn = async (params) => ({
      agentState: params.agentState,
      output: { type: 'lastMessage', value: [] },
    })

    await driveAutoTurns(makeParams(root, agentState), loopFn)

    expect(drive.status).toBe('blocked')
  })
})

describe('markDriveBlocked', () => {
  test('sets the drive status to blocked', () => {
    const drive: NonNullable<AgentState['drive']> = {
      driveId: 'd',
      goal: 'x',
      acceptanceCriteria: [],
      status: 'active',
      startedAt: 0,
    }
    markDriveBlocked(drive, 'reason')
    expect(drive.status).toBe('blocked')
  })
})
