import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, expect, test } from 'bun:test'

import { HookEngine, buildHookInput } from '../engine'
import {
  resetExposureCaptureCache,
  setExposureRevisionResolver,
} from '../exposure-capture'

import type { HookConfig } from '@savant-code/common/types/hooks'

const roots: string[] = []
afterEach(() => {
  resetExposureCaptureCache()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true })
})

function fixture() {
  resetExposureCaptureCache()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exposure-engine-'))
  roots.push(root)
  const store = path.join(root, 'dev', 'experiences')
  fs.mkdirSync(store, { recursive: true })
  fs.writeFileSync(
    path.join(store, 'fix-boundaries.json'),
    JSON.stringify({
      boundaries: [
        {
          classKey: 'v1:str_replace:edit-noop:undetermined',
          commit: 'a'.repeat(40),
          fixedAt: '2026-10-13T00:00:00.000Z',
        },
      ],
    }),
  )
  setExposureRevisionResolver(() => 'a'.repeat(40))
  return {
    root,
    receipts: () => {
      const directory = path.join(store, 'exposure')
      return fs.existsSync(directory) ? fs.readdirSync(directory) : []
    },
  }
}

test('success exposure requires failure capture configured for the same tool', async () => {
  const capture: HookConfig = {
    event: 'PostToolUseFailure',
    action: 'experience-capture',
  }
  for (const config of [
    undefined,
    { ...capture, matcher: '^read_files$' },
    { ...capture, matcher: '(' },
    { ...capture, matcher: '^str_replace$' },
  ]) {
    const { root, receipts } = fixture()
    const engine = new HookEngine([
      { event: 'PostToolUse', action: 'exposure-capture' },
      ...(config ? [config] : []),
    ])
    const result = await engine.triggerBlock(
      buildHookInput({
        event: 'PostToolUse',
        sessionId: 'fixture',
        cwd: root,
        toolName: 'str_replace',
      }),
    )
    expect(result.blocked).toBe(false)
    expect(receipts()).toHaveLength(config?.matcher === '^str_replace$' ? 1 : 0)
  }
})

test('distinct builtins survive dedupe and a failure event produces no exposure', async () => {
  const { root, receipts } = fixture()
  const engine = new HookEngine([
    { event: 'PostToolUseFailure', action: 'exposure-capture' },
    { event: 'PostToolUseFailure', action: 'experience-capture' },
    { event: 'PostToolUseFailure', action: 'experience-capture' },
  ])
  const result = await engine.triggerBlock(
    buildHookInput({
      event: 'PostToolUseFailure',
      sessionId: 'fixture',
      cwd: root,
      toolName: 'str_replace',
      errorMessage: 'No change to the file',
    }),
  )
  expect(result.runs).toHaveLength(2)
  expect(receipts()).toHaveLength(0)
  const rows = fs.readFileSync(
    path.join(root, 'dev', 'experiences', 'raw-traces.jsonl'),
    'utf8',
  )
  expect(rows.trim().split('\n')).toHaveLength(1)
})
