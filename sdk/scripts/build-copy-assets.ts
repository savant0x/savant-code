// FID-2026-0819-005 Loop 233: dist asset helpers, extracted verbatim from
// build.ts (over the 300-line ceiling). build() orchestrates these after
// bundling; behavior contract unchanged.

import { cp, mkdir, readFile, writeFile } from 'fs/promises'

import { findMissingVendorBinaries } from './vendor-manifest'

/**
 * Fix duplicate imports in the generated index.d.ts file
 */
export async function fixDuplicateImports() {
  try {
    let content = await readFile('dist/index.d.ts', 'utf-8')

    // Remove any duplicate zod default imports (handle various whitespace)
    const zodDefaultImportRegex = /import\s+z\s+from\s+['"]zod\/v4['"];?\n?/g
    const zodNamedImportRegex =
      /import\s+\{\s*z\s*\}\s+from\s+['"]zod\/v4['"];?/

    // If we have both imports, remove all default imports and keep only the named one
    if (
      content.match(zodNamedImportRegex) &&
      content.match(zodDefaultImportRegex)
    ) {
      content = content.replace(zodDefaultImportRegex, '')
    }

    await writeFile('dist/index.d.ts', content)
    console.log('  ✓ Fixed duplicate imports in bundled types')
  } catch (error) {
    console.warn('  ⚠ Warning: Could not fix duplicate imports:', error.message)
  }
}

/**
 * Copy WASM files from @vscode/tree-sitter-wasm to shared dist/wasm directory
 */
export async function copyWasmFiles() {
  const wasmSourceDir = '../node_modules/@vscode/tree-sitter-wasm/wasm'
  const wasmFiles = [
    'tree-sitter.wasm', // Main tree-sitter WASM file
    'tree-sitter-c-sharp.wasm',
    'tree-sitter-cpp.wasm',
    'tree-sitter-go.wasm',
    'tree-sitter-java.wasm',
    'tree-sitter-javascript.wasm',
    'tree-sitter-python.wasm',
    'tree-sitter-ruby.wasm',
    'tree-sitter-rust.wasm',
    'tree-sitter-tsx.wasm',
    'tree-sitter-typescript.wasm',
  ]

  // Create shared wasm directory
  await mkdir('dist/wasm', { recursive: true })

  // Copy each WASM file to shared directory only
  for (const wasmFile of wasmFiles) {
    try {
      await cp(`${wasmSourceDir}/${wasmFile}`, `dist/wasm/${wasmFile}`)
      console.log(`  ✓ Copied ${wasmFile}`)
    } catch (error) {
      console.warn(`  ⚠ Warning: Could not copy ${wasmFile}:`, error.message)
    }
  }
}

export async function copyRipgrepVendor() {
  const vendorSrc = 'vendor/ripgrep'
  const vendorDest = 'dist/vendor/ripgrep'
  try {
    await mkdir(vendorDest, { recursive: true })
    await cp(vendorSrc, vendorDest, { recursive: true })
  } catch {
    console.warn(
      '  ⚠ No vendored ripgrep found; skipping (use fetch-ripgrep.ts first)',
    )
    return
  }
  // FID-2026-0821-005 B1: dev-build loudness — name exactly which platform
  // binaries are missing instead of a generic success line. The hard
  // fail-closed gate lives in scripts/verify-ripgrep-vendor.ts and runs at
  // prepack only; plain dev builds must never fail here.
  const missing = findMissingVendorBinaries(vendorDest)
  if (missing.length > 0) {
    console.warn('  ⚠ Vendored ripgrep incomplete — missing platforms:')
    for (const entry of missing) {
      console.warn(`     - ${entry}`)
    }
    console.warn('     Remediation: bun run fetch-ripgrep, then rebuild.')
    return
  }
  console.log('  ✓ Copied vendored ripgrep binaries (5/5 platforms)')
}
