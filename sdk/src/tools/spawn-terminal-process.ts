import { spawn } from 'node:child_process'

import { registerLiveChild } from './child-process-registry'
import { createWindowsCommandJob } from './windows-command-job'

// No user command can start until the parent assigns this host to its job.
const WAITING_HOST = [
  'process.stdin.once("end",()=>process.exit(125));',
  'process.stdin.once("data",()=>{',
  'process.stdin.removeAllListeners("end");',
  'const original=JSON.parse(process.argv[1]);',
  'if(original===null)delete process.env.BUN_BE_BUN;else process.env.BUN_BE_BUN=original;',
  'const child=require("child_process").spawn(process.argv[2],process.argv.slice(3),{stdio:"inherit",windowsHide:true});',
  'child.on("error",()=>process.exit(126));',
  'child.on("exit",code=>process.exit(code??1));',
  '});',
].join('')

export function spawnTerminalProcess(params: {
  shell: string
  shellArgs: string[]
  command: string
  cwd: string
  env: NodeJS.ProcessEnv
}) {
  const job = createWindowsCommandJob()
  const args = [...params.shellArgs, params.command]
  try {
    const child = spawn(
      job ? process.execPath : params.shell,
      job
        ? [
            '-e',
            WAITING_HOST,
            JSON.stringify(params.env.BUN_BE_BUN ?? null),
            params.shell,
            ...args,
          ]
        : args,
      {
        cwd: params.cwd,
        env: job ? { ...params.env, BUN_BE_BUN: '1' } : params.env,
        stdio: 'pipe',
        detached: true,
        windowsHide: true,
      },
    )
    child.once('error', () => {}) // Also handled by the caller after startup.
    child.stdin.on('error', () => {}) // A failed host can close before the gate write.
    if (job) {
      try {
        if (!child.pid) throw new Error('Command host did not start.')
        job.attach(child.pid)
      } catch (error) {
        child.stdin.destroy()
        child.kill()
        throw error
      }
    }
    registerLiveChild(child, job)
    if (job) child.stdin.end('\n')
    return child
  } catch (error) {
    job?.close()
    throw error
  }
}
