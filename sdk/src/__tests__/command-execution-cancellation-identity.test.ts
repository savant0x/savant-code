import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  abortForUserCancellation,
  commandCancellationMetadata,
  commandExecutionMetadata,
  isUserCancellationSignal,
} from '@savant-code/common/util/command-execution'
import { describe, expect, test } from 'bun:test'

import { runTerminalCommand } from '../tools/run-terminal-command'

/**
 * FID-2026-1012-023 (Loop 7) — cancellation identity across a module copy.
 *
 * `common` resolves to SOURCE in this repository (`"bun": "./src/*.ts"`) while
 * `@savant-code/sdk` resolves to its bundle (`"import": "./dist/index.mjs"`),
 * and the bundle INLINES its own copy of every module it imports. One process
 * therefore runs two copies of the command-execution contract, and a per-module
 * `Symbol('…')` is a *different* symbol in each: a user stop minted by one copy
 * was read as an untyped cancellation by the other, silently.
 *
 * The second copy is built here rather than loaded from `dist/`: `dist/` is
 * gitignored and absent until a build runs, so a gate that needed it could not
 * be a gate.
 */

const REPOSITORY_ROOT = join(import.meta.dir, '..', '..', '..')

/** The contract a built copy must expose; the brand itself is never exported. */
interface CommandExecutionCopy {
  abortForUserCancellation(controller: AbortController): void
  commandCancellationMetadata(signal?: AbortSignal): {
    cancellationReason?: string
  }
  isUserCancellationSignal(signal?: AbortSignal): boolean
}

interface TerminalCommandCopy {
  runTerminalCommand(params: {
    command: string
    process_type: 'SYNC'
    cwd: string
    timeout_seconds: number
    signal?: AbortSignal
  }): Promise<Array<{ value: Record<string, unknown> }>>
}

function isCommandExecutionCopy(value: unknown): value is CommandExecutionCopy {
  return (
    !!value &&
    typeof value === 'object' &&
    'abortForUserCancellation' in value &&
    'commandCancellationMetadata' in value &&
    'isUserCancellationSignal' in value
  )
}

function isTerminalCommandCopy(value: unknown): value is TerminalCommandCopy {
  return !!value && typeof value === 'object' && 'runTerminalCommand' in value
}

/** Build one module into a throwaway second copy and import its contract. */
async function importModuleCopy<Contract>(
  relativeEntry: string,
  isContract: (value: unknown) => value is Contract,
): Promise<Contract> {
  const built = await Bun.build({
    entrypoints: [join(REPOSITORY_ROOT, relativeEntry)],
    target: 'bun',
    format: 'esm',
  })
  const output = built.outputs[0]
  if (!built.success || !output)
    throw new Error(`could not build a copy of ${relativeEntry}`)
  const directory = await fs.mkdtemp(join(os.tmpdir(), 'savant-copy-'))
  const file = join(directory, 'module-copy.mjs')
  await fs.writeFile(file, await output.text())
  const loaded: unknown = await import(pathToFileURL(file).href)
  if (!isContract(loaded))
    throw new Error(`the copy of ${relativeEntry} does not expose its contract`)
  return loaded
}

/** A pre-aborted call inspects provenance without starting any process. */
const terminalCall = {
  command: 'echo fixture',
  process_type: 'SYNC',
  cwd: process.cwd(),
  timeout_seconds: 30,
} as const

describe('FID-2026-1012-023 cancellation identity across a module copy', () => {
  test('a typed user abort is typed in both copies, in both directions', async () => {
    const copy = await importModuleCopy(
      'common/src/util/command-execution.ts',
      isCommandExecutionCopy,
    )

    const abortedBySource = new AbortController()
    abortForUserCancellation(abortedBySource)
    expect(commandCancellationMetadata(abortedBySource.signal)).toEqual({
      cancellationReason: 'user-request',
    })
    expect(copy.commandCancellationMetadata(abortedBySource.signal)).toEqual({
      cancellationReason: 'user-request',
    })
    expect(copy.isUserCancellationSignal(abortedBySource.signal)).toBe(true)

    const abortedByCopy = new AbortController()
    copy.abortForUserCancellation(abortedByCopy)
    expect(copy.commandCancellationMetadata(abortedByCopy.signal)).toEqual({
      cancellationReason: 'user-request',
    })
    expect(commandCancellationMetadata(abortedByCopy.signal)).toEqual({
      cancellationReason: 'user-request',
    })
    expect(isUserCancellationSignal(abortedByCopy.signal)).toBe(true)
  })

  test('an untyped abort and a claiming reason stay untyped in both copies', async () => {
    const copy = await importModuleCopy(
      'common/src/util/command-execution.ts',
      isCommandExecutionCopy,
    )

    const untyped = new AbortController()
    untyped.abort()
    expect(commandCancellationMetadata(untyped.signal)).toEqual({})
    expect(copy.commandCancellationMetadata(untyped.signal)).toEqual({})
    expect(copy.isUserCancellationSignal(untyped.signal)).toBe(false)

    // A value that merely CLAIMS user intent is not a harness declaration.
    const claimed = new AbortController()
    claimed.abort({ cancellationReason: 'user-request' })
    expect(commandCancellationMetadata(claimed.signal)).toEqual({})
    expect(copy.commandCancellationMetadata(claimed.signal)).toEqual({})
  })

  test('the copied terminal runner keeps a user stop minted by the source copy', async () => {
    const controller = new AbortController()
    abortForUserCancellation(controller)
    const copy = await importModuleCopy(
      'sdk/src/tools/run-terminal-command.ts',
      isTerminalCommandCopy,
    )

    const copied = await copy.runTerminalCommand({
      ...terminalCall,
      signal: controller.signal,
    })
    const source = await runTerminalCommand({
      ...terminalCall,
      signal: controller.signal,
    })

    // One outcome, described by two copies of the producer: an explicit user
    // stop must not be the "unexpected cancellation" Loop 6 removed.
    const expected = {
      executionOutcome: 'cancelled',
      executionStarted: false,
      executedToolName: 'run_terminal_command',
      terminationState: 'not-started',
      cancellationReason: 'user-request',
    } as const
    expect(commandExecutionMetadata(copied[0]?.value)).toEqual(expected)
    expect(commandExecutionMetadata(source[0]?.value)).toEqual(expected)
  })
})
