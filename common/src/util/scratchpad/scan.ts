import { promises as fs } from 'node:fs'
import path from 'node:path'

import { assertPlainPath, isMissing } from './paths'

export interface ScratchFile {
  file: string
  size: number
  mtimeMs: number
  ino: number
  dev: number
}

export async function scanScratchpad(
  project: string,
  scratch: string,
  limit: number,
) {
  const files: ScratchFile[] = []
  const directories: string[] = []
  const pending = [scratch]
  let entries = 0
  let skippedLinks = 0
  let complete = true
  while (pending.length > 0 && complete) {
    const directory = pending.pop() as string
    await assertPlainPath(project, directory)
    try {
      const handle = await fs.opendir(directory)
      for await (const entry of handle) {
        if (++entries > limit) {
          complete = false
          break
        }
        const file = path.join(directory, entry.name)
        const stat = await fs.lstat(file)
        if (stat.isSymbolicLink()) {
          skippedLinks++
          continue
        }
        if (stat.isDirectory()) {
          pending.push(file)
          directories.push(file)
          continue
        }
        if (!stat.isFile()) continue
        if (
          directory === scratch &&
          ['README.md', '.gitkeep'].includes(entry.name)
        )
          continue
        files.push({
          file,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          ino: stat.ino,
          dev: stat.dev,
        })
      }
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  return { files, directories, skippedLinks, complete }
}

export async function deleteUnchanged(
  project: string,
  file: ScratchFile,
): Promise<boolean> {
  await assertPlainPath(project, file.file)
  try {
    const stat = await fs.lstat(file.file)
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size !== file.size ||
      stat.mtimeMs !== file.mtimeMs ||
      stat.ino !== file.ino ||
      stat.dev !== file.dev
    )
      return false
    await fs.unlink(file.file)
    return true
  } catch (error) {
    if (!isMissing(error)) throw error
    return false
  }
}

export async function removeEmptyDirectories(
  project: string,
  directories: string[],
): Promise<void> {
  for (const directory of directories.sort((a, b) => b.length - a.length)) {
    await assertPlainPath(project, directory)
    try {
      await fs.rmdir(directory)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(code ?? '')) throw error
    }
  }
}
