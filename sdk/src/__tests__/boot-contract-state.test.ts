import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { initialSessionState } from '../run-state'

const temporaryDirectories: string[] = []

describe('SDK boot contract state', () => {
  test('stores the marker-resolved single-agent contract on the main agent', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-boot-contract-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev'), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, 'ECHO-single-agent.md'),
      '```text\ndev/echo.md\n```\n',
    )
    fs.writeFileSync(path.join(cwd, 'dev', 'echo.md'), '# protocol\n')
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      [
        'single_agent:',
        '  protocol:',
        "    version: 'test-single-agent'",
        '    strict_mode: true',
        '',
      ].join('\n'),
    )

    const state = await initialSessionState({
      cwd,
      protocolVariant: 'single-agent',
      projectFiles: { 'src/index.ts': 'export const ok = true\n' },
    })

    expect(state.mainAgentState.protocolVariant).toBe('single-agent')
    expect(state.mainAgentState.protocolFile).toBe('dev/echo.md')
    expect(state.mainAgentState.protocolVersion).toBe('test-single-agent')
    expect(state.mainAgentState.protocolStrictMode).toBe(true)

    fs.rmSync(cwd, { recursive: true, force: true })
  })
})
