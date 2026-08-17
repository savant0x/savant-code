#!/usr/bin/env bun
/**
 * FID-2026-0817-002 B4: count bun test registrations without running them.
 * `bun test` has no `--dry-run`, so this statically counts `test(` / `it(`
 * declarations in the given test files (it does NOT count `describe(` suites).
 *
 * Usage:
 *   bun run scripts/test-count.ts <file...>
 *   bun run scripts/test-count.ts cli/src/state/chat-store/__tests__/sidebar-collapse.test.ts
 */
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: bun run scripts/test-count.ts <file...>')
  process.exit(2)
}

let total = 0
for (const rel of files) {
  const path = resolve(rel)
  if (!existsSync(path)) {
    console.error(`test-count: file not found: ${rel}`)
    process.exit(1)
  }
  const source = readFileSync(path, 'utf8')
  const count = (source.match(/\b(?:test|it)\s*\(/g) ?? []).length
  total += count
  console.log(`${count}\t${rel}`)
}
if (files.length > 1) {
  console.log(`${total}\ttotal`)
}
