import { isReadonlyCommand } from './readonly-command-validation'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  ClientToolName as _ClientToolName,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
// run_readonly_command is not a ClientToolName, so its handler function type
// does not expose requestClientToolCall. We still delegate to the client tool
// run_terminal_command at runtime, which requires an explicit cast.
// run_readonly_command is not a ClientToolName (it performs server-side
// validation first), but it delegates to run_terminal_command, which IS a
// ClientToolName. The runtime passes requestClientToolCall to every handler,
// so we cast to SavantCodeToolHandlerFunction to keep the public signature
// simple while still using the run_terminal_command client tool internally.
export const handleRunReadonlyCommand = (async ({
  previousToolCallFinished,
  toolCall,
  requestClientToolCall,
}: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'run_readonly_command'>
  requestClientToolCall: (
    toolCall: ClientToolCall<'run_terminal_command'>,
  ) => Promise<SavantCodeToolOutput<'run_terminal_command'>>
}) => {
  const { command, commands, cwd, timeout_seconds } = toolCall.input
  const isBatch = commands !== undefined
  const allCommands: string[] = isBatch
    ? commands
    : command !== undefined
      ? [command]
      : []

  if (allCommands.length === 0) {
    return {
      output: [
        {
          type: 'json',
          value: {
            command: command ?? '',
            stdout: '',
            stderr: 'run_readonly_command rejected: no command provided.',
            exitCode: 1,
          },
        },
      ] as SavantCodeToolOutput<'run_readonly_command'>,
    }
  }

  await previousToolCallFinished

  // FID-2026-0817-002 B3: validate + delegate one command. Reused by both the
  // single-command and batch paths so validation never diverges.
  const runOne = async (
    cmd: string,
  ): Promise<SavantCodeToolOutput<'run_terminal_command'>> => {
    const safety = isReadonlyCommand(cmd)
    if (!safety.valid) {
      return [
        {
          type: 'json',
          value: {
            command: cmd,
            stdout: '',
            stderr: `run_readonly_command rejected: ${safety.reason}`,
            exitCode: 1,
          },
        },
      ]
    }
    const clientToolCall: ClientToolCall<'run_terminal_command'> = {
      toolName: 'run_terminal_command',
      toolCallId: toolCall.toolCallId,
      input: {
        command: cmd,
        mode: 'assistant',
        process_type: 'SYNC',
        timeout_seconds,
        cwd,
      },
    }
    return requestClientToolCall(clientToolCall)
  }

  if (isBatch) {
    const results: Array<SavantCodeToolOutput<'run_terminal_command'>[number]> =
      []
    for (const cmd of allCommands) {
      const out = await runOne(cmd)
      results.push(out[0])
    }
    return {
      output: [
        {
          type: 'json',
          value: {
            commands: allCommands,
            results: results.map((result) => result.value),
          },
        },
      ] as SavantCodeToolOutput<'run_readonly_command'>,
    }
  }

  return { output: await runOne(allCommands[0]) }
}) as SavantCodeToolHandlerFunction<'run_readonly_command'>
