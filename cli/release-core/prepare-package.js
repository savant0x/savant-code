#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const packageDir = process.cwd()
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'),
)
const supportedPackages = new Set([
  'savant-code',
  'savant-code-staging',
  'savant-free',
])

if (!supportedPackages.has(packageJson.name)) {
  throw new Error(
    `Refusing to prepare unexpected release package: ${packageJson.name}`,
  )
}

const generatedFiles = ['launcher.js', 'http.js']
const designSystemsSource = path.resolve(
  __dirname,
  '..',
  '..',
  '.agents',
  'skills',
  'savant-design-systems',
)
const designSystemsDestination = path.join(packageDir, 'savant-design-systems')

for (const fileName of generatedFiles) {
  const destinationPath = path.join(packageDir, fileName)
  if (process.argv.includes('--clean')) {
    fs.rmSync(destinationPath, { force: true })
  } else {
    fs.copyFileSync(path.join(__dirname, fileName), destinationPath)
  }
}

if (process.argv.includes('--clean')) {
  fs.rmSync(designSystemsDestination, { recursive: true, force: true })
} else {
  if (!fs.existsSync(designSystemsSource)) {
    throw new Error(
      `Missing design-system skill source: ${designSystemsSource}`,
    )
  }
  fs.cpSync(designSystemsSource, designSystemsDestination, { recursive: true })
}
