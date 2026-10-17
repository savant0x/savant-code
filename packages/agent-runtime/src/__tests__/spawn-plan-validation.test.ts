import { spawnAgentsParams } from '@savant-code/common/tools/params/tool/spawn-agents'
import { describe, expect, it } from 'bun:test'

import {
  RESEARCH_PLAN_ROLES,
  normalizePlanPath,
  snapshotDigest,
  sourceContentDigest,
  validateSpawnPlan,
} from '../tools/handlers/tool/spawn-plan'

import type {
  SpawnPlanAgentInput,
  SpawnPlanInput,
} from '../tools/handlers/tool/spawn-plan'

const CONTENTS: Record<string, string> = {
  'src/a.ts': 'export const a = 1\n',
  'src/b.ts': 'export const b = 2\n',
}

function fixturePlan(): SpawnPlanInput {
  const sources = [
    { path: 'src/a.ts', sha256: sourceContentDigest(CONTENTS['src/a.ts']!) },
    { path: 'src/b.ts', sha256: sourceContentDigest(CONTENTS['src/b.ts']!) },
  ]
  return {
    objective: 'Answer the coupled question',
    cancellation_id: 'turn-1',
    snapshot_sha256: snapshotDigest(sources),
    max_output_tokens: 4000,
    sources,
  }
}

function fixtureAgents(): SpawnPlanAgentInput[] {
  return [
    {
      agent_type: 'scout',
      id: 'draft',
      prompt: 'Investigate',
      sources: ['src/a.ts'],
      depends_on: [],
    },
    {
      agent_type: 'detective',
      id: 'review',
      prompt: 'Review',
      sources: ['src/a.ts'],
      depends_on: ['draft'],
    },
  ]
}

async function validate(params?: {
  plan?: SpawnPlanInput
  agents?: SpawnPlanAgentInput[]
  projectRoot?: string | undefined
  maxOutputTokens?: number
  contents?: Record<string, string>
}) {
  const contents = params?.contents ?? CONTENTS
  return validateSpawnPlan({
    plan: params?.plan ?? fixturePlan(),
    agents: params?.agents ?? fixtureAgents(),
    deps: {
      projectRoot:
        'projectRoot' in (params ?? {}) ? params?.projectRoot : '/repo',
      userInputId: 'turn-1',
      maxOutputTokens: params?.maxOutputTokens ?? 4000,
      maxFanOut: 32,
      readSource: async (sourcePath: string) => {
        const content = contents[sourcePath]
        if (content === undefined) throw new Error('missing')
        return content
      },
    },
  })
}

describe('research plan validation (FID-2026-1017-004)', () => {
  it('accepts a two-step plan and stages the dependent after its predecessor', async () => {
    const result = await validate()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.steps.map((step) => step.id)).toEqual(['draft', 'review'])
    expect(result.steps[1]?.dependsOn).toEqual(['draft'])
    expect(result.stages.map((stage) => stage.map((step) => step.id))).toEqual([
      ['draft'],
      ['review'],
    ])
    expect([...result.sources.keys()].sort()).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('treats CRLF and LF source bytes as the same identity', async () => {
    const sources = [
      {
        path: 'src/a.ts',
        sha256: sourceContentDigest('line one\r\nline two\n'),
      },
    ]
    const result = await validate({
      plan: {
        ...fixturePlan(),
        sources,
        snapshot_sha256: snapshotDigest(sources),
      },
      agents: [
        {
          agent_type: 'scout',
          id: 'draft',
          sources: ['src/a.ts'],
          depends_on: [],
        },
      ],
      contents: { 'src/a.ts': 'line one\nline two\n' },
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a stale cancellation identity', async () => {
    const result = await validate({
      plan: { ...fixturePlan(), cancellation_id: 'turn-0' },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.join(' ')).toContain('stale plan is rejected')
  })

  it('rejects a source hash mismatch', async () => {
    const result = await validate({
      contents: { ...CONTENTS, 'src/a.ts': 'tampered\n' },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContain('Source hash mismatch: src/a.ts')
  })

  it('rejects a snapshot that does not cover the declared sources', async () => {
    const result = await validate({
      plan: { ...fixturePlan(), snapshot_sha256: '0'.repeat(64) },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.join(' ')).toContain('snapshot_sha256')
  })

  it('rejects absolute paths and traversal', async () => {
    const sources = [{ path: '../secret.ts', sha256: '0'.repeat(64) }]
    const result = await validate({
      plan: {
        ...fixturePlan(),
        sources,
        snapshot_sha256: snapshotDigest(sources),
      },
      agents: [
        { agent_type: 'scout', id: 'draft', sources: [], depends_on: [] },
      ],
      contents: {},
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.join(' ')).toContain('Unsafe plan source path')
    expect(normalizePlanPath('/etc/passwd')).toBeNull()
    expect(normalizePlanPath('C:/windows/hosts')).toBeNull()
    expect(normalizePlanPath('src\\a.ts')).toBe('src/a.ts')
  })

  it('rejects a step that reads an undeclared source', async () => {
    const agents = fixtureAgents()
    agents[0] = { ...agents[0]!, sources: ['src/b.ts', 'src/c.ts'] }
    const result = await validate({ agents })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.join(' ')).toContain('undeclared source: src/c.ts')
  })

  it('rejects implementation, audit and effectful roles', async () => {
    expect(RESEARCH_PLAN_ROLES.has('forge')).toBe(false)
    for (const agentType of ['forge', 'verifier', 'adversary', 'basher']) {
      const result = await validate({
        agents: [
          { agent_type: agentType, id: 'step', sources: [], depends_on: [] },
        ],
      })
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.issues.join(' ')).toContain('not a read-only research role')
    }
  })

  it('rejects any write scope', async () => {
    const result = await validate({
      agents: [
        {
          agent_type: 'scout',
          id: 'step',
          sources: [],
          depends_on: [],
          writeScope: ['src/**'],
        },
      ],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.join(' ')).toContain('plan steps are read-only')
  })

  it('rejects unknown, forward and duplicate step identities', async () => {
    const forward = await validate({
      agents: [
        {
          agent_type: 'scout',
          id: 'draft',
          sources: [],
          depends_on: ['review'],
        },
        {
          agent_type: 'detective',
          id: 'review',
          sources: [],
          depends_on: [],
        },
      ],
    })
    expect(forward.ok).toBe(false)
    if (!forward.ok) {
      expect(forward.issues.join(' ')).toContain('not an earlier declared step')
    }

    const duplicate = await validate({
      agents: [
        { agent_type: 'scout', id: 'same', sources: [], depends_on: [] },
        { agent_type: 'scout', id: 'same', sources: [], depends_on: [] },
      ],
    })
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) {
      expect(duplicate.issues.join(' ')).toContain('Duplicate plan step id')
    }
  })

  it('rejects an output ceiling above the run budget and a missing project root', async () => {
    const overBudget = await validate({ maxOutputTokens: 1000 })
    expect(overBudget.ok).toBe(false)
    if (!overBudget.ok) {
      expect(overBudget.issues.join(' ')).toContain('exceeds the run')
    }

    const noRoot = await validate({ projectRoot: undefined })
    expect(noRoot.ok).toBe(false)
    if (!noRoot.ok) {
      expect(noRoot.issues.join(' ')).toContain('requires a project root')
    }
  })

  it('rejects an undeclared plan field at the schema boundary', () => {
    const parsed = spawnAgentsParams.inputSchema.safeParse({
      agents: [
        {
          agent_type: 'scout',
          id: 'draft',
          sources: [],
          depends_on: [],
        },
      ],
      plan: { ...fixturePlan(), tools: ['write_file'] },
    })
    expect(parsed.success).toBe(false)
  })
})
