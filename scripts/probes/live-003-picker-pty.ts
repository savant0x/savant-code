/**
 * LIVE-003 model-picker live observation probe.
 *
 * Drives the real CLI through a PTY (`Bun.Terminal`), asks for `/model` against
 * the developer catalog, and records what the terminal actually received plus
 * the child's process state. It exists because the original 2026-10-18
 * incident — a blank CLI after `/model` while three bashers were active — was
 * never classified as process exit versus a live blank screen, and tmux is not
 * installed on this host.
 *
 * It answers a narrower question than the incident: does the repaired surface
 * render and keep its process alive on the full catalog? It does not
 * reconstruct three concurrent bashers (that needs a tool-capable model, and no
 * paid inference is authorized) and it cannot establish the original incident's
 * cause. `pickerOpened: false` is a real result: the probe records the bytes,
 * the live state and whether the typed command was dispatched, so the next
 * attempt starts from evidence rather than a guess.
 *
 * Usage: `bun scripts/probes/live-003-picker-pty.ts [--transcript <path>]`
 * Exit code 0 = picker rendered and the process stayed alive; 1 = an
 * expectation failed (the transcript is written either way).
 */
import os from 'node:os'
import path from 'node:path'

import { sleep } from '@savant-code/common/util/promise'

const COLS = 120
const ROWS = 40
const KEEP_BYTES = 4_000_000
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007/g
const NON_PRINTABLE = /[^\P{C}\n\t]/gu
const BOOT_MARKER = 'Session'
const PICKER_MARKER = 'Select a model'

const startedAt = Date.now()
const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-')
const args = process.argv.slice(2)
const transcriptFlag = args.indexOf('--transcript')
const repoRoot = process.cwd()
const transcriptPath =
  transcriptFlag >= 0 && args[transcriptFlag + 1]
    ? path.resolve(args[transcriptFlag + 1]!)
    : path.join(
        repoRoot,
        'dev',
        'scratchpad',
        'active',
        `live-003-picker-pty-${stamp}.log`,
      )

const raw: Uint8Array[] = []
let keptBytes = 0
let totalBytes = 0

const decoder = new TextDecoder()

function onData(_terminal: Bun.Terminal, data: Uint8Array): void {
  totalBytes += data.byteLength
  raw.push(data.slice())
  keptBytes += data.byteLength
  while (keptBytes > KEEP_BYTES && raw.length > 1) {
    const dropped = raw.shift()
    keptBytes -= dropped?.byteLength ?? 0
  }
}

function screenText(): string {
  return decoder
    .decode(Buffer.concat(raw.map((part) => Buffer.from(part))))
    .replace(ANSI, ' ')
    .replace(NON_PRINTABLE, '')
}

/** Resolve once the rendered screen contains `marker`, or at `maxMs`. */
async function waitForScreen(marker: string, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (screenText().includes(marker)) return true
    await sleep(150)
  }
  return false
}

/** Rows in the dev-env catalog the picker loads, or null when unreadable. */
async function catalogRows(): Promise<number | null> {
  const catalogPath = path.join(
    os.homedir(),
    '.savant-code-dev',
    'gateway-catalog.json',
  )
  try {
    const parsed = (await Bun.file(catalogPath).json()) as {
      catalog?: unknown[]
    }
    return Array.isArray(parsed.catalog) ? parsed.catalog.length : null
  } catch {
    return null
  }
}

function write(terminal: Bun.Terminal, text: string): void {
  if (!terminal.closed) terminal.write(text)
}

async function type(
  terminal: Bun.Terminal,
  text: string,
  perCharMs = 60,
): Promise<void> {
  for (const char of text) {
    write(terminal, char)
    await sleep(perCharMs)
  }
}

async function rssMb(pid: number): Promise<number | null> {
  try {
    const proc = Bun.spawn(
      [
        'powershell',
        '-NoProfile',
        '-Command',
        `(Get-Process -Id ${pid} -ErrorAction Stop).WorkingSet64`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    const text = (await new Response(proc.stdout).text()).trim()
    await proc.exited
    const bytes = Number.parseInt(text, 10)
    return Number.isFinite(bytes) ? Math.round(bytes / 1024 / 1024) : null
  } catch {
    return null
  }
}

const terminal = new Bun.Terminal({ cols: COLS, rows: ROWS, data: onData })
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

const notes: string[] = []

// Phase 1 — boot until the main surface is on screen.
const ready = await waitForScreen(BOOT_MARKER, 45_000)
await sleep(1500)
const bootMs = Date.now() - startedAt
const bootBytes = totalBytes
const bootScreen = screenText()
const exitedDuringBoot = child.exitCode

// Phase 2 — ask for the picker and give the dispatch a real deadline.
const openBaseline = totalBytes
await type(terminal, '/model')
await sleep(1200)
write(terminal, '\r')
const pickerOpened = await waitForScreen(PICKER_MARKER, 12_000)
await sleep(600)
const openMs = Date.now() - startedAt
const openBytes = totalBytes - openBaseline
const openScreen = screenText()
const aliveAfterOpen = child.exitCode === null
const commandRetained = openScreen.replace(/\s+/g, ' ').includes('/model')
const openExcerpt = openScreen.replace(/\s+/g, ' ').trim().slice(-900)
if (!pickerOpened) {
  notes.push(
    commandRetained
      ? 'the typed /model stayed in the input: the command was never dispatched'
      : 'the command left the input but no picker surface appeared',
  )
}

// Phase 3 — navigation and filtering, only meaningful once the picker exists.
let navBytes = 0
let filterBytes = 0
let aliveAfterNav = aliveAfterOpen
if (pickerOpened) {
  const navBaseline = totalBytes
  for (let i = 0; i < 3; i++) {
    write(terminal, '\u001b[B')
    await sleep(150)
  }
  await sleep(400)
  navBytes = totalBytes - navBaseline
  const filterBaseline = totalBytes
  await type(terminal, 'q')
  await sleep(500)
  write(terminal, '\u007f')
  await sleep(400)
  filterBytes = totalBytes - filterBaseline
  aliveAfterNav = child.exitCode === null
}
const rssSample = await rssMb(child.pid)

// Phase 4 — leave and shut the session down.
for (let i = 0; i < 3 && child.exitCode === null; i++) {
  write(terminal, '\u001b')
  await sleep(200)
  write(terminal, '\u0003')
  await sleep(400)
}

const exitDeadline = Date.now() + 15_000
while (child.exitCode === null && Date.now() < exitDeadline) await sleep(100)
if (child.exitCode === null) {
  notes.push('child did not exit after three Escape/Ctrl+C rounds; killed')
  child.kill()
}
await child.exited.catch(() => undefined)
terminal.close()

const failures: string[] = []
if (!ready) failures.push('main surface never reached the screen')
if (bootBytes === 0) failures.push('no output during boot')
if (exitedDuringBoot !== null)
  failures.push(`CLI exited during boot (code ${exitedDuringBoot})`)
if (!aliveAfterOpen) failures.push('CLI exited while the picker was requested')
if (!pickerOpened) failures.push('picker never appeared within 12s of Enter')
if (pickerOpened) {
  if (openBytes === 0) failures.push('picker opened with no terminal output')
  if (navBytes === 0) failures.push('navigation produced no output')
  if (filterBytes === 0) failures.push('filtering produced no output')
  if (!aliveAfterNav) failures.push('CLI exited during navigation or filtering')
}

const summary = {
  probe: 'live-003-picker-pty',
  startedAt: new Date(startedAt).toISOString(),
  transcript: transcriptPath,
  catalogRows: await catalogRows(),
  boot: {
    ms: bootMs,
    bytes: bootBytes,
    printableChars: bootScreen.trim().length,
    ready,
  },
  picker: {
    opened: pickerOpened,
    ms: openMs,
    bytes: openBytes,
    commandRetained,
    alive: aliveAfterOpen,
    excerpt: openExcerpt,
  },
  navigation: { bytes: navBytes, filterBytes, alive: aliveAfterNav },
  rssMb: rssSample,
  exit: { code: child.exitCode, notes },
  failures,
}

await Bun.write(transcriptPath, `${screenText()}\n`)
console.log(`transcript: ${transcriptPath}`)
console.log(JSON.stringify(summary, null, 2))
if (failures.length > 0) {
  console.error(`FAIL — ${failures.join('; ')}`)
  process.exitCode = 1
} else {
  console.log('PASS — picker rendered and the process stayed alive')
}
