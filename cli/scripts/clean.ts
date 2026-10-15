#!/usr/bin/env bun

// FID-2026-0803-011 BH-3: purge cli/bin build artifacts. Everything in bin/
// is generated (see scripts/build-binary.ts + src/pre-init/tree-sitter-wasm.ts)
// and gitignored (root .gitignore + cli/.gitignore), so removal is safe and
// self-healing via `bun run build:binary` / `bun savant-free/cli/build.ts`.

import { rmSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const binDir = join(__dirname, '..', 'bin')

rmSync(binDir, { recursive: true, force: true })
console.log(`Cleaned ${binDir}`)
