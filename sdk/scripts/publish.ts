#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

function log(message) {
  console.log(`📦 ${message}`)
}

function run(command, options = {}) {
  log(`Running: ${command}`)
  try {
    return execSync(command, { stdio: 'inherit', ...options })
  } catch (error) {
    console.error(`❌ Command failed: ${command}`)
    process.exit(1)
  }
}

function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')

  log('Starting SDK publishing process...')

  // Verify the package
  log('Verifying package contents...')
  run('npm pack --dry-run')

  if (isDryRun) {
    log('Dry run complete! Package is ready for publishing.')
    log('To publish for real, run: bun run release')
    return
  }

  // Publish
  log('Publishing to npm...')
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  run('npm publish')
  log('✅ SDK published successfully!')
  log(`📦 Package: ${packageJson.name}@${packageJson.version}`)
}

const isDirectInvocation =
  import.meta.main ||
  (process.argv[1] !== undefined &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url)

if (isDirectInvocation) {
  main()
}
