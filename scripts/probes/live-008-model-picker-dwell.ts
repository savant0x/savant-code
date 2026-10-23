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
 * FID-2026-1022-002 extended it to read the product's own breadcrumbs back.
 * `ModelPicker` now writes `model-picker.open` / `.key` / `.filter` / `.close`
 * records to `debug/cli.jsonl`, so the interaction verdict ("arrow keys and the
 * filter letter responded") is derived from log lines instead of a human
 * observation. When the picker never opens, no verdict is invented.
 *
 * Usage: `bun scripts/probes/live-008-model-picker-dwell.ts [--dwell-ms N]`
 * Exit code 0 = the picker opened AND every interaction claim held; 1 = the CLI
 * never reached the picker, or a claim failed (each failed claim is named on
 * stderr). A completed observation that judged its own claim false is not a
 * pass: the probe is consumed as an acceptance gate, and a gate that exits 0
 * while printing its own FAIL lines certifies nothing (FID-2026-1023-001).
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

/** One acceptance claim the interaction half must prove, and whether it did. */
export type InteractionVerdict = { claim: string; pass: boolean }

/**
 * The probe's exit code (FID-2026-1023-001): `0` only when the picker opened
 * AND every interaction claim held. An opened picker with no claim proved is a
 * failure too — an observation that asserted nothing cannot pass an acceptance
 * gate.
 */
export function exitCodeFor(
  opened: boolean,
  verdicts: InteractionVerdict[],
): number {
  if (!opened || verdicts.length === 0) return 1
  return verdicts.every((verdict) => verdict.pass) ? 0 : 1
}

async function main(): Promise<void> {
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
  /**
   * One `model-picker.*` record from a JSONL line. The CLI's pino sink nests
   * call arguments under `data`, so both shapes are read.
   */
  function breadcrumbOf(line: string): Record<string, unknown> | undefined {
    try {
      const record = JSON.parse(line) as Record<string, unknown>
      const payload = (record.data ?? record) as Record<string, unknown>
      const event = payload.event
      return typeof event === 'string' && event.startsWith('model-picker.')
        ? payload
        : undefined
    } catch {
      return undefined
    }
  }

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

  async function waitForScreen(
    marker: string,
    maxMs: number,
  ): Promise<boolean> {
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

  // Interaction after the dwell: the breadcrumbs can only verdict a key the
  // product actually received, so the harness presses the keys the acceptance
  // claim is about rather than inferring them from the screen.
  if (opened) {
    write('\u001b[B')
    await sleep(150)
    write('\u001b[B')
    await sleep(150)
    write('a')
    await sleep(500)
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

  const breadcrumbs = jsonlDelta
    .split('\n')
    .map(breadcrumbOf)
    .filter((entry): entry is Record<string, unknown> => entry !== undefined)
  const ofEvent = (event: string) =>
    breadcrumbs.filter((entry) => entry.event === event)
  const keysByAction: Record<string, number> = {}
  for (const entry of ofEvent('model-picker.key')) {
    const action = String(entry.action)
    keysByAction[action] = (keysByAction[action] ?? 0) + 1
  }
  const filteredCounts = ofEvent('model-picker.filter').map((entry) =>
    Number(entry.filtered),
  )
  const closeReasons = ofEvent('model-picker.close').map((entry) =>
    String(entry.reason),
  )
  const catalogSize = Number(
    ofEvent('model-picker.open')[0]?.catalog ?? Number.POSITIVE_INFINITY,
  )
  // Verdicts are derived from the product's own records only; a missing picker
  // yields an empty verdict list rather than a pass.
  const interactionVerdicts: InteractionVerdict[] = opened
    ? [
        {
          claim: 'the picker recorded its open',
          pass: ofEvent('model-picker.open').length > 0,
        },
        {
          claim: 'at least one navigation key was handled',
          pass: (keysByAction.up ?? 0) + (keysByAction.down ?? 0) > 0,
        },
        {
          claim: 'a filter narrowed the matched rows',
          pass: filteredCounts.some(
            (count) => Number.isFinite(count) && count < catalogSize,
          ),
        },
        {
          claim: 'the close recorded its reason',
          pass: closeReasons.length > 0,
        },
      ]
    : []

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
    breadcrumbs: {
      opens: ofEvent('model-picker.open').length,
      keys: ofEvent('model-picker.key').length,
      keysByAction,
      filteredCounts,
      closeReasons,
    },
    interactionVerdicts,
    tailScreen: screenText().replace(/\s+/g, ' ').trim().slice(-600),
  }

  console.log(JSON.stringify(report, null, 2))
  process.exitCode = exitCodeFor(opened, interactionVerdicts)
  if (!opened) {
    console.error('FAIL — picker never appeared within 12s of Enter')
  }
  for (const verdict of interactionVerdicts) {
    if (!verdict.pass) console.error(`FAIL — ${verdict.claim}`)
  }
}

if (import.meta.main) await main()
