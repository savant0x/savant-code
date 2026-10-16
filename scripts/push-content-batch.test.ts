import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, expect, test } from 'bun:test'

import { commitChangedFiles, runPrePushSecretScan } from './pre-push-scan'
import {
  chunkPushedBlobs,
  MAX_BATCH_BYTES,
  parsePushedBlobBatch,
  parsePushedTree,
  readPushedBlobBatches,
  SCAN_SIZE_CAP_BYTES,
} from './push-content-batch'
import {
  materializePushedContent,
  pushedMirrorTarget,
} from './push-content-mirror'

import type { PushedTreeEntry } from './push-content-batch'

const roots: string[] = []
const SHA = 'a'.repeat(40)
const FAKE_TOKEN = ['ghp', '_', 'K8sT2vX9mQ4rA7cD1fH5jL0nP3wZ6yB8eG2uR'].join(
  '',
)

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function git(root: string, args: string[], input?: string): string {
  const result = spawnSync('git', args, {
    cwd: root,
    input,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
  })
  if (result.status !== 0) throw new Error(String(result.stderr))
  return result.stdout.trim()
}

function repo(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'push-batch-test-'))
  roots.push(root)
  git(root, ['init', '-q'])
  git(root, ['config', 'user.name', 'Push Test'])
  git(root, ['config', 'user.email', 'push@test.invalid'])
  git(root, ['config', 'core.autocrlf', 'false'])
  return root
}

function commit(root: string): string {
  git(root, ['add', '-A'])
  git(root, ['commit', '-qm', 'fixture', '--allow-empty'])
  return git(root, ['rev-parse', 'HEAD'])
}

function entry(size = 3, file = 'bytes.bin'): PushedTreeEntry {
  return { file, type: 'blob', sha: SHA, size }
}

function response(data = Buffer.from([0, 255, 10])): Buffer {
  return Buffer.concat([
    Buffer.from(`${SHA} blob ${data.length}\n`),
    data,
    Buffer.from('\n'),
  ])
}

test('strict tree framing retains exact whitespace, UTF-8 and newline paths', () => {
  const file = ' café\tline\nnext.txt'
  const raw = Buffer.from(`100644 blob ${SHA}       3\t${file}\0`)
  expect(parsePushedTree(raw).get(file)).toEqual(entry(3, file))
  expect(parsePushedTree(Buffer.alloc(0)).size).toBe(0)
  for (const malformed of [
    raw.subarray(0, -1),
    Buffer.from('broken\0'),
    Buffer.concat([raw, raw]),
    Buffer.from(`100644 blob ${SHA} -\tx\0`),
    Buffer.from(`100644 blob ${SHA} 9007199254740992\tx\0`),
    Buffer.concat([
      Buffer.from(`100644 blob ${SHA} 1\t`),
      Buffer.from([255, 0]),
    ]),
  ])
    expect(() => parsePushedTree(malformed)).toThrow()
})

test('binary batch parser refuses wrong count, identity, type, size, trailer and truncation', () => {
  const good = response()
  expect(parsePushedBlobBatch(good, [entry()])[0]).toEqual(
    Buffer.from([0, 255, 10]),
  )
  for (const malformed of [
    good.subarray(0, -1),
    Buffer.concat([good, good]),
    Buffer.from(good.toString('latin1').replace(SHA, 'b'.repeat(40)), 'latin1'),
    Buffer.from(good.toString('latin1').replace('blob', 'tree'), 'latin1'),
    Buffer.from(good.toString('latin1').replace('blob 3', 'blob 4'), 'latin1'),
    Buffer.concat([good.subarray(0, -1), Buffer.from('!')]),
  ])
    expect(() => parsePushedBlobBatch(malformed, [entry()])).toThrow()
  expect(() => parsePushedBlobBatch(good, [])).toThrow()
  expect(() => parsePushedBlobBatch(good, [entry(), entry()])).toThrow()
  expect(() => chunkPushedBlobs([entry(SCAN_SIZE_CAP_BYTES + 1)])).toThrow()
  expect(() =>
    chunkPushedBlobs([{ ...entry(), sha: 'HEAD:x\nHEAD:y' }]),
  ).toThrow()
})

test('batch chunks include framing in the 8 MiB bound', () => {
  const chunks = chunkPushedBlobs(
    Array.from({ length: 8 }, () => entry(SCAN_SIZE_CAP_BYTES)),
  )
  expect(chunks.map((chunk) => chunk.length)).toEqual([3, 3, 2])
  for (const chunk of chunks) {
    const total = chunk.reduce(
      (n, item) =>
        n +
        Buffer.byteLength(`${item.sha} blob ${item.size}\n`) +
        (item.size ?? 0) +
        1,
      0,
    )
    expect(total).toBeLessThanOrEqual(MAX_BATCH_BYTES)
  }
})

test('mirror paths reject escape and platform aliases while accepting double-dot prefixes', () => {
  const root = path.resolve(os.tmpdir(), 'mirror')
  expect(pushedMirrorTarget(root, '..notes.txt')).toBe(
    path.join(root, '..notes.txt'),
  )
  for (const unsafe of [
    '../escape',
    '/absolute',
    'C:/absolute',
    'a/../b',
    'a\\b',
  ])
    expect(() => pushedMirrorTarget(root, unsafe)).toThrow()
  if (process.platform === 'win32')
    for (const unsafe of ['file.', 'file ', 'file:ads', 'NUL.txt', 'a/COM1'])
      expect(() => pushedMirrorTarget(root, unsafe)).toThrow()
})

test('real Git preserves binary/empty bytes and exact UTF-8/space paths at each revision', () => {
  const root = repo()
  const file = ' café file.txt'
  const bytes = Buffer.from([0, 255, 254, 10, 0, 128])
  writeFileSync(path.join(root, file), bytes)
  writeFileSync(path.join(root, 'empty.txt'), '')
  const before = commit(root)
  writeFileSync(path.join(root, file), 'changed without final newline')
  const after = commit(root)
  expect(commitChangedFiles(root, after)).toEqual([file])
  for (const [sha, expected] of [
    [before, bytes],
    [after, Buffer.from('changed without final newline')],
  ] as const) {
    const mirror = materializePushedContent(root, sha, [file, 'empty.txt'])
    roots.push(mirror.mirror)
    expect(readFileSync(path.join(mirror.mirror, file))).toEqual(expected)
    expect(readFileSync(path.join(mirror.mirror, 'empty.txt')).length).toBe(0)
  }
  rmSync(path.join(root, file))
  const deleted = commit(root)
  const mirror = materializePushedContent(
    root,
    deleted,
    commitChangedFiles(root, deleted),
  )
  roots.push(mirror.mirror)
  expect(mirror.materialized).toEqual([])
  expect(() => materializePushedContent(root, 'f'.repeat(40), [file])).toThrow()
}, 30_000)

test('real Git reads multiple bounded chunks including exact-cap blobs without decoding', () => {
  const root = repo()
  for (let index = 0; index < 5; index++)
    writeFileSync(
      path.join(root, `blob${index}.bin`),
      Buffer.alloc(SCAN_SIZE_CAP_BYTES, index),
    )
  const sha = commit(root)
  const files = Array.from({ length: 5 }, (_, index) => `blob${index}.bin`)
  const mirror = materializePushedContent(root, sha, files)
  roots.push(mirror.mirror)
  expect(mirror.oversized).toBe(0)
  expect(mirror.materialized).toEqual(files)
  for (let index = 0; index < 5; index++)
    expect(readFileSync(path.join(mirror.mirror, `blob${index}.bin`))).toEqual(
      Buffer.alloc(SCAN_SIZE_CAP_BYTES, index),
    )
}, 30_000)

test('real Git case aliases cannot overwrite an earlier mirror payload', () => {
  const root = repo()
  git(root, ['config', 'core.ignorecase', 'false'])
  const blob = git(root, ['hash-object', '-w', '--stdin'], 'bytes')
  for (const file of ['Case.txt', 'case.txt'])
    git(root, [
      'update-index',
      '--add',
      '--cacheinfo',
      `100644,${blob},${file}`,
    ])
  git(root, ['commit', '-qm', 'case fixture'])
  const sha = git(root, ['rev-parse', 'HEAD'])
  if (process.platform === 'win32')
    expect(() =>
      materializePushedContent(root, sha, ['Case.txt', 'case.txt']),
    ).toThrow('colliding pushed paths')
  else {
    // The filesystem is the final authority even on case-insensitive macOS.
    try {
      const mirror = materializePushedContent(root, sha, [
        'Case.txt',
        'case.txt',
      ])
      roots.push(mirror.mirror)
      expect(mirror.materialized).toEqual(['Case.txt', 'case.txt'])
    } catch (error) {
      expect((error as NodeJS.ErrnoException).code).toBe('EEXIST')
    }
  }
}, 30_000)

test('real Git missing objects and gitlinks fail closed; empty commits are valid', () => {
  const root = repo()
  const empty = commit(root)
  const mirror = materializePushedContent(root, empty, ['absent.txt'])
  roots.push(mirror.mirror)
  expect(mirror.materialized).toEqual([])
  git(root, [
    'update-index',
    '--add',
    '--cacheinfo',
    `160000,${empty},submodule`,
  ])
  git(root, ['commit', '-qm', 'gitlink'])
  const sha = git(root, ['rev-parse', 'HEAD'])
  expect(() => materializePushedContent(root, sha, ['submodule'])).toThrow(
    'object type',
  )
  expect(() =>
    readPushedBlobBatches(
      root,
      [{ ...entry(), sha: 'f'.repeat(40) }],
      () => {},
    ),
  ).toThrow()
}, 30_000)

test('real Git merge resolution content is scanned against both parents', () => {
  const root = repo()
  writeFileSync(path.join(root, 'base.txt'), 'base')
  const base = commit(root)
  const branch = git(root, ['branch', '--show-current'])
  git(root, ['checkout', '-qb', 'side'])
  writeFileSync(path.join(root, 'side.txt'), 'side')
  commit(root)
  git(root, ['checkout', '-q', branch])
  writeFileSync(path.join(root, 'main.txt'), 'main')
  commit(root)
  git(root, ['merge', '--no-commit', '--no-ff', 'side'])
  writeFileSync(path.join(root, 'merge only café.txt'), FAKE_TOKEN)
  const head = commit(root)
  expect(commitChangedFiles(root, head)).toContain('merge only café.txt')
  const result = runPrePushSecretScan(
    root,
    `refs/heads/main ${head} refs/heads/main ${base}\n`,
  )
  expect(
    result.flagged.some((line) => line.includes('merge only café.txt')),
  ).toBe(true)
}, 30_000)
