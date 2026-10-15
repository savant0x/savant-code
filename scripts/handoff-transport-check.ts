#!/usr/bin/env bun

/**
 * FID-2026-0919-027 / -028 / -029 — boundary transport check.
 *
 * A boundary is where "part of this run" becomes "an agent (or a snapshot) with
 * some fields copied onto it". This probe asks three questions, live, on real
 * code:
 *
 * 1. **AgentState → child** (FID-027/028): does a child state built by
 *    `createAgentState` carry every field classified as inherited — the run's
 *    governance configuration above all?
 * 2. **SessionState → snapshot** (FID-029): does `cloneSessionState` deep-copy
 *    exactly the fields classified deep-copied, and share exactly the rest?
 * 3. **ProjectFileContext → run start** (FID-029): is every field the run
 *    boundary writes classified as refreshed, with a live writer for each?
 *
 * Every question reads its field lists from the CLASSIFICATION AUTHORITY
 * (`spawn-child-fields.ts`, `session-boundary-fields.ts`), never from a copy: the
 * probe cannot agree with the code it checks unless it uses the same list, and
 * the compile-time gates in those modules force a decision on a new field.
 *
 * Exit 0 = every classified field crosses its boundary as declared.
 * Exit 1 = at least one does not.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  getTier,
  resolveEnforcementMode,
} from '@savant-code/agent-runtime/echo/enforcement/helpers'
import { getCurrentGroundingIdentity } from '@savant-code/agent-runtime/echo/grounding'
import {
  createOffSession,
  resolveProvenanceMode,
} from '@savant-code/agent-runtime/provenance/registry'
import { createAgentState } from '@savant-code/agent-runtime/tools/handlers/tool/spawn-agent-utils'
import {
  classifyAgentStateField,
  INHERITED_FROM_PARENT,
  NOT_INHERITED_BY_DESIGN,
} from '@savant-code/agent-runtime/tools/handlers/tool/spawn-child-fields'
import { EchoComplianceTracker } from '@savant-code/agent-runtime/util/echo-compliance'
import {
  classifyFileContextField,
  classifySessionStateField,
  FILE_CONTEXT_CARRIED_ACROSS_RUNS,
  FILE_CONTEXT_REFRESHED_AT_RUN_START,
  SESSION_DEEP_COPIED,
  SESSION_SHARED_BY_REFERENCE,
} from '@savant-code/common/types/session-boundary-fields'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'

import { cloneSessionState } from '../sdk/src/run/types'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { AgentState } from '@savant-code/common/types/session-state'

const template = {
  id: 'forge',
  displayName: 'Forge',
  includeMessageHistory: false,
} as unknown as AgentTemplate

/** The only two modules that write `fileContext.*` in non-test code. */
const WRITER_FILES = [
  'sdk/src/run-state/mutations.ts',
  'sdk/src/run/execution/session-state.ts',
]

function parentState(): AgentState {
  return {
    agentId: 'parent-1',
    agentType: 'savant',
    agentContext: {},
    ancestorRunIds: [],
    runId: 'run-parent',
    subagents: [],
    childRunIds: [],
    messageHistory: [],
    stepsRemaining: 10,
    creditsUsed: 0,
    directCreditsUsed: 0,
    systemPrompt: 'parent',
    toolDefinitions: {},
    contextTokenCount: 0,
    fsmPhase: 'green',
    iterationCount: 3,
    enforcementMode: 'strict',
    designContract: {
      id: 'probe-contract',
      version: 1,
      tokens: {},
    } as unknown as AgentState['designContract'],
    protocolVariant: 'harness',
    protocolFile: 'ECHO.md',
    protocolVersion: '0.2.0',
    protocolStrictMode: true,
    protocolSource: 'embedded',
    provenanceMode: 'off',
    maxContextLength: 400_000,
    digestCaps: { headChars: 111, tailChars: 222 },
    echoCompliance: new EchoComplianceTracker({ mode: 'warn' }),
    provenance: createOffSession(),
  }
}

const truncate = (text: string, max = 68): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`

/** 1. AgentState → child (FID-2026-0919-027 / -028). */
function checkChildTransport(missing: string[]): void {
  const parent = parentState()
  const child = createAgentState('forge', template, parent, {})
  const parentRecord = parent as unknown as Record<string, unknown>
  const childRecord = child as unknown as Record<string, unknown>

  console.log('== AgentState -> child: classified-inherited fields ==')
  for (const field of INHERITED_FROM_PARENT) {
    const to = childRecord[field]
    const status = to === undefined ? 'MISSING' : 'ok'
    if (status === 'MISSING') missing.push(field)
    console.log(
      `${status.padEnd(13)} ${field.padEnd(20)} parent=${String(parentRecord[field])} child=${typeof to === 'object' ? 'object' : String(to)}`,
    )
  }

  console.log('')
  console.log('== AgentState -> child: by-design fields must NOT be copied ==')
  for (const [field, reason] of Object.entries(NOT_INHERITED_BY_DESIGN)) {
    const leaked = childRecord[field] !== undefined
    if (leaked) missing.push(field)
    console.log(
      `${(leaked ? 'LEAKED' : 'by-design').padEnd(13)} ${field.padEnd(20)} ${truncate(reason)}`,
    )
  }

  console.log('')
  console.log('== AgentState -> child: classification coverage ==')
  const classifications = new Map<string, number>()
  for (const field of [
    ...INHERITED_FROM_PARENT,
    ...Object.keys(NOT_INHERITED_BY_DESIGN),
  ]) {
    const kind = classifyAgentStateField(field)
    classifications.set(kind, (classifications.get(kind) ?? 0) + 1)
    // An 'unclassified' answer means the probe and the classification drifted.
    if (kind === 'unclassified') missing.push(field)
  }
  for (const [kind, count] of [...classifications].sort()) {
    console.log(`${kind.padEnd(13)} ${count}`)
  }

  console.log('')
  console.log('== AgentState -> child: consequence at each reader ==')
  console.log(
    `EHEL tier          ${getTier(resolveEnforcementMode(parent.enforcementMode))} -> ${getTier(resolveEnforcementMode(child.enforcementMode))}`,
  )
  console.log(
    `ZTAP mode          ${resolveProvenanceMode(parent)} -> ${resolveProvenanceMode(child)}`,
  )
  console.log(
    `grounding identity ${getCurrentGroundingIdentity(parent)?.fingerprint.slice(0, 12)} -> ${getCurrentGroundingIdentity(child)?.fingerprint.slice(0, 12)}`,
  )
}

/** 2. SessionState → snapshot (FID-2026-0919-029). */
function checkSnapshotTransport(missing: string[]): void {
  const source = getInitialSessionState(getStubProjectFileContext())
  const message = (text: string) =>
    ({
      role: 'user',
      content: [{ type: 'text', text }],
    }) as unknown as AgentState['messageHistory'][number]
  source.mainAgentState.messageHistory = [message('probe')]

  const snapshot = cloneSessionState(source)

  console.log('')
  console.log(
    '== SessionState -> snapshot: deep-copied fields must be distinct ==',
  )
  for (const field of SESSION_DEEP_COPIED) {
    const distinct = snapshot[field] !== source[field]
    if (!distinct) missing.push(field)
    console.log(
      `${(distinct ? 'ok' : 'ALIASED').padEnd(13)} ${field.padEnd(20)} independent copy=${distinct}`,
    )
  }
  // The failure this section exists for: a snapshot that aliases live state.
  source.mainAgentState.messageHistory = [message('a'), message('b')]
  if (snapshot.mainAgentState.messageHistory.length !== 1) {
    missing.push('mainAgentState')
    console.log(
      `${'BLEED'.padEnd(13)} mainAgentState        snapshot saw a later mutation`,
    )
  }

  console.log('')
  console.log('== SessionState -> snapshot: shared fields must be identical ==')
  for (const field of Object.keys(SESSION_SHARED_BY_REFERENCE)) {
    const key = field as 'fileContext'
    const shared = snapshot[key] === source[key]
    if (!shared) missing.push(field)
    console.log(
      `${(shared ? 'ok' : 'COPIED').padEnd(13)} ${field.padEnd(20)} ${truncate(SESSION_SHARED_BY_REFERENCE[key])}`,
    )
  }

  console.log('')
  console.log('== SessionState -> snapshot: classification coverage ==')
  for (const field of Object.keys(source)) {
    const kind = classifySessionStateField(field)
    if (kind === 'unclassified') missing.push(field)
    console.log(`${kind.padEnd(18)} ${field}`)
  }
}

/** 3. ProjectFileContext → run start (FID-2026-0919-029). */
function checkRunBoundary(missing: string[]): void {
  console.log('')
  console.log('== ProjectFileContext -> run start: writer census ==')
  const assigned = new Set<string>()
  for (const writer of WRITER_FILES) {
    const text = readFileSync(join(import.meta.dir, '..', writer), 'utf8')
    for (const match of text.matchAll(
      /fileContext\.([A-Za-z0-9_]+)\s*=(?!=)/g,
    )) {
      assigned.add(match[1])
    }
  }
  // Every writer target must be classified as refreshed…
  for (const field of [...assigned].sort()) {
    const kind = classifyFileContextField(field)
    if (kind !== 'refreshed-at-run-start') missing.push(field)
    console.log(
      `${(kind === 'refreshed-at-run-start' ? 'ok' : 'UNCLASSIFIED').padEnd(13)} ${field.padEnd(22)} ${kind}`,
    )
  }
  // …and every declared-refreshed field must have a live writer.
  for (const field of FILE_CONTEXT_REFRESHED_AT_RUN_START) {
    if (!assigned.has(field)) {
      missing.push(field)
      console.log(
        `${'NO-WRITER'.padEnd(13)} ${field.padEnd(22)} declared refreshed but nothing writes it`,
      )
    }
  }

  console.log('')
  console.log('== ProjectFileContext -> run start: carried fields ==')
  for (const [field, reason] of Object.entries(
    FILE_CONTEXT_CARRIED_ACROSS_RUNS,
  )) {
    // A carried field with a run-start writer would be silently refreshed.
    const clobbered = assigned.has(field)
    if (clobbered) missing.push(field)
    console.log(
      `${(clobbered ? 'CLOBBERED' : 'carried').padEnd(13)} ${field.padEnd(22)} ${truncate(reason)}`,
    )
  }

  console.log('')
  console.log('== ProjectFileContext -> run start: classification coverage ==')
  for (const field of Object.keys(getStubProjectFileContext())) {
    const kind = classifyFileContextField(field)
    if (kind === 'unclassified') missing.push(field)
    console.log(`${kind.padEnd(22)} ${field}`)
  }
}

export function handoffTransportMain(): number {
  const missing: string[] = []

  checkChildTransport(missing)
  checkSnapshotTransport(missing)
  checkRunBoundary(missing)

  const unique = [...new Set(missing)]
  if (unique.length > 0) {
    console.log('')
    console.log(
      `handoff-transport: FAIL — ${unique.join(', ')} did not cross its boundary cleanly`,
    )
    return 1
  }
  console.log('')
  console.log(
    'handoff-transport: PASS — inherited fields cross to children, nothing by-design leaks, snapshots copy exactly the classified-deep-copied fields, and run start writes exactly the classified-refreshed ones',
  )
  return 0
}

if (import.meta.main) {
  process.exit(handoffTransportMain())
}
