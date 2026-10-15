import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  FILE_CONTEXT_CARRIED_ACROSS_RUNS,
  FILE_CONTEXT_REFRESHED_AT_RUN_START,
  SESSION_DEEP_COPIED,
  SESSION_SHARED_BY_REFERENCE,
  classifyFileContextField,
  classifySessionStateField,
} from '@savant-code/common/types/session-boundary-fields'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { describe, expect, it } from 'bun:test'

import { cloneSessionState } from '../run'
import { resolveSessionState } from '../run/execution/session-state'
import { applyOverridesToSessionState } from '../run-state'

import type { RunState } from '../run-state'
import type { DesignContract } from '@savant-code/common/types/design-system'
import type { SessionState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0919-029 — pins for the SessionState / ProjectFileContext boundary
 * partitions. Every assertion here is driven by the SHIPPED lists in
 * `common/src/types/session-boundary-fields.ts`, so a list that stops describing
 * the code fails a test instead of passing as documentation.
 */

const refreshed = FILE_CONTEXT_REFRESHED_AT_RUN_START as readonly string[]
const carried = Object.keys(FILE_CONTEXT_CARRIED_ACROSS_RUNS)

function makeSession(): SessionState {
  const state = getInitialSessionState(getStubProjectFileContext())
  state.mainAgentState.messageHistory = [
    { role: 'user', content: [{ type: 'text', text: 'hello' }] },
  ] as unknown as SessionState['mainAgentState']['messageHistory']
  return state
}

/** A base session whose every field differs from what run start would write. */
function plantedSession(): SessionState {
  const state = makeSession()
  state.fileContext = {
    ...state.fileContext,
    devMode: false,
    permissionMode: 'safe',
    designContract: { system: 'planted' } as never,
    designSystemContext: 'planted-context',
    fileTree: [
      { name: 'planted.ts', type: 'file', filePath: '/planted.ts' },
    ] as never,
    fileTokenScores: { '/planted.ts': { tokens: 1 } },
    tokenCallers: { '/planted.ts': { f: ['g'] } },
    knowledgeFiles: { '/planted.md': 'planted' },
    agentTemplates: { planted: { id: 'planted' } },
    customToolDefinitions: { plantedTool: { inputSchema: {} } },
    gitChanges: {
      status: 'planted-status',
      diff: 'planted-diff',
      diffCached: 'planted-cached',
      lastCommitMessages: 'planted-log',
    },
  }
  return state
}

describe('SessionState snapshot partition (FID-2026-0919-029)', () => {
  it('deep-copies exactly the fields classified deep-copied', () => {
    const source = makeSession()
    const snapshot = cloneSessionState(source)

    expect(SESSION_DEEP_COPIED.length).toBeGreaterThan(0)
    for (const field of SESSION_DEEP_COPIED) {
      expect(snapshot[field]).not.toBe(source[field])
      expect(snapshot[field]).toEqual(source[field])
      expect(classifySessionStateField(field)).toBe('deep-copied')
    }
  })

  it('shares by reference exactly the fields classified shared', () => {
    const source = makeSession()
    const snapshot = cloneSessionState(source)

    const sharedFields = Object.keys(SESSION_SHARED_BY_REFERENCE)
    expect(sharedFields.length).toBeGreaterThan(0)
    for (const field of sharedFields) {
      expect(snapshot[field as 'fileContext']).toBe(
        source[field as 'fileContext'],
      )
      expect(classifySessionStateField(field)).toBe('shared-by-reference')
    }
  })

  it('classifies every field of a live session state', () => {
    // The compile-time gate proves completeness; this proves the RUNTIME
    // classifier agrees, which is what probes and tests consume.
    for (const field of Object.keys(makeSession())) {
      expect(classifySessionStateField(field)).not.toBe('unclassified')
    }
  })

  it('mutating a shared fileContext is visible to the snapshot (why the run boundary must refresh it)', () => {
    const source = makeSession()
    const snapshot = cloneSessionState(source)

    // Documented consequence of sharing: the snapshot is NOT insulated from
    // fileContext. That is acceptable only because run start owns the fields
    // that actually change — asserted below.
    source.fileContext.gitChanges.diff = 'mutated-after-snapshot'
    expect(snapshot.fileContext.gitChanges.diff).toBe('mutated-after-snapshot')
  })
})

describe('ProjectFileContext run boundary (FID-2026-0919-029)', () => {
  it('every run-start writer target is classified refreshed', () => {
    // Census, not a fixture: a new `fileContext.x = …` assignment in the run
    // boundary must be classified, or this fails.
    const writers = [
      join(import.meta.dir, '..', 'run-state', 'mutations.ts'),
      join(import.meta.dir, '..', 'run', 'execution', 'session-state.ts'),
    ]
    const assigned = new Set<string>()
    for (const writer of writers) {
      const source = readFileSync(writer, 'utf8')
      for (const match of source.matchAll(
        /fileContext\.([A-Za-z0-9_]+)\s*=(?!=)/g,
      )) {
        assigned.add(match[1])
      }
    }

    expect(assigned.size).toBeGreaterThan(0)
    for (const field of assigned) {
      expect(classifyFileContextField(field)).toBe('refreshed-at-run-start')
    }
    // And the classification names no writer that does not exist.
    for (const field of refreshed) {
      expect(assigned.has(field)).toBe(true)
    }
  })

  it('applyOverridesToSessionState refreshes the project-input fields and leaves carried fields alone', async () => {
    const base = plantedSession()
    const resumed = await applyOverridesToSessionState(undefined, base, {
      projectFiles: {},
      agentDefinitions: [],
      customToolDefinitions: [],
    })

    const projectInputFields = [
      'fileTree',
      'fileTokenScores',
      'tokenCallers',
      'knowledgeFiles',
      'agentTemplates',
      'customToolDefinitions',
    ] as const
    for (const field of projectInputFields) {
      expect(refreshed).toContain(field)
      // Refreshed to the override-derived value, not the planted one.
      expect(resumed.fileContext[field]).not.toBe(base.fileContext[field])
    }

    for (const field of carried) {
      expect(resumed.fileContext[field as 'gitChanges']).toEqual(
        base.fileContext[field as 'gitChanges'],
      )
    }
    // The one carried field with a real consequence, asserted by value.
    expect(resumed.fileContext.gitChanges.diff).toBe('planted-diff')
    expect(resumed.fileContext.projectRoot).toBe(base.fileContext.projectRoot)
  })

  it('resolveSessionState arms the run-option fields from options', async () => {
    const base = plantedSession()
    const previousRun: RunState = {
      output: { type: 'error', message: 'previous' },
      traceSessionId: 'trace',
      sessionState: base,
    }

    const designContract = { id: 'armed' } as unknown as DesignContract
    const session = await resolveSessionState({
      options: {
        devMode: true,
        permissionMode: 'unsafe',
        designContract,
        echoCompliance: { mode: 'off' },
        prompt: 'test prompt',
      },
      previousRun,
      fs: {} as never,
      spawn: {} as never,
    })

    for (const field of [
      'devMode',
      'permissionMode',
      'designContract',
      'designSystemContext',
    ]) {
      expect(refreshed).toContain(field)
    }
    expect(session.fileContext.devMode).toBe(true)
    expect(session.fileContext.permissionMode).toBe('unsafe')
    expect(session.fileContext.designContract).toBe(designContract)
    // The rendered prompt guidance is rebuilt from the armed contract, so it
    // must reflect the run's contract and not the planted string.
    expect(session.fileContext.designSystemContext).toContain('armed')

    // Carried fields survive a run start untouched — including the only one
    // whose staleness an operator could actually notice.
    expect(session.fileContext.gitChanges.diff).toBe('planted-diff')
    expect(session.fileContext.userKnowledgeFiles).toEqual(
      base.fileContext.userKnowledgeFiles,
    )
    expect(session.fileContext.skills).toEqual(base.fileContext.skills)
  })

  it('classifies every live file-context field', () => {
    for (const field of Object.keys(getStubProjectFileContext())) {
      expect(classifyFileContextField(field)).not.toBe('unclassified')
    }
  })
})
