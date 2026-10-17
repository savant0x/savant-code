import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { z } from 'zod/v4'

import { runSchedule } from './parallel-agent-slice/scheduler'
import { createSdkBatch, historyDigest } from './parallel-agent-slice/sdk'
import { SliceStore } from './parallel-agent-slice/store'
import { installRequestGuard } from './parallel-agent-slice/transport'
import { handoffOf } from './parallel-agent-slice/types'
import {
  ASSIGNMENTS,
  captureSources,
  sourceDigest,
  validateEvidence,
} from './parallel-agent-slice/workload'

import type { JSONValue } from '@savant-code/common/types/json'

const MAX_REQUESTS = 60
const MAX_RUN_MS = 20 * 60 * 1000
const root = path.resolve(import.meta.dir, '..', '..')
const research = path.join(root, 'dev', 'research')
const ledger = path.join(research, 'FID-2026-1017-001-request-ledger.jsonl')

async function main(): Promise<void> {
  if (!process.argv.includes('--live')) {
    console.log(
      'Explicit opt-in: bun scripts/probes/parallel-agent-slice.ts --live',
    )
    return
  }
  if (!process.env.APIXOAI_API_KEY?.trim())
    throw new Error('Apixo credential unavailable')
  mkdirSync(research, { recursive: true })
  const previous = existsSync(ledger)
    ? readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean)
    : []
  for (const line of previous)
    z.object({
      index: z.number().int().positive(),
      startedAt: z.number(),
    }).parse(JSON.parse(line))
  if (previous.length >= MAX_REQUESTS)
    throw new Error('Experiment cumulative request budget exhausted')
  const catalog = await fetch('https://api.apixoai.online/v1/models', {
    signal: AbortSignal.timeout(15000),
  })
  if (!catalog.ok) throw new Error(`Catalog HTTP ${catalog.status}`)
  const models = z
    .object({
      data: z.array(
        z.object({
          id: z.string(),
          context_window: z.number().positive().optional(),
        }),
      ),
    })
    .parse(await catalog.json())
  const model = models.data.find((entry) => entry.id === 'gpt-6.1-sol')
  if (!model) throw new Error('Selected model is not advertised')
  const contextWindow = model.context_window
  if (!contextWindow)
    throw new Error('Catalog omitted the selected context window')
  const directory = mkdtempSync(path.join(research, 'parallel-agent-slice-'))
  const sources = captureSources(root, ASSIGNMENTS)
  const fingerprint = sourceDigest(sources)
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new Error('Experiment wall-clock ceiling reached')),
    MAX_RUN_MS,
  )
  const guard = installRequestGuard({
    maxRequests: MAX_REQUESTS - previous.length,
    concurrency: 2,
    signal: controller.signal,
    onDispatch: (record) =>
      appendFileSync(
        ledger,
        JSON.stringify({ ...record, index: previous.length + record.index }) +
          '\n',
      ),
  })
  const report: {
    provider: string
    model: string
    sourceDigest: string
    limits: JSONValue
    modes: JSONValue[]
    error?: string
  } = {
    provider: 'apixo',
    model: 'gpt-6.1-sol',
    sourceDigest: fingerprint,
    limits: {
      cumulativeRequests: MAX_REQUESTS,
      concurrency: 2,
      maxRunMs: MAX_RUN_MS,
      outputTokens: 4000,
    },
    modes: [],
  }
  try {
    for (const mode of ['batch', 'completion'] as const) {
      const histories: JSONValue[] = []
      const store = new SliceStore(
        path.join(directory, `${mode}.sqlite`),
        fingerprint,
      )
      const startedAt = Date.now()
      const requestStart = guard.records.length
      try {
        console.log(
          `Starting ${mode}; ${MAX_REQUESTS - previous.length - guard.records.length} inference requests remain`,
        )
        const results = await runSchedule({
          mode,
          assignments: ASSIGNMENTS,
          store,
          runBatch: createSdkBatch(root, sources, histories, contextWindow),
          signal: controller.signal,
        })
        const evidence = results.map((result) => ({
          taskId: result.assignment.id,
          failures: validateEvidence(
            result.artifact,
            result.assignment,
            result.assignment.dependsOn.map((id) => {
              const predecessor = results.find(
                (entry) => entry.assignment.id === id,
              )
              if (!predecessor) throw new Error('Missing report predecessor')
              return handoffOf(predecessor.artifact)
            }),
            sources,
            result.readPaths,
          ),
        }))
        report.modes.push({
          mode,
          elapsedMs: Date.now() - startedAt,
          requestCount: guard.records.length - requestStart,
          results: JSON.parse(JSON.stringify(results)),
          evidence,
          historyDigest: historyDigest(histories),
          canonicalOwner: { ...store.owner() },
        })
        console.log(
          `${mode} completed; citation/handoff failures: ${evidence.reduce((sum, task) => sum + task.failures.length, 0)}`,
        )
        if (evidence.some((task) => task.failures.length > 0))
          process.exitCode = 1
      } finally {
        writeFileSync(
          path.join(directory, `${mode}-histories.json`),
          JSON.stringify(histories, null, 2),
        )
        store.close()
      }
      if (sourceDigest(captureSources(root, ASSIGNMENTS)) !== fingerprint)
        throw new Error('Repository source changed during comparison')
    }
  } catch (error) {
    report.error =
      error instanceof Error ? error.message : 'Unknown experiment failure'
    controller.abort(new Error('Experiment stopped after failure'))
    process.exitCode = 1
  } finally {
    clearTimeout(timer)
    guard.restore()
    writeFileSync(
      path.join(directory, 'report.json'),
      JSON.stringify({ ...report, requests: guard.records }, null, 2),
    )
    console.log(`Evidence: ${path.join(directory, 'report.json')}`)
  }
}

if (import.meta.main) await main()
