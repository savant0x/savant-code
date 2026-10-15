import { runTerminalCommand } from '@savant-code/sdk'

import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import { clearInput } from '../command-shared'

import type { RouterParams } from '../command-shared'

// FID-2026-0819-005 Loop 142: /verify handler, extracted from chat.ts.
// Runs `bun run typecheck` in the selected workspace(s) and reports
// PASS/FAIL per workspace in the chat.
export async function handleVerifyCommand(params: RouterParams, args: string) {
  const trimmedArgs = args.trim().toLowerCase()

  const workspaceMap: Record<string, string> = {
    sdk: 'sdk',
    common: 'common',
    'agent-runtime': 'packages/agent-runtime',
    cli: 'cli',
  }

  const workspaces =
    trimmedArgs === ''
      ? Object.entries(workspaceMap)
      : [[trimmedArgs, workspaceMap[trimmedArgs]]]

  if (!workspaces.length || workspaces.some(([, dir]) => !dir)) {
    params.setMessages((prev) => [
      ...prev,
      getUserMessage(params.inputValue.trim()),
      getSystemMessage('Usage: /verify [sdk|common|agent-runtime|cli]'),
    ])
    params.saveToHistory(params.inputValue.trim())
    clearInput(params)
    return
  }

  params.saveToHistory(params.inputValue.trim())
  clearInput(params)

  const results = await Promise.all(
    workspaces.map(async ([name, dir]) => {
      try {
        const [{ value }] = await runTerminalCommand({
          command: 'bun run typecheck',
          process_type: 'SYNC',
          cwd: dir,
          timeout_seconds: 120,
        })
        const stdout = 'stdout' in value ? value.stdout || '' : ''
        const stderr = 'stderr' in value ? value.stderr || '' : ''
        const exitCode = 'exitCode' in value ? (value.exitCode ?? 1) : 1
        return { name, exitCode, stdout, stderr }
      } catch (error) {
        return {
          name,
          exitCode: 1,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
        }
      }
    }),
  )

  const allPassed = results.every((r) => r.exitCode === 0)
  const summary = results
    .map((r) => {
      const status = r.exitCode === 0 ? 'PASS' : 'FAIL'
      const detail =
        r.exitCode === 0
          ? 'No TypeScript errors'
          : `exit ${r.exitCode}\n${(r.stderr || r.stdout).slice(0, 300)}`
      return `${r.name}: ${status}\n${detail}`
    })
    .join('\n\n')

  const overall = allPassed
    ? '✅ All typechecks passed'
    : '❌ Some typechecks failed'

  params.setMessages((prev) => [
    ...prev,
    getSystemMessage(`${overall}\n\n${summary}`),
  ])
}
