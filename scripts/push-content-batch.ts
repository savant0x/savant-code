import { spawnSync } from 'node:child_process'

export const SCAN_SIZE_CAP_BYTES = 2 * 1024 * 1024
export const MAX_BATCH_BYTES = 8 * 1024 * 1024
const TREE_BUFFER_BYTES = 64 * 1024 * 1024
const STDERR_ALLOWANCE_BYTES = 1024

export interface PushedTreeEntry {
  file: string
  type: string
  sha: string
  size: number | undefined
}

function gitBuffer(
  root: string,
  args: string[],
  maxBuffer: number,
  input?: string,
): Buffer {
  const result = spawnSync('git', args, {
    cwd: root,
    input,
    stdio: 'pipe',
    windowsHide: true,
    shell: false,
    maxBuffer,
  })
  if (result.status !== 0 || result.error) {
    const detail = result.error?.message || String(result.stderr ?? '').trim()
    throw new Error(
      `pushed-content git ${args[0]} failed: ${detail || 'unknown git error'}`,
    )
  }
  return result.stdout
}

/** Parse complete NUL framing; only metadata is decoded, never blob content. */
export function parsePushedTree(output: Buffer): Map<string, PushedTreeEntry> {
  const entries = new Map<string, PushedTreeEntry>()
  const text = output.toString('utf8')
  if (!Buffer.from(text, 'utf8').equals(output))
    throw new Error('pushed tree contains unsupported non-UTF-8 paths')
  if (text === '') return entries
  if (!text.endsWith('\0')) throw new Error('truncated pushed tree metadata')
  for (const record of text.slice(0, -1).split('\0')) {
    const match = record.match(
      /^[0-7]{6} (blob|commit|tree) ([a-f0-9]{40}|[a-f0-9]{64}) +(\d+|-)\t([\s\S]+)$/,
    )
    if (!match) throw new Error('malformed pushed tree metadata')
    const [, type, sha, rawSize, file] = match
    if (!type || !sha || !file)
      throw new Error('incomplete pushed tree metadata')
    const size = rawSize === '-' ? undefined : Number(rawSize)
    if (
      (size !== undefined && (!Number.isSafeInteger(size) || size < 0)) ||
      (type === 'blob' && size === undefined)
    )
      throw new Error(`invalid pushed blob size for ${file}`)
    if (entries.has(file))
      throw new Error(`duplicate pushed tree path: ${file}`)
    entries.set(file, { file, type, sha, size })
  }
  return entries
}

/** A deletion is trustworthy only after successful complete tree inspection. */
export function readPushedTree(
  root: string,
  commitSha: string,
): Map<string, PushedTreeEntry> {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha))
    throw new Error('invalid pushed commit id')
  return parsePushedTree(
    gitBuffer(
      root,
      ['ls-tree', '-r', '-l', '-z', commitSha],
      TREE_BUFFER_BYTES,
    ),
  )
}

function blobHeader(entry: PushedTreeEntry): Buffer {
  if (
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(entry.sha) ||
    entry.type !== 'blob' ||
    entry.size === undefined ||
    !Number.isSafeInteger(entry.size) ||
    entry.size < 0 ||
    entry.size > SCAN_SIZE_CAP_BYTES
  )
    throw new Error(`invalid batch blob metadata: ${entry.file}`)
  return Buffer.from(`${entry.sha} blob ${entry.size}\n`, 'ascii')
}

function responseSize(entry: PushedTreeEntry): number {
  return blobHeader(entry).length + (entry.size ?? 0) + 1
}

/** Payload plus exact framing stays bounded even for many empty blobs. */
export function chunkPushedBlobs(
  entries: readonly PushedTreeEntry[],
): PushedTreeEntry[][] {
  const chunks: PushedTreeEntry[][] = []
  let current: PushedTreeEntry[] = []
  let bytes = 0
  for (const entry of entries) {
    const required = responseSize(entry)
    if (bytes + required > MAX_BATCH_BYTES) {
      chunks.push(current)
      current = []
      bytes = 0
    }
    current.push(entry)
    bytes += required
  }
  if (current.length) chunks.push(current)
  return chunks
}

/** Validate the whole batch before exposing any payload from it to a writer. */
export function parsePushedBlobBatch(
  output: Buffer,
  entries: readonly PushedTreeEntry[],
): Buffer[] {
  const expectedBytes = entries.reduce(
    (total, entry) => total + responseSize(entry),
    0,
  )
  if (expectedBytes > MAX_BATCH_BYTES || output.length !== expectedBytes)
    throw new Error('truncated, oversized or unexpected pushed blob batch')
  let offset = 0
  const payloads: Buffer[] = []
  for (const entry of entries) {
    const header = blobHeader(entry)
    if (!output.subarray(offset, offset + header.length).equals(header))
      throw new Error(
        `pushed blob header identity/type/size mismatch: ${entry.file}`,
      )
    offset += header.length
    const end = offset + (entry.size ?? 0)
    if (output[end] !== 10)
      throw new Error(`missing pushed blob trailer: ${entry.file}`)
    payloads.push(output.subarray(offset, end))
    offset = end + 1
  }
  return payloads
}

/** SHA-only stdin avoids filename expressions; bounded buffers preserve raw bytes. */
export function readPushedBlobBatches(
  root: string,
  entries: readonly PushedTreeEntry[],
  consume: (entry: PushedTreeEntry, content: Buffer) => void,
): void {
  for (const chunk of chunkPushedBlobs(entries)) {
    const expectedBytes = chunk.reduce(
      (total, entry) => total + responseSize(entry),
      0,
    )
    const output = gitBuffer(
      root,
      ['cat-file', '--batch'],
      expectedBytes + STDERR_ALLOWANCE_BYTES,
      chunk.map((entry) => `${entry.sha}\n`).join(''),
    )
    const payloads = parsePushedBlobBatch(output, chunk)
    chunk.forEach((entry, index) => {
      const payload = payloads[index]
      if (payload === undefined)
        throw new Error(`missing pushed blob payload: ${entry.file}`)
      consume(entry, payload)
    })
  }
}
