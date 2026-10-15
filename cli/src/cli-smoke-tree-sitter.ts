/**
 * CI gate: `<binary> --smoke-tree-sitter` proves the embedded wasm boots
 * through Parser.init end-to-end. Moved verbatim from the CLI entrypoint
 * (FID-2026-0819-005 Loop 133); always terminates the process.
 */
export async function runTreeSitterSmokeCheck(): Promise<void> {
  const wasmBinary = (
    globalThis as { __SAVANT_CODE_TREE_SITTER_WASM_BINARY__?: Uint8Array }
  ).__SAVANT_CODE_TREE_SITTER_WASM_BINARY__
  const wasmPath = (
    globalThis as { __SAVANT_CODE_TREE_SITTER_WASM_PATH__?: string }
  ).__SAVANT_CODE_TREE_SITTER_WASM_PATH__

  // Diagnostic dump so CI logs (and bug reports) show exactly what
  // the runtime saw when smoke fails. process.execPath, the
  // siblingPath we expect, and what's actually in that directory.
  const fs = await import('fs')
  const path = await import('path')
  const execDir = path.dirname(process.execPath)
  const siblingPath = path.join(execDir, 'tree-sitter.wasm')
  let dirListing: string[] = []
  try {
    dirListing = fs.readdirSync(execDir)
  } catch (err) {
    dirListing = [
      `<readdir failed: ${err instanceof Error ? err.message : err}>`,
    ]
  }
  // eslint-disable-next-line no-console -- CLI smoke diagnostic; logger is not yet initialized
  console.error(
    `[smoke diag] execPath=${process.execPath}\n` +
      `[smoke diag] execDir=${execDir}\n` +
      `[smoke diag] siblingPath=${siblingPath}\n` +
      `[smoke diag] siblingExists=${fs.existsSync(siblingPath)}\n` +
      `[smoke diag] dir contents (${dirListing.length}): ${dirListing.slice(0, 30).join(', ')}\n` +
      `[smoke diag] globalThis wasmPath=${wasmPath ?? '<unset>'}\n` +
      `[smoke diag] globalThis wasmBinary bytes=${wasmBinary?.byteLength ?? 0}\n`,
  )

  try {
    const { Parser } = await import('web-tree-sitter')
    // Pick the best wasm source available, falling back to the
    // sibling-of-execPath lookup if pre-init couldn't reach it. By
    // main() time process.execPath has stabilized to the disk path
    // even on Windows, where it was the bunfs path during pre-init.
    let effectiveBinary = wasmBinary
    let effectivePath = wasmPath
    if (!effectiveBinary && !effectivePath && fs.existsSync(siblingPath)) {
      effectivePath = siblingPath
      effectiveBinary = new Uint8Array(fs.readFileSync(siblingPath))
    }

    if (effectiveBinary) {
      await Parser.init({ wasmBinary: effectiveBinary })
      // Marker grepped by cli/scripts/smoke-binary.ts — keep this exact text.
      // eslint-disable-next-line no-console -- CLI smoke success marker; logger is not yet initialized
      console.log(
        `tree-sitter smoke ok (wasmBinary, ${effectiveBinary.byteLength} bytes)`,
      )
    } else if (effectivePath) {
      await Parser.init({
        locateFile: (name: string) =>
          name === 'tree-sitter.wasm' ? effectivePath! : name,
      })
      // eslint-disable-next-line no-console -- CLI smoke success marker; logger is not yet initialized
      console.log(`tree-sitter smoke ok (locateFile, path=${effectivePath})`)
    } else {
      // eslint-disable-next-line no-console -- CLI smoke failure; logger is not yet initialized
      console.error(
        'tree-sitter smoke FAIL: no wasm available — pre-init published ' +
          'nothing and the sibling-of-execPath fallback also missed. See ' +
          'the diag above for paths.',
      )
      process.exit(1)
    }
    process.exit(0)
  } catch (err) {
    // eslint-disable-next-line no-console -- CLI smoke failure; logger is not yet initialized
    console.error('tree-sitter smoke FAIL:', err)
    process.exit(1)
  }
}
