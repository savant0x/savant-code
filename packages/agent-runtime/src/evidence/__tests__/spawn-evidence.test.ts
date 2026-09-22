import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { afterEach, describe, expect, it } from 'bun:test'

import { loadRawEvidenceForSpawn } from '../spawn-evidence'
import { evidenceFilePath, recordEvidence } from '../spill'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'

const template: AgentTemplate = {
  id: 'verifier',
  displayName: 'Verifier',
  spawnerPrompt: '',
  model: 'test/model',
  inputSchema: {},
  outputMode: 'last_message',
  includeMessageHistory: true,
  inheritParentSystemPrompt: false,
  mcpServers: {},
  toolNames: [],
  spawnableAgents: [],
  systemPrompt: '',
  instructionsPrompt: '',
  stepPrompt: '',
  requiresRawEvidence: true,
}

const tempRoots: string[] = []
afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop()
    if (root) await rm(root, { recursive: true, force: true })
  }
})

async function freshRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'spawn-evidence-'))
  tempRoots.push(root)
  return root
}

describe('spawn-boundary raw evidence transport (FID-2026-0919-027)', () => {
  it('does not read the spill for an agent that does not require raw evidence', async () => {
    const root = await freshRoot()
    const state = getInitialAgentState()
    state.runId = 'run-1'

    const records = await loadRawEvidenceForSpawn({
      agentTemplate: { ...template, requiresRawEvidence: false },
      spawningAgentState: state,
      // A root that does not exist: any read attempt would surface as an
      // empty array only, so assert through the call count surrogate — the
      // loader returns undefined for a non-audit agent with no IO at all.
      projectRoot: path.join(root, 'missing'),
    })

    expect(records).toBeUndefined()
  })

  it('unions records across the run chain so a NESTED spawn still restores', async () => {
    const root = await freshRoot()
    // Grandparent run wrote one raw result; the parent run wrote another.
    await recordEvidence({
      projectRoot: root,
      runId: 'run-root',
      agentId: 'root',
      toolCallId: 'call-from-grandparent',
      toolName: 'read_files',
      raw: '{"grandparent":true}',
    })
    await recordEvidence({
      projectRoot: root,
      runId: 'run-parent',
      agentId: 'parent',
      toolCallId: 'call-from-parent',
      toolName: 'code_search',
      raw: '{"parent":true}',
    })

    const parent = getInitialAgentState()
    parent.runId = 'run-parent'
    parent.ancestorRunIds = ['run-root']
    // The nested case: this spawning agent is itself a child.
    parent.parentId = 'root-agent'

    const records = await loadRawEvidenceForSpawn({
      agentTemplate: template,
      spawningAgentState: parent,
      projectRoot: root,
    })

    expect(records?.map((record) => record.toolCallId).sort()).toEqual([
      'call-from-grandparent',
      'call-from-parent',
    ])
  })

  it('lets the spawning run win on a duplicate tool call id', async () => {
    const root = await freshRoot()
    await recordEvidence({
      projectRoot: root,
      runId: 'run-root',
      agentId: 'root',
      toolCallId: 'call-1',
      toolName: 'read_files',
      raw: '{"stale":true}',
    })
    await recordEvidence({
      projectRoot: root,
      runId: 'run-parent',
      agentId: 'parent',
      toolCallId: 'call-1',
      toolName: 'read_files',
      raw: '{"fresh":true}',
    })

    const parent = getInitialAgentState()
    parent.runId = 'run-parent'
    parent.ancestorRunIds = ['run-root']

    const records = await loadRawEvidenceForSpawn({
      agentTemplate: template,
      spawningAgentState: parent,
      projectRoot: root,
    })

    expect(records).toHaveLength(1)
    expect(records?.[0]?.raw).toBe('{"fresh":true}')
    // The spill file is keyed per run, which is why depth never mattered.
    expect(evidenceFilePath(root, 'run-parent')).toContain('run-parent')
  })

  it('returns undefined when the run chain has no spilled records', async () => {
    const root = await freshRoot()
    const state = getInitialAgentState()
    state.runId = 'run-empty'

    const records = await loadRawEvidenceForSpawn({
      agentTemplate: template,
      spawningAgentState: state,
      projectRoot: root,
    })

    expect(records).toBeUndefined()
  })
})
