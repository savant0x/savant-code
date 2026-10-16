import { createRequire } from 'node:module'

export interface WindowsCommandJob {
  attach(pid: number): void
  terminate(): boolean
  close(): void
}

// Private structural port: optional Bun types must not enter the Node SDK's
// declaration bundle. The native boundary is loaded only on Windows Bun.
interface KernelSymbols {
  CreateJobObjectW(attributes: null, name: null): number | null
  SetInformationJobObject(
    job: number,
    kind: number,
    data: number,
    size: number,
  ): number
  OpenProcess(access: number, inherit: number, pid: number): number | null
  AssignProcessToJobObject(job: number, process: number): number
  TerminateJobObject(job: number, code: number): number
  CloseHandle(handle: number): number
}

interface KernelFfi {
  ptr(buffer: Uint8Array): number
  dlopen(
    name: string,
    symbols: Record<string, { args: string[]; returns: string }>,
  ): {
    symbols: KernelSymbols
  }
}

function loadKernel() {
  const { dlopen, ptr } = createRequire(import.meta.url)('bun:ffi') as KernelFfi
  const pointer = 'ptr',
    u32 = 'u32',
    i32 = 'i32'
  const lib = dlopen('kernel32.dll', {
    CreateJobObjectW: { args: [pointer, pointer], returns: pointer },
    SetInformationJobObject: {
      args: [pointer, i32, pointer, u32],
      returns: i32,
    },
    OpenProcess: { args: [u32, i32, u32], returns: pointer },
    AssignProcessToJobObject: { args: [pointer, pointer], returns: i32 },
    TerminateJobObject: { args: [pointer, u32], returns: i32 },
    CloseHandle: { args: [pointer], returns: i32 },
  })
  return { lib, ptr }
}

let kernel: ReturnType<typeof loadKernel> | undefined

/** Native membership survives MSYS exec/reparenting; no global PID sweeping. */
export function createWindowsCommandJob(): WindowsCommandJob | undefined {
  if (process.platform !== 'win32' || !process.versions.bun) return undefined
  const { lib, ptr } = (kernel ??= loadKernel())
  const api = lib.symbols
  const handle = api.CreateJobObjectW(null, null)
  if (!handle) throw new Error('Could not create the command containment job.')
  const limits = new Uint8Array(144)
  new DataView(limits.buffer).setUint32(16, 0x2000, true) // KILL_ON_JOB_CLOSE
  if (!api.SetInformationJobObject(handle, 9, ptr(limits), limits.byteLength)) {
    api.CloseHandle(handle)
    throw new Error('Could not configure the command containment job.')
  }
  let closed = false
  return {
    attach(pid) {
      const ownedProcess = api.OpenProcess(0x0101, 0, pid) // SET_QUOTA | TERMINATE
      if (!ownedProcess)
        throw new Error('Could not open the waiting command host.')
      try {
        if (!api.AssignProcessToJobObject(handle, ownedProcess)) {
          throw new Error(
            'Could not contain the command host; execution was refused.',
          )
        }
      } finally {
        api.CloseHandle(ownedProcess)
      }
    },
    terminate: () => !closed && Boolean(api.TerminateJobObject(handle, 1)),
    close() {
      if (closed) return
      closed = true
      api.CloseHandle(handle)
    },
  }
}
