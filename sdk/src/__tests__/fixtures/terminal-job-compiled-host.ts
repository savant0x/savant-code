import { runTerminalCommand } from '../../tools/run-terminal-command'

const output = await runTerminalCommand({
  command: 'printf compiled-command-host',
  process_type: 'SYNC',
  cwd: process.cwd(),
  timeout_seconds: 5,
})
console.log(JSON.stringify(output))
