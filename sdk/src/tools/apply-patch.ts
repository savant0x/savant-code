/**
 * apply_patch tool entry (FID-2026-0805-003). Parser/diff/result helpers
 * moved to apply-patch/{types,parser,diff,result}.ts; this file keeps the
 * public `applyPatchTool` at the original path.
 */

import path from 'path'

import { applyPatchOperationSchema } from '@savant-code/common/tools/params/tool/apply-patch'
import { resolveAndContain } from '@savant-code/common/util/paths'

import {
  applyDiff,
  preserveOriginalLineEndings,
  tryApplyPatchWithFallbacks,
  formatPatchFailureMessage,
} from './apply-patch/diff'
import { sanitizeUnifiedDiff } from './apply-patch/parser'
import { successResult, errorResult } from './apply-patch/result'
import { diagnosePatchFailure, safePatchError } from './patch-diagnostics'
import { resolveFilePath } from './path-utils'

import type { OnFileWrittenCallback } from './change-file'
import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { JSONValue } from '@savant-code/common/types/json'

type ApplyPatchResult = SavantCodeToolOutput<'apply_patch'>

export async function applyPatchTool(params: {
  parameters: Record<string, JSONValue>
  cwd: string
  fs: SavantCodeFileSystem
  onFileWritten?: OnFileWrittenCallback
  /** FID-2026-0718-014 v2: injectable for testability. Default = node:fs.realpathSync.native. */
  realpathFn?: (p: string) => string
}): Promise<ApplyPatchResult> {
  const { parameters, cwd, fs, onFileWritten, realpathFn } = params
  const operationParse = applyPatchOperationSchema.safeParse(
    parameters.operation,
  )

  if (!operationParse.success) {
    return [errorResult('Missing or invalid operation object.')]
  }

  const operation = operationParse.data

  try {
    const { fullPath } = resolveFilePath(cwd, operation.path)

    // FID-2026-0718-014 v2: defense-in-depth at SDK boundary. Per v2 corrected
    // architecture, this is where the actual fs.writeFile / fs.unlink happens.
    // Closes the TOCTOU window between agent-runtime's gate and the real FS op.
    const pathCheck = resolveAndContain(fullPath, {
      projectRoot: cwd,
      realpathFn,
    })
    if (pathCheck.kind === 'reject') {
      return [errorResult(`apply_patch: ${pathCheck.reason}`)]
    }

    if (operation.type === 'create_file') {
      const sanitizedDiff = sanitizeUnifiedDiff(operation.diff)
      const { result: content } = applyDiff('', sanitizedDiff, 'create')

      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, content)

      // Call the onFileWritten callback if provided
      if (onFileWritten) {
        await onFileWritten({
          path: operation.path,
          content,
          type: 'created',
        })
      }

      return [successResult(operation.path, 'add')]
    }

    if (operation.type === 'delete_file') {
      await fs.unlink(fullPath)
      return [successResult(operation.path, 'delete')]
    }

    const sanitizedDiff = sanitizeUnifiedDiff(operation.diff)
    const oldContent = await fs.readFile(fullPath, 'utf-8')
    const patchResult = tryApplyPatchWithFallbacks({
      oldContent,
      diff: sanitizedDiff,
    })

    if (patchResult.patched === null) {
      return [
        errorResult(
          formatPatchFailureMessage({
            path: operation.path,
            attemptedStrategies: patchResult.attemptedStrategies,
            lastError: patchResult.lastError,
            diagnosis: diagnosePatchFailure(oldContent, sanitizedDiff),
          }),
        ),
      ]
    }

    const patchedContent = preserveOriginalLineEndings({
      original: oldContent,
      patched: patchResult.patched,
    })
    await fs.writeFile(fullPath, patchedContent)

    // Call the onFileWritten callback if provided
    if (onFileWritten) {
      await onFileWritten({
        path: operation.path,
        content: patchedContent,
        type: 'modified',
      })
    }

    return [successResult(operation.path, 'update')]
  } catch (error) {
    return [errorResult(safePatchError(error))]
  }
}
