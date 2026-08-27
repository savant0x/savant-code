#!/usr/bin/env bun

/**
 * Fail-closed vendored-ripgrep manifest gate (FID-2026-0821-005 B1).
 *
 * Runs as part of sdk `prepack`: a published tarball missing any platform
 * binary is a shipped defect, so packing FAILS CLOSED here. Plain dev
 * builds must NOT route through this gate — they warn-and-skip inside
 * scripts/build.ts instead. This script never touches the network.
 */
import { join } from 'path'

import { findMissingVendorBinaries } from './vendor-manifest'

const vendorBaseDir = join('dist', 'vendor', 'ripgrep')
const missing = findMissingVendorBinaries(vendorBaseDir)

if (missing.length > 0) {
  console.error(
    `❌ Vendored ripgrep manifest INCOMPLETE (${5 - missing.length}/5` +
      ` platforms present under ${vendorBaseDir}):`,
  )
  for (const entry of missing) {
    console.error(`   - ${entry}`)
  }
  console.error(
    'Remediation: bun run fetch-ripgrep && bun run build, then repack.',
  )
  process.exit(1)
}

console.log(
  `✅ Vendored ripgrep manifest complete (5/5 platforms in ${vendorBaseDir})`,
)
