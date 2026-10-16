import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { sha256Hex } from '@savant-code/common/util/hash'
import { afterEach, expect, test } from 'bun:test'

import { resetEvidenceRecordCache } from '../../../../evidence/spill-read'
import { handleRecoverEvidence } from '../recover-evidence'

let root = ''
afterEach(async () => {
  resetEvidenceRecordCache()
  if (root) await rm(root, { recursive: true, force: true })
})

async function fixture(sha?: string) {
  root = await mkdtemp(path.join(os.tmpdir(), 'recover-evidence-'))
  await mkdir(path.join(root, '.savant', 'evidence'), { recursive: true })
  const raw = 'alpha\nBeta evidence\ngamma'
  await writeFile(
    path.join(root, '.savant', 'evidence', 'parent.jsonl'),
    JSON.stringify({
      ts: 0,
      runId: 'parent',
      agentId: 'root',
      toolCallId: 'retained',
      toolName: 'code_search',
      byteSize: raw.length,
      raw,
      sha256: sha ?? sha256Hex(raw),
      redacted: true,
    }) + '\n',
  )
}

function recover(
  input: {
    toolCallId: string
    query?: string
    offset?: number
    limit?: number
  },
  projectRoot = root,
) {
  return handleRecoverEvidence({
    previousToolCallFinished: Promise.resolve(),
    toolCall: { toolName: 'recover_evidence', toolCallId: 'recovery', input },
    fileContext: { projectRoot },
    agentState: { runId: 'child', ancestorRunIds: ['parent'] },
  })
}

test('recovers ancestor evidence, verifies hash and paginates bounded text', async () => {
  await fixture()
  const { output } = await recover({
    toolCallId: 'retained',
    offset: 6,
    limit: 4,
  })
  expect(output[0].value).toEqual({
    found: true,
    toolCallId: 'retained',
    toolName: 'code_search',
    sha256Verified: true,
    redacted: true,
    totalChars: 25,
    offset: 6,
    returnedChars: 4,
    content: 'Beta',
  })
})

test('filters literal queries with original line numbers before pagination', async () => {
  await fixture()
  const { output } = await recover({ toolCallId: 'retained', query: 'BETA' })
  expect(output[0].value.content).toBe('2: Beta evidence')
})

test('refuses missing records and missing project roots', async () => {
  await fixture()
  expect((await recover({ toolCallId: 'absent' })).output[0].value.reason).toBe(
    'not-in-store',
  )
  expect(
    (await recover({ toolCallId: 'retained' }, '')).output[0].value.reason,
  ).toBe('no-project-root')
})

test('never returns tampered bytes', async () => {
  await fixture('invalid')
  const { output } = await recover({ toolCallId: 'retained' })
  expect(output[0].value).toEqual({
    found: false,
    toolCallId: 'retained',
    reason: 'sha256-mismatch',
  })
})
