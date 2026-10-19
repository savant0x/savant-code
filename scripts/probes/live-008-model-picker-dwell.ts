/**
 * LIVE-008 model-picker dwell probe (FID-2026-1018-008).
 *
 * `live-003` opens the picker and closes it within ~3 s, which is shorter than
 * the observed failure: the renderer root went empty ~8 s after
 * `model-picker-open-begin` in run `46880`. This probe keeps the picker open
 * for the whole window and reports what the durable logs recorded afterwards —
 * `render-tree-empty` from `renderer-health`, and, since the console wrapper
 * now sits on top of OpenTUI's capture, the text of any React failure.
 *
 * It asserts nothing about the cause; it collects the evidence.
 *
 * Usage: `bun scripts/probes/live-008-model-picker-dwell.ts [--dwell-ms N]`
 * Exit code 0 = the observation completed (read the JSON), 1 = the CLI never
 * reached the picker at all.
 */
import fs from 'node:fs'
import path from 'node:path'

import { sleep } from '@savant-code/common/util/promise'

const COLS = 123
const ROWS = 76
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007/g
const NON_PRINTABLE = /[^\P{C}\n\t]/gu
const BOOT_MARKER = 'Session'
const PICKER_MARKER = 'Select a model'

const args = process.argv.slice(2)
const dwellFlag = args.indexOf('--dwell-ms')
const dwellMs =
  dwellFlag >= 0 && args[dwellFlag + 1]
    ? Number.parseInt(args[dwellFlag + 1]!, 10)
    : 30_000

const repoRoot = process.cwd()
const debugDir = path.join(repoRoot, 'debug')
const exitLogPath = path.join(debugDir, 'cli.exit.log')
const jsonlPath = path.join(debugDir, 'cli.jsonl')

function sizeOf(file: string): number {
  try {
    return fs.statSync(file).size
  } catch {
    return 0
  }
}

/** Bytes appended to `file` since `from`, read as text. */
function deltaSince(file: string, from: number): string {
  try {
    const buffer = fs.readFileSync(file)
    return buffer.subarray(Math.min(from, buffer.length)).toString('utf8')
  } catch {
    return ''
  }
}

const exitLogStart = sizeOf(exitLogPath)
const jsonlStart = sizeOf(jsonlPath)

const raw: Uint8Array[] = []
const decoder = new TextDecoder()

const terminal = new Bun.Terminal({
  cols: COLS,
  rows: ROWS,
  data: (_t: Bun.Terminal, data: Uint8Array) => {
    raw.push(data.slice())
  },
})

function screenText(): string {
  return decoder
    .decode(Buffer.concat(raw.map((part) => Buffer.from(part))))
    .replace(ANSI, ' ')
    .replace(NON_PRINTABLE, '')
}

async function waitForScreen(marker: string, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (screenText().includes(marker)) return true
    await sleep(150)
  }
  return false
}

function write(text: string): void {
  if (!terminal.closed) terminal.write(text)
}

async function type(text: string, perCharMs = 50): Promise<void> {
  for (const char of text) {
    write(char)
    await sleep(perCharMs)
  }
}

const child = Bun.spawn(
  [
    process.execPath,
    '--no-env-file',
    'run',
    'cli/src/index.tsx',
    '--cwd',
    repoRoot,
  ],
  { cwd: repoRoot, terminal },
)

const ready = await waitForScreen(BOOT_MARKER, 45_000)
await sleep(1200)

await type('/model')
await sleep(1200)
write('\r')
const opened = await waitForScreen(PICKER_MARKER, 12_000)

// The dwell: sample the durable exit log each second so we can time the blank
// against the picker open rather than inferring it from file mtimes.
const openedAt = Date.now()
const samples: { atMs: number; emptyTree: boolean; exitLines: number }[] = []
const blankWrite = Date.now() + dwellMs
while (Date.now() < blankWrite) {
  const lines = deltaSince(exitLogPath, exitLogStart)
  samples.push({
    atMs: Date.now() - openedAt,
    emptyTree: lines.includes('render-tree-empty'),
    exitLines: lines.trim() === '' ? 0 : lines.trim().split('\n').length,
  })
  await sleep(1000)
}

const aliveAfterDwell = child.exitCode === null
for (let i = 0; i < 3 && child.exitCode === null; i++) {
  write('\u001b')
  await sleep(200)
  write('\u0003')
  await sleep(400)
}
const exitDeadline = Date.now() + 15_000
while (child.exitCode === null && Date.now() < exitDeadline) await sleep(100)
if (child.exitCode === null) child.kill()
await child.exited.catch(() => undefined)
terminal.close()

const exitDelta = deltaSince(exitLogPath, exitLogStart)
const jsonlDelta = deltaSince(jsonlPath, jsonlStart)
const consoleLines = jsonlDelta
  .split('\n')
  .filter(
    (line) =>
      line.includes('"source":"console"') || line.includes('"level":"ERROR"'),
  )
  .map((line) => line.slice(0, 2_000))

const firstEmpty = samples.find((sample) => sample.emptyTree)
const report = {
  probe: 'live-008-model-picker-dwell',
  dwellMs,
  booted: ready,
  pickerOpened: opened,
  emptyTreeAfterMs: firstEmpty?.atMs ?? null,
  aliveAfterDwell,
  exitCode: child.exitCode,
  exitLogLines: exitDelta.trim() === '' ? [] : exitDelta.trim().split('\n'),
  errorLogLines: consoleLines,
  tailScreen: screenText().replace(/\s+/g, ' ').trim().slice(-600),
}

console.log(JSON.stringify(report, null, 2))
if (!opened) {
  console.error('FAIL — picker never appeared within 12s of Enter')
  process.exitCode = 1
}
