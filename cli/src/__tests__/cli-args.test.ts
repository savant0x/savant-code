import fs from 'fs'
import os from 'os'
import path from 'path'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Command } from 'commander'

import { parseArgs } from '../cli-args'

describe('CLI Argument Parsing', () => {
  let originalArgv: string[]

  beforeEach(() => {
    originalArgv = process.argv
  })

  afterEach(() => {
    process.argv = originalArgv
  })

  function parseTestArgs(args: string[]) {
    process.argv = ['node', 'codecane', ...args]

    const program = new Command()
    program
      .name('codecane')
      .version('1.0.0', '-v, --version', 'Print the CLI version')
      .option('--agent <agent-id>', 'Specify which agent to use')
      .option('--clear-logs', 'Remove any existing CLI log files')
      .argument('[prompt...]', 'Initial prompt to send')
      .allowExcessArguments(true)
      .exitOverride() // Prevent process.exit in tests

    try {
      program.parse(process.argv)
    } catch (error) {
      // Commander throws on --help, --version in exitOverride mode
      if (error instanceof Error && error.message.includes('(outputHelp)')) {
        return { help: true }
      }
      if (
        error instanceof Error &&
        (error.message.includes('(version)') || error.message.includes('1.0.0'))
      ) {
        return { version: true }
      }
      throw error
    }

    const options = program.opts()
    const promptArgs = program.args

    return {
      agent: options.agent,
      clearLogs: options.clearLogs || false,
      initialPrompt: promptArgs.length > 0 ? promptArgs.join(' ') : null,
    }
  }

  test('parses --agent flag correctly', () => {
    const result = parseTestArgs([
      '--agent',
      'scout',
      'find all TypeScript files',
    ])
    expect(result.agent).toBe('scout')
    expect(result.initialPrompt).toBe('find all TypeScript files')
  })

  test('parses --agent with full agent ID', () => {
    const result = parseTestArgs([
      '--agent',
      'savant-code/base-lite@1.0.0',
      'hello',
    ])
    expect(result.agent).toBe('savant-code/base-lite@1.0.0')
    expect(result.initialPrompt).toBe('hello')
  })

  test('works without --agent flag (defaults to base)', () => {
    const result = parseTestArgs(['create a new component'])
    expect(result.agent).toBeUndefined()
    expect(result.initialPrompt).toBe('create a new component')
  })

  test('parses --clear-logs flag', () => {
    const result = parseTestArgs(['--clear-logs', 'hello'])
    expect(result.clearLogs).toBe(true)
    expect(result.initialPrompt).toBe('hello')
  })

  test('handles multiple flags together', () => {
    const result = parseTestArgs([
      '--agent',
      'verifier',
      '--clear-logs',
      'review my code',
    ])
    expect(result.agent).toBe('verifier')
    expect(result.clearLogs).toBe(true)
    expect(result.initialPrompt).toBe('review my code')
  })

  test('handles prompt with no flags', () => {
    const result = parseTestArgs(['this is a test prompt'])
    expect(result.agent).toBeUndefined()
    expect(result.clearLogs).toBe(false)
    expect(result.initialPrompt).toBe('this is a test prompt')
  })

  test('handles empty arguments', () => {
    const result = parseTestArgs([])
    expect(result.agent).toBeUndefined()
    expect(result.clearLogs).toBe(false)
    expect(result.initialPrompt).toBeNull()
  })

  test('handles multi-word prompt', () => {
    const result = parseTestArgs([
      '--agent',
      'base',
      'fix the bug in auth.ts file',
    ])
    expect(result.agent).toBe('base')
    expect(result.initialPrompt).toBe('fix the bug in auth.ts file')
  })

  test('handles --help flag', () => {
    const result = parseTestArgs(['--help'])
    expect(result.help).toBe(true)
  })

  test('handles -h flag', () => {
    const result = parseTestArgs(['-h'])
    expect(result.help).toBe(true)
  })

  test('handles --version flag', () => {
    const result = parseTestArgs(['--version'])
    expect(result.version).toBe(true)
  })

  test('handles -v flag', () => {
    const result = parseTestArgs(['-v'])
    expect(result.version).toBe(true)
  })

  test('parses --permission-mode flag', () => {
    const result = parseArgs({
      argv: ['node', 'savant-code', '--permission-mode', 'safe'],
    })
    expect(result.initialPermissionMode).toBe('safe')
  })

  test('ignores invalid --permission-mode values', () => {
    const result = parseArgs({
      argv: ['node', 'savant-code', '--permission-mode', 'paranoid'],
    })
    expect(result.initialPermissionMode).toBeUndefined()
  })

  test('parses --prompt-file flag correctly', () => {
    const tmpFile = path.join(os.tmpdir(), 'cli-args-prompt-test.txt')
    fs.writeFileSync(tmpFile, 'hello from file')
    try {
      const result = parseArgs({
        argv: ['node', 'savant-code', '--prompt-file', tmpFile],
      })
      expect(result.initialPrompt).toBe('hello from file')
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  test('resolves --prompt-file relative to cwd with parent fallback', () => {
    const tmpFile = path.join(os.tmpdir(), 'cli-args-prompt-relative.txt')
    fs.writeFileSync(tmpFile, 'relative prompt')
    try {
      // Simulate the common `bun --cwd cli dev --prompt-file <file>` case:
      // process.cwd() is the cli workspace, and the file lives in the parent.
      const originalCwd = process.cwd()
      const simulatedCliDir = path.join(
        originalCwd,
        'cli-args-prompt-simulated-cli',
      )
      fs.mkdirSync(simulatedCliDir, { recursive: true })
      try {
        process.chdir(simulatedCliDir)
        const relativePath = path.relative(originalCwd, tmpFile)
        process.chdir(simulatedCliDir)
        const result = parseArgs({
          argv: ['node', 'savant-code', '--prompt-file', relativePath],
        })
        expect(result.initialPrompt).toBe('relative prompt')
      } finally {
        process.chdir(originalCwd)
        fs.rmSync(simulatedCliDir, { recursive: true, force: true })
      }
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })
})

describe('SavantFree CLI Argument Parsing', () => {
  test('accepts login as a command, not an unexpected argument', () => {
    const result = parseArgs({
      argv: ['node', 'savant-free', 'login'],
      isSavantFree: true,
      version: '1.0.0',
    })

    expect(result.initialPrompt).toBeNull()
    expect(result.command).toBe('login')
    expect(result.initialMode).toBe('EDIT')
  })

  test('allows cwd before the login command', () => {
    const result = parseArgs({
      argv: ['node', 'savant-free', '--cwd', '/tmp', 'login'],
      isSavantFree: true,
      version: '1.0.0',
    })

    expect(result.cwd).toBe('/tmp')
    expect(result.command).toBe('login')
    expect(result.initialPrompt).toBeNull()
  })

  test('allows cwd after the login command', () => {
    const result = parseArgs({
      argv: ['node', 'savant-free', 'login', '--cwd', '/tmp'],
      isSavantFree: true,
      version: '1.0.0',
    })

    expect(result.cwd).toBe('/tmp')
    expect(result.command).toBe('login')
    expect(result.initialPrompt).toBeNull()
  })
})
