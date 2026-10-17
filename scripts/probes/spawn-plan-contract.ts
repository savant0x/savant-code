/**
 * FID-2026-1017-004 — deterministic research-plan probe.
 *
 * No model, no network, no clock-dependent behavior: it captures two real
 * files, validates a plan against their bytes, then tampers one and requires
 * the policy to reject it. Exit 0 only when both behaviors hold.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  createProjectSourceReader,
  snapshotDigest,
  sourceContentDigest,
  validateSpawnPlan,
} from '@savant-code/agent-runtime/tools/handlers/tool/spawn-plan'

import type {
  SpawnPlanAgentInput,
  SpawnPlanInput,
} from '@savant-code/agent-runtime/tools/handlers/tool/spawn-plan'

const FILES: Record<string, string> = {
  'src/alpha.ts': 'export const alpha = 1\n',
  'src/beta.ts': 'export const beta = 2\n',
}

function planFor(sources: SpawnPlanInput['sources']): SpawnPlanInput {
  return {
    objective: 'Probe the bounded research contract',
    cancellation_id: 'probe-turn',
    snapshot_sha256: snapshotDigest(sources),
    max_output_tokens: 4000,
    sources,
  }
}

const agents: SpawnPlanAgentInput[] = [
  {
    agent_type: 'scout',
    id: 'draft',
    prompt: 'Read the captured sources',
    sources: ['src/alpha.ts', 'src/beta.ts'],
    depends_on: [],
  },
  {
    agent_type: 'detective',
    id: 'review',
    prompt: 'Review the draft',
    sources: ['src/alpha.ts'],
    depends_on: ['draft'],
  },
]

function fail(message: string): never {
  throw new Error(message)
}

async function main(): Promise<void> {
  const root = mkdtempSync(path.join(tmpdir(), 'spawn-plan-probe-'))
  try {
    mkdirSync(path.join(root, 'src'), { recursive: true })
    for (const [file, content] of Object.entries(FILES)) {
      writeFileSync(path.join(root, file), content)
    }
    const sources = Object.entries(FILES).map(([file, content]) => ({
      path: file,
      sha256: sourceContentDigest(content),
    }))
    const plan = planFor(sources)
    const readSource = createProjectSourceReader(root)
    const deps = {
      projectRoot: root,
      userInputId: 'probe-turn',
      maxOutputTokens: 4000,
      maxFanOut: 32,
      readSource,
    }

    const accepted = await validateSpawnPlan({ plan, agents, deps })
    if (!accepted.ok) {
      fail(`valid plan was rejected: ${accepted.issues.join('; ')}`)
    }
    if (accepted.stages.length !== 2) {
      fail(`expected two dependency stages, received ${accepted.stages.length}`)
    }
    for (const source of sources) {
      if (!accepted.sources.has(source.path)) {
        fail(`source bytes were not captured: ${source.path}`)
      }
    }

    let traversalRejected = false
    try {
      await readSource('../escape.ts')
    } catch {
      traversalRejected = true
    }
    if (!traversalRejected) fail('traversal path was not rejected')

    writeFileSync(path.join(root, 'src/beta.ts'), 'export const beta = 999\n')
    const tampered = await validateSpawnPlan({ plan, agents, deps })
    if (tampered.ok) fail('tampered source was accepted')
    const issues = tampered.issues.join('; ')
    if (!issues.includes('Source hash mismatch: src/beta.ts')) {
      fail(`tampered source produced the wrong issue: ${issues}`)
    }

    console.log(
      'PASS — plan accepted its captured bytes; tamper, traversal and snapshot identity held',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error(`FAIL — ${error.message}`)
    process.exitCode = 1
  })
}
