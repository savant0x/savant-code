import { readFile, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { parsePatch, applyPatch } from 'diff'
import type { Sandbox } from './sandbox'

export class GoldenPatchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'GoldenPatchError'
  }
}

/**
 * Read a unified-diff golden patch file and apply it to the sandbox.
 *
 * The patch file must be a standard unified diff. This function applies each
 * file hunk using the `diff` package, so it works on Windows without the
 * native `patch` utility.
 */
export async function applyGoldenPatch(
  sandbox: Sandbox,
  patchPath: string,
): Promise<void> {
  const patchText = await readFile(patchPath, 'utf-8')
  return applyGoldenPatchText(sandbox, patchText)
}

/**
 * Apply a unified-diff string directly. Exported for testing.
 */
export async function applyGoldenPatchText(
  sandbox: Sandbox,
  patchText: string,
): Promise<void> {
  const patches = parsePatch(patchText)
  const workingDir = sandbox.getWorkingDir()

  for (const patch of patches) {
    const fileName = patch.newFileName ?? patch.oldFileName
    if (!fileName) {
      throw new GoldenPatchError('Patch missing old and new file name.')
    }

    // Handle file deletions: newFileName is '/dev/null'.
    if (patch.newFileName === '/dev/null' && patch.oldFileName) {
      const absolutePath = path.isAbsolute(patch.oldFileName)
        ? patch.oldFileName
        : path.join(workingDir, patch.oldFileName)
      await unlink(absolutePath).catch(() => {})
      continue
    }

    const absolutePath = path.isAbsolute(fileName)
      ? fileName
      : path.join(workingDir, fileName)

    const source = await readFile(absolutePath, 'utf-8').catch(() => '')
    const patched = applyPatch(source, patch)

    if (typeof patched !== 'string') {
      throw new GoldenPatchError(
        `Failed to apply golden patch to ${fileName}. The file content did not match the expected pre-image.`,
      )
    }

    await writeFile(absolutePath, patched, 'utf-8')
  }
}
