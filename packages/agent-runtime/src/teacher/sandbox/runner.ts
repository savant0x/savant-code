/**
 * Sandbox child runner — FID-2026-0813-013.
 *
 * Spawned as `<bun> runner.ts <workspace>`. It evaluates the untrusted solution
 * in a restricted `node:vm` context (no require/process/fetch/WebAssembly,
 * string+wasm code generation disabled) and runs the trusted hidden tests in
 * the same realm, writing a structured `result.json`. Uses only Node builtins
 * so it runs in a stripped-environment subprocess.
 *
 * The runner captures the solution's `console.*` output into a bounded buffer
 * and reports it back in `result.json` so the supervisor can hash it without
 * trusting the child's raw stdout.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const workspace = process.argv[2]
if (!workspace) {
  process.stderr.write('usage: runner.ts <workspace>\n')
  process.exit(2)
}

type TestSummary = {
  total: number
  passed: number
  failed: number
  failedNames: string[]
}

type PolicyJson = {
  limits: { timeLimitMs: number; maxOutputBytes: number }
}

type ChildResult = {
  status: 'passed' | 'failed' | 'timed_out'
  testSummary: TestSummary
  error: string
  /** Bounded captured solution output (console.*), truncated at the cap. */
  stdout: string
  outputOverflowed: boolean
}

function readPolicy(): PolicyJson {
  return JSON.parse(
    fs.readFileSync(path.join(workspace, 'policy.json'), 'utf8'),
  ) as PolicyJson
}

function readWorkspaceFile(name: string): string {
  return fs.readFileSync(path.join(workspace, name), 'utf8')
}

/** A console that appends to a bounded buffer and never throws. */
function makeCappedConsole(maxBytes: number) {
  let text = ''
  let overflowed = false
  const append = (parts: unknown[]): void => {
    const line = `${parts.map((part) => String(part)).join(' ')}\n`
    if (text.length + line.length > maxBytes) {
      overflowed = true
      const remaining = maxBytes - text.length
      if (remaining > 0) text += line.slice(0, remaining)
    } else {
      text += line
    }
  }
  return {
    log: (...parts: unknown[]) => append(parts),
    error: (...parts: unknown[]) => append(parts),
    warn: (...parts: unknown[]) => append(parts),
    info: (...parts: unknown[]) => append(parts),
    debug: (...parts: unknown[]) => append(parts),
    getText: () => text,
    getOverflowed: () => overflowed,
  }
}

function timeoutCode(caught: unknown): boolean {
  return (
    typeof caught === 'object' &&
    caught !== null &&
    'code' in caught &&
    (caught as { code: unknown }).code === 'ERR_SCRIPT_EXECUTION_TIMEOUT'
  )
}

function main(): void {
  const policy = readPolicy()
  const consoleBuffer = makeCappedConsole(policy.limits.maxOutputBytes)

  const context = vm.createContext({})
  for (const banned of [
    'require',
    'process',
    'Buffer',
    'fetch',
    'import',
    'importScripts',
    'WebAssembly',
    'globalThis',
  ]) {
    ;(context as Record<string, unknown>)[banned] = undefined
  }
  ;(context as Record<string, unknown>).console = {
    log: consoleBuffer.log,
    error: consoleBuffer.error,
    warn: consoleBuffer.warn,
    info: consoleBuffer.info,
    debug: consoleBuffer.debug,
  }

  const summary: TestSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    failedNames: [],
  }
  ;(context as Record<string, unknown>).recordTest = (
    name: unknown,
    fn: () => unknown,
  ): void => {
    summary.total++
    try {
      if (fn()) summary.passed++
      else {
        summary.failed++
        summary.failedNames.push(String(name))
      }
    } catch {
      summary.failed++
      summary.failedNames.push(String(name))
    }
  }

  // `codeGeneration` is a valid Node vm option; the bundled `RunningScriptOptions`
  // typing here omits it, so the option bag is cast through unknown.
  const options = {
    timeout: policy.limits.timeLimitMs,
    codeGeneration: { strings: false, wasm: false },
  } as unknown as vm.RunningScriptOptions

  let status: 'passed' | 'failed' | 'timed_out' = 'failed'
  let error = ''
  try {
    // The challenge-specific function name is encoded in the tests, not the
    // runner; a missing function surfaces as a failing test (ReferenceError).
    vm.runInContext(readWorkspaceFile('solution.js'), context, options)
    vm.runInContext(readWorkspaceFile('tests.js'), context, options)
    status = summary.total > 0 && summary.failed === 0 ? 'passed' : 'failed'
  } catch (caught) {
    if (timeoutCode(caught)) {
      status = 'timed_out'
      error = 'execution timed out'
    } else {
      status = 'failed'
      error = String(caught instanceof Error ? caught.message : caught).slice(
        0,
        500,
      )
    }
  }

  const result: ChildResult = {
    status,
    testSummary: summary,
    error,
    stdout: consoleBuffer.getText(),
    outputOverflowed: consoleBuffer.getOverflowed(),
  }
  fs.writeFileSync(
    path.join(workspace, 'result.json'),
    JSON.stringify(result),
    'utf8',
  )
  process.exit(0)
}

main()
