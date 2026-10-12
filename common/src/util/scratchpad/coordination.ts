import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { assertPlainPath, isMissing, scratchpadPaths } from './paths'

interface Owner {
  pid: number
  token: string
}

function parseOwner(text: string): Owner {
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object')
    throw new Error('Invalid scratchpad owner')
  const owner = value as Partial<Owner>
  if (
    !Number.isSafeInteger(owner.pid) ||
    (owner.pid ?? 0) <= 0 ||
    typeof owner.token !== 'string' ||
    owner.token.length === 0
  ) {
    throw new Error('Invalid scratchpad owner')
  }
  return owner as Owner
}

function ownerAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM and unknown platform errors are not evidence of a dead owner.
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

async function reclaimDead(file: string): Promise<boolean> {
  if ((await fs.lstat(file)).isSymbolicLink())
    throw new Error('Linked scratchpad owner')
  const bytes = await fs.readFile(file, 'utf8')
  const owner = parseOwner(bytes)
  if (ownerAlive(owner.pid)) return false
  if ((await fs.readFile(file, 'utf8')) !== bytes) return false
  await fs.unlink(file)
  return true
}

/** All sweep/lease mutations take the same bounded cross-process lock. */
export async function withScratchpadLock<T>(
  projectRoot: string,
  operation: (control: string) => Promise<T>,
): Promise<T> {
  const { project, control } = scratchpadPaths(projectRoot)
  if (!(await fs.lstat(project)).isDirectory())
    throw new Error('Scratchpad project is not a directory')
  await assertPlainPath(project, control)
  await fs.mkdir(control, { recursive: true })
  await assertPlainPath(project, control)
  const lock = path.join(control, 'lock.json')
  const owner = JSON.stringify({ pid: process.pid, token: randomUUID() })
  await acquireLock(lock, owner)
  try {
    return await operation(control)
  } finally {
    if ((await fs.readFile(lock, 'utf8')) === owner) await fs.unlink(lock)
  }
}

async function acquireLock(lock: string, owner: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await fs.writeFile(lock, owner, { flag: 'wx' })
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      try {
        if (await reclaimDead(lock)) continue
      } catch (error) {
        if (isMissing(error)) continue
        // An owner may still be writing the exclusive file. Never steal it.
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 25))
    }
  }
  throw new Error('Scratchpad housekeeping busy or lock owner unverified')
}

export async function hasLiveScratchpadLease(
  control: string,
): Promise<boolean> {
  let live = false
  for (const name of await fs.readdir(control)) {
    if (!name.endsWith('.lease.json')) continue
    const file = path.join(control, name)
    if ((await fs.lstat(file)).isSymbolicLink()) {
      throw new Error('Linked scratchpad lease')
    }
    if (!(await reclaimDead(file))) live = true
  }
  return live
}

export async function acquireScratchpadLease(
  projectRoot: string,
): Promise<() => Promise<void>> {
  const token = randomUUID()
  const file = await withScratchpadLock(projectRoot, async (control) => {
    const file = path.join(control, `${token}.lease.json`)
    await fs.writeFile(file, JSON.stringify({ pid: process.pid, token }), {
      flag: 'wx',
    })
    return file
  })
  return async () => {
    await withScratchpadLock(projectRoot, async () => {
      try {
        const owner = parseOwner(await fs.readFile(file, 'utf8'))
        if (owner.token === token && owner.pid === process.pid)
          await fs.unlink(file)
      } catch (error) {
        if (!isMissing(error)) throw error
      }
    })
  }
}
