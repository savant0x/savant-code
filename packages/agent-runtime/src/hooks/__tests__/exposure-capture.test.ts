import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  EXPOSURE_DIR_NAME,
  FIX_BOUNDARIES_FILE_NAME,
  resetExposureCaptureCache,
  runExposureCapture as captureExposure,
  setExposureRevisionResolver,
  toolOfClassKey,
} from '../exposure-capture'

import type { ExposureReceipt } from '../exposure-capture'
import type { HookInputData } from '../types'

const SHA_A = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const SHA_B = 'b'.repeat(40)

/** Writer controls explicitly confirm the engine's capture configuration. */
function runExposureCapture(input: HookInputData) {
  return captureExposure(input, true)
}

function fixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exposure-capture-'))
  fs.mkdirSync(path.join(root, 'dev', 'experiences'), { recursive: true })
  return root
}

function declareBoundary(
  root: string,
  classKey: string,
  commit = SHA_A,
  fixedAt = '2026-10-13T00:00:00.000Z',
): void {
  fs.writeFileSync(
    path.join(root, 'dev', 'experiences', FIX_BOUNDARIES_FILE_NAME),
    JSON.stringify({
      version: 1,
      boundaries: [{ classKey, commit, fixedAt }],
    }),
    'utf8',
  )
}

function success(
  root: string,
  toolName: string,
  sessionId = 'session-1',
): HookInputData {
  return {
    hook_event_name: 'PostToolUse',
    session_id: sessionId,
    cwd: root,
    tool_name: toolName,
  }
}

function receiptsIn(root: string): string[] {
  const directory = path.join(root, 'dev', 'experiences', EXPOSURE_DIR_NAME)
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory).map((name) => path.join(directory, name))
}

describe('FID-2026-1012-024 production exposure receipts', () => {
  test('renewed boundaries preserve earlier receipts and earn independent exposure', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    const key = 'v1:str_replace:edit-noop:undetermined'
    declareBoundary(root, key)
    setExposureRevisionResolver(() => SHA_B)
    runExposureCapture(success(root, 'str_replace'))
    const [firstFile] = receiptsIn(root)
    const original = fs.readFileSync(firstFile ?? '', 'utf8')
    for (const [commit, fixedAt] of [
      [SHA_B, '2026-10-13T00:00:00.000Z'],
      [SHA_B, '2026-10-13T01:00:00.000Z'],
    ]) {
      declareBoundary(root, key, commit, fixedAt)
      resetExposureCaptureCache()
      setExposureRevisionResolver(() => SHA_B)
      runExposureCapture(success(root, 'str_replace'))
    }
    expect(receiptsIn(root)).toHaveLength(3)
    expect(fs.readFileSync(firstFile ?? '', 'utf8')).toBe(original)
  })
  test('a direct sink call cannot assume failure capture is configured', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    declareBoundary(root, 'v1:str_replace:edit-noop:undetermined')
    setExposureRevisionResolver(() => {
      throw new Error('must not resolve without capture confirmation')
    })
    const result = captureExposure(success(root, 'str_replace'))
    expect(result.spawnError).toContain('failure capture is not configured')
    expect(receiptsIn(root)).toHaveLength(0)
  })
  test('a future boundary cannot consume the first exposure receipt', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    declareBoundary(
      root,
      'v1:str_replace:edit-noop:undetermined',
      SHA_A,
      new Date(Date.now() + 60_000).toISOString(),
    )
    setExposureRevisionResolver(() => {
      throw new Error('a future boundary must not resolve a revision')
    })
    expect(
      runExposureCapture(success(root, 'str_replace')).spawnError,
    ).toBeUndefined()
    expect(receiptsIn(root)).toHaveLength(0)
  })
  test('stamps a checkable receipt for the tool that owns a declared boundary', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    declareBoundary(root, 'v1:str_replace:edit-noop:undetermined')
    setExposureRevisionResolver(() => SHA_A)

    const result = runExposureCapture(success(root, 'str_replace'))
    expect(result.outcome).toBe('allowed')

    const files = receiptsIn(root)
    expect(files).toHaveLength(1)
    const receipt = JSON.parse(
      fs.readFileSync(files[0] ?? '', 'utf8'),
    ) as ExposureReceipt

    // The exact shape `scripts/experiences-proof.ts` validates.
    expect(receipt.kind).toBe('production-tool-exposure')
    expect(receipt.classKey).toBe('v1:str_replace:edit-noop:undetermined')
    expect(receipt.sessionId).toBe('session-1')
    expect(receipt.implementationCommit).toMatch(/^[a-f0-9]{40}$/)
    expect(receipt.implementationCommit).toBe(SHA_A)
    expect(receipt.captureVerified).toBe(true)
    expect(receipt.boundaryCommit).toBe(SHA_A)
    expect(receipt.boundaryFixedAt).toBe('2026-10-13T00:00:00.000Z')
    // `z.iso.datetime({ offset: true })` accepts the UTC form.
    expect(new Date(receipt.exercisedAt).toISOString()).toBe(
      receipt.exercisedAt,
    )
  })

  test('writes nothing for a tool that owns no declared boundary', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    declareBoundary(root, 'v1:str_replace:edit-noop:undetermined')
    setExposureRevisionResolver(() => SHA_A)

    expect(runExposureCapture(success(root, 'read_files')).outcome).toBe(
      'allowed',
    )
    expect(receiptsIn(root)).toHaveLength(0)
  })

  test('is a no-op when no boundary is declared', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    setExposureRevisionResolver(() => {
      throw new Error('the revision must not be resolved without a boundary')
    })

    expect(runExposureCapture(success(root, 'str_replace')).outcome).toBe(
      'allowed',
    )
    expect(receiptsIn(root)).toHaveLength(0)
  })

  test('is a no-op when the manifest is malformed', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    fs.writeFileSync(
      path.join(root, 'dev', 'experiences', FIX_BOUNDARIES_FILE_NAME),
      '{ not json',
      'utf8',
    )
    setExposureRevisionResolver(() => SHA_A)

    expect(runExposureCapture(success(root, 'str_replace')).outcome).toBe(
      'allowed',
    )
    expect(receiptsIn(root)).toHaveLength(0)
  })

  test('stamps exactly one receipt per class and session, never rewriting it', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    declareBoundary(root, 'v1:str_replace:edit-noop:undetermined')
    setExposureRevisionResolver(() => SHA_A)
    runExposureCapture(success(root, 'str_replace'))

    const [file] = receiptsIn(root)
    expect(file).toBeDefined()
    const first = fs.readFileSync(file ?? '', 'utf8')

    // Force re-resolution to a different revision: a rewrite would be visible.
    resetExposureCaptureCache()
    setExposureRevisionResolver(() => SHA_B)
    expect(runExposureCapture(success(root, 'str_replace')).outcome).toBe(
      'allowed',
    )

    expect(receiptsIn(root)).toHaveLength(1)
    expect(fs.readFileSync(file ?? '', 'utf8')).toBe(first)
    expect(JSON.parse(first).implementationCommit).toBe(SHA_A)
  })

  test('records a separate receipt per session', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    declareBoundary(root, 'v1:str_replace:edit-noop:undetermined')
    setExposureRevisionResolver(() => SHA_A)

    runExposureCapture(success(root, 'str_replace', 'session-1'))
    runExposureCapture(success(root, 'str_replace', 'session-2'))
    expect(receiptsIn(root)).toHaveLength(2)
  })

  test('reports an unresolvable revision instead of inventing a commit', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    declareBoundary(root, 'v1:str_replace:edit-noop:undetermined')
    setExposureRevisionResolver(() => undefined)

    const result = runExposureCapture(success(root, 'str_replace'))
    expect(result.outcome).toBe('allowed')
    expect(typeof result.spawnError).toBe('string')
    expect(receiptsIn(root)).toHaveLength(0)
  })

  test('rejects a non-hex revision rather than writing it into a receipt', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    declareBoundary(root, 'v1:str_replace:edit-noop:undetermined')
    setExposureRevisionResolver(() => 'HEAD')

    expect(runExposureCapture(success(root, 'str_replace')).outcome).toBe(
      'allowed',
    )
    expect(receiptsIn(root)).toHaveLength(0)
  })

  test('matches the tool decoded from the class key', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    // Keys encode the tool name exactly as the identity builder does.
    expect(
      toolOfClassKey('v1:read%20files:incomplete-arguments:unexpected'),
    ).toBe('read files')
    expect(toolOfClassKey('not-a-v1-key')).toBeUndefined()
    declareBoundary(root, 'v1:read%20files:incomplete-arguments:unexpected')
    setExposureRevisionResolver(() => SHA_A)

    expect(runExposureCapture(success(root, 'read files')).outcome).toBe(
      'allowed',
    )
    expect(receiptsIn(root)).toHaveLength(1)
  })

  test('never throws when the receipt path cannot be created', () => {
    resetExposureCaptureCache()
    const root = fixtureRoot()
    declareBoundary(root, 'v1:str_replace:edit-noop:undetermined')
    setExposureRevisionResolver(() => SHA_A)
    // Occupy the directory path with a file: the writer must fail open.
    fs.writeFileSync(
      path.join(root, 'dev', 'experiences', EXPOSURE_DIR_NAME),
      'not a directory',
      'utf8',
    )

    expect(runExposureCapture(success(root, 'str_replace')).outcome).toBe(
      'allowed',
    )
  })
})
