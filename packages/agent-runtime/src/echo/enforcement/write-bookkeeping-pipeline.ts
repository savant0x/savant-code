import { getTargetPath, isWriteTool } from './helpers'
import {
  classifyFileKind,
  hasWiringDeclaration,
} from '../../util/echo-compliance-core'

import type { MutationClassification } from './helpers'
import type { EnforcementState } from '../types'

/**
 * Post-tool mutation and write bookkeeping for `afterToolCallImpl`
 * (extracted from `tool-pipeline.ts` under FID-2026-1013-010 for the 300-line ceiling).
 */
export function recordAfterToolMutationBookkeeping(params: {
  state: EnforcementState
  toolName: string
  input: Record<string, unknown>
  mutation: MutationClassification | null
  writtenContent?: string
  writeSucceeded?: boolean
  commandSucceeded?: boolean
}): void {
  const {
    state,
    toolName,
    input,
    mutation,
    writtenContent,
    writeSucceeded,
    commandSucceeded,
  } = params

  // FID-2026-1001-003 step 1 (consume): a mutating terminal call's targets
  // join the tracking sets exactly as a write tool's would — Law 15's batch
  // predicate and step 2's reconciliation now see the bypass.
  if (
    mutation?.mutates &&
    !isWriteTool(toolName) &&
    commandSucceeded !== false
  ) {
    for (const target of mutation.targets) {
      state.filesWritten.add(target)
      state.dirtyFiles.add(target)
      state.verifiedFiles.delete(target)
      state.hasVerifiedSinceLastDirty = false
      state.writeCount++
    }
    if (mutation.targets.length > 0) {
      state.writtenFileContent.delete(mutation.targets[0])
    }
  }

  // Record only successful writes. The exact post-write payload is kept in a
  // bounded per-path ledger so turn-end scanners never reread unrelated disk
  // changes and can distinguish an empty file from unavailable content.
  if (isWriteTool(toolName)) {
    const path = getTargetPath(input)
    if (path && writeSucceeded !== false) {
      state.filesWritten.add(path)
      state.dirtyFiles.add(path)
      state.verifiedFiles.delete(path)
      state.hasVerifiedSinceLastDirty = false
      state.writeCount++

      if (writtenContent !== undefined) {
        state.writtenFileContent.set(path, writtenContent)
      } else {
        state.writtenFileContent.delete(path)
      }

      const content =
        writtenContent ??
        (input.content as string) ??
        (input.newString as string) ??
        ''
      if (classifyFileKind(path) === 'code' && hasWiringDeclaration(content)) {
        state.featuresWired.add(path)
      }
    }
  }
}
