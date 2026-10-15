import path from 'path'

import { fileExists } from '@savant-code/common/util/file'
import { resolveAndContain } from '@savant-code/common/util/paths'
import { redactSecrets } from '@savant-code/common/util/redact'
import { applyPatch } from 'diff'
import z from 'zod/v4'

import { diagnosePatchFailure, filesystemErrorCode } from './patch-diagnostics'
import { resolveFilePath } from './path-utils'
import { logger as defaultLogger } from '../utils/logger'

import type { ResolvedProjectPath } from './path-utils'
import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { JSONValue } from '@savant-code/common/types/json'

export const FileChangeSchema = z.object({
  type: z.enum(['patch', 'file']),
  path: z.string(),
  content: z.string(),
})

type FileChange = z.infer<typeof FileChangeSchema>

type ApplyChangeResult =
  | { status: 'created' | 'modified'; file: string }
  | { status: 'patchFailed'; file: string; diagnosis: string }
  | { status: 'invalid'; file: string; code: string }

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
  /** Per-call diagnostics sink; receives metadata, never the attempted body. */
  logger?: Pick<Logger, 'error'>
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

  const result = await applyChange({
    change: fileChange,
    resolvedPath,
    fs,
    logger: params.logger ?? defaultLogger,
  })

  // Call the onFileWritten callback if provided and the file was successfully written
  if (
    onFileWritten &&
    (result.status === 'created' || result.status === 'modified')
  ) {
    const content =
      fileChange.type === 'file'
        ? fileChange.content
        : await fs
            .readFile(resolvedPath.fullPath, 'utf-8')
            .catch(() => fileChange.content)

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
      errorMessage: `Failed to apply patch.\n${result.diagnosis}`,
    }
  }

  return {
    file: result.file,
    errorMessage:
      'Failed to write to file: file path caused an error or file could not be written\n' +
      `Filesystem code: ${'code' in result ? result.code : 'unknown'}. Check the parent directory and write permissions before retrying.`,
  }
}

async function applyChange(params: {
  change: FileChange
  resolvedPath: ResolvedProjectPath
  fs: SavantCodeFileSystem
  logger: Pick<Logger, 'error'>
}): Promise<ApplyChangeResult> {
  const { change, resolvedPath, fs, logger } = params
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
        return {
          status: 'patchFailed',
          file: relativePath,
          diagnosis: diagnosePatchFailure(oldContent, content),
        }
      }
      await fs.writeFile(fullPath, newContent)
    }

    return { status: exists ? 'modified' : 'created', file: relativePath }
  } catch (error) {
    const code = filesystemErrorCode(error)
    try {
      logger.error(
        {
          file: redactSecrets(relativePath),
          code,
          contentChars: content.length,
        },
        'Failed to apply file change',
      )
    } catch {
      // A failed diagnostic sink cannot erase the filesystem failure result.
    }
    return { status: 'invalid', file: relativePath, code }
  }
}
