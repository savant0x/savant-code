import path from 'path'

import { fileExists } from '@savant-code/common/util/file'
import { resolveAndContain } from '@savant-code/common/util/paths'
import { applyPatch } from 'diff'
import z from 'zod/v4'

import { resolveFilePath } from './path-utils'
import { logger } from '../utils/logger'

import type { ResolvedProjectPath } from './path-utils'
import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { JSONValue } from '@savant-code/common/types/json'

const FileChangeSchema = z.object({
  type: z.enum(['patch', 'file']),
  path: z.string(),
  content: z.string(),
})

type FileChange = z.infer<typeof FileChangeSchema>

type ApplyChangeResult =
  | { status: 'created' | 'modified'; file: string }
  | { status: 'patchFailed'; file: string; patch: string }
  | { status: 'invalid'; file: string }

export type OnFileWrittenCallback = (params: {
  path: string
  content: string
  type: 'created' | 'modified'
}) => void | Promise<void>

export async function changeFile(params: {
  parameters: Record<string, JSONValue>
  cwd: string
  fs: SavantCodeFileSystem
  onFileWritten?: OnFileWrittenCallback
  /** FID-2026-0718-014 v2: injectable for testability. Default = node:fs.realpathSync.native. */
  realpathFn?: (p: string) => string
}): Promise<SavantCodeToolOutput<'str_replace'>> {
  const { parameters, cwd, fs, onFileWritten, realpathFn } = params

  const fileChange = FileChangeSchema.parse(parameters)
  const resolvedPath = resolveFilePath(cwd, fileChange.path)

  // FID-2026-0718-014 v2: defense-in-depth at SDK boundary. Per v2 corrected
  // architecture, this is where the actual fs.writeFile happens (the CLI is
  // a frontend; the SDK does the FS ops). Closes the TOCTOU window between
  // agent-runtime's gate check and the real fs op here.
  const pathCheck = resolveAndContain(resolvedPath.fullPath, {
    projectRoot: cwd,
    realpathFn,
  })
  if (pathCheck.kind === 'reject') {
    return [
      {
        type: 'json' as const,
        value: {
          file: fileChange.path,
          errorMessage: `change-file: ${pathCheck.reason}`,
        },
      },
    ]
  }

  const result = await applyChange({ change: fileChange, resolvedPath, fs })

  // Call the onFileWritten callback if provided and the file was successfully written
  if (onFileWritten && (result.status === 'created' || result.status === 'modified')) {
    const content = fileChange.type === 'file' 
      ? fileChange.content 
      : await fs.readFile(resolvedPath.fullPath, 'utf-8').catch(() => fileChange.content)
    
    await onFileWritten({
      path: fileChange.path,
      content,
      type: result.status,
    })
  }

  return [{ type: 'json', value: formatApplyChangeResult(result, fileChange) }]
}

function formatApplyChangeResult(
  result: ApplyChangeResult,
  fileChange: FileChange,
): SavantCodeToolOutput<'str_replace'>[0]['value'] {
  if (result.status === 'created' || result.status === 'modified') {
    return {
      file: result.file,
      message:
        fileChange.type === 'patch'
          ? 'String replace applied successfully.'
          : result.status === 'created'
            ? 'Created file successfully.'
            : 'Overwrote file successfully.',
    }
  }

  if (result.status === 'patchFailed') {
    return {
      file: result.file,
      errorMessage: `Failed to apply patch.`,
      patch: result.patch,
    }
  }

  return {
    file: result.file,
    errorMessage:
      'Failed to write to file: file path caused an error or file could not be written',
  }
}

async function applyChange(params: {
  change: FileChange
  resolvedPath: ResolvedProjectPath
  fs: SavantCodeFileSystem
}): Promise<ApplyChangeResult> {
  const { change, resolvedPath, fs } = params
  const { content, type } = change
  const { fullPath, relativePath } = resolvedPath

  try {
    const exists = await fileExists({ filePath: fullPath, fs })
    if (!exists) {
      const dirPath = path.dirname(fullPath)
      await fs.mkdir(dirPath, { recursive: true })
    }

    if (type === 'file') {
      await fs.writeFile(fullPath, content)
    } else {
      const oldContent = await fs.readFile(fullPath, 'utf-8')
      const newContent = applyPatch(oldContent, content)
      if (newContent === false) {
        return { status: 'patchFailed', file: relativePath, patch: content }
      }
      await fs.writeFile(fullPath, newContent)
    }

    return { status: exists ? 'modified' : 'created', file: relativePath }
  } catch (error) {
    logger.error(`Failed to apply patch to ${relativePath}:`, error, content)
    return { status: 'invalid', file: relativePath }
  }
}
