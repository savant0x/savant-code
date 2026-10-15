import { spawn } from 'child_process'
import { existsSync, writeFileSync } from 'fs'

const FIXTURE_START_TIMEOUT_MS = 30_000

const mode = process.argv[2]
const pidFile = mode === 'grandchild' ? process.argv[3] : mode
if (!pidFile) throw new Error('PID file path is required')

function keepHeartbeat(path: string): void {
  let sequence = 0
  const write = () => writeFileSync(path, `${process.pid}:${sequence++}`)
  write()
  setInterval(write, 50)
}

if (mode === 'grandchild') {
  keepHeartbeat(`${pidFile}.grandchild`)
} else {
  const grandchild = spawn(
    process.execPath,
    [import.meta.path, 'grandchild', pidFile],
    { detached: true, stdio: 'ignore', windowsHide: true },
  )
  const grandchildPid = grandchild.pid
  if (!grandchildPid) throw new Error('Failed to start grandchild')
  grandchild.unref()

  keepHeartbeat(`${pidFile}.parent`)
  const grandchildHeartbeat = `${pidFile}.grandchild`
  const readyDeadline = Date.now() + FIXTURE_START_TIMEOUT_MS
  while (!existsSync(grandchildHeartbeat) && Date.now() < readyDeadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
  }
  if (!existsSync(grandchildHeartbeat)) {
    throw new Error('Grandchild heartbeat did not start')
  }
  writeFileSync(
    pidFile,
    JSON.stringify({ parentPid: process.pid, grandchildPid }),
  )
}
